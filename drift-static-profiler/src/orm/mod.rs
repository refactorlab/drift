//! ORM static-analysis layer (Phase 1: Python — Django + SQLAlchemy).
//!
//! Architecture: tree-sitter captures → per-file `PyOrmContext` (binding
//! map + loop ranges + call chains) → per-ORM `OrmDialect::predict_all`
//! emits `PredictedSql` IR → cross-ORM `SqlIrRule` catalog fires on
//! predictions → `fuse_findings` triangulates ORM-level + SQL-IR
//! findings into single higher-confidence outputs.
//!
//! See `research/ORM_STATIC_ANALYSIS_PLAN.md` for the full design.

pub mod context;
pub mod dialect;
pub mod fusion;
pub mod go;
pub mod jvm;
pub mod jvm_kotlin;
pub mod jvm_scala;
pub mod model_graph;
pub mod n_plus_one;
pub mod parallel;
pub mod python;
pub mod rust_lang;
pub mod shape;
pub mod sql_ir;
pub mod sql_ir_rules;
pub mod ts;
pub mod walker;

use crate::graph::ExternalCall;
use crate::insights::{Ctx, Effort, Evidence, Finding, Severity};
use crate::Symbol;
use context::PyOrmContext;
use dialect::OrmDialect;
use std::ops::Range;

/// Which ORM family produced a finding. Used by reporting/UX and by the
/// path-gate that decides which dialect's rules to run on a given file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Framework {
    Django,
    SqlAlchemy,
    Alembic,
    Generic,
}

/// One per ORM-specific rule (Django N+1, SQLAlchemy lazy-dynamic, etc.).
/// Mirrors the shape of `crate::sql_lint::SqlRule` so contributors who
/// already know the SQL-rule pipeline can write ORM rules without learning
/// a new shape.
pub struct OrmRule {
    pub id: &'static str,
    pub framework: Framework,
    pub severity: Severity,
    pub effort: Effort,
    pub message: &'static str,
    pub remediation: &'static str,
    pub confidence: f64,
    pub matches: fn(&PyOrmContext) -> Vec<MatchHit>,
}

/// A successful match from an `OrmRule`. The matcher fn returns one per
/// site so a single rule can fire multiple times in the same file.
#[derive(Debug, Clone)]
pub struct MatchHit {
    pub line: usize,
    pub byte_range: Range<usize>,
    pub extra_evidence: Vec<Evidence>,
}

/// Per-symbol stub. ORM analysis is file-level (not symbol-level), so
/// per-node findings come from `attach_orm_findings` (called from
/// `report::Report::build`) instead. This stub is kept so the existing
/// `insights::collect_node_findings` call path stays intact.
pub fn collect_orm_findings(
    _sym: &Symbol,
    _externals: &[ExternalCall],
    _ctx: &Ctx,
) -> Vec<Finding> {
    Vec::new()
}

/// Run ORM static-analysis on every Python file touched by `entries`,
/// attaching findings to the nearest call-tree node whose symbol lives
/// in that file. Drives Django + SQLAlchemy detection, SQL-IR rules,
/// and fusion in one pass.
///
/// `source_root` is the project root; entries store paths relative to
/// it (per `tree::TreeBuilder.root_dir`), so we resolve each `node.file`
/// by joining onto the root before reading.
///
/// `walk_opts` controls the workspace scan that feeds ModelGraph and the
/// off-tree finding pass. Pass the same `WalkOpts` the main source walker
/// used so user settings (`exclude_tests`, `exclude_static_assets`,
/// `.gitignore`, `.driftignore`) are honored uniformly — otherwise files
/// under e.g. `tests/fixtures/` slip past the user's filter and surface
/// as synthetic `<orm_file>` entries.
pub fn attach_orm_findings(
    entries: &mut Vec<crate::tree::CallTreeNode>,
    source_root: Option<&std::path::Path>,
    walk_opts: &crate::walker::WalkOpts,
) {
    // Collect the SET of file paths referenced by call-tree entries.
    // When the user picked ONE entry from the picker, this set spans
    // ONLY that entry's transitive call tree — files that live outside
    // that subtree (standalone scripts, modules wired up via reflection,
    // dead code with real ORM usage) wouldn't be analysed. We fix that
    // by analysing every workspace file regardless, then routing the
    // findings: in-tree files attach to a covering node (existing
    // behavior); off-tree files-with-findings become synthetic
    // `orm:file` entry nodes appended to the call-tree list. Mirrors
    // the existing `sql:file` pattern in `sql_lint::scan_sql_files_into`
    // so the viewer / summary rollups treat them uniformly.
    let mut entry_files: std::collections::HashSet<String> =
        std::collections::HashSet::new();
    for e in entries.iter() {
        collect_files(e, &mut entry_files);
    }

    // ── Single-pass optimal pipeline (matches `scan_workspace`):
    //
    //   walk_workspace ──► WorkspaceFile (path + source) ──► parse_one ──► ParsedFile
    //                                                                          │
    //                                ┌─────────────────────────────────────────┴───┐
    //                                ▼                                              ▼
    //                       ModelGraph::from_parsed                  per-file analyze_with_tree
    //                                                              (zero re-reads, zero re-parses)
    //
    // ONE read + ONE tree-sitter parse per analysable file. Both
    // ModelGraph extraction (for cross-file relation lookup) AND
    // per-file analysis re-use the same cached `tree_sitter::Tree`.
    let parsed: Vec<ParsedFile> = match source_root {
        Some(root) => {
            // ModelGraph spans the WHOLE workspace (model files may
            // have no callable entries themselves — `models.py`).
            // We also include any entry-referenced files that
            // wouldn't otherwise be in the workspace walk's cap.
            let mut cache = build_workspace_cache(root, /*max_files=*/ 8000, walk_opts);
            // If the cap clipped some entry-referenced files, top
            // up by reading them on demand.
            let cached_set: std::collections::HashSet<std::path::PathBuf> =
                cache.iter().map(|c| c.path.clone()).collect();
            for f in &entry_files {
                let abs = resolve_path(f, source_root);
                if !cached_set.contains(&abs) {
                    if let Some(lang) = detect_lang(&abs) {
                        if let Ok(source) = std::fs::read_to_string(&abs) {
                            if file_might_contain_orm_signal(lang, &source) {
                                cache.push(WorkspaceFile {
                                    path: abs,
                                    lang,
                                    source,
                                });
                            }
                        }
                    }
                }
            }
            cache.into_iter().filter_map(parse_one).collect()
        }
        None => Vec::new(),
    };
    let model_graph = model_graph::ModelGraph::from_parsed(&parsed);

    // Files that produced findings but aren't covered by any existing
    // entry tree — we'll add a synthetic `orm:file` node for each so
    // the findings reach the summary rollup.
    let mut off_tree: Vec<(std::path::PathBuf, String, Vec<Finding>)> = Vec::new();

    for pf in &parsed {
        let Some(file_rel) = relative_to(&pf.path, source_root) else {
            continue;
        };
        let Some(findings) = analyze_parsed(pf, &model_graph) else {
            continue;
        };
        if findings.is_empty() {
            continue;
        }
        if entry_files.contains(&file_rel) {
            // In-tree: attach to the nearest covering node.
            let mut indices: Vec<usize> = (0..entries.len()).collect();
            indices.sort_by_key(|i| {
                let e = &entries[*i];
                let is_module = e.name.starts_with('<');
                (is_module, e.loc)
            });
            for f in findings {
                let mut placed = false;
                for &i in &indices {
                    if attach_finding(&mut entries[i], &file_rel, &f) {
                        placed = true;
                        break;
                    }
                }
                if !placed {
                    for &i in &indices {
                        if attach_to_file_root(&mut entries[i], &file_rel, &f) {
                            break;
                        }
                    }
                }
            }
        } else {
            // Off-tree: stash for synthetic-entry creation after the loop.
            off_tree.push((pf.path.clone(), file_rel, findings));
        }
    }

    for (path, file_rel, findings) in off_tree {
        entries.push(make_orm_file_node(&path, &file_rel, findings));
    }
}

/// Build a synthetic leaf `CallTreeNode` for a workspace file that
/// produced ORM findings but isn't covered by any existing entry tree.
/// Mirrors `sql_lint::make_sql_file_node` shape so the viewer's
/// rollup / Insights / Findings-by-Category infrastructure treats it
/// uniformly. Tagged `entry_labels: ["orm:file"]` so the viewer can
/// optionally render an "ORM files" group distinct from real entries.
fn make_orm_file_node(
    abs_path: &std::path::Path,
    file_rel: &str,
    findings: Vec<Finding>,
) -> crate::tree::CallTreeNode {
    let name = abs_path
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_else(|| file_rel.to_string());
    let id = crate::graph::SymbolId(format!("{file_rel}::<orm_file>::{name}"));
    crate::tree::CallTreeNode {
        id,
        name,
        kind: crate::SymbolKind::Function,
        file: file_rel.to_string(),
        line: 1,
        depth: 0,
        parent_class: None,
        children: Vec::new(),
        truncated_reason: None,
        callers: Vec::new(),
        callers_count: 0,
        callees_count: 0,
        subtree_size: 1,
        category_self: Some(crate::categories::Category::Db),
        categories_reached: std::collections::BTreeMap::new(),
        external_calls: Vec::new(),
        complexity: 0,
        loc: 0,
        nesting_depth: 0,
        parameter_count: 0,
        is_async: false,
        call_site_count: 0,
        is_recursive: false,
        pagerank: 0.0,
        percent_total: 0.0,
        percent_parent: 0.0,
        n_plus_one_risk: false,
        blocking_in_async: false,
        findings,
        entry_labels: vec!["orm:file".to_string()],
    }
}

/// Iterative DFS over a `CallTreeNode` tree: returns the first node
/// whose `file` matches, then attaches the finding. No recursion, so
/// deeply-nested call trees don't risk stack overflow.
fn attach_to_file_root(
    node: &mut crate::tree::CallTreeNode,
    file: &str,
    finding: &Finding,
) -> bool {
    // Iterative DFS using a stack of mutable pointers cast to raw
    // and back. We need `&mut` access to `findings`, which a single
    // visit-then-push approach can't safely express via closures —
    // but a raw-pointer stack does. Each pointer is dereffed once
    // and never aliased.
    let mut stack: Vec<*mut crate::tree::CallTreeNode> = vec![node as *mut _];
    while let Some(np) = stack.pop() {
        // SAFETY: every `*mut` originates from a unique `&mut` we
        // own through the tree spine, popped exactly once.
        let n: &mut crate::tree::CallTreeNode = unsafe { &mut *np };
        if n.file == file {
            n.findings.push(finding.clone());
            return true;
        }
        // Push children in reverse so the next pop is the leftmost.
        for c in n.children.iter_mut().rev() {
            stack.push(c as *mut _);
        }
    }
    false
}

/// Quick substring check on raw source text: do we see anything that
/// looks like an ORM / LLM / auth-crypto signal? Falses-cheap (5-10
/// µs per file) and avoids the 6 tree-walks for the bulk of files
/// that have no ORM content (typical app: <20% of files actually
/// touch an ORM client).
fn file_might_contain_orm_signal(lang: FileLang, source: &str) -> bool {
    let needles: &[&str] = match lang {
        FileLang::Python => &[
            "django",
            "models.",
            "sqlalchemy",
            "alembic",
            // SA shape signatures — let files through that USE SA via
            // an inherited base class without importing it directly.
            // Each needle is SA-exclusive enough not to false-trigger
            // on pandas / polars / generic builders.
            "joinedload",
            "selectinload",
            "yield_per",
            "session.query(",
            "scalar_one",
            "bulk_save_objects",
            "filter_by",
            // Django shape signatures — same rationale: manager-pattern
            // usage in files that don't import django directly.
            "select_related",
            "prefetch_related",
            "bulk_create",
            "get_or_create",
            ".objects.",
            // LLM
            "openai",
            "OpenAI",
            "anthropic",
            "Anthropic",
            "Cohere",
            "Mistral",
            // Auth/crypto
            "bcrypt",
            "passlib",
            "rsa",
            "RSA",
            "jwks",
            ".well-known",
        ],
        FileLang::TypeScript | FileLang::JavaScript => &[
            "@prisma",
            "PrismaClient",
            "prisma.",
            "drizzle",
            "typeorm",
            "TypeORM",
            "sequelize",
            "Sequelize",
            "mongoose",
            "Mongoose",
            "@Entity",
            "@OneToMany",
            "@ManyToOne",
            "@Query",
            // React (parallel track): admit files exhibiting React so the
            // `react` detector's gate + rules get a chance to run. Hook usage
            // and `dangerouslySetInnerHTML` are React-specific; the `react`
            // import covers class components / no-hook files.
            "react",
            "useEffect",
            "useState",
            "useLayoutEffect",
            "dangerouslySetInnerHTML",
        ],
        FileLang::Java => &[
            "@Entity",
            "@Repository",
            "@Query",
            "@ManyToOne",
            "@OneToMany",
            "@ManyToMany",
            "@OneToOne",
            "JpaRepository",
            "EntityManager",
            "hibernate",
            "Hibernate",
        ],
        FileLang::Go => &["gorm.io", "jinzhu/gorm", "AutoMigrate"],
        FileLang::Rust => &["sqlx::", "diesel::", "sea_orm", "::sqlx"],
        FileLang::Scala => &[
            // Slick
            "slick.jdbc",
            "slick.lifted",
            "TableQuery",
            "sql\"",
            "sqlu\"",
            ".result",
            // Quill
            "io.getquill",
            "import io.getquill",
            "quote {",
            "ctx.run",
            "liftQuery",
            "infix\"",
        ],
        FileLang::Kotlin => &[
            // Exposed
            "org.jetbrains.exposed",
            "import org.jetbrains.exposed",
            "IntEntity",
            "LongEntity",
            "IntEntityClass",
            "LongEntityClass",
            "transaction {",
            "newSuspendedTransaction",
            ".findById(",
            "SchemaUtils",
            // Ktorm
            "org.ktorm",
            "import org.ktorm",
            "useConnection",
            "sequenceOf(",
            "joinReferencesAndSelect",
            "flushChanges()",
        ],
    };
    needles.iter().any(|n| source.contains(n))
}

/// Inverse of `resolve_path`: convert an absolute path back to the
/// string drift's call-tree nodes use (relative to `source_root`).
/// Required for `entry_files` lookup since drift stores
/// `tree::CallTreeNode.file` as the rendered relative string.
fn relative_to(
    abs: &std::path::Path,
    source_root: Option<&std::path::Path>,
) -> Option<String> {
    match source_root {
        Some(root) => Some(
            abs.strip_prefix(root)
                .unwrap_or(abs)
                .display()
                .to_string(),
        ),
        None => Some(abs.display().to_string()),
    }
}

fn resolve_path(file: &str, source_root: Option<&std::path::Path>) -> std::path::PathBuf {
    let p = std::path::Path::new(file);
    if p.is_absolute() {
        return p.to_path_buf();
    }
    match source_root {
        Some(root) => root.join(file),
        None => p.to_path_buf(),
    }
}

fn collect_files(node: &crate::tree::CallTreeNode, out: &mut std::collections::HashSet<String>) {
    let ext_ok = node.file.ends_with(".py")
        || node.file.ends_with(".ts")
        || node.file.ends_with(".tsx")
        || node.file.ends_with(".js")
        || node.file.ends_with(".jsx")
        || node.file.ends_with(".mjs")
        || node.file.ends_with(".cjs")
        || node.file.ends_with(".java")
        || node.file.ends_with(".go")
        || node.file.ends_with(".rs")
        || node.file.ends_with(".scala")
        || node.file.ends_with(".sc")
        || node.file.ends_with(".kt")
        || node.file.ends_with(".kts");
    if ext_ok {
        out.insert(node.file.clone());
    }
    for c in &node.children {
        collect_files(c, out);
    }
}

fn detect_lang(path: &std::path::Path) -> Option<FileLang> {
    let ext = path.extension()?.to_str()?;
    match ext {
        "py" => Some(FileLang::Python),
        "ts" | "tsx" => Some(FileLang::TypeScript),
        "js" | "jsx" | "mjs" | "cjs" => Some(FileLang::JavaScript),
        "java" => Some(FileLang::Java),
        "go" => Some(FileLang::Go),
        "rs" => Some(FileLang::Rust),
        // `.sc` is the worksheet/script form; both go to tree-sitter-scala.
        "scala" | "sc" => Some(FileLang::Scala),
        // `.kts` is the script form; both go to tree-sitter-kotlin-ng.
        "kt" | "kts" => Some(FileLang::Kotlin),
        _ => None,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FileLang {
    Python,
    TypeScript,
    JavaScript,
    Java,
    Go,
    Rust,
    Scala,
    Kotlin,
}

/// Iterative deepest-first attach: pick the smallest CallTreeNode
/// span that contains the finding's line. Drift's call trees can be
/// hundreds deep on big monorepos; recursing would risk stack
/// overflow with no graceful degradation.
fn attach_finding(
    node: &mut crate::tree::CallTreeNode,
    file: &str,
    finding: &Finding,
) -> bool {
    // First pass (iterative DFS): collect (depth, raw pointer) for
    // every node in the same file whose [line, line+loc] contains
    // `finding.line`. Then pick the deepest (largest depth) — same
    // semantics as "walk children first" recursion.
    let mut stack: Vec<(u32, *mut crate::tree::CallTreeNode)> =
        vec![(0, node as *mut _)];
    let mut best: Option<(u32, *mut crate::tree::CallTreeNode)> = None;
    while let Some((depth, np)) = stack.pop() {
        // SAFETY: each pointer is popped exactly once and never
        // aliased on the stack at the same time.
        let n: &mut crate::tree::CallTreeNode = unsafe { &mut *np };
        if n.file == file
            && finding.line >= n.line
            && finding.line <= n.line + n.loc.max(1)
        {
            best = match best {
                Some((d, _)) if d >= depth => best,
                _ => Some((depth, np)),
            };
        }
        for c in n.children.iter_mut() {
            stack.push((depth + 1, c as *mut _));
        }
    }
    if let Some((_, np)) = best {
        let n: &mut crate::tree::CallTreeNode = unsafe { &mut *np };
        n.findings.push(finding.clone());
        true
    } else {
        false
    }
}

/// Parse a Python file, build a `PyOrmContext`, run Django + SQLAlchemy
/// rules, run dialects' `predict_all`, run cross-ORM `SqlIrRule`s, and
/// fuse the two finding sets into a single triangulated list.
/// Fast file-based ORM scan — public entrypoint for `orm-scan` CLI.
///
/// Architecture: **single pass + cache**, Unix-style.
///
/// 1. Walk the workspace ONCE, eager-reading every file into a tiny
///    `WorkspaceFile { path, lang, source }`. We immediately apply the
///    fast-prefilter `file_might_contain_orm_signal`; non-matching
///    files are dropped here — we never re-read or parse them.
/// 2. Hand the surviving sources to `ModelGraph::build_from_sources`.
///    Cross-file model resolution gets a free ride on data we already
///    loaded — no second I/O pass.
/// 3. Run per-file ORM analysis against the cached sources (still no
///    re-read).
///
/// Before this refactor every ORM-relevant file was read TWICE (once
/// in ModelGraph::build, once in analyze_file). For Label Studio's
/// ~200 ORM files that doubled the I/O cost. Now each surviving file
/// pays exactly one `read_to_string` and one tree-sitter parse.
pub fn scan_workspace(
    source_root: &std::path::Path,
    max_files: usize,
    walk_opts: &crate::walker::WalkOpts,
) -> Vec<(std::path::PathBuf, Finding)> {
    // Single, blazingly-fast pipeline. Each ORM-relevant file pays
    // exactly ONE filesystem read AND ONE tree-sitter parse — every
    // downstream pass (ModelGraph extraction, rule matchers) re-uses
    // the cached `tree_sitter::Tree`.
    //
    //   walk_workspace
    //       │            (skips node_modules / target / venv / __pycache__)
    //       ▼
    //   walk_and_load                  ←── path discovery + read + needle filter
    //       │  Vec<WorkspaceFile>
    //       ▼
    //   parse_all                       ←── ONE tree-sitter parse per file
    //       │  Vec<ParsedFile>           (tree cached)
    //       ▼
    //   ModelGraph::from_parsed         ←── walks each cached tree, NO re-parse
    //       │  ModelGraph
    //       ▼
    //   analyze_parsed                  ←── walks each cached tree, NO re-parse
    //       │  Vec<Finding>
    //       ▼
    //   fused findings
    let cache = build_workspace_cache(source_root, max_files, walk_opts);
    let parsed: Vec<ParsedFile> = cache.into_iter().filter_map(parse_one).collect();
    let model_graph = model_graph::ModelGraph::from_parsed(&parsed);
    let mut out = Vec::new();
    for pf in &parsed {
        let Some(findings) = analyze_parsed(pf, &model_graph) else {
            continue;
        };
        for f in findings {
            out.push((pf.path.clone(), f));
        }
    }
    out
}

/// One source file that survived the prefilter — already read into
/// memory so downstream stages don't re-do the I/O.
pub struct WorkspaceFile {
    pub path: std::path::PathBuf,
    pub lang: FileLang,
    pub source: String,
}

/// A `WorkspaceFile` plus its `tree_sitter::Tree` — produced by the
/// single parse pass and shared across every subsequent AST walk
/// (ModelGraph extraction, dialect rules, fusion).
pub struct ParsedFile {
    pub path: std::path::PathBuf,
    pub lang: FileLang,
    pub source: String,
    pub tree: tree_sitter::Tree,
}

fn parse_one(wf: WorkspaceFile) -> Option<ParsedFile> {
    let mut parser = tree_sitter::Parser::new();
    let is_tsx = wf
        .path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e == "tsx");
    let lang_obj = match wf.lang {
        FileLang::Python => tree_sitter_python::LANGUAGE.into(),
        // `.tsx` needs the JSX-aware grammar — the plain TS grammar parses JSX
        // into ERROR nodes, breaking chain/loop extraction (and the React
        // hook-in-loop rule). `.ts` keeps the non-JSX grammar.
        FileLang::TypeScript if is_tsx => crate::languages::typescript_xml::language(),
        FileLang::TypeScript => crate::languages::typescript::language(),
        FileLang::JavaScript => crate::languages::javascript::language(),
        FileLang::Java => crate::languages::java::language(),
        FileLang::Go => crate::languages::go::language(),
        FileLang::Rust => crate::languages::rust::language(),
        FileLang::Scala => crate::languages::scala::language(),
        FileLang::Kotlin => crate::languages::kotlin::language(),
    };
    parser.set_language(&lang_obj).ok()?;
    let tree = parser.parse(&wf.source, None)?;
    Some(ParsedFile {
        path: wf.path,
        lang: wf.lang,
        source: wf.source,
        tree,
    })
}

/// Walk the workspace, read each candidate file ONCE, drop files
/// whose source has no ORM signal. Returns the surviving sources
/// for re-use by every downstream stage.
///
/// Delegates discovery to `walker::walk_files_with` so this walk
/// honors `.gitignore`, `.driftignore`, `DEFAULT_IGNORE_DIRS`,
/// `STATIC_ASSET_DIRS`, `is_test_path`, and the minified-bundle
/// filter — the same machinery the main source walker uses. Without
/// this, `tests/fixtures/...` files leak into the ORM pass even when
/// the user has the "Exclude test/spec/mock files" toggle on, and
/// surface as synthetic `<orm_file>` entries in the report.
fn build_workspace_cache(
    source_root: &std::path::Path,
    max_files: usize,
    walk_opts: &crate::walker::WalkOpts,
) -> Vec<WorkspaceFile> {
    let mut out: Vec<WorkspaceFile> = Vec::new();
    for (path, _size) in crate::walker::walk_files_with(source_root, walk_opts) {
        if out.len() >= max_files {
            break;
        }
        let Some(lang) = detect_lang(&path) else { continue };
        let Ok(source) = std::fs::read_to_string(&path) else { continue };
        if !file_might_contain_orm_signal(lang, &source) {
            continue;
        }
        out.push(WorkspaceFile {
            path,
            lang,
            source,
        });
    }
    out
}

/// Analyze a `ParsedFile` using the CACHED tree — zero re-parse,
/// zero re-read. Wraps in `catch_unwind` for the same soft-fail
/// policy as `analyze_file`.
fn analyze_parsed(
    pf: &ParsedFile,
    model_graph: &model_graph::ModelGraph,
) -> Option<Vec<Finding>> {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        analyze_with_tree(&pf.path, pf.lang, &pf.source, &pf.tree, model_graph)
    }));
    match result {
        Ok(v) => v,
        Err(_) => {
            eprintln!(
                "drift-orm: panic analysing {} — file skipped (soft-fail policy)",
                pf.path.display()
            );
            None
        }
    }
}

#[allow(dead_code)] // single-file fallback; production uses analyze_parsed via the cache
fn analyze_file(
    path: &std::path::Path,
    model_graph: &model_graph::ModelGraph,
) -> Option<Vec<Finding>> {
    // Per master plan §III soft-fail policy: a panic inside any
    // dialect / rule / walker MUST NOT crash the whole analysis. Wrap
    // the per-file analysis body in `catch_unwind` so one
    // pathologically-shaped source file degrades gracefully (warn +
    // skip) instead of taking down the whole CLI run.
    let path_owned = path.to_path_buf();
    let mg_ref: &model_graph::ModelGraph = model_graph;
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(move || {
        analyze_file_inner(&path_owned, mg_ref)
    }));
    match result {
        Ok(v) => v,
        Err(_) => {
            eprintln!(
                "drift-orm: panic analysing {} — file skipped (soft-fail policy)",
                path.display()
            );
            None
        }
    }
}

#[allow(dead_code)]
fn analyze_file_inner(
    path: &std::path::Path,
    model_graph: &model_graph::ModelGraph,
) -> Option<Vec<Finding>> {
    let lang = detect_lang(path)?;
    let source = std::fs::read_to_string(path).ok()?;
    if !file_might_contain_orm_signal(lang, &source) {
        return Some(Vec::new());
    }
    analyze_source_inner(path, lang, &source, model_graph)
}

/// Core analyzer body — shared by:
///   - `analyze_file` (disk-read path) → parses the file, calls us
///   - `analyze_parsed` (cache path) → calls `analyze_with_tree`
///     directly with a tree that's already parsed.
///
/// This wrapper exists for the disk-read path (single-file CLI
/// invocations). The `scan_workspace` happy path bypasses it.
#[allow(dead_code)]
fn analyze_source_inner(
    path: &std::path::Path,
    lang: FileLang,
    source: &str,
    model_graph: &model_graph::ModelGraph,
) -> Option<Vec<Finding>> {
    let mut parser = tree_sitter::Parser::new();
    let lang_obj = match lang {
        FileLang::Python => tree_sitter_python::LANGUAGE.into(),
        FileLang::TypeScript => crate::languages::typescript::language(),
        FileLang::JavaScript => crate::languages::javascript::language(),
        FileLang::Java => crate::languages::java::language(),
        FileLang::Go => crate::languages::go::language(),
        FileLang::Rust => crate::languages::rust::language(),
        FileLang::Scala => crate::languages::scala::language(),
        FileLang::Kotlin => crate::languages::kotlin::language(),
    };
    parser.set_language(&lang_obj).ok()?;
    let tree = parser.parse(source, None)?;
    analyze_with_tree(path, lang, source, &tree, model_graph)
}

/// Pure-tree analyzer: no parse, no read, just walks an existing
/// `tree_sitter::Tree`. Single source of truth for ORM rules.
fn analyze_with_tree(
    _path: &std::path::Path,
    lang: FileLang,
    source: &str,
    tree: &tree_sitter::Tree,
    model_graph: &model_graph::ModelGraph,
) -> Option<Vec<Finding>> {

    let mut orm_findings: Vec<Finding> = Vec::new();
    let mut sql_ir_findings: Vec<Finding> = Vec::new();

    match lang {
        FileLang::Python => {
            let mut ctx = python::build_context(source, &tree);
            ctx.model_graph = Some(model_graph);

            let django = python::django::DjangoDialect;
            if django.matches(&ctx) {
                run_rules(
                    &python::django::DJANGO_RULES,
                    &ctx,
                    Framework::Django,
                    &mut orm_findings,
                );
                let preds = django.predict_all(&ctx);
                run_sql_ir(&preds, "django", &mut sql_ir_findings);
            }

            let sa = python::sqlalchemy::SqlalchemyDialect;
            if sa.matches(&ctx) {
                run_rules(
                    &python::sqlalchemy::SQLALCHEMY_RULES,
                    &ctx,
                    Framework::SqlAlchemy,
                    &mut orm_findings,
                );
                let preds = sa.predict_all(&ctx);
                run_sql_ir(&preds, "sqlalchemy", &mut sql_ir_findings);
            }

            // Parallel tracks (LLM, auth/crypto) run on every Python file.
            run_rules_with_kind(
                &parallel::llm::LLM_RULES,
                &ctx,
                crate::insights::FindingKind::LlmAntipattern,
                &mut orm_findings,
            );
            run_rules_with_kind(
                &parallel::auth_crypto::AUTH_CRYPTO_RULES,
                &ctx,
                crate::insights::FindingKind::AuthCryptoAntipattern,
                &mut orm_findings,
            );
        }
        FileLang::TypeScript | FileLang::JavaScript => {
            let mut ctx = ts::build_context(source, &tree);
            ctx.model_graph = Some(model_graph);

            let prisma = ts::prisma::PrismaDialect;
            if prisma.matches(&ctx) {
                run_rules_with_kind(
                    &ts::prisma::PRISMA_RULES,
                    &ctx,
                    crate::insights::FindingKind::PrismaAntipattern,
                    &mut orm_findings,
                );
                let preds = prisma.predict_all(&ctx);
                run_sql_ir(&preds, "prisma", &mut sql_ir_findings);
            }

            let drizzle = ts::drizzle::DrizzleDialect;
            if drizzle.matches(&ctx) {
                run_rules_with_kind(
                    &ts::drizzle::DRIZZLE_RULES,
                    &ctx,
                    crate::insights::FindingKind::DrizzleAntipattern,
                    &mut orm_findings,
                );
                let preds = drizzle.predict_all(&ctx);
                run_sql_ir(&preds, "drizzle", &mut sql_ir_findings);
            }

            let typeorm = ts::typeorm::TypeormDialect;
            if typeorm.matches(&ctx) {
                run_rules_with_kind(
                    &ts::typeorm::TYPEORM_RULES,
                    &ctx,
                    crate::insights::FindingKind::TypeormAntipattern,
                    &mut orm_findings,
                );
                let preds = typeorm.predict_all(&ctx);
                run_sql_ir(&preds, "typeorm", &mut sql_ir_findings);
            }

            let seq = ts::sequelize::SequelizeDialect;
            if seq.matches(&ctx) {
                run_rules_with_kind(
                    &ts::sequelize::SEQUELIZE_RULES,
                    &ctx,
                    crate::insights::FindingKind::SequelizeAntipattern,
                    &mut orm_findings,
                );
                let preds = seq.predict_all(&ctx);
                run_sql_ir(&preds, "sequelize", &mut sql_ir_findings);
            }

            // Mongoose: rules only (no SQL-IR — document store).
            // Gate via `matches_mongoose` which checks both the explicit
            // import AND the shape-based fallback so factory-wrapped
            // usage (no direct mongoose import in the leaf file) still
            // triggers the rule matchers.
            if ts::mongoose::matches_mongoose(&ctx) {
                run_rules_with_kind(
                    &ts::mongoose::MONGOOSE_RULES,
                    &ctx,
                    crate::insights::FindingKind::MongooseAntipattern,
                    &mut orm_findings,
                );
            }

            // React parallel track (NOT an ORM): UI-framework anti-patterns.
            // Gated by `matches_react` (react/react-dom import OR hook usage)
            // so it never fires on plain TS/JS.
            if parallel::react::matches_react(&ctx) {
                run_rules_with_kind(
                    &parallel::react::REACT_RULES,
                    &ctx,
                    crate::insights::FindingKind::ReactAntipattern,
                    &mut orm_findings,
                );
            }
        }
        FileLang::Java => {
            let mut ctx = jvm::build_context(source, &tree);
            ctx.model_graph = Some(model_graph);
            let jpa = jvm::jpa::JpaDialect;
            if jpa.matches(&ctx) {
                run_rules_with_kind(
                    &jvm::jpa::JPA_RULES,
                    &ctx,
                    crate::insights::FindingKind::JpaAntipattern,
                    &mut orm_findings,
                );
                let preds = jpa.predict_all(&ctx);
                run_sql_ir(&preds, "jpa", &mut sql_ir_findings);
            }
        }
        FileLang::Go => {
            let mut ctx = go::build_context(source, &tree);
            ctx.model_graph = Some(model_graph);
            let gorm = go::gorm::GormDialect;
            if gorm.matches(&ctx) {
                run_rules_with_kind(
                    &go::gorm::GORM_RULES,
                    &ctx,
                    crate::insights::FindingKind::GormAntipattern,
                    &mut orm_findings,
                );
                let preds = gorm.predict_all(&ctx);
                run_sql_ir(&preds, "gorm", &mut sql_ir_findings);
            }
        }
        FileLang::Rust => {
            let mut ctx = rust_lang::build_context(source, &tree);
            ctx.model_graph = Some(model_graph);
            let sqlx = rust_lang::sqlx::SqlxDialect;
            if sqlx.matches(&ctx) {
                run_rules_with_kind(
                    &rust_lang::sqlx::SQLX_RULES,
                    &ctx,
                    crate::insights::FindingKind::SqlxAntipattern,
                    &mut orm_findings,
                );
                let preds = sqlx.predict_all(&ctx);
                run_sql_ir(&preds, "sqlx", &mut sql_ir_findings);
            }
        }
        FileLang::Scala => {
            let mut ctx = jvm_scala::build_context(source, &tree);
            ctx.model_graph = Some(model_graph);
            let slick = jvm_scala::slick::SlickDialect;
            if slick.matches(&ctx) {
                run_rules_with_kind(
                    &jvm_scala::slick::SLICK_RULES,
                    &ctx,
                    crate::insights::FindingKind::SlickAntipattern,
                    &mut orm_findings,
                );
                let preds = slick.predict_all(&ctx);
                run_sql_ir(&preds, "slick", &mut sql_ir_findings);
            }
            let quill = jvm_scala::quill::QuillDialect;
            if quill.matches(&ctx) {
                run_rules_with_kind(
                    &jvm_scala::quill::QUILL_RULES,
                    &ctx,
                    crate::insights::FindingKind::QuillAntipattern,
                    &mut orm_findings,
                );
                let preds = quill.predict_all(&ctx);
                run_sql_ir(&preds, "quill", &mut sql_ir_findings);
            }
        }
        FileLang::Kotlin => {
            let mut ctx = jvm_kotlin::build_context(source, &tree);
            ctx.model_graph = Some(model_graph);
            let exposed = jvm_kotlin::exposed::ExposedDialect;
            if exposed.matches(&ctx) {
                run_rules_with_kind(
                    &jvm_kotlin::exposed::EXPOSED_RULES,
                    &ctx,
                    crate::insights::FindingKind::ExposedAntipattern,
                    &mut orm_findings,
                );
                let preds = exposed.predict_all(&ctx);
                run_sql_ir(&preds, "exposed", &mut sql_ir_findings);
            }
            let ktorm = jvm_kotlin::ktorm::KtormDialect;
            if ktorm.matches(&ctx) {
                run_rules_with_kind(
                    &jvm_kotlin::ktorm::KTORM_RULES,
                    &ctx,
                    crate::insights::FindingKind::KtormAntipattern,
                    &mut orm_findings,
                );
                let preds = ktorm.predict_all(&ctx);
                run_sql_ir(&preds, "ktorm", &mut sql_ir_findings);
            }
        }
    }

    Some(fusion::fuse_findings(orm_findings, sql_ir_findings))
}

fn run_rules(
    rules: &[OrmRule],
    ctx: &PyOrmContext,
    framework: Framework,
    out: &mut Vec<Finding>,
) {
    use crate::insights::FindingKind;
    let kind = match framework {
        Framework::Django => FindingKind::DjangoAntipattern,
        Framework::SqlAlchemy => FindingKind::SqlalchemyAntipattern,
        Framework::Alembic => FindingKind::AlembicMigration,
        // `Framework::Generic` is what TS / JVM / Go / Rust dialects
        // use as a placeholder. Those dialects ALWAYS dispatch via
        // `run_rules_with_kind` directly (not this fn), so `Generic`
        // hitting this branch indicates a wiring bug — eprintln + drop
        // the findings rather than silently mislabel as Django.
        Framework::Generic => {
            eprintln!(
                "drift-orm: BUG — Framework::Generic passed to run_rules; \
                 dialect must use run_rules_with_kind. Findings dropped to avoid mislabel."
            );
            return;
        }
    };
    run_rules_with_kind(rules, ctx, kind, out);
}

fn run_rules_with_kind(
    rules: &[OrmRule],
    ctx: &PyOrmContext,
    kind: crate::insights::FindingKind,
    out: &mut Vec<Finding>,
) {
    use crate::insights::Evidence;
    for rule in rules {
        // Per-rule catch_unwind: a panic in one rule's matcher must
        // not prevent the remaining rules in the same dialect from
        // running.
        let rule_hits = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            (rule.matches)(ctx)
        }));
        let hits = match rule_hits {
            Ok(v) => v,
            Err(_) => {
                eprintln!(
                    "drift-orm: panic in rule matcher {} — rule skipped for this file",
                    rule.id
                );
                continue;
            }
        };
        for hit in hits {
            let mut evidence = vec![Evidence {
                call: rule.id.to_string(),
                line: hit.line,
                category: None,
            }];
            evidence.extend(hit.extra_evidence);
            out.push(Finding {
                kind,
                severity: rule.severity,
                effort: rule.effort,
                confidence: rule.confidence,
                line: hit.line,
                message: rule.message.to_string(),
                evidence,
                remediation: Some(rule.remediation.to_string()),
                byte_range: Some(hit.byte_range),
                fidelity: None,
                fusion_paths: vec![rule.id.to_string()],
                predicted_sql: None,
                originating_orm: None,
            });
        }
    }
}

#[cfg(test)]
mod end_to_end_tests {
    use super::*;

    #[test]
    fn analyze_django_fixture_views_py() {
        let path = std::path::Path::new(
            "tests/fixtures/python-django/app/views.py"
        );
        let mg = model_graph::ModelGraph::default();
        let findings = analyze_file(path, &mg).expect("file must analyze");
        for f in &findings {
            eprintln!(
                "  line {:3} {:25} conf={:.2} rule={:?}",
                f.line,
                f.kind.as_str(),
                f.confidence,
                f.evidence.first().map(|e| e.call.as_str()).unwrap_or("?")
            );
        }
        let dj_n1_001 = findings.iter().any(|f| {
            f.evidence.first().map(|e| e.call == "DJ-N1-001").unwrap_or(false)
        });
        assert!(
            dj_n1_001,
            "DJ-N1-001 must fire on show_users (found {} findings)",
            findings.len()
        );
    }

    #[test]
    fn analyze_file_handles_unreadable_path_softly() {
        // Soft-fail: a missing file must return None, not panic.
        let path = std::path::Path::new("/this/path/does/not/exist.py");
        let mg = model_graph::ModelGraph::default();
        let r = analyze_file(path, &mg);
        assert!(r.is_none(), "missing file must return None, not panic");
    }

    #[test]
    fn analyze_file_handles_unknown_extension_softly() {
        let mg = model_graph::ModelGraph::default();
        // A path with no extension drift-static-profiler recognises.
        let path = std::path::Path::new("tests/fixtures/python-django/app/__init__.py");
        // .py is recognised; if the file is empty it should still be Some(vec![]).
        let r = analyze_file(path, &mg);
        assert!(r.is_some(), "empty/recognised file must return Some, got {r:?}");
    }

    #[test]
    fn deeply_chained_python_source_does_not_panic() {
        // Stress-test the chain walker: build a synthetic source with
        // a 100-step method chain and verify analyze_file returns
        // Some (no panic, no stack overflow on the recursive walker).
        let mut src = String::from("from django.db import models\nqs = User.objects");
        for _ in 0..100 {
            src.push_str(".filter(a=1)");
        }
        src.push('\n');
        let tmp = std::env::temp_dir()
            .join(format!("drift-deep-chain-{}.py", std::process::id()));
        std::fs::write(&tmp, &src).unwrap();
        struct Cleanup(std::path::PathBuf);
        impl Drop for Cleanup {
            fn drop(&mut self) {
                let _ = std::fs::remove_file(&self.0);
            }
        }
        let _g = Cleanup(tmp.clone());
        let mg = model_graph::ModelGraph::default();
        let r = analyze_file(&tmp, &mg);
        assert!(r.is_some(), "deeply chained source must analyze without panic");
    }

    #[test]
    fn malformed_python_source_does_not_panic() {
        // Tree-sitter parses invalid Python into ERROR nodes; the
        // walker must walk through them gracefully.
        let src = "def foo(:\n    qs = User.objects.filter(\n    return\n";
        let tmp = std::env::temp_dir()
            .join(format!("drift-malformed-{}.py", std::process::id()));
        std::fs::write(&tmp, src).unwrap();
        struct Cleanup(std::path::PathBuf);
        impl Drop for Cleanup {
            fn drop(&mut self) {
                let _ = std::fs::remove_file(&self.0);
            }
        }
        let _g = Cleanup(tmp.clone());
        let mg = model_graph::ModelGraph::default();
        let r = analyze_file(&tmp, &mg);
        assert!(r.is_some(), "malformed source must not panic the walker");
    }

    #[test]
    fn panic_in_one_rule_does_not_crash_others() {
        // Build a synthetic rule slice with a panicking matcher AND a
        // working one. Run them through `run_rules_with_kind` and
        // assert the working one's findings still come through.
        use crate::insights::{Effort, FindingKind, Severity};
        fn panicking_matcher(_: &PyOrmContext) -> Vec<MatchHit> {
            panic!("intentional");
        }
        fn working_matcher(_: &PyOrmContext) -> Vec<MatchHit> {
            vec![MatchHit {
                line: 1,
                byte_range: 0..1,
                extra_evidence: vec![],
            }]
        }
        let rules: &[OrmRule] = &[
            OrmRule {
                id: "TEST-PANIC",
                framework: Framework::Generic,
                severity: Severity::Low,
                effort: Effort::Trivial,
                message: "panic",
                remediation: "",
                confidence: 0.5,
                matches: panicking_matcher,
            },
            OrmRule {
                id: "TEST-OK",
                framework: Framework::Generic,
                severity: Severity::Low,
                effort: Effort::Trivial,
                message: "ok",
                remediation: "",
                confidence: 0.5,
                matches: working_matcher,
            },
        ];
        let ctx = PyOrmContext::default();
        let mut out = Vec::new();
        // Silence the eprintln from the catch_unwind branch — the test
        // body must not crash.
        run_rules_with_kind(rules, &ctx, FindingKind::DjangoAntipattern, &mut out);
        assert_eq!(out.len(), 1, "panicking rule was skipped; working rule ran");
        assert_eq!(out[0].evidence[0].call, "TEST-OK");
    }
}

/// `origin` is the ORM family name in stable snake_case (e.g. `"sqlalchemy"`,
/// `"prisma"`). Stored on each finding's `originating_orm` so the
/// cross-ORM `SqlIrAntipattern` kind retains provenance through the
/// rollup pipeline.
fn run_sql_ir(preds: &[sql_ir::PredictedSql], origin: &str, out: &mut Vec<Finding>) {
    use crate::insights::{Evidence, FindingKind};
    use sql_ir_rules::BUILTIN_SQL_IR_RULES;
    for pred in preds {
        let fidelity = pred.primary_fidelity();
        for rule in BUILTIN_SQL_IR_RULES {
            // Per-rule catch_unwind: a panic in one SQL-IR rule's
            // matcher must not crash the analysis (mirrors the policy
            // for ORM-level rules in `run_rules_with_kind`).
            let rule_hits = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                (rule.matches)(pred)
            }));
            let hits = match rule_hits {
                Ok(v) => v,
                Err(_) => {
                    eprintln!(
                        "drift-orm: panic in SQL-IR rule {} — rule skipped for this prediction",
                        rule.id
                    );
                    continue;
                }
            };
            for hit in hits {
                let mut evidence = vec![Evidence {
                    call: rule.id.to_string(),
                    line: hit.line,
                    category: None,
                }];
                evidence.extend(hit.extra_evidence);
                out.push(Finding {
                    kind: FindingKind::SqlIrAntipattern,
                    severity: rule.severity,
                    effort: rule.effort,
                    confidence: rule.effective_confidence(fidelity),
                    line: hit.line,
                    message: rule.message.to_string(),
                    evidence,
                    remediation: Some(rule.remediation.to_string()),
                    byte_range: Some(hit.byte_range),
                    fidelity: Some(fidelity),
                    fusion_paths: vec![rule.id.to_string()],
                    predicted_sql: pred.primary_render(),
                    originating_orm: Some(origin.to_string()),
                });
            }
        }
    }
}
