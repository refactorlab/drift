use crate::progress::{NullProgress, Progress};
use crate::Language;
use ignore::WalkBuilder;
use std::path::{Path, PathBuf};

/// Always-skip directories. Applied regardless of `.gitignore` contents because
/// they're universal noise across languages and dramatically reduce wall time
/// even when a project's `.gitignore` is missing or sloppy.
///
/// Source: cross-referenced GitHub's default `gitignore` templates
/// (github.com/github/gitignore) for Node, Python, Java, Maven, Gradle, Rust,
/// Go, plus common framework conventions.
///
/// Contract: every name in this list represents code that is **never** the
/// user's source — package caches, build output, editor metadata. If a name
/// belongs here it must NEVER hold project source code by any convention.
/// Names that are "usually" asset/non-source live in
/// [`STATIC_ASSET_DIRS`] instead and are toggleable.
pub const DEFAULT_IGNORE_DIRS: &[&str] = &[
    // VCS metadata
    ".git", ".hg", ".svn",
    // JS / TS dependencies & build output
    "node_modules", "bower_components", "vendor",
    "dist", ".next", ".nuxt", "out", ".cache", ".turbo",
    "coverage", ".nyc_output",
    // Python venvs & caches
    "__pycache__", ".venv", "venv", "env",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox", ".nox",
    "site-packages",
    // JVM build dirs
    "target", "build", ".gradle",
    // Rust / Go (target also covered)
    // Editor / OS
    ".idea", ".vscode", ".DS_Store",
];

/// "Probably-not-source" directories. On by default but **togglable** via
/// [`WalkOpts::exclude_static_assets`].
///
/// Why this is separate from [`DEFAULT_IGNORE_DIRS`]:
///   - These names *can* legitimately hold source. A Django app's
///     `static/` may also contain hand-written admin JavaScript; a Vue
///     project's `public/` is usually plain HTML but a team may put
///     small scripts there. Marking these "always skip" would silently
///     hide real code on some projects.
///   - The motivating signal is huge minified bundles (`swagger-ui-
///     bundle.js`, vendored `app.min.js`, copied SDK builds). When the
///     analyzer parses these, they dominate the top entries with reach
///     counts in the thousands and bury the user's actual code.
///   - Default ON because the noise case is the common one; advanced
///     users can disable from the desktop Settings UI when they really
///     are trying to inspect a static-asset payload.
pub const STATIC_ASSET_DIRS: &[&str] = &["static", "assets"];

/// Options that control which paths the walker emits.
#[derive(Debug, Clone)]
pub struct WalkOpts {
    /// Read `.gitignore`, `.git/info/exclude`, and the global git excludes
    /// file. Applied EVEN WHEN there is no `.git` directory at the root —
    /// the `ignore` crate's default behavior of "no gitignore outside a git
    /// repo" is unhelpful for our static analysis use case.
    pub respect_gitignore: bool,
    /// Read `.driftignore` files (same syntax as `.gitignore`).
    pub respect_driftignore: bool,
    /// Apply [`DEFAULT_IGNORE_DIRS`] as a hard fallback regardless of any
    /// user-provided ignore files.
    pub apply_defaults: bool,
    /// Skip hidden files / dirs (anything starting with `.`).
    pub skip_hidden: bool,
    /// Skip test/spec/mock files and the test-segment directories that
    /// hold them. Off by default — the scan walks tests. When on, both
    /// path segments AND filename conventions are filtered:
    ///
    /// - directories: case-insensitive `test`/`tests`/`__tests__`/
    ///   `spec`/`specs`/`__mocks__`/`testdata` (so `/Test/` matches too)
    /// - filenames: dot-separated (`*.test.ts`, `*.spec.js`,
    ///   `*.mock.ts`), underscore-separated (`test_*.py`, `*_test.py`,
    ///   `*_test.go`), dash-separated (`test-*`, `*-test`, `*-test-*`),
    ///   PascalCase prefix (`Test<UPPER>...`), PascalCase suffix
    ///   (`*Test`, `*Tests`, `*Spec`, `*Specs` across any extension).
    ///
    /// See [`is_test_path`] for the full rule; boundary handling avoids
    /// false positives like `testimony.ts`, `contest.py`, `Tester.java`.
    pub exclude_tests: bool,
    /// Skip directories named in [`STATIC_ASSET_DIRS`] (currently `static`,
    /// `assets`). **Defaults to true** — vendored asset directories on real
    /// projects (e.g. Django `static/`, FastAPI `static/`, generic
    /// `assets/swagger-ui-bundle.js`) routinely contain minified JS that
    /// otherwise dominates the entry-point picker with synthetic
    /// "functions" named `Gk`, `Ek`, etc. Settable to `false` for projects
    /// where these directories legitimately contain hand-written source.
    pub exclude_static_assets: bool,
}

impl Default for WalkOpts {
    fn default() -> Self {
        Self {
            respect_gitignore: true,
            respect_driftignore: true,
            apply_defaults: true,
            skip_hidden: true,
            exclude_tests: false,
            exclude_static_assets: true,
        }
    }
}

/// Test-file recognition shared by walker filtering AND roots discovery
/// so the definition of "test code" stays consistent across the two
/// stages. Returns true for paths that are either:
///
/// - inside a test/spec subdirectory — case-insensitive: `test`,
///   `tests`, `Test`, `TEST`, `__tests__`, `spec`, `specs`,
///   `__mocks__`, `testdata` all qualify, OR
/// - have a test-shaped filename per any of these conventions
///   (see [`is_test_filename`] for the full grammar):
///   - JS/TS/JS — `foo.test.ts`, `foo.spec.ts`, `foo.mock.ts`,
///     `test-foo.ts`, `foo-test.ts`, `foo-test-bar.ts`
///   - Python — `test_foo.py`, `foo_test.py`
///   - Go — `foo_test.go`
///   - Java/Kotlin — `FooTest.java`, `FooTests.kt`, `TestFoo.java`
///   - Scala — `FooSpec.scala`, `FooSpecs.scala`
///   - Generic — any stem that starts with `test` (followed by
///     `_`/`-`/`.`/PascalCase) or ends with `test` (preceded by
///     `_`/`-`/`.`/PascalCase).
///
/// Boundary rule (matters for the "contains test" cases): we never match
/// "test" embedded in another word — `testimony.ts`, `contesting.ts`,
/// `tester.java`, `protest.py` are NOT test files. The substring rule
/// only fires when `test` is bounded by start/end-of-stem or by a
/// non-alphanumeric character.
///
/// `root` is used to strip the project-root prefix BEFORE checking path
/// segments, so a project rooted at e.g. `tests/fixtures/foo/` is not
/// itself misidentified as test code — only test directories *inside*
/// the analyzed root count.
pub fn is_test_path(path: &Path, root: &Path) -> bool {
    if has_test_directory_segment(path, root) {
        return true;
    }
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    is_test_filename(name)
}

/// True iff any path segment between `root` (exclusive) and the
/// filename (also exclusive) is a recognized test bucket. Case-insensitive.
/// The filename itself is checked separately by [`is_test_filename`].
fn has_test_directory_segment(path: &Path, root: &Path) -> bool {
    let rel = path.strip_prefix(root).unwrap_or(path);
    let total = rel.components().count();
    // Skip the last component — that's the filename. Without this skip
    // a file named `test.py` at the project root would match via the
    // segment rule, hiding bugs in the filename rule (we want only one
    // pass to handle filenames).
    rel.components().take(total.saturating_sub(1)).any(|c| {
        let s = c.as_os_str().to_string_lossy().to_ascii_lowercase();
        matches!(
            s.as_str(),
            "test"
                | "tests"
                | "__tests__"
                | "spec"
                | "specs"
                | "__mocks__"
                | "testdata",
        )
    })
}

/// Decide whether a bare filename (no directory) names a test file.
///
/// Three orthogonal rules, in order; any one of them firing is enough:
///   1. **PascalCase prefix** — `Test<UPPER>...` (case-sensitive). Catches
///      `TestService.java`, `TestRepositoryImpl.kt`. Does NOT match
///      `Tester.java` (lowercase `e` after `Test`) or `Testing.java`.
///   2. **PascalCase suffix** — `<lower>Test`, `<lower>Tests`, `<lower>Spec`,
///      `<lower>Specs` at the end of the stem. The lowercase-before
///      boundary is what makes `MyTest.java` match but `attest.java`
///      not. Plain `Test.java` / `Tests.kt` / `Spec.scala` also match
///      (empty prefix). Language-agnostic — works for `.java`, `.kt`,
///      `.cs`, `.rs`, anything.
///   3. **Boundary-respecting `test` / `spec` / `mock` substring**
///      (case-insensitive). The needle must sit between non-alphanumeric
///      separators (`-`, `_`, `.`) or at start/end of the stem. Catches
///      every shape the user listed: `test_foo`, `foo_test`,
///      `test-foo`, `foo-test`, `foo-test-bar`, `foo.test.ts`,
///      `e2e.test.ts`. Rejects `testimony`, `contesting`, `tester`.
pub fn is_test_filename(name: &str) -> bool {
    // Use the part before the final extension as the "stem". `foo.test.ts`
    // → stem `foo.test`; `MyTest.java` → `MyTest`; `test.py` → `test`.
    // We only strip ONE extension because compound conventions like
    // `foo.test.ts` rely on the inner `.test.` surviving the strip.
    let stem = name.rsplit_once('.').map(|(s, _)| s).unwrap_or(name);

    // Rule 1 — PascalCase prefix `Test<UPPER>...`
    if let Some(rest) = stem.strip_prefix("Test") {
        if rest
            .chars()
            .next()
            .map(|c| c.is_ascii_uppercase())
            .unwrap_or(false)
        {
            return true;
        }
    }

    // Rule 2 — PascalCase suffix `Test`/`Tests`/`Spec`/`Specs`.
    // The prefix must be empty OR end with a lowercase letter, so the
    // suffix sits on a PascalCase boundary (`MyTest` ✓, `attest` ✗).
    for suf in ["Tests", "Specs", "Test", "Spec"] {
        if let Some(prefix) = stem.strip_suffix(suf) {
            if prefix.is_empty()
                || prefix
                    .chars()
                    .next_back()
                    .map(|c| c.is_ascii_lowercase())
                    .unwrap_or(false)
            {
                return true;
            }
        }
    }

    // Rule 3 — separator-bounded `test`/`spec`/`mock` substring.
    // We run this on the FULL filename (not just the stem) so trailing
    // extensions still count as separators — `foo.test.ts` matches
    // because the `.` after `test` is a non-alnum boundary.
    let lower = name.to_ascii_lowercase();
    for needle in ["test", "spec", "mock"] {
        if has_separator_bounded_substring(&lower, needle) {
            return true;
        }
    }

    false
}

/// True iff `haystack` contains `needle` bounded by non-alphanumeric
/// characters (or start / end of string). ASCII-only — fine for our
/// case because the needles are pure ASCII keywords.
///
/// Examples for needle="test":
///   - "test"          → match (both ends are string boundary)
///   - "test_foo"      → match (`_` is non-alnum after)
///   - "foo-test"      → match (`-` non-alnum before, end after)
///   - "foo-test-bar"  → match
///   - "foo.test.ts"   → match (`.` non-alnum on both sides)
///   - "testimony"     → NO match (alnum `i` after)
///   - "contesting"    → NO match (alnum `n` before)
///   - "tester"        → NO match (alnum `e` after)
fn has_separator_bounded_substring(haystack: &str, needle: &str) -> bool {
    debug_assert!(needle.is_ascii());
    debug_assert!(needle.bytes().all(|b| b.is_ascii_lowercase()));
    let bytes = haystack.as_bytes();
    let n = needle.len();
    for (i, _) in haystack.match_indices(needle) {
        let before_ok = i == 0 || !bytes[i - 1].is_ascii_alphanumeric();
        let after_ok = i + n == bytes.len() || !bytes[i + n].is_ascii_alphanumeric();
        if before_ok && after_ok {
            return true;
        }
    }
    false
}

/// Convenience wrapper using sensible defaults. Used by the CLI.
pub fn discover_source_files(root: &Path) -> Vec<(PathBuf, Language)> {
    discover_source_files_with(root, &WalkOpts::default())
}

pub fn discover_source_files_with(root: &Path, opts: &WalkOpts) -> Vec<(PathBuf, Language)> {
    walk_files_with(root, opts)
        .into_iter()
        .filter_map(|(p, _)| Language::from_path(&p).map(|l| (p, l)))
        .collect()
}

/// Walk every file under `root` honoring the same ignore semantics as
/// [`discover_source_files_with`], but WITHOUT filtering by language. Returns
/// `(path, byte_len)` per file.
///
/// Thin wrapper over [`walk_files_classified_with`] that drops the
/// classification columns. Kept for backward compatibility with library
/// consumers and the linguist's standalone `compute_language_stats`
/// path. New orchestration code (api.rs) should call the classified
/// variant directly so the linguist breakdown and source-discovery
/// share a single filesystem walk.
pub fn walk_files_with(root: &Path, opts: &WalkOpts) -> Vec<(PathBuf, u64)> {
    walk_files_classified_with(root, opts, &NullProgress)
        .into_iter()
        .map(|f| (f.path, f.size))
        .collect()
}

/// One entry per file the walker emits, pre-classified with linguist
/// metadata so downstream consumers don't need a second walk to
/// recover the language tag.
///
/// Fields are pub(crate): the type is an internal coordination shape
/// between `walker`, `linguist`, and `api`; library consumers stay on
/// the simpler `Vec<(PathBuf, Language)>` / `Vec<(PathBuf, u64)>` APIs.
#[derive(Debug, Clone)]
pub struct ClassifiedFile {
    pub path: PathBuf,
    pub size: u64,
    /// Linguist-style display name (e.g. "Python", "TypeScript",
    /// "Kotlin"). `None` for files that don't match any known
    /// extension/filename — those still appear in the walk output so
    /// callers can decide how to treat them, but they don't contribute
    /// to the language bar.
    pub(crate) lang_name: Option<&'static str>,
    /// Linguist bucket — only `Programming` files contribute to the
    /// language percentage denominator. `None` mirrors `lang_name`.
    pub(crate) lang_kind: Option<crate::linguist::LangKind>,
    /// Drift's tree-sitter parser variant for this file. Populated only
    /// for files we can actually profile; `None` means the file is
    /// counted in the linguist bar (if it's a known programming language)
    /// but skipped by source discovery.
    pub language: Option<Language>,
}

/// One-pass walk that classifies each file as it's discovered.
///
/// Replaces the legacy two-walk pattern in the orchestrator: the old
/// `compute_language_stats` and `discover_source_files_with` each
/// traversed the filesystem independently — for a large monorepo,
/// that's twice the inode reads and twice the gitignore evaluation.
/// This variant yields all the data both phases need in a single
/// pass, and emits `Progress::walk_progress` checkpoints so the CLI
/// can show "scanning… N files" while it runs.
///
/// Progress checkpoint cadence: every 256 files. Fine-grained enough
/// to feel responsive on slow filesystems, coarse enough that the
/// callback overhead is irrelevant.
pub fn walk_files_classified_with(
    root: &Path,
    opts: &WalkOpts,
    progress: &dyn Progress,
) -> Vec<ClassifiedFile> {
    let mut wb = WalkBuilder::new(root);

    // `standard_filters(true)` is a shortcut that enables:
    //   hidden(true), parents(true), ignore(true),
    //   git_ignore(true), git_global(true), git_exclude(true).
    // We override below where needed.
    wb.standard_filters(true)
        .hidden(opts.skip_hidden)
        .parents(true)
        // CRITICAL: by default, the ignore crate only consults .gitignore when
        // the walked directory sits inside a real git repo. For our purposes
        // (analyzing arbitrary checkouts) we want gitignore semantics to apply
        // always.
        .require_git(false);

    if !opts.respect_gitignore {
        wb.git_ignore(false).git_global(false).git_exclude(false);
    }
    if opts.respect_driftignore {
        wb.add_custom_ignore_filename(".driftignore");
    }

    progress.walk_start();
    let mut out: Vec<ClassifiedFile> = Vec::new();
    let mut total_bytes: u64 = 0;
    for entry in wb.build().flatten() {
        if !entry.file_type().is_some_and(|t| t.is_file()) {
            continue;
        }
        let path = entry.path();
        if opts.apply_defaults && hits_default_ignore(path) {
            continue;
        }
        if opts.exclude_static_assets && hits_static_asset_ignore(path) {
            continue;
        }
        if opts.exclude_tests && is_test_path(path, root) {
            continue;
        }
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        // Single dispatch: `classify` already maps the extension to
        // both the linguist name+kind AND the supported `Language` (when
        // we ship a parser for it). Reading `info.supported` here
        // instead of calling `Language::from_path` avoids duplicating
        // the extension→language match in two places.
        let info = crate::linguist::classify(path);
        out.push(ClassifiedFile {
            path: path.to_path_buf(),
            size,
            lang_name: info.map(|i| i.name),
            lang_kind: info.map(|i| i.kind),
            language: info.and_then(|i| i.supported),
        });
        total_bytes += size;
        // Throttled progress: 256-file granularity. Walker is single-
        // threaded today (`ignore::Walk` rather than `WalkParallel`),
        // so this is the only hot loop pushing walk_progress events.
        if out.len() & 0xFF == 0 {
            progress.walk_progress(out.len());
        }
    }
    progress.walk_end(out.len(), total_bytes);
    out
}

fn hits_default_ignore(path: &Path) -> bool {
    path.components().any(|c| {
        c.as_os_str()
            .to_str()
            .map(|s| DEFAULT_IGNORE_DIRS.contains(&s))
            .unwrap_or(false)
    })
}

/// True iff any component of `path` matches one of [`STATIC_ASSET_DIRS`]
/// (case-sensitive — every convention this targets uses lowercase). We match
/// at any depth, not just the project root, because vendored static
/// directories appear under sub-apps too (`apps/admin/static/...`,
/// `dashboards/static/admin.js`). Users with edge-case projects where these
/// names legitimately hold source can disable the whole filter via
/// [`WalkOpts::exclude_static_assets`].
fn hits_static_asset_ignore(path: &Path) -> bool {
    path.components().any(|c| {
        c.as_os_str()
            .to_str()
            .map(|s| STATIC_ASSET_DIRS.contains(&s))
            .unwrap_or(false)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    /// Make a unique temp dir per test under /tmp. Tests run in parallel so
    /// names must be unique. Caller is responsible for cleanup.
    fn tmp_dir(label: &str) -> PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let pid = std::process::id();
        let p = std::env::temp_dir().join(format!("drift-walker-{label}-{pid}-{n}"));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).expect("mkdir tmp");
        p
    }

    fn rel(root: &Path, files: &[(PathBuf, Language)]) -> Vec<String> {
        let mut v: Vec<String> = files
            .iter()
            .map(|(p, _)| {
                p.strip_prefix(root)
                    .unwrap_or(p)
                    .display()
                    .to_string()
            })
            .collect();
        v.sort();
        v
    }

    #[test]
    fn defaults_skip_node_modules_even_without_gitignore() {
        let root = tmp_dir("defaults-node-modules");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("node_modules/lodash")).unwrap();
        fs::write(root.join("src/app.ts"), "export const x = 1;").unwrap();
        fs::write(root.join("node_modules/lodash/index.js"), "module.exports = {};").unwrap();

        let files = discover_source_files(&root);
        let names = rel(&root, &files);
        assert!(names.contains(&"src/app.ts".to_string()));
        assert!(
            !names.iter().any(|n| n.contains("node_modules")),
            "node_modules must be skipped by default; got {names:?}"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn defaults_skip_pycache_and_venv() {
        let root = tmp_dir("defaults-python");
        fs::create_dir_all(root.join("app")).unwrap();
        fs::create_dir_all(root.join("app/__pycache__")).unwrap();
        fs::create_dir_all(root.join(".venv/lib/python3.12/site-packages")).unwrap();
        fs::write(root.join("app/main.py"), "x = 1").unwrap();
        fs::write(root.join("app/__pycache__/main.cpython-312.pyc"), "garbage").unwrap();
        fs::write(
            root.join(".venv/lib/python3.12/site-packages/requests.py"),
            "x = 1",
        )
        .unwrap();

        let files = discover_source_files(&root);
        let names = rel(&root, &files);
        assert_eq!(names, vec!["app/main.py".to_string()]);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn gitignore_is_respected_even_without_git_dir() {
        let root = tmp_dir("gitignore");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("private")).unwrap();
        fs::write(root.join(".gitignore"), "private/\nsecret.py\n").unwrap();
        fs::write(root.join("src/app.py"), "x = 1").unwrap();
        fs::write(root.join("private/internal.py"), "y = 2").unwrap();
        fs::write(root.join("secret.py"), "z = 3").unwrap();
        // NOTE: no `.git/` directory — the `ignore` crate's default would
        // ignore .gitignore here. require_git(false) fixes that.

        let files = discover_source_files(&root);
        let names = rel(&root, &files);
        assert_eq!(names, vec!["src/app.py".to_string()],
            "private/ and secret.py must be skipped via .gitignore even without a .git dir; got {names:?}");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn driftignore_filters_additional_paths() {
        let root = tmp_dir("driftignore");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join(".driftignore"), "src/legacy.py\n").unwrap();
        fs::write(root.join("src/main.py"), "x = 1").unwrap();
        fs::write(root.join("src/legacy.py"), "x = 1").unwrap();

        let files = discover_source_files(&root);
        let names = rel(&root, &files);
        assert!(names.contains(&"src/main.py".to_string()));
        assert!(
            !names.contains(&"src/legacy.py".to_string()),
            ".driftignore should drop src/legacy.py; got {names:?}"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn opts_can_disable_gitignore() {
        let root = tmp_dir("opts-no-git");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join(".gitignore"), "src/skipped.py\n").unwrap();
        fs::write(root.join("src/main.py"), "x = 1").unwrap();
        fs::write(root.join("src/skipped.py"), "x = 1").unwrap();

        let opts = WalkOpts {
            respect_gitignore: false,
            ..WalkOpts::default()
        };
        let files = discover_source_files_with(&root, &opts);
        let names = rel(&root, &files);
        assert!(
            names.contains(&"src/skipped.py".to_string()),
            "with gitignore disabled, src/skipped.py should reappear; got {names:?}"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn nested_gitignore_in_subdir_works() {
        let root = tmp_dir("nested-gitignore");
        fs::create_dir_all(root.join("app/internal")).unwrap();
        fs::write(root.join("app/internal/.gitignore"), "*.py\n").unwrap();
        fs::write(root.join("app/handler.py"), "x = 1").unwrap();
        fs::write(root.join("app/internal/private.py"), "x = 1").unwrap();
        fs::write(root.join("app/internal/keep.ts"), "x = 1").unwrap();

        let files = discover_source_files(&root);
        let names = rel(&root, &files);
        assert!(names.contains(&"app/handler.py".to_string()));
        assert!(
            !names.contains(&"app/internal/private.py".to_string()),
            "nested .gitignore (*.py) should drop app/internal/private.py; got {names:?}"
        );
        assert!(
            names.contains(&"app/internal/keep.ts".to_string()),
            "nested .gitignore only ignored *.py, not *.ts; got {names:?}"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn negation_patterns_in_gitignore_are_honored() {
        let root = tmp_dir("gitignore-negation");
        fs::create_dir_all(root.join("logs")).unwrap();
        // Ignore everything in logs/, but un-ignore important.py
        fs::write(root.join(".gitignore"), "logs/*\n!logs/important.py\n").unwrap();
        fs::write(root.join("logs/scratch.py"), "x = 1").unwrap();
        fs::write(root.join("logs/important.py"), "x = 1").unwrap();

        let files = discover_source_files(&root);
        let names = rel(&root, &files);
        assert!(
            names.contains(&"logs/important.py".to_string()),
            "negation should un-ignore logs/important.py; got {names:?}"
        );
        assert!(!names.contains(&"logs/scratch.py".to_string()));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn typescript_repo_with_realistic_gitignore() {
        // Mimic a NestJS-shaped project. We exercise the same machinery the
        // CLI uses on real checkouts: a Node-style .gitignore, build output,
        // installed dependencies, env files, and coverage reports.
        //
        // What MUST be discovered:
        //   src/main.ts, src/app.module.ts
        //   src/users/users.controller.ts, src/users/users.service.ts
        //   test/app.e2e-spec.ts
        //
        // What MUST be filtered:
        //   dist/*           (gitignore)
        //   coverage/*       (gitignore)
        //   node_modules/*   (gitignore AND L1 default)
        //   .env             (gitignore)
        //   *.log            (gitignore)
        //
        // The .gitignore content is verbatim from GitHub's `Node.gitignore`
        // template (truncated to the relevant lines).
        let root = tmp_dir("ts-repo");

        // ── project metadata ──────────────────────────────────────────────
        fs::write(
            root.join(".gitignore"),
            "node_modules/\n\
             dist/\n\
             coverage/\n\
             .env\n\
             *.log\n\
             .DS_Store\n\
             .npm\n",
        )
        .unwrap();
        fs::write(root.join("package.json"), r#"{"name":"orders-svc"}"#).unwrap();
        fs::write(root.join("tsconfig.json"), r#"{"compilerOptions":{}}"#).unwrap();
        fs::write(root.join("README.md"), "# orders-svc").unwrap();
        fs::write(root.join(".env"), "DB_URL=postgres://...").unwrap();
        fs::write(root.join("app.log"), "[INFO] started").unwrap();

        // ── real source ───────────────────────────────────────────────────
        fs::create_dir_all(root.join("src/users")).unwrap();
        fs::write(
            root.join("src/main.ts"),
            "import { NestFactory } from '@nestjs/core';\nasync function bootstrap() {}\n",
        )
        .unwrap();
        fs::write(
            root.join("src/app.module.ts"),
            "import { Module } from '@nestjs/common';\n@Module({})\nexport class AppModule {}\n",
        )
        .unwrap();
        fs::write(
            root.join("src/users/users.controller.ts"),
            "export class UsersController { create() { return {}; } }\n",
        )
        .unwrap();
        fs::write(
            root.join("src/users/users.service.ts"),
            "export class UsersService { findAll() { return []; } }\n",
        )
        .unwrap();

        // ── tests dir (kept by default — Node gitignore does NOT exclude it) ─
        fs::create_dir_all(root.join("test")).unwrap();
        fs::write(
            root.join("test/app.e2e-spec.ts"),
            "import { Test } from '@nestjs/testing';\ndescribe('App', () => {});\n",
        )
        .unwrap();

        // ── build output (gitignored) ─────────────────────────────────────
        fs::create_dir_all(root.join("dist")).unwrap();
        fs::write(root.join("dist/main.js"), "console.log('hi');\n").unwrap();
        fs::write(root.join("dist/app.module.js"), "module.exports = {};\n").unwrap();

        // ── coverage report (gitignored) ──────────────────────────────────
        fs::create_dir_all(root.join("coverage/lcov-report")).unwrap();
        fs::write(root.join("coverage/lcov-report/index.html"), "<html/>").unwrap();
        fs::write(root.join("coverage/extra.ts"), "// fake source").unwrap();

        // ── installed dependencies (gitignored + L1 default) ──────────────
        fs::create_dir_all(root.join("node_modules/@nestjs/common")).unwrap();
        fs::create_dir_all(root.join("node_modules/typeorm/dist")).unwrap();
        fs::write(
            root.join("node_modules/@nestjs/common/index.d.ts"),
            "export declare const X: number;",
        )
        .unwrap();
        fs::write(
            root.join("node_modules/typeorm/index.js"),
            "module.exports = {};",
        )
        .unwrap();
        fs::write(
            root.join("node_modules/typeorm/dist/repository.ts"),
            "export class Repository {}",
        )
        .unwrap();

        // ── act ───────────────────────────────────────────────────────────
        let files = discover_source_files(&root);
        let names = rel(&root, &files);

        // ── must include ──────────────────────────────────────────────────
        let must_include = [
            "src/main.ts",
            "src/app.module.ts",
            "src/users/users.controller.ts",
            "src/users/users.service.ts",
            "test/app.e2e-spec.ts",
        ];
        for f in must_include {
            assert!(
                names.contains(&f.to_string()),
                "expected {f:?} to be discovered; got {names:?}"
            );
        }

        // ── must exclude ──────────────────────────────────────────────────
        for forbidden in [
            "dist/",
            "coverage/",
            "node_modules/",
        ] {
            assert!(
                !names.iter().any(|n| n.contains(forbidden)),
                "expected nothing matching {forbidden:?}; got {names:?}"
            );
        }
        // .env, app.log, README.md, package.json — none are source languages we
        // recognize anyway, so they're filtered out by Language::from_path
        // regardless of .gitignore. Just sanity-check.
        assert!(!names.iter().any(|n| n.ends_with(".env")));
        assert!(!names.iter().any(|n| n.ends_with(".log")));

        // ── now layer a .driftignore on top to also exclude tests/ ────────
        fs::write(root.join(".driftignore"), "test/\n").unwrap();
        let files2 = discover_source_files(&root);
        let names2 = rel(&root, &files2);
        assert!(
            !names2.iter().any(|n| n.starts_with("test/")),
            ".driftignore should now exclude test/; got {names2:?}"
        );
        // src/ must still be present
        assert!(names2.contains(&"src/main.ts".to_string()));

        // ── final sanity: exactly the 5 src+test files originally ─────────
        // (test/ count: 1 before .driftignore)
        // Using a set for clarity:
        let set: std::collections::HashSet<String> = names.into_iter().collect();
        assert_eq!(set.len(), 5, "expected exactly 5 source files; got {set:?}");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn static_assets_dirs_are_excluded_by_default() {
        // Real-world shape: a server project with vendored Swagger UI sitting
        // in `static/` and `assets/`. Real source under `src/` and `app/`.
        // The motivating bug was these vendored bundles appearing as the
        // top entry-point candidates with reach 4000+, drowning out the
        // user's actual code.
        let root = tmp_dir("static-assets-default");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("static")).unwrap();
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::create_dir_all(root.join("apps/admin/static")).unwrap();
        fs::write(root.join("src/server.py"), "x = 1").unwrap();
        fs::write(root.join("static/swagger-ui-bundle.js"), "var Gk={};").unwrap();
        fs::write(root.join("static/redoc.standalone.js"), "var Ek={};").unwrap();
        fs::write(root.join("assets/app.min.js"), "var ai={};").unwrap();
        fs::write(root.join("apps/admin/static/admin.js"), "var ci={};").unwrap();

        let files = discover_source_files(&root);
        let names = rel(&root, &files);
        assert_eq!(
            names,
            vec!["src/server.py".to_string()],
            "default WalkOpts should exclude static/ and assets/ at any depth; got {names:?}"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn static_assets_filter_can_be_disabled() {
        // The escape hatch — users analyzing a project that genuinely keeps
        // source under static/ (rare but real, e.g. Django apps with
        // `static/admin/js/admin.js` as the codebase under analysis) can
        // opt out via the new flag. Settings UI exposes this toggle.
        let root = tmp_dir("static-assets-disabled");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("static")).unwrap();
        fs::write(root.join("src/main.py"), "x = 1").unwrap();
        fs::write(root.join("static/admin.py"), "x = 1").unwrap();

        let opts = WalkOpts {
            exclude_static_assets: false,
            ..WalkOpts::default()
        };
        let files = discover_source_files_with(&root, &opts);
        let names = rel(&root, &files);
        let set: std::collections::HashSet<String> = names.into_iter().collect();
        assert!(
            set.contains("src/main.py") && set.contains("static/admin.py"),
            "with the static-assets filter off, static/admin.py must reappear; got {set:?}"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn fixtures_still_discover_their_source_files() {
        // Regression check: the existing four fixtures must still resolve.
        for (fix, expected_lang) in &[
            ("python-fastapi", Language::Python),
            ("java-spring", Language::Java),
            ("typescript-nestjs", Language::TypeScript),
            ("javascript-express", Language::JavaScript),
        ] {
            let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            p.push("tests/fixtures");
            p.push(fix);
            let files = discover_source_files(&p);
            assert!(
                files.iter().any(|(_, l)| l == expected_lang),
                "expected at least one {:?} file in {fix}, got {:?}",
                expected_lang,
                rel(&p, &files)
            );
        }
    }

    // ── is_test_filename — exhaustive grammar tests ────────────────────
    //
    // These are the unit tests for the file-name half of `is_test_path`.
    // We keep them in walker.rs (not integration.rs) so they exercise the
    // helper directly without touching the filesystem — fast, focused,
    // and they pin down the exact grammar above.

    #[test]
    fn is_test_filename_dot_separated_conventions() {
        // The classic JS/TS shape, plus its sibling .spec / .mock.
        for name in [
            "app.test.ts",
            "app.test.tsx",
            "app.test.js",
            "app.spec.js",
            "api.mock.ts",
            "e2e.test.ts",
            "deeply.nested.feature.test.tsx",
        ] {
            assert!(is_test_filename(name), "should match: {name:?}");
        }
    }

    #[test]
    fn is_test_filename_underscore_separated_conventions() {
        // Python + Go classics. We accept both `test_X` and `X_test` for
        // Python (pytest collects both); Go only blesses `_test.go`.
        for name in [
            "test_utils.py",
            "utils_test.py",
            "test_data_loader.py",
            "util_test.go",
            "user_test.go",
        ] {
            assert!(is_test_filename(name), "should match: {name:?}");
        }
    }

    #[test]
    fn is_test_filename_dash_separated_conventions() {
        // New in this pass — dash-separated test naming is common in
        // TS/JS/Deno repos but wasn't previously matched.
        for name in [
            "test-helper.ts",
            "helper-test.ts",
            "foo-test-bar.ts",
            "spec-runner.ts",
            "runner-spec.ts",
            "mock-server.ts",
        ] {
            assert!(is_test_filename(name), "should match: {name:?}");
        }
    }

    #[test]
    fn is_test_filename_pascal_case_suffix_works_across_extensions() {
        // PascalCase `*Test` / `*Tests` / `*Spec` / `*Specs` is no longer
        // tied to `.java` / `.scala` — Kotlin, C#, Rust, etc. all qualify.
        for name in [
            "UserTest.java",
            "UserTests.java",
            "UserTest.kt",
            "UserTests.kt",
            "UserTest.cs",
            "UserTest.rs",
            "UserSpec.scala",
            "UserSpecs.scala",
            "IntegrationTest.java",   // multi-camel still works
        ] {
            assert!(is_test_filename(name), "should match: {name:?}");
        }
    }

    #[test]
    fn is_test_filename_pascal_case_prefix_test_x() {
        // `Test<UPPER>...` — typical for the "Test*" Java/Kotlin style.
        for name in [
            "TestUserService.java",
            "TestHelper.kt",
            "TestUtils.java",
            "TestRepository.scala",
        ] {
            assert!(is_test_filename(name), "should match: {name:?}");
        }
    }

    #[test]
    fn is_test_filename_bare_names_count() {
        // Empty prefix / empty suffix is fine — a file literally named
        // `Test.java`, `Spec.ts`, or `test.py` IS a test artifact.
        for name in [
            "Test.java",
            "Tests.kt",
            "Spec.scala",
            "Specs.scala",
            "Spec.ts",
            "Test.ts",
            "test.py",
            "spec.rb",
        ] {
            assert!(is_test_filename(name), "should match: {name:?}");
        }
    }

    #[test]
    fn is_test_filename_rejects_words_that_merely_contain_test() {
        // THE boundary rule is the heart of this matcher. None of these
        // should fire, even though they textually contain "test" /
        // "spec" / "mock".
        for name in [
            "app.py",                  // unrelated
            "users.ts",
            "handler.go",
            "User.java",
            "UserService.scala",
            "testimony.py",            // alnum AFTER `test`
            "testimonial.ts",
            "contest.py",              // alnum BEFORE `test`
            "contesting.ts",
            "protester.go",
            "Tester.java",             // PascalCase: `Test` + LOWERCASE `e` is the boundary fail
            "Testing.java",
            "MyTestUtil.java",         // PascalCase: `MyTest` + UPPERCASE `U` → util, not a test class
            "inspector.ts",            // contains `spec` mid-word
            "respect.ts",
            "mockery.ts",              // `mock` + alnum `e` after
            "smoke.ts",                // contains `mok` not `mock` — safety check
        ] {
            assert!(!is_test_filename(name), "should NOT match: {name:?}");
        }
    }

    #[test]
    fn has_separator_bounded_substring_is_strict_about_alnum() {
        // Direct unit tests for the boundary helper — these are the
        // exact cases that determine our true/false above. Keeping them
        // as their own assertions makes regressions obvious.
        assert!(has_separator_bounded_substring("test", "test"));
        assert!(has_separator_bounded_substring("test_x", "test"));
        assert!(has_separator_bounded_substring("x_test", "test"));
        assert!(has_separator_bounded_substring("x.test.y", "test"));
        assert!(has_separator_bounded_substring("x-test-y", "test"));
        assert!(has_separator_bounded_substring("a.b.test", "test"));
        // Negatives — the substring exists but isn't bounded by non-alnum.
        assert!(!has_separator_bounded_substring("testing", "test"));
        assert!(!has_separator_bounded_substring("contest", "test"));
        assert!(!has_separator_bounded_substring("attestation", "test"));
        assert!(!has_separator_bounded_substring("attester", "test"));
    }
}
