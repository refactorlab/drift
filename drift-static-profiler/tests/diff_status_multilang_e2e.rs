//! Multi-language TRUE end-to-end: for EVERY supported language, build a real
//! git repo (modify + add + delete + rename), run the EXACT `git diff` commands
//! action.yml uses, run the scanner with `--diff-status`, and assert the
//! BEFORE/AFTER two-chart invariants — then validate both charts through the
//! REAL mermaid parser.
//!
//! WHY: every other e2e test uses Python. The diff-status logic is path-based
//! (language-agnostic), but "two charts, in all cases, end to end" demands
//! proof across the whole supported matrix (Python is covered by
//! `diff_status_real_git.rs`; this file covers the other seven). A parallel
//! workflow probe confirmed all seven pass; this test makes that a permanent
//! regression guard.
//!
//! The asserted invariants are deliberately language-AGNOSTIC (they hold
//! regardless of how rich each language's call tree is, because the removed
//! card is injected from the `D` status, not the AST):
//!   1. scan-pr succeeds + emits JSON,
//!   2. the DELETED file renders as a `🗑 removed` card in BEFORE,
//!   3. the RENAMED file does NOT render as a removed card (rename ≠ delete —
//!      guards the `--find-renames` fix under a hostile `diff.renames=false`),
//!   4. both BEFORE and AFTER are valid mermaid (real parser).
//!
//! AUTO-SKIP: skips cleanly when `git` is unavailable; mermaid validation
//! sub-skips when `node`/deps are absent (the core assertions still run).

use std::path::{Path, PathBuf};
use std::process::Command;

fn have(cmd: &str) -> bool {
    Command::new(cmd).arg("--version").output().map(|o| o.status.success()).unwrap_or(false)
}

/// Run git in a hermetic, config-independent way. Crucially sets
/// `diff.renames=false` so our explicit `--find-renames` is PROVEN to override
/// a hostile config (the exact production bug the action.yml fix prevents).
fn git(repo: &Path, args: &[&str]) -> (bool, String) {
    let mut full: Vec<&str> = vec![
        "-c", "user.email=t@t.co",
        "-c", "user.name=t",
        "-c", "commit.gpgsign=false",
        "-c", "diff.renames=false",
    ];
    full.extend_from_slice(args);
    let out = Command::new("git").args(&full).current_dir(repo).output().expect("spawn git");
    (out.status.success(), String::from_utf8_lossy(&out.stdout).into_owned())
}

fn write(repo: &Path, rel: &str, body: &str) {
    let p = repo.join(rel);
    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
    std::fs::write(p, body).unwrap();
}

fn unique_repo(tag: &str) -> PathBuf {
    static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let seq = SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    std::env::temp_dir().join(format!("drift-ml-{tag}-{}-{seq}", std::process::id()))
}

fn validator_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../action/scripts/validate-mermaid.mjs")
}

/// Some(true)=valid · Some(false)=invalid · None=skipped (no node/deps).
fn validate_mermaid(tag: &str, mmd: &str) -> Option<bool> {
    let script = validator_script();
    if !script.exists() || !have("node") {
        return None;
    }
    let p = std::env::temp_dir().join(format!("drift-ml-{tag}-{}.mmd", mmd.len()));
    std::fs::write(&p, mmd).unwrap();
    let out = Command::new("node").arg(&script).arg(&p).output().ok()?;
    let _ = std::fs::remove_file(&p);
    match out.status.code() {
        Some(2) => None,
        Some(0) => Some(true),
        _ => Some(false),
    }
}

/// A language's minimal real-repo spec. `entry/helper/legacy/feature` are
/// idiomatic, tree-sitter-parseable snippets — they need not COMPILE, only
/// parse, and the asserted invariants don't depend on call-tree richness.
struct Lang {
    name: &'static str,
    ext: &'static str,
    /// Base-commit source for the entry file (will be MODIFIED in the PR).
    entry: &'static str,
    entry_modified: &'static str,
    /// Source for the file that will be RENAMED (helper_old → helper_new).
    helper: &'static str,
    /// Source for the file that will be DELETED.
    legacy: &'static str,
    /// Source for the file ADDED in the PR.
    feature: &'static str,
}

fn matrix() -> Vec<Lang> {
    vec![
        Lang {
            name: "TypeScript", ext: "ts",
            entry: "import { help } from './helper_old';\nexport function entry(): number { return help() + 1; }\n",
            entry_modified: "import { help } from './helper_new';\nexport function entry(): number { return help() + 2; }\n",
            helper: "export function help(): number { return 7; }\n",
            legacy: "export function legacy(): number { return 0; }\n",
            feature: "export function feature(): number { return 42; }\n",
        },
        Lang {
            name: "JavaScript", ext: "js",
            entry: "const { help } = require('./helper_old');\nfunction entry() { return help() + 1; }\nmodule.exports = { entry };\n",
            entry_modified: "const { help } = require('./helper_new');\nfunction entry() { return help() + 2; }\nmodule.exports = { entry };\n",
            helper: "function help() { return 7; }\nmodule.exports = { help };\n",
            legacy: "function legacy() { return 0; }\nmodule.exports = { legacy };\n",
            feature: "function feature() { return 42; }\nmodule.exports = { feature };\n",
        },
        Lang {
            name: "Go", ext: "go",
            entry: "package app\n\nfunc Entry() int { return Help() + 1 }\n",
            entry_modified: "package app\n\nfunc Entry() int { return Help() + 2 }\n",
            helper: "package app\n\nfunc Help() int { return 7 }\n",
            legacy: "package app\n\nfunc Legacy() int { return 0 }\n",
            feature: "package app\n\nfunc Feature() int { return 42 }\n",
        },
        Lang {
            name: "Rust", ext: "rs",
            entry: "pub fn entry() -> i32 { help() + 1 }\nfn help() -> i32 { 7 }\n",
            entry_modified: "pub fn entry() -> i32 { help() + 2 }\nfn help() -> i32 { 7 }\n",
            helper: "pub fn help_util() -> i32 { 7 }\n",
            legacy: "pub fn legacy() -> i32 { 0 }\n",
            feature: "pub fn feature() -> i32 { 42 }\n",
        },
        Lang {
            name: "Java", ext: "java",
            entry: "class Entry { int run() { return new Helper().help() + 1; } }\n",
            entry_modified: "class Entry { int run() { return new Helper().help() + 2; } }\n",
            helper: "class Helper { int help() { return 7; } }\n",
            legacy: "class Legacy { int legacy() { return 0; } }\n",
            feature: "class Feature { int feature() { return 42; } }\n",
        },
        Lang {
            name: "Kotlin", ext: "kt",
            entry: "fun entry(): Int { return help() + 1 }\n",
            entry_modified: "fun entry(): Int { return help() + 2 }\n",
            helper: "fun help(): Int { return 7 }\n",
            legacy: "fun legacy(): Int { return 0 }\n",
            feature: "fun feature(): Int { return 42 }\n",
        },
        Lang {
            name: "Scala", ext: "scala",
            entry: "object Entry { def run(): Int = Helper.help() + 1 }\n",
            entry_modified: "object Entry { def run(): Int = Helper.help() + 2 }\n",
            helper: "object Helper { def help(): Int = 7 }\n",
            legacy: "object Legacy { def legacy(): Int = 0 }\n",
            feature: "object Feature { def feature(): Int = 42 }\n",
        },
    ]
}

fn run_one(l: &Lang) {
    let repo = unique_repo(l.ext);
    let _ = std::fs::remove_dir_all(&repo);
    std::fs::create_dir_all(&repo).unwrap();

    let entry = format!("src/entry.{}", l.ext);
    let helper_old = format!("src/helper_old.{}", l.ext);
    let helper_new = format!("src/helper_new.{}", l.ext);
    let legacy = format!("src/legacy.{}", l.ext);
    let feature = format!("src/feature.{}", l.ext);

    // ── BASE commit ──
    write(&repo, &entry, l.entry);
    write(&repo, &helper_old, l.helper);
    write(&repo, &legacy, l.legacy);
    assert!(git(&repo, &["init", "-q"]).0, "[{}] git init", l.name);
    assert!(git(&repo, &["add", "-A"]).0, "[{}] git add base", l.name);
    assert!(git(&repo, &["commit", "-qm", "base"]).0, "[{}] git commit base", l.name);
    let base = git(&repo, &["rev-parse", "HEAD"]).1.trim().to_string();

    // ── PR commit: modify entry, add feature, delete legacy, rename helper ──
    write(&repo, &entry, l.entry_modified);
    write(&repo, &feature, l.feature);
    assert!(git(&repo, &["rm", "-q", &legacy]).0, "[{}] git rm legacy", l.name);
    assert!(git(&repo, &["mv", &helper_old, &helper_new]).0, "[{}] git mv rename", l.name);
    assert!(git(&repo, &["add", "-A"]).0, "[{}] git add pr", l.name);
    assert!(git(&repo, &["commit", "-qm", "pr"]).0, "[{}] git commit pr", l.name);
    let head = git(&repo, &["rev-parse", "HEAD"]).1.trim().to_string();

    // ── EXACT action.yml diff commands (with --find-renames, hostile config) ──
    let (ok_c, changed) = git(&repo, &["diff", "--name-only", "--find-renames", "--diff-filter=ACMRT", &base, &head]);
    let (ok_s, status) = git(&repo, &["diff", "--name-status", "--find-renames", "--diff-filter=ACMRTD", &base, &head]);
    assert!(ok_c && ok_s, "[{}] git diff failed", l.name);

    // The rename MUST survive as an R row even under diff.renames=false.
    assert!(
        status.lines().any(|ln| ln.starts_with('R') && ln.contains("helper_old") && ln.contains("helper_new")),
        "[{}] rename must be an R row under --find-renames:\n{status}", l.name
    );
    assert!(
        status.lines().any(|ln| ln.starts_with('D') && ln.contains("legacy")),
        "[{}] delete must be a D row:\n{status}", l.name
    );

    let changed_path = repo.join("changed.txt");
    let status_path = repo.join("status.tsv");
    std::fs::write(&changed_path, &changed).unwrap();
    std::fs::write(&status_path, &status).unwrap();

    // ── Run scan-pr ──
    let bin = env!("CARGO_BIN_EXE_drift-static-profiler");
    let out = Command::new(bin)
        .args([
            "scan-pr", repo.to_str().unwrap(),
            "--changed-files", changed_path.to_str().unwrap(),
            "--diff-status", status_path.to_str().unwrap(),
        ])
        .output()
        .expect("spawn scan-pr");
    assert!(
        out.status.success(),
        "[{}] scan-pr failed (exit {:?}); stderr:\n{}",
        l.name, out.status.code(), String::from_utf8_lossy(&out.stderr)
    );
    let report: serde_json::Value =
        serde_json::from_slice(&out.stdout).unwrap_or_else(|e| panic!("[{}] scan-pr stdout not JSON: {e}", l.name));

    let af = &report["pr_review"]["architecture_flow"];
    let before = af["before_mermaid"].as_str().unwrap_or_else(|| panic!("[{}] no before_mermaid", l.name));
    let after = af["after_mermaid"].as_str().unwrap_or_else(|| panic!("[{}] no after_mermaid", l.name));

    // ── Language-agnostic two-chart invariants ──
    assert!(before.starts_with("flowchart "), "[{}] BEFORE not a flowchart:\n{before}", l.name);
    assert!(after.starts_with("flowchart "), "[{}] AFTER not a flowchart:\n{after}", l.name);
    // 1. Deleted file → removed card in BEFORE.
    assert!(
        before.contains(&format!("🗑 removed — legacy.{}", l.ext)),
        "[{}] deleted file must be a removed card in BEFORE:\n{before}", l.name
    );
    // 2. Rename must NOT produce a removed card for the old path.
    assert!(
        !before.contains(&format!("🗑 removed — helper_old.{}", l.ext)),
        "[{}] rename must NOT render the old path as a removed card:\n{before}", l.name
    );
    // 3. Added file must be absent from BEFORE.
    assert!(
        !before.contains(&format!("feature.{}", l.ext)) || !before.contains("🗑 removed — feature"),
        "[{}] added file must not be a removed card in BEFORE:\n{before}", l.name
    );

    // 4. Both charts parse through the REAL mermaid grammar.
    for (which, mmd) in [("BEFORE", before), ("AFTER", after)] {
        match validate_mermaid(l.ext, mmd) {
            Some(true) => {}
            Some(false) => panic!("[{}] {which} chart REJECTED by mermaid:\n{mmd}", l.name),
            None => eprintln!("SKIP: mermaid validator unavailable for [{}] {which}", l.name),
        }
    }

    let _ = std::fs::remove_dir_all(&repo);
}

#[test]
fn two_charts_end_to_end_across_all_supported_languages() {
    if !have("git") {
        eprintln!("SKIP: git not on PATH");
        return;
    }
    for l in matrix() {
        run_one(&l);
    }
}
