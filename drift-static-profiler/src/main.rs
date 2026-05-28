use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use drift_static_profiler::{
    analyze, analyze_roots_with_progress, analyze_with_progress, compute_language_stats,
    tags::extract_tags, tree::render_ascii, walker::discover_source_files, AnalyzeOptions,
    CliProgress, DiscoverOpts, LanguageStats, NullProgress, Progress,
};
use std::path::PathBuf;

/// Install a `tracing` subscriber that prints compact, production-shaped
/// log lines to stderr. The library crate emits `tracing::info!` /
/// `debug!` / `warn!` at every pipeline boundary — without a subscriber
/// those calls are no-ops. We install one here so the standalone CLI
/// always produces an audit trail (`DRIFT_LOG=debug` for verbose).
///
/// Why the seam lives in the binary, not the library: Clean Architecture —
/// the library publishes events through the `tracing` facade and is
/// agnostic to where they end up; the binary chooses stderr + the
/// EnvFilter default; the Tauri host (when embedding the lib) installs
/// its own subscriber. Same logs, different sinks, zero coupling.
fn init_tracing() {
    use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
    let filter = std::env::var("DRIFT_LOG")
        .ok()
        .and_then(|s| EnvFilter::try_new(s).ok())
        .or_else(|| EnvFilter::try_from_default_env().ok())
        .unwrap_or_else(|| EnvFilter::new("info,drift_static_profiler=debug"));
    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(
            fmt::layer()
                .with_target(true)
                .with_writer(std::io::stderr)
                .compact(),
        )
        .try_init();
}

/// Pick the progress sink for the CLI context.
///
/// `CliProgress` is backed by `indicatif::MultiProgress`, which:
///   - draws live bars only when stderr is a TTY,
///   - silently skips bar redraws on non-TTY (CI / pipe / log
///     capture), but still routes per-phase `✓ <label> in Xs`
///     completion lines through `eprintln!` via the `commit_line`
///     helper, so log-shaped output stays informative.
///
/// We therefore use `CliProgress` unconditionally — no `IsTerminal`
/// gate — unless the user explicitly opts out via `DRIFT_PROGRESS=off`.
/// That env var is the escape hatch for "I really want no output at
/// all even though I'm on a TTY" (rare but useful for clean script
/// composition).
fn pick_progress() -> Box<dyn Progress> {
    if std::env::var("DRIFT_PROGRESS").as_deref() == Ok("off") {
        Box::new(NullProgress)
    } else {
        Box::new(CliProgress::new())
    }
}

/// Parse the user-facing CLI `--sql-dialect <NAME>` value into the
/// internal enum. Returns `Ok(None)` when the flag wasn't passed;
/// returns `Err` with a friendly message when the name is unknown so
/// the user sees the accepted set up-front rather than discovering it
/// only when a `.sql` file fails to parse.
fn resolve_sql_dialect(
    name: Option<&str>,
) -> Result<Option<drift_static_profiler::sql_lint::SqlDialect>> {
    match name {
        None => Ok(None),
        Some(s) => drift_static_profiler::sql_lint::SqlDialect::parse(s)
            .map(Some)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "unknown --sql-dialect {s:?}; accepted: postgres, mysql, \
                     sqlite, mssql, snowflake, bigquery, generic"
                )
            }),
    }
}

#[derive(Parser)]
#[command(name = "drift-static-profiler", version, about = "Static call-tree analyzer")]
struct Cli {
    #[command(subcommand)]
    command: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Analyze a project root and emit a call tree rooted at one or more symbols.
    Analyze {
        /// Project root to walk
        path: PathBuf,
        /// Entry-point symbol name (e.g. createOrder, create_order). Repeatable.
        #[arg(short, long)]
        entry: Vec<String>,
        /// Emit JSON instead of ASCII tree
        #[arg(long)]
        json: bool,
        /// Max tree depth (default 12)
        #[arg(long, default_value_t = 12)]
        max_depth: usize,
        /// Hide trivial getX/setX/isX accessors in the tree
        #[arg(long)]
        no_accessors: bool,
        /// Exclude test/spec/mock files entirely (path segments + filename
        /// conventions). See `walker::is_test_path` for the full rule.
        #[arg(long)]
        no_tests: bool,
    },
    /// Dump all extracted tags (definitions + references) for a project.
    Tags {
        path: PathBuf,
    },
    /// Analyze any full path and write a JSON report directly into the viewer's
    /// fixtures directory so it shows up at http://localhost:5180/.
    ///
    /// Example:
    ///   drift-static-profiler scan /Users/me/code/myproj --entry handleRequest --name myproj
    Scan {
        /// Absolute or relative path to the project root to analyze
        path: PathBuf,
        /// Entry-point symbol name (repeatable). If omitted, the report will
        /// still contain summary/graph data but no rooted call tree.
        #[arg(short, long)]
        entry: Vec<String>,
        /// Fixture name (no extension). Defaults to "custom". The JSON is
        /// written to `<out_dir>/<name>.json`.
        #[arg(long, default_value = "custom")]
        name: String,
        /// Output directory. Defaults to the viewer's public/fixtures folder
        /// relative to the current working directory.
        #[arg(long, default_value = "viewer/public/fixtures")]
        out_dir: PathBuf,
        /// Max tree depth (default 12)
        #[arg(long, default_value_t = 12)]
        max_depth: usize,
        /// Hide trivial getX/setX/isX accessors in the tree
        #[arg(long)]
        no_accessors: bool,
        /// Exclude test/spec/mock files entirely (path segments like
        /// `tests/`, `__tests__/`, `spec/` AND filename conventions like
        /// `*.test.ts`, `*_test.go`, `test_*.py`, `*Test.java`).
        #[arg(long)]
        no_tests: bool,
        /// Skip the `.sql` file scan pass (plan §3.2). By default
        /// drift walks the project for `*.sql` files, parses each with
        /// the inferred dialect, and reports SQL-rule findings as
        /// synthetic entries.
        #[arg(long)]
        no_sql_files: bool,
        /// Force a SQL dialect for the `.sql` file scan. Overrides
        /// drift's per-file inference. Accepted values: postgres,
        /// mysql, sqlite, mssql, snowflake, bigquery, generic.
        #[arg(long, value_name = "DIALECT")]
        sql_dialect: Option<String>,
        /// Also print the ASCII call tree to stdout
        #[arg(long)]
        print: bool,
    },
    /// Auto-discover every plausible root entry point in a project (symbols
    /// with no in-graph caller, ranked by transitive reach) and emit a single
    /// JSON report containing the call tree of each one. The viewer's "Roots"
    /// tab renders this as a sortable table; clicking a row drills into that
    /// entry's flame graph and call tree (same drill-in pattern as Chrome
    /// DevTools' Top-Down view, pprof's `top -cum`, or Speedscope's Sandwich).
    ///
    /// Example:
    ///   drift-static-profiler analyze-root /Users/me/code/myproj --name myproj-roots
    AnalyzeRoot {
        /// Absolute or relative path to the project root to analyze
        path: PathBuf,
        /// Fixture name (no extension). Defaults to "roots".
        #[arg(long, default_value = "roots")]
        name: String,
        /// Output directory. Defaults to the viewer's public/fixtures folder
        /// relative to the current working directory.
        #[arg(long, default_value = "viewer/public/fixtures")]
        out_dir: PathBuf,
        /// Minimum transitive reach (deduped subtree size) for a symbol to
        /// qualify as a root worth profiling. Default 2 drops leaves with no
        /// in-project callees; raise it to focus on top-level handlers.
        #[arg(long, default_value_t = 2)]
        min_reach: usize,
        /// Hard cap on number of discovered roots. Default 200 — generous but
        /// bounded so the viewer doesn't choke on a monorepo.
        #[arg(long, default_value_t = 200)]
        max_roots: usize,
        /// Include symbols under test/spec paths (off by default).
        #[arg(long)]
        include_tests: bool,
        /// Include language-conventional private symbols (`_foo`, off by default).
        #[arg(long)]
        include_private: bool,
        /// Include trivial accessors (`getX`/`setX`/`isX`, off by default).
        #[arg(long)]
        include_accessors: bool,
        /// Max tree depth per root (default 12)
        #[arg(long, default_value_t = 12)]
        max_depth: usize,
        /// Hide accessor frames inside the per-root tree (mirrors `analyze`
        /// flag). Independent from `--include-accessors`, which controls the
        /// roots-list filter.
        #[arg(long)]
        no_accessors: bool,
        /// Exclude test/spec/mock files from the WALK entirely — different
        /// from `--include-tests`, which only controls the discovery filter
        /// (root candidates). With `--no-tests`, test files don't reach the
        /// graph at all, so they don't show up as dead_code, callees, or in
        /// `findings_top`. Implies `--no-tests` semantics in `roots.rs` too.
        #[arg(long)]
        no_tests: bool,
        /// Skip the `.sql` file scan pass (plan §3.2). By default
        /// drift walks the project for `*.sql` files, parses each with
        /// the inferred dialect, and reports SQL-rule findings as
        /// synthetic entries.
        #[arg(long)]
        no_sql_files: bool,
        /// Force a SQL dialect for the `.sql` file scan. Overrides
        /// drift's per-file inference. Accepted values: postgres,
        /// mysql, sqlite, mssql, snowflake, bigquery, generic.
        #[arg(long, value_name = "DIALECT")]
        sql_dialect: Option<String>,
        /// Also print the discovered roots table to stderr
        #[arg(long)]
        print: bool,
        /// Pretty-print the JSON (default: minified, ~4× smaller).
        /// Opt in for human inspection / `diff` workflows; both forms
        /// are read identically by viewers and tooling.
        #[arg(long)]
        pretty: bool,
        /// Gzip the output as `<name>.json.gz` (default: plain `.json`).
        /// On a real polyglot scan (`pos`) this drops the file from
        /// 9.8 MB → 0.78 MB (~13× over minified; ~53× over pretty).
        #[arg(long)]
        gzip: bool,
    },
    /// Interactive scan: discover root entry points, show the top 10
    /// by reach, prompt for a selection, then build a focused report
    /// on just that one entry.
    ///
    /// Defaults invert the `scan` command's "everything" stance:
    /// test/spec/mock files are excluded at the walker stage so the
    /// menu shows production roots. Pass `--include-tests` to bring
    /// test entry points back into the candidate list.
    ///
    /// The graph is built ONCE and reused for both discovery and the
    /// focused analysis, so the prompt costs no extra parsing.
    ///
    /// Example:
    ///   drift-static-profiler scan-prompt /Users/me/code/myproj
    ScanPrompt {
        /// Absolute or relative path to the project root to analyze
        path: PathBuf,
        /// Bring test/spec/mock files back into the walk. Off by default
        /// (opposite of `scan`) — the prompt is for picking real entry
        /// points, not test fixtures.
        #[arg(long)]
        include_tests: bool,
        /// Fixture name (no extension). Defaults to the basename of `path`.
        #[arg(long)]
        name: Option<String>,
        /// Output directory. Defaults to the viewer's scans fixture dir.
        #[arg(long, default_value = "viewer/public/fixtures/scans")]
        out_dir: PathBuf,
        /// Max tree depth (default 12)
        #[arg(long, default_value_t = 12)]
        max_depth: usize,
        /// Hide trivial getX/setX/isX accessors in the call tree.
        #[arg(long)]
        no_accessors: bool,
        /// Minimum transitive reach for a symbol to appear on the menu.
        #[arg(long, default_value_t = 2)]
        min_reach: usize,
    },
    /// Rebuild the scans index used by the viewer's landing page.
    ///
    /// Walks `<dir>` for `*.json` files (excluding `index.json` itself),
    /// extracts `generator.source_root` from each scan's PREFIX (no full
    /// parse — see `scans_index::extract_source_root`), and writes
    /// `<dir>/index.json` atomically.
    ///
    /// Example:
    ///   drift-static-profiler regen-scans-index viewer/public/fixtures/scans
    RegenScansIndex {
        /// Directory holding the scan JSONs. Defaults to the viewer's
        /// scans fixture dir relative to the current working directory.
        #[arg(default_value = "viewer/public/fixtures/scans")]
        dir: PathBuf,
    },
    /// Fast file-based ORM scan: walks `<PATH>` for source files,
    /// runs the ORM static-analysis rules on each, and emits a flat
    /// findings JSON. Skips the call-graph and call-tree construction
    /// entirely — orders of magnitude faster than `analyze-root` on a
    /// large project. Use this when you only care about ORM findings.
    ///
    /// Example:
    ///   drift-static-profiler orm-scan /path/to/project
    OrmScan {
        /// Absolute or relative path to the project root.
        path: PathBuf,
        /// Output JSON file (defaults to stdout).
        #[arg(long, short)]
        out: Option<PathBuf>,
        /// Hard cap on files scanned (default 8000).
        #[arg(long, default_value_t = 8000)]
        max_files: usize,
    },
    /// Compare two report JSONs (baseline vs current). Exit non-zero if regressions found.
    Diff {
        baseline: PathBuf,
        current: PathBuf,
        /// Emit JSON instead of human-readable text
        #[arg(long)]
        json: bool,
        /// Exit 0 even when regressions are found (default: exit 1)
        #[arg(long)]
        no_fail: bool,
    },
    /// Emit the discovered call trees as a Graphviz DOT graph. Pipe
    /// into `dot -Tsvg`, `dot -Tpng`, or paste into Mermaid Live /
    /// draw.io / OmniGraffle. One subgraph cluster per discovered
    /// entry; nodes colored by depth (entries vs callees) + finding
    /// state. Reads the same project root as `analyze-root`; writes
    /// DOT to stdout by default.
    ///
    /// Example:
    ///   drift-static-profiler dot /path/to/project > graph.dot
    ///   dot -Tsvg graph.dot > graph.svg
    Dot {
        /// Absolute or relative path to the project root.
        path: PathBuf,
        /// Write DOT to this file instead of stdout.
        #[arg(long, short)]
        out: Option<PathBuf>,
        /// Minimum reach (same semantics as `analyze-root`).
        #[arg(long, default_value_t = 2)]
        min_reach: usize,
        /// Hard cap on discovered roots.
        #[arg(long, default_value_t = 200)]
        max_roots: usize,
        /// Max tree depth per root.
        #[arg(long, default_value_t = 12)]
        max_depth: usize,
        /// Exclude test/spec files (off by default — matches `scan`).
        #[arg(long)]
        no_tests: bool,
    },
    /// Emit findings as SARIF 2.1.0 — the format GitHub Code Scanning,
    /// GitLab SAST, Azure DevOps, and most enterprise security
    /// dashboards consume. Uploadable via
    /// `gh code-scanning upload` or the
    /// `github/codeql-action/upload-sarif` action.
    ///
    /// Example:
    ///   drift-static-profiler sarif /path/to/project --out drift.sarif
    Sarif {
        /// Absolute or relative path to the project root.
        path: PathBuf,
        /// Write SARIF to this file instead of stdout.
        #[arg(long, short)]
        out: Option<PathBuf>,
        /// Minimum reach (same semantics as `analyze-root`).
        #[arg(long, default_value_t = 2)]
        min_reach: usize,
        /// Hard cap on discovered roots.
        #[arg(long, default_value_t = 200)]
        max_roots: usize,
        /// Max tree depth per root.
        #[arg(long, default_value_t = 12)]
        max_depth: usize,
        /// Exclude test/spec files.
        #[arg(long)]
        no_tests: bool,
    },
    /// PR-review pipeline: runs `scan-pr` internally then enriches
    /// the output with the full `pr_review` block (counts, value-card
    /// axes, mermaid diagrams, statically-derived code suggestions,
    /// tech-debt, duplication, NFR coverage). One-shot replacement
    /// for the previous Python `pr_algorithms` layer — everything
    /// runs in this binary.
    ///
    /// Output: the standard compact report PLUS `pr_review` (the
    /// renderer envelope) PLUS `pr_review_ext` (extras: tech_debt,
    /// duplication, tests_in_graph, nfr_edge_cases).
    ///
    /// Example:
    ///   git log $BASE..$HEAD --format=%B%x00 > /tmp/commits
    ///   git diff --name-only --diff-filter=ACMRT $BASE $HEAD > /tmp/changed
    ///   drift-static-profiler pr-review /path/to/repo \
    ///       --changed-files /tmp/changed \
    ///       --commits /tmp/commits \
    ///       --output /tmp/drift-pr-review.json
    /// PR-scoped scan: builds the call graph, filters to roots
    /// transitively reaching the PR's changed files, AND enriches
    /// the output with the full review envelope (4 images, code
    /// suggestions, tech debt, duplication, NFR coverage) unless
    /// `--no-review` is passed.
    ///
    /// Output (single envelope):
    ///   - standard CompactReport fields (`string_table`, `frames`,
    ///     `summary`, `entries`)
    ///   - `pr_scope` — changed_files / affected_roots / unreachable_changes
    ///   - `pr_review` — overall_drift, counts, architecture_flow,
    ///     business_logic, value_card, code_suggestions, visual_summary
    ///   - `pr_review_ext` — tech_debt, duplication, tests_in_graph,
    ///     nfr_edge_cases
    ///
    /// Example:
    ///   git diff --name-only --diff-filter=ACMRT $BASE $HEAD > changed.txt
    ///   git log --format=%B%x00 $BASE..$HEAD > commits.txt
    ///   drift-static-profiler scan-pr /path/to/repo \
    ///       --changed-files changed.txt --commits commits.txt \
    ///       --output drift.json --pretty
    #[command(alias = "pr-review")]
    ScanPr {
        /// Absolute or relative path to the project root.
        path: PathBuf,
        /// Newline-delimited file listing repo-relative paths the PR
        /// touched. Exactly one of `--changed-files` / `--changed-files-stdin`
        /// must be supplied.
        #[arg(long, value_name = "FILE")]
        changed_files: Option<PathBuf>,
        /// Read the newline-delimited list of changed files from stdin
        /// instead of a file.
        #[arg(long, conflicts_with = "changed_files")]
        changed_files_stdin: bool,
        /// File of commit messages, NUL-byte separated
        /// (`git log --format=%B%x00 $BASE..$HEAD`). Used by the
        /// counts / value-card / NFR algorithms. Optional — without
        /// it, count chips and `perf:`/`feat:` signals will be zero
        /// but the rest of the review still works.
        #[arg(long, value_name = "FILE")]
        commits: Option<PathBuf>,
        /// I3: TSV file of per-file diff stats. Format per line:
        /// `path<TAB>additions<TAB>deletions` (the shape produced by
        /// `git diff --numstat`). Wires real LOC numbers into
        /// `value_money` (otherwise `loc_added = 0` always).
        #[arg(long, value_name = "FILE")]
        diff_stats: Option<PathBuf>,
        /// I1: JSON file matching the `PrContext` component schema.
        /// Supplies title / body / labels / linked-issues without
        /// needing separate flags. Preferred for action callers.
        #[arg(long, value_name = "FILE")]
        pr_context_file: Option<PathBuf>,
        /// I5/A1: base-ref SHA (the merge-base or `$GITHUB_EVENT_PATH
        /// .pull_request.base.sha`). When supplied, the architecture
        /// flow's `before_mermaid` placeholder is suppressed because
        /// the renderer knows a true before-state COULD be
        /// reconstructed (today the heavy graph-diff lives in the
        /// action wrapper, not here — this flag is the contract surface).
        #[arg(long, value_name = "SHA")]
        base_sha: Option<String>,
        /// PR title — feeds `business_logic.summary`.
        ///
        /// `allow_hyphen_values`: PR titles are free text and can begin
        /// with `-` (e.g. `-fix typo`). Without it, clap reads the leading
        /// `-` as an unknown flag and aborts with `unexpected argument`
        /// (exit 2) before the scan runs. See `tests/scan_pr_hyphen_args.rs`.
        #[arg(long, allow_hyphen_values = true)]
        pr_title: Option<String>,
        /// PR body — feeds `business_logic.summary`. First sentence
        /// is used.
        ///
        /// `allow_hyphen_values`: PR bodies almost always open with a
        /// markdown bullet list (`- item`) or front-matter rule (`---`),
        /// both of which start with `-`. Same clap rationale as `pr_title`.
        #[arg(long, allow_hyphen_values = true)]
        pr_body: Option<String>,
        /// Skip the review-enrichment step. Output then contains only
        /// the factual scan (no `pr_review` / `pr_review_ext`). Useful
        /// for fast smoke checks; the default is to ALWAYS enrich.
        #[arg(long)]
        no_review: bool,
        /// Write JSON to this file (default: stdout).
        #[arg(long, short = 'o', value_name = "PATH")]
        output: Option<PathBuf>,
        /// Pretty-print the JSON.
        #[arg(long)]
        pretty: bool,
        /// Passthrough to `DiscoverOpts.min_reach`. Default 2.
        #[arg(long, default_value_t = 2)]
        min_reach: usize,
        /// Passthrough to `DiscoverOpts.max_roots` — applies to the
        /// FULL discovered list before PR filtering.
        #[arg(long, default_value_t = 5000)]
        max_roots: usize,
        /// Skip test/spec/mock files at the walker stage.
        #[arg(long)]
        no_tests: bool,
        /// Max tree depth per affected root.
        #[arg(long, default_value_t = 12)]
        max_depth: usize,
        /// Hide trivial getX/setX/isX accessors in per-root trees.
        #[arg(long)]
        no_accessors: bool,
        /// Skip the `.sql` file scan pass.
        #[arg(long)]
        no_sql_files: bool,
        /// Force SQL dialect.
        #[arg(long, value_name = "DIALECT")]
        sql_dialect: Option<String>,
        /// PR-scope cap: max number of affected roots to build call
        /// trees for. Reverse-reachability marks nearly every root
        /// "affected" when a PR touches a foundational/high-fan-in file;
        /// building a depth-N tree per root then OOM-kills the runner.
        /// Roots are reach-sorted, so the top N (most impactful) are
        /// kept and the long tail dropped. Default 150.
        #[arg(long, default_value_t = 150)]
        max_affected: usize,
        /// Per-tree node cap: stop expanding a single call tree past
        /// this many nodes (cutoff marked `node-budget`). Bounds one
        /// god-function tree on a dense graph. Default 15000.
        #[arg(long, default_value_t = 15_000)]
        max_nodes_per_tree: usize,
        /// Global node budget across ALL trees in the scan; tree
        /// building stops once cumulative nodes cross it. This is the
        /// primary memory guarantee — ~150k nodes peaks near 1.5 GB on
        /// a dense graph, well within a hosted runner. Backstop against
        /// many bounded trees still summing to an OOM. Default 150000.
        #[arg(long, default_value_t = 150_000)]
        max_total_nodes: usize,
        /// Retain at most this many detailed callers per tree node
        /// (the callers_count metric stays exact). The dominant
        /// per-node allocation on dense graphs. Default 32.
        #[arg(long, default_value_t = 32)]
        max_callers_per_node: usize,
        /// Hard memory backstop in MiB for the tree-build phase: after
        /// each tree, sample peak RSS and stop building once it crosses
        /// this, emitting a partial report plus a WARN that names memory
        /// as the cause. Independent of the node budgets above (which
        /// assume ~10 KB/node) — this is the one guard that holds
        /// regardless of per-node weight, so it catches the
        /// anomalous-input case the node-count proxy under-estimates,
        /// turning an uncatchable kernel OOM-kill into a clean partial.
        /// `0` = unlimited (rely on node budgets alone). Default 0; the
        /// Drift action sets it to the runner's RAM minus headroom.
        #[arg(long, default_value_t = 0)]
        max_rss_mb: usize,
    },
}

/// Read a newline-delimited list of repo-relative paths.
///
/// Source is either a file (when `path` is `Some`) or stdin (when
/// `from_stdin` is true). Exactly one of the two must be selected;
/// the Cli layer enforces this via `conflicts_with`.
///
/// Lines are trimmed; empty lines and `#` comment lines are ignored
/// so PR-action wrappers can include human-readable annotations
/// without breaking parsing.
fn read_changed_files(
    path: Option<&std::path::Path>,
    from_stdin: bool,
) -> Result<Vec<PathBuf>> {
    let raw = match (path, from_stdin) {
        (Some(p), false) => std::fs::read_to_string(p)
            .with_context(|| format!("read changed-files list {}", p.display()))?,
        (None, true) => {
            use std::io::Read;
            let mut buf = String::new();
            std::io::stdin()
                .read_to_string(&mut buf)
                .context("read changed-files list from stdin")?;
            buf
        }
        _ => anyhow::bail!(
            "scan-pr requires exactly one of --changed-files <FILE> or --changed-files-stdin"
        ),
    };
    let out: Vec<PathBuf> = raw
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .map(PathBuf::from)
        .collect();
    Ok(out)
}

/// PR-scoped scan entry point.
///
/// Wires the CLI flags into [`drift_static_profiler::analyze_pr_with_progress`],
/// then serializes the standard compact report envelope with a
/// top-level `pr_scope` block appended via `#[serde(flatten)]`.
#[allow(clippy::too_many_arguments)]
/// One-shot scan-pr pipeline:
///   1. read changed-files list
///   2. read commit messages (optional)
///   3. run `analyze_pr_with_progress` to build the call graph +
///      pr_scope
///   4. if `--no-review` not set, run `pr_algorithms::enrich` and
///      emit a full envelope (4 images + code suggestions + ext)
///   5. else emit the factual envelope only
///
/// Output is JSON to `--output` or stdout. Progress sinks emit one
/// `phase()` per algorithm so CI logs show what's running.
#[allow(clippy::too_many_arguments)]
fn run_scan_pr(
    path: &std::path::Path,
    changed_files_path: Option<&std::path::Path>,
    changed_files_stdin: bool,
    commits_path: Option<&std::path::Path>,
    diff_stats_path: Option<&std::path::Path>,
    pr_context_file: Option<&std::path::Path>,
    base_sha: Option<&str>,
    pr_title: Option<&str>,
    pr_body: Option<&str>,
    no_review: bool,
    output: Option<&std::path::Path>,
    pretty: bool,
    min_reach: usize,
    max_roots: usize,
    no_tests: bool,
    max_depth: usize,
    no_accessors: bool,
    no_sql_files: bool,
    sql_dialect: Option<&str>,
    max_affected: usize,
    max_nodes_per_tree: usize,
    max_total_nodes: usize,
    max_callers_per_node: usize,
    max_rss_mb: usize,
) -> Result<()> {
    use drift_static_profiler::{
        analyze_pr_with_progress,
        pr_algorithms::{
            business_logic::PrContextInput, counts::ChangedFile, enrich, EnrichInputs,
        },
        AnalyzeOptions, DiscoverOpts,
    };

    let scan_pr_started_at = std::time::Instant::now();
    let changed = read_changed_files(changed_files_path, changed_files_stdin)?;
    if changed.is_empty() {
        eprintln!("note: changed-files list is empty — emitting an empty PR-scope envelope");
        tracing::warn!("scan-pr: changed-files list is empty");
    }
    tracing::info!(
        root = %path.display(),
        changed = changed.len(),
        no_review,
        base_sha = base_sha.unwrap_or("<none>"),
        has_commits = commits_path.is_some(),
        has_diff_stats = diff_stats_path.is_some(),
        has_pr_context = pr_context_file.is_some(),
        "scan-pr start"
    );

    let progress = pick_progress();
    let sql_dialect_override = resolve_sql_dialect(sql_dialect)?;

    let discover = DiscoverOpts {
        min_reach,
        skip_tests: no_tests,
        skip_private: true,
        skip_accessors: true,
        max_roots,
    };
    let opts = AnalyzeOptions {
        max_depth,
        skip_accessors: no_accessors,
        exclude_tests: no_tests,
        scan_sql_files: !no_sql_files,
        sql_dialect_override,
        max_affected,
        max_nodes_per_tree,
        max_total_nodes,
        max_callers_per_node,
        // `0` = unlimited → keep the usize::MAX sentinel so the guard in
        // `build_trees_from_ids` short-circuits. saturating_mul guards the
        // (impossible on 64-bit, cheap to keep) overflow case.
        max_rss_bytes: if max_rss_mb == 0 {
            usize::MAX
        } else {
            max_rss_mb.saturating_mul(1024 * 1024)
        },
        ..AnalyzeOptions::default()
    };
    let result = analyze_pr_with_progress(
        path,
        &changed,
        &discover,
        &opts,
        progress.as_ref(),
    )?;
    progress.finish();

    eprintln!(
        "✓ scan-pr (factual): {} changed file(s) → {} affected root(s), {} unreachable",
        result.pr_scope.changed_files.len(),
        result.pr_scope.affected_root_names.len(),
        result.pr_scope.unreachable_changes.len(),
    );
    tracing::info!(
        changed = result.pr_scope.changed_files.len(),
        affected_roots = result.pr_scope.affected_root_names.len(),
        unreachable = result.pr_scope.unreachable_changes.len(),
        rss_peak_mb = drift_static_profiler::mem::peak_rss_mb().unwrap_or(0),
        "scan-pr factual phase complete"
    );

    if no_review {
        tracing::info!(
            elapsed_ms = scan_pr_started_at.elapsed().as_millis() as u64,
            "scan-pr complete (no review)"
        );
        // Factual-only envelope.
        return write_envelope(&result, None, output, pretty);
    }

    // ── Enrichment phase ───────────────────────────────────────────
    let commit_messages = read_commit_messages(commits_path)?;
    // I3: read --diff-stats TSV (path<TAB>additions<TAB>deletions) if
    // supplied. We index by repo-relative path for O(1) lookup when
    // building the ChangedFile list below.
    let diff_stats_map = read_diff_stats(diff_stats_path)?;
    let changed_files: Vec<ChangedFile> = changed
        .iter()
        .map(|p| {
            let path_str = p.display().to_string();
            let (additions, deletions) = diff_stats_map
                .get(&path_str)
                .copied()
                .unwrap_or((0, 0));
            ChangedFile {
                path: path_str,
                status: None,
                additions,
                deletions,
            }
        })
        .collect();
    // I1: read --pr-context FILE if supplied. The JSON shape matches
    // the OpenAPI `PrContext` component; we project title+body into
    // the algorithm-facing `PrContextInput`.
    // C2: support `--pr-body @path` syntax for file-backed bodies.
    let body_str = resolve_at_path(pr_body)?;
    let pr_context = if let Some(file) = pr_context_file {
        Some(read_pr_context_file(file)?)
    } else {
        match (pr_title, body_str.as_deref()) {
            (None, None) => None,
            (t, b) => Some(PrContextInput {
                title: t.unwrap_or("").to_string(),
                body: b.unwrap_or("").to_string(),
            }),
        }
    };

    let enrich_progress = pick_progress();
    let mut enriched = enrich(EnrichInputs {
        outcome: &result,
        commit_messages: &commit_messages,
        changed_files: &changed_files,
        pr_context: pr_context.as_ref(),
        repo_root: Some(path),
        progress: Some(enrich_progress.as_ref()),
    });
    enrich_progress.finish();

    // A1/I5: when no --base-sha was supplied, the before_mermaid is
    // a placeholder ("Before-state requires --base-sha…"). Drop it
    // entirely per the spec's "silence > noise" rule so renderers
    // don't show a confusing dead panel. When base-sha IS supplied,
    // keep the placeholder text — future work in the action wrapper
    // will replace it with a real before-state graph from `git
    // checkout $BASE`.
    if base_sha.is_none() {
        enriched.pr_review.architecture_flow.before_mermaid.clear();
    }

    eprintln!(
        "✓ scan-pr (enriched): {} code-suggestion(s) · {} data-structure(s) · \
         {} risk(s) · {} duplication cluster(s) · {} test-files-in-graph",
        enriched.pr_review.code_suggestions.len(),
        enriched.pr_review.architecture_flow.data_structures.len(),
        enriched.pr_review.visual_summary.risks.items.len(),
        enriched.pr_review_ext.duplication.count,
        enriched.pr_review_ext.tests_in_graph.test_files,
    );
    tracing::info!(
        suggestions = enriched.pr_review.code_suggestions.len(),
        data_structures = enriched.pr_review.architecture_flow.data_structures.len(),
        risks = enriched.pr_review.visual_summary.risks.items.len(),
        duplication = enriched.pr_review_ext.duplication.count,
        test_files = enriched.pr_review_ext.tests_in_graph.test_files,
        elapsed_ms = scan_pr_started_at.elapsed().as_millis() as u64,
        "scan-pr complete (enriched)"
    );

    write_envelope(&result, Some(&enriched), output, pretty)
}

/// Slim envelope writer.
///
/// The output deliberately OMITS the heavy CompactReport internals
/// (`string_table`, `frames`, `entries`, `summary`) — those exist
/// only so the algorithms can build pr_review_ext + pr_scope from
/// the call graph, and they're internal to drift. Downstream
/// consumers (the GitHub Action / LLM renderer / PR-comment poster)
/// only need:
///
///   - `schema_version` + `mode` — version stamps
///   - `generator` — provenance (tool name, version, captured_at)
///   - `pr_scope` — factual changed-files / affected-roots / unreachable
///   - `pr_review` — Image 1/2/3/4 mermaid + code suggestions
///   - `pr_review_ext` — tech_debt / duplication / tests_in_graph / NFR
///
/// Before this slim form, kotlin-ktor output was ~34 KB; after, ~10 KB.
/// The internal call-graph data is regenerated on every scan-pr, so
/// nothing is lost.
fn write_envelope(
    result: &drift_static_profiler::AnalyzePrOutcome,
    enriched: Option<&drift_static_profiler::pr_algorithms::EnrichedReport>,
    output: Option<&std::path::Path>,
    pretty: bool,
) -> Result<()> {
    use drift_static_profiler::pr_algorithms::{PrReview, PrReviewExt};
    use drift_static_profiler::report::Generator;
    use serde::Serialize;
    use std::io::{BufWriter, Write};

    #[derive(Serialize)]
    struct PrScopeBlock<'a> {
        changed_files: &'a [PathBuf],
        affected_roots: &'a [String],
        unreachable_changes: &'a [PathBuf],
    }

    #[derive(Serialize)]
    struct Envelope<'a> {
        schema_version: &'a str,
        mode: &'a str,
        generator: &'a Generator,
        pr_scope: PrScopeBlock<'a>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pr_review: Option<&'a PrReview>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pr_review_ext: Option<&'a PrReviewExt>,
    }

    let report = &result.outcome.report;
    let envelope = Envelope {
        schema_version: &report.schema_version,
        mode: &report.mode,
        generator: &report.generator,
        pr_scope: PrScopeBlock {
            changed_files: &result.pr_scope.changed_files,
            affected_roots: &result.pr_scope.affected_root_names,
            unreachable_changes: &result.pr_scope.unreachable_changes,
        },
        pr_review: enriched.map(|e| &e.pr_review),
        pr_review_ext: enriched.map(|e| &e.pr_review_ext),
    };

    match output {
        Some(p) => {
            let file = std::fs::File::create(p)
                .with_context(|| format!("create scan-pr output {}", p.display()))?;
            let mut buf = BufWriter::with_capacity(256 * 1024, file);
            if pretty {
                serde_json::to_writer_pretty(&mut buf, &envelope).context("serialize")?;
            } else {
                serde_json::to_writer(&mut buf, &envelope).context("serialize")?;
            }
            buf.flush()
                .with_context(|| format!("flush scan-pr output {}", p.display()))?;
            eprintln!("✓ wrote {}", p.display());
        }
        None => {
            let stdout = std::io::stdout();
            let mut buf = BufWriter::with_capacity(256 * 1024, stdout.lock());
            if pretty {
                serde_json::to_writer_pretty(&mut buf, &envelope).context("serialize")?;
            } else {
                serde_json::to_writer(&mut buf, &envelope).context("serialize")?;
            }
            buf.write_all(b"\n").ok();
            buf.flush().context("flush stdout")?;
        }
    }
    Ok(())
}

/// I3: parse `git diff --numstat` output. Returns a path-keyed
/// hashmap of (additions, deletions). TSV format per line:
///     <additions>\t<deletions>\t<path>
/// We also accept the legacy `path\tadds\tdels` ordering for
/// hand-written test files. Binary diffs (numstat shows `-\t-`)
/// are skipped silently.
fn read_diff_stats(
    path: Option<&std::path::Path>,
) -> Result<std::collections::HashMap<String, (usize, usize)>> {
    use std::collections::HashMap;
    let Some(p) = path else { return Ok(HashMap::new()) };
    let raw = std::fs::read_to_string(p)
        .with_context(|| format!("read diff-stats file {}", p.display()))?;
    let mut out: HashMap<String, (usize, usize)> = HashMap::new();
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 3 {
            continue;
        }
        // Detect ordering: if column 0 parses as an integer, this is
        // git-numstat ordering (`adds\tdels\tpath`). Otherwise
        // assume the hand-written `path\tadds\tdels` ordering.
        let (adds, dels, path) = if cols[0].parse::<usize>().is_ok() {
            (cols[0], cols[1], cols[2..].join("\t"))
        } else {
            (cols[1], cols[2], cols[0].to_string())
        };
        let Ok(a) = adds.parse::<usize>() else { continue };
        let Ok(d) = dels.parse::<usize>() else { continue };
        out.insert(path, (a, d));
    }
    Ok(out)
}

/// I1: parse a `PrContext`-shaped JSON file and project it into the
/// algorithm-facing `PrContextInput` (title + body). We keep the
/// `PrContext` schema rich for forward-compat (labels, linked
/// issues, head/base SHAs) but the algorithm only needs title+body
/// today.
fn read_pr_context_file(
    path: &std::path::Path,
) -> Result<drift_static_profiler::pr_algorithms::business_logic::PrContextInput> {
    use drift_static_profiler::pr_algorithms::business_logic::PrContextInput;
    use serde::Deserialize;
    #[derive(Deserialize, Default)]
    struct PrContextDoc {
        #[serde(default)]
        title: String,
        #[serde(default)]
        body: String,
    }
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("read pr-context file {}", path.display()))?;
    let doc: PrContextDoc = serde_json::from_str(&raw)
        .with_context(|| format!("parse pr-context JSON {}", path.display()))?;
    Ok(PrContextInput {
        title: doc.title,
        body: doc.body,
    })
}

/// C2: support `--pr-body @path/to/file` syntax. If the body starts
/// with `@`, treat the rest as a file path; otherwise the body is
/// the literal string. Mirrors curl's `@file` convention.
fn resolve_at_path(s: Option<&str>) -> Result<Option<String>> {
    let Some(raw) = s else { return Ok(None) };
    if let Some(p) = raw.strip_prefix('@') {
        let text = std::fs::read_to_string(p)
            .with_context(|| format!("read --pr-body @{p}"))?;
        return Ok(Some(text));
    }
    Ok(Some(raw.to_string()))
}

/// Read null-byte separated commit messages from disk (or `-` for
/// stdin). Convention: `git log --format=%B%x00 $BASE..$HEAD`.
/// Falls back to `\n\n` splitting when no null bytes are present.
fn read_commit_messages(path: Option<&std::path::Path>) -> Result<Vec<String>> {
    let raw = match path {
        Some(p) if p.to_string_lossy() == "-" => {
            use std::io::Read;
            let mut buf = String::new();
            std::io::stdin()
                .read_to_string(&mut buf)
                .context("read commits from stdin")?;
            buf
        }
        Some(p) => std::fs::read_to_string(p)
            .with_context(|| format!("read commits file {}", p.display()))?,
        None => return Ok(Vec::new()),
    };
    let out: Vec<String> = if raw.contains('\0') {
        raw.split('\0')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        raw.split("\n\n")
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    };
    Ok(out)
}

fn run_orm_scan(path: &std::path::Path, out: Option<&std::path::Path>, max_files: usize) -> Result<()> {
    let start = std::time::Instant::now();
    // Mirror the desktop default posture: walk respecting gitignore /
    // driftignore / default-ignore dirs, but with `exclude_tests=false`
    // so `orm-scan` keeps surfacing test-file findings unless a future
    // `--no-tests` flag is wired in. The fix here is structural — the
    // walk is no longer bespoke — even though the default behavior of
    // this command stays the same.
    let walk_opts = drift_static_profiler::walker::WalkOpts::default();
    let findings = drift_static_profiler::orm::scan_workspace(path, max_files, &walk_opts);
    let elapsed_ms = start.elapsed().as_millis();

    // Group by rule_id for a tidy summary.
    let mut by_rule: std::collections::BTreeMap<String, usize> =
        std::collections::BTreeMap::new();
    for (_p, f) in &findings {
        if let Some(rule) = f.evidence.first().map(|e| e.call.clone()) {
            *by_rule.entry(rule).or_default() += 1;
        }
    }

    // Category & ORM-family rollups — same kind→category mapping the
    // full report uses. Lets callers of `orm-scan` see the breakdown
    // without having to re-aggregate the flat findings array.
    let mut by_category: std::collections::BTreeMap<String, usize> =
        std::collections::BTreeMap::new();
    let mut by_orm_family: std::collections::BTreeMap<String, usize> =
        std::collections::BTreeMap::new();
    for (_p, f) in &findings {
        *by_category
            .entry(f.kind.category().as_str().to_string())
            .or_default() += 1;
        if let Some(fam) = f.orm_family() {
            *by_orm_family.entry(fam.to_string()).or_default() += 1;
        }
    }

    #[derive(serde::Serialize)]
    struct OrmScanRecord {
        file: String,
        line: usize,
        kind: String,
        rule: String,
        confidence: f64,
        severity: String,
        message: String,
        remediation: Option<String>,
    }
    let records: Vec<OrmScanRecord> = findings
        .iter()
        .map(|(p, f)| OrmScanRecord {
            file: p
                .strip_prefix(path)
                .unwrap_or(p)
                .display()
                .to_string(),
            line: f.line,
            kind: f.kind.as_str().to_string(),
            rule: f
                .evidence
                .first()
                .map(|e| e.call.clone())
                .unwrap_or_default(),
            confidence: f.confidence,
            severity: format!("{:?}", f.severity).to_lowercase(),
            message: f.message.clone(),
            remediation: f.remediation.clone(),
        })
        .collect();

    let report = serde_json::json!({
        "schema_version": 1,
        "mode": "orm-scan",
        "root": path.display().to_string(),
        "elapsed_ms": elapsed_ms,
        "summary": {
            "total_findings": findings.len(),
            "by_rule": by_rule,
            "by_category": by_category,
            "by_orm_family": by_orm_family,
        },
        "findings": records,
    });

    let body = serde_json::to_string_pretty(&report)?;
    match out {
        Some(p) => {
            std::fs::write(p, body)?;
            println!(
                "orm-scan: {} findings in {} ms — wrote {}",
                findings.len(),
                elapsed_ms,
                p.display()
            );
        }
        None => println!("{body}"),
    }
    Ok(())
}

fn main() -> Result<()> {
    init_tracing();
    let started_at = std::time::Instant::now();
    let cli = Cli::parse();
    // One-line entrypoint banner: `cmd=… version=…`. Lets log aggregators
    // group all the pipeline phases that follow under a single run.
    let cmd_name = match &cli.command {
        Cmd::Analyze { .. } => "analyze",
        Cmd::Tags { .. } => "tags",
        Cmd::Scan { .. } => "scan",
        Cmd::AnalyzeRoot { .. } => "analyze-root",
        Cmd::ScanPrompt { .. } => "scan-prompt",
        Cmd::RegenScansIndex { .. } => "regen-scans-index",
        Cmd::OrmScan { .. } => "orm-scan",
        Cmd::Diff { .. } => "diff",
        Cmd::Dot { .. } => "dot",
        Cmd::Sarif { .. } => "sarif",
        Cmd::ScanPr { .. } => "scan-pr",
    };
    tracing::info!(
        cmd = cmd_name,
        version = env!("CARGO_PKG_VERSION"),
        "drift-static-profiler starting"
    );
    let result = match cli.command {
        Cmd::Analyze {
            path,
            entry,
            json,
            max_depth,
            no_accessors,
            no_tests,
        } => run_analyze(&path, &entry, json, max_depth, no_accessors, no_tests),
        Cmd::Tags { path } => run_tags(&path),
        Cmd::RegenScansIndex { dir } => run_regen_scans_index(&dir),
        Cmd::ScanPrompt {
            path,
            include_tests,
            name,
            out_dir,
            max_depth,
            no_accessors,
            min_reach,
        } => run_scan_prompt(
            &path,
            include_tests,
            name.as_deref(),
            &out_dir,
            max_depth,
            no_accessors,
            min_reach,
        ),
        Cmd::OrmScan {
            path,
            out,
            max_files,
        } => run_orm_scan(&path, out.as_deref(), max_files),
        Cmd::Diff {
            baseline,
            current,
            json,
            no_fail,
        } => run_diff(&baseline, &current, json, no_fail),
        Cmd::Dot {
            path,
            out,
            min_reach,
            max_roots,
            max_depth,
            no_tests,
        } => run_dot(&path, out.as_deref(), min_reach, max_roots, max_depth, no_tests),
        Cmd::Sarif {
            path,
            out,
            min_reach,
            max_roots,
            max_depth,
            no_tests,
        } => run_sarif(&path, out.as_deref(), min_reach, max_roots, max_depth, no_tests),
        Cmd::Scan {
            path,
            entry,
            name,
            out_dir,
            max_depth,
            no_accessors,
            no_tests,
            no_sql_files,
            sql_dialect,
            print,
        } => run_scan(
            &path,
            &entry,
            &name,
            &out_dir,
            max_depth,
            no_accessors,
            no_tests,
            no_sql_files,
            sql_dialect.as_deref(),
            print,
        ),
        Cmd::ScanPr {
            path,
            changed_files,
            changed_files_stdin,
            commits,
            diff_stats,
            pr_context_file,
            base_sha,
            pr_title,
            pr_body,
            no_review,
            output,
            pretty,
            min_reach,
            max_roots,
            no_tests,
            max_depth,
            no_accessors,
            no_sql_files,
            sql_dialect,
            max_affected,
            max_nodes_per_tree,
            max_total_nodes,
            max_callers_per_node,
            max_rss_mb,
        } => run_scan_pr(
            &path,
            changed_files.as_deref(),
            changed_files_stdin,
            commits.as_deref(),
            diff_stats.as_deref(),
            pr_context_file.as_deref(),
            base_sha.as_deref(),
            pr_title.as_deref(),
            pr_body.as_deref(),
            no_review,
            output.as_deref(),
            pretty,
            min_reach,
            max_roots,
            no_tests,
            max_depth,
            no_accessors,
            no_sql_files,
            sql_dialect.as_deref(),
            max_affected,
            max_nodes_per_tree,
            max_total_nodes,
            max_callers_per_node,
            max_rss_mb,
        ),
        Cmd::AnalyzeRoot {
            path,
            name,
            out_dir,
            min_reach,
            max_roots,
            include_tests,
            include_private,
            include_accessors,
            max_depth,
            no_accessors,
            no_tests,
            no_sql_files,
            sql_dialect,
            print,
            pretty,
            gzip,
        } => run_analyze_root(
            &path,
            &name,
            &out_dir,
            min_reach,
            max_roots,
            include_tests,
            include_private,
            include_accessors,
            max_depth,
            no_accessors,
            no_tests,
            no_sql_files,
            sql_dialect.as_deref(),
            print,
            pretty,
            gzip,
        ),
    };
    let elapsed_ms = started_at.elapsed().as_millis();
    match &result {
        Ok(_) => tracing::info!(cmd = cmd_name, elapsed_ms, "drift-static-profiler done"),
        Err(e) => tracing::error!(cmd = cmd_name, elapsed_ms, error = %e, "drift-static-profiler failed"),
    }
    result
}

fn run_diff(
    baseline: &std::path::Path,
    current: &std::path::Path,
    json: bool,
    no_fail: bool,
) -> Result<()> {
    use drift_static_profiler::{compact, diff};
    // `compact::read_report` accepts both legacy 1.0 (denormalized) and
    // new 1.1 (interned) reports — auto-detected via the presence of
    // `string_table` at the top level. Lets `diff` cross 1.0↔1.1.
    let base = compact::read_report(
        &std::fs::read(baseline)
            .with_context(|| format!("read baseline {}", baseline.display()))?,
    )
    .context("parse baseline JSON")?;
    let cur = compact::read_report(
        &std::fs::read(current)
            .with_context(|| format!("read current {}", current.display()))?,
    )
    .context("parse current JSON")?;

    let d = diff::diff(&base, &cur);

    if json {
        println!("{}", serde_json::to_string_pretty(&d).context("serialize")?);
    } else {
        print!("{}", diff::render(&d));
    }

    if !no_fail && !d.regressions.is_empty() {
        std::process::exit(1);
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn run_analyze(
    root: &std::path::Path,
    entries: &[String],
    json: bool,
    max_depth: usize,
    no_accessors: bool,
    no_tests: bool,
) -> Result<()> {
    if entries.is_empty() {
        eprintln!("note: no --entry given; pass one or more entry-point symbol names");
        return Ok(());
    }

    let outcome = analyze(
        root,
        entries,
        &AnalyzeOptions {
            max_depth,
            skip_accessors: no_accessors,
            exclude_tests: no_tests,
            ..AnalyzeOptions::default()
        },
    )?;
    print_language_summary(&outcome.language_stats);
    for q in &outcome.unresolved_entries {
        eprintln!("warn: no symbol matched entry {q:?}");
    }

    if json {
        // Emit the interned 1.1 wire form so analyze --json output
        // matches what `scan` writes to disk — same shape, same
        // dedup. Consumers must use `compact::read_report` (or the
        // viewer's decompress.ts) to load it.
        let compact = drift_static_profiler::compact::CompactReport::from_report(&outcome.report);
        println!(
            "{}",
            serde_json::to_string_pretty(&compact).context("serialize")?
        );
    } else {
        for r in &outcome.report.entries {
            println!("{}", render_ascii(r));
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn run_scan(
    root: &std::path::Path,
    entries: &[String],
    name: &str,
    out_dir: &std::path::Path,
    max_depth: usize,
    no_accessors: bool,
    no_tests: bool,
    no_sql_files: bool,
    sql_dialect: Option<&str>,
    print: bool,
) -> Result<()> {
    let progress = pick_progress();
    let sql_dialect_override = resolve_sql_dialect(sql_dialect)?;
    let outcome = analyze_with_progress(
        root,
        entries,
        &AnalyzeOptions {
            max_depth,
            skip_accessors: no_accessors,
            exclude_tests: no_tests,
            scan_sql_files: !no_sql_files,
            sql_dialect_override,
            ..AnalyzeOptions::default()
        },
        progress.as_ref(),
    )?;
    // Serialize + write are the last two phases of the scan from the
    // user's perspective: `serde_json::to_string_pretty` on a 700-
    // entry report can take a couple of seconds, and writing the
    // resulting (possibly 100MB+) JSON to disk is non-trivial too.
    // Both used to be silent — surface them so the user sees the
    // overall bar reach its final phases instead of hanging.
    write_report_with_progress(&outcome, name, out_dir, progress.as_ref())?;
    progress.finish();

    print_language_summary(&outcome.language_stats);
    for q in &outcome.unresolved_entries {
        eprintln!("warn: no symbol matched entry {q:?}");
    }
    eprintln!(
        "✓ wrote viewer/public/fixtures/{name}.json ({} entries, {} symbols)",
        outcome.report.entries.len(),
        outcome.report.summary.symbols,
    );
    eprintln!(
        "  open the viewer (make viewer) and pick the fixture named '{name}' to see it",
    );

    if print {
        for r in &outcome.report.entries {
            println!("{}", render_ascii(r));
        }
    }
    Ok(())
}

/// Serialize the report to pretty JSON and stream it to disk via a
/// `BufWriter`, with a single `phase()` label so the CLI's overall
/// bar surfaces the work. Shared between `run_scan` and
/// `run_analyze_root` because both have the identical write tail.
///
/// Why streaming (vs. the old `to_string_pretty` + `fs::write`):
///   - `to_string_pretty` serializes the WHOLE report into a `String`
///     before any bytes hit disk. On a large polyglot scan that's a
///     100MB+ allocation that lives alongside the report's own
///     in-memory structures — easy to push peak RSS past 1 GB.
///   - `to_writer_pretty` walks the serde tree and pushes bytes
///     directly through the writer. With a 256 KB-buffered
///     `BufWriter` in front of the file we get amortized 256 KB
///     syscalls instead of one monolithic `fs::write`. Net effect:
///     same wall time on small reports, and **no double-buffer
///     memory cost on big ones**.
///
/// One phase, not two: serialize and write are interleaved by the
/// streaming path (serde produces bytes → BufWriter accumulates →
/// flushes at 256 KB boundaries → disk). The user can't meaningfully
/// separate "CPU-bound serialize" from "IO-bound write" anymore, so
/// we surface a single combined `writing …` phase. If the merged
/// timing ever masks a slow regression we can split it apart again,
/// but with streaming the wall-clock IS one timer.
fn write_report_with_progress(
    outcome: &drift_static_profiler::AnalyzeOutcome,
    name: &str,
    out_dir: &std::path::Path,
    progress: &dyn Progress,
) -> Result<()> {
    write_report_with_options(
        outcome, name, out_dir, progress, /*pretty=*/ false, /*gzip=*/ false,
    )
}

/// Streaming-write variant that lets the caller choose pretty-vs-minified
/// and plain-vs-gzipped on-disk encoding.
///
/// Empirical numbers from a real polyglot scan (`pos`, 154 files, 1099
/// symbols, 3546 edges):
///
/// | encoding             | size      | factor |
/// |----------------------|-----------|--------|
/// | pretty (legacy)      | 41.67 MB  | 1.0×   |
/// | **minified (default)** | **9.83 MB** | **4.2× smaller** |
/// | minified + gzip      | 0.78 MB   | 53× smaller |
///
/// The compact 1.1 wire form (`string_table` + `frames` interning) is
/// emitted in all three cases; only the JSON serializer's whitespace
/// + optional gzip layer change. Every existing reader (`compact::
/// read_report`, viewer, diff) auto-handles both whitespace variants;
/// the gzip path is detected by the `.json.gz` filename extension at
/// load time.
fn write_report_with_options(
    outcome: &drift_static_profiler::AnalyzeOutcome,
    name: &str,
    out_dir: &std::path::Path,
    progress: &dyn Progress,
    pretty: bool,
    gzip: bool,
) -> Result<()> {
    use std::io::{BufWriter, Write};

    std::fs::create_dir_all(out_dir)
        .with_context(|| format!("create output dir {}", out_dir.display()))?;
    let ext = if gzip { "json.gz" } else { "json" };
    let out_path = out_dir.join(format!("{name}.{ext}"));

    progress.phase(&format!("writing {}…", out_path.display()));
    let file = std::fs::File::create(&out_path)
        .with_context(|| format!("create report file {}", out_path.display()))?;
    // BufWriter sits CLOSEST to the file so syscalls are amortized
    // even when gzip is enabled. The gzip encoder's own internal
    // buffer is independent of this one.
    let buf = BufWriter::with_capacity(256 * 1024, file);

    // Build the layered writer based on the flags. The closure shape
    // keeps the inner `serde_json::to_writer{,_pretty}` call generic
    // over the actual writer type (BufWriter vs GzEncoder).
    if gzip {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        // `Compression::default()` is level 6 — the historical sweet
        // spot for "shrink JSON dramatically without burning a tail's
        // worth of CPU". A 50× ratio at level 6 is typical for JSON
        // with lots of string repetition (our scan output qualifies).
        let mut writer = GzEncoder::new(buf, Compression::default());
        write_compact(&mut writer, &outcome.report, pretty)?;
        writer
            .finish()
            .with_context(|| format!("finalize gzip stream {}", out_path.display()))?;
    } else {
        let mut writer = buf;
        write_compact(&mut writer, &outcome.report, pretty)?;
        writer
            .flush()
            .with_context(|| format!("flush report to {}", out_path.display()))?;
    }
    Ok(())
}

/// One-liner that picks the right `compact::write_report*` based on
/// `pretty`. Kept separate so the layered-writer logic above stays
/// focused on plumbing.
fn write_compact<W: std::io::Write>(
    writer: W,
    report: &drift_static_profiler::report::Report,
    pretty: bool,
) -> Result<()> {
    if pretty {
        drift_static_profiler::compact::write_report_pretty(writer, report)
            .context("serialize")?;
    } else {
        drift_static_profiler::compact::write_report(writer, report)
            .context("serialize")?;
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn run_analyze_root(
    root: &std::path::Path,
    name: &str,
    out_dir: &std::path::Path,
    min_reach: usize,
    max_roots: usize,
    include_tests: bool,
    include_private: bool,
    include_accessors: bool,
    max_depth: usize,
    no_accessors: bool,
    no_tests: bool,
    no_sql_files: bool,
    sql_dialect: Option<&str>,
    print: bool,
    pretty: bool,
    gzip: bool,
) -> Result<()> {
    // `--no-tests` (walker-level filter) implies `--no-include-tests`
    // (discover-roots filter): if test files don't reach the graph at
    // all, there's no test code left for roots to discover anyway. But
    // we honor `--include-tests` if the user passes BOTH (they get
    // whatever the walker emitted). Default behavior unchanged.
    let discover = DiscoverOpts {
        min_reach,
        skip_tests: !include_tests,
        skip_private: !include_private,
        skip_accessors: !include_accessors,
        max_roots,
    };
    let progress = pick_progress();
    let sql_dialect_override = resolve_sql_dialect(sql_dialect)?;
    let outcome = analyze_roots_with_progress(
        root,
        &discover,
        &AnalyzeOptions {
            max_depth,
            skip_accessors: no_accessors,
            exclude_tests: no_tests,
            scan_sql_files: !no_sql_files,
            sql_dialect_override,
            ..AnalyzeOptions::default()
        },
        progress.as_ref(),
    )?;
    // Same write tail as run_scan — the JSON serialize + disk write
    // are the last visible phases of the scan and used to be silent.
    write_report_with_options(&outcome, name, out_dir, progress.as_ref(), pretty, gzip)?;
    progress.finish();

    print_language_summary(&outcome.language_stats);
    eprintln!(
        "discovered {} root entry points (min_reach={min_reach}, max_roots={max_roots})",
        outcome.discovered_roots.len(),
    );
    let ext = if gzip { "json.gz" } else { "json" };
    eprintln!(
        "✓ wrote {}/{}.{ext} ({} entries, {} symbols)",
        out_dir.display(),
        name,
        outcome.report.entries.len(),
        outcome.report.summary.symbols,
    );
    eprintln!(
        "  open the viewer (make viewer) and pick the fixture named '{name}' to see it",
    );

    print_category_breakdown(&outcome.report.summary);

    if print {
        eprintln!("\ntop roots (ranked by reach):");
        for (i, r) in outcome.discovered_roots.iter().take(20).enumerate() {
            eprintln!("  {:>3}. {:<32} reach={}", i + 1, r.name, r.reach);
        }
    }
    Ok(())
}

/// Interactive root-pick scan. See `Cmd::ScanPrompt`.
///
/// Pipeline:
///   1. Build graph + discover top-N roots (excluding tests unless
///      `include_tests`).
///   2. Render the menu to stderr, read selection from stdin.
///   3. If a root is picked: build a focused report for that one
///      entry, write JSON, regenerate the scans index.
///   4. If user quits or stdin is closed: exit cleanly with code 0.
///
/// We intentionally pin `--max-roots = 10` here so the menu is always
/// bounded. If a user wants the full discovered list, `analyze-root`
/// remains the right tool.
#[allow(clippy::too_many_arguments)]
fn run_scan_prompt(
    path: &std::path::Path,
    include_tests: bool,
    name: Option<&str>,
    out_dir: &std::path::Path,
    max_depth: usize,
    no_accessors: bool,
    min_reach: usize,
) -> Result<()> {
    use drift_static_profiler::{analyze_picked_with_progress, AnalyzeOptions, DiscoverOpts};
    use std::io::{IsTerminal, Write};

    // Sanity: scan-prompt is interactive by design. Refuse early when
    // stdin isn't a TTY so users in CI/pipes don't get a hanging read.
    // The env-var escape hatch exists for testing only — exposes the
    // same prompt-loop on a piped stdin so end-to-end smoke tests can
    // verify the picker without needing a pty harness.
    if !std::io::stdin().is_terminal()
        && std::env::var("DRIFT_SCAN_PROMPT_ALLOW_PIPE").is_err()
    {
        anyhow::bail!(
            "scan-prompt requires an interactive terminal — pipe or CI invocation detected.\n\
             For non-interactive scanning use `analyze-root` (auto-discovers all roots).",
        );
    }

    let progress = pick_progress();
    let discover = DiscoverOpts {
        min_reach,
        skip_tests: !include_tests,
        skip_private: true,
        skip_accessors: true,
        max_roots: 10,
    };
    let opts = AnalyzeOptions {
        max_depth,
        skip_accessors: no_accessors,
        // include_tests=false → walker drops test files at the walk stage
        // so they don't show up as callees or in dead_code either.
        exclude_tests: !include_tests,
        ..AnalyzeOptions::default()
    };

    let outcome = analyze_picked_with_progress(
        path,
        &discover,
        &opts,
        progress.as_ref(),
        |rows| pick_root_via_stdin(rows),
    )?;
    progress.finish();

    let Some(outcome) = outcome else {
        eprintln!("no root selected — nothing written.");
        return Ok(());
    };

    // Resolve output filename: explicit --name wins, else basename of path.
    let derived_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("scan")
        .to_string();
    let fixture_name = name.unwrap_or(&derived_name);

    write_report_with_progress(&outcome, fixture_name, out_dir, progress.as_ref())?;

    print_language_summary(&outcome.language_stats);
    eprintln!(
        "✓ wrote {}/{}.json ({} entries, {} symbols)",
        out_dir.display(),
        fixture_name,
        outcome.report.entries.len(),
        outcome.report.summary.symbols,
    );

    // Refresh scans/index.json so the viewer picks up the new scan
    // on its next load. Matches the post-scan tail in `make scan`.
    let _ = drift_static_profiler::scans_index::regen(out_dir);

    // Flush stderr so the final summary lands before the shell prompt
    // returns — otherwise the indicatif draw thread can interleave.
    let _ = std::io::stderr().flush();
    Ok(())
}

/// Render the picker menu to stderr and read a 1-based selection from
/// stdin. Returns the zero-based index of the chosen row, or `None`
/// for "user quit" / "EOF" / "no rows".
///
/// The prompt loop accepts:
///   - `1`..`N` → pick that row (1-based for human ergonomics)
///   - `q` / `quit` / empty line / EOF → abort
///   - anything else → re-prompt with an error message
fn pick_root_via_stdin(rows: &[drift_static_profiler::PickerRoot]) -> Option<usize> {
    use std::io::{BufRead, Write};
    if rows.is_empty() {
        eprintln!("no root entry points discovered (try lowering --min-reach).");
        return None;
    }

    eprintln!();
    eprintln!("top {} roots by reach (descending):", rows.len());
    eprintln!();
    for (i, r) in rows.iter().enumerate() {
        eprintln!(
            "  {:>2}. {:<32} reach={:<5} {}:{}",
            i + 1,
            r.name,
            r.reach,
            r.file,
            r.line,
        );
        if r.callers.is_empty() {
            eprintln!("      callers: <none — entry point>");
        } else {
            let summary: Vec<String> = r
                .callers
                .iter()
                .take(2)
                .map(|c| format!("{} ({}:{})", c.name, c.file, c.line))
                .collect();
            let extra = if r.callers.len() > 2 {
                format!(" +{} more", r.callers.len() - 2)
            } else {
                String::new()
            };
            eprintln!("      callers: {}{}", summary.join(", "), extra);
        }
    }
    eprintln!();

    let stdin = std::io::stdin();
    let mut line = String::new();
    loop {
        eprint!("pick 1-{} (or 'q' to quit): ", rows.len());
        let _ = std::io::stderr().flush();
        line.clear();
        match stdin.lock().read_line(&mut line) {
            Ok(0) => return None, // EOF
            Ok(_) => {}
            Err(_) => return None,
        }
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("q") || trimmed.eq_ignore_ascii_case("quit") {
            return None;
        }
        match trimmed.parse::<usize>() {
            Ok(n) if (1..=rows.len()).contains(&n) => return Some(n - 1),
            _ => eprintln!("  ! not a valid choice (expected 1-{} or 'q'); try again.", rows.len()),
        }
    }
}

fn run_regen_scans_index(dir: &std::path::Path) -> Result<()> {
    let count = drift_static_profiler::scans_index::regen(dir)
        .with_context(|| format!("regenerate scans index in {}", dir.display()))?;
    let plural = if count == 1 { "" } else { "s" };
    eprintln!(
        "  ↻ wrote {}/index.json ({count} scan{plural})",
        dir.display(),
    );
    Ok(())
}

fn run_dot(
    path: &std::path::Path,
    out: Option<&std::path::Path>,
    min_reach: usize,
    max_roots: usize,
    max_depth: usize,
    no_tests: bool,
) -> Result<()> {
    let progress = pick_progress();
    let outcome = drift_static_profiler::api::analyze_roots_with_progress(
        path,
        &drift_static_profiler::roots::DiscoverOpts {
            min_reach,
            max_roots,
            skip_tests: true,
            skip_private: true,
            skip_accessors: true,
        },
        &drift_static_profiler::api::AnalyzeOptions {
            max_depth,
            skip_accessors: true,
            exclude_tests: no_tests,
            scan_sql_files: false,
            ..drift_static_profiler::api::AnalyzeOptions::default()
        },
        progress.as_ref(),
    )?;
    progress.finish();
    let dot = drift_static_profiler::dot_export::render(&outcome.report.entries);
    match out {
        Some(path) => {
            std::fs::write(path, &dot)
                .with_context(|| format!("write {}", path.display()))?;
            eprintln!(
                "✓ wrote {} ({} entries, {} bytes)",
                path.display(),
                outcome.report.entries.len(),
                dot.len(),
            );
        }
        None => {
            print!("{dot}");
        }
    }
    Ok(())
}

fn run_sarif(
    path: &std::path::Path,
    out: Option<&std::path::Path>,
    min_reach: usize,
    max_roots: usize,
    max_depth: usize,
    no_tests: bool,
) -> Result<()> {
    let progress = pick_progress();
    let outcome = drift_static_profiler::api::analyze_roots_with_progress(
        path,
        &drift_static_profiler::roots::DiscoverOpts {
            min_reach,
            max_roots,
            skip_tests: true,
            skip_private: true,
            skip_accessors: true,
        },
        &drift_static_profiler::api::AnalyzeOptions {
            max_depth,
            skip_accessors: true,
            exclude_tests: no_tests,
            // SARIF is about findings — keep SQL scan on by default
            // so .sql files contribute their findings to the report.
            scan_sql_files: true,
            ..drift_static_profiler::api::AnalyzeOptions::default()
        },
        progress.as_ref(),
    )?;
    progress.finish();
    let sarif = drift_static_profiler::sarif_export::render(&outcome.report)
        .context("render SARIF")?;
    // Count findings up-front so the user sees what was found.
    let n_findings = count_findings(&outcome.report.entries);
    match out {
        Some(path) => {
            std::fs::write(path, &sarif)
                .with_context(|| format!("write {}", path.display()))?;
            eprintln!(
                "✓ wrote {} ({n_findings} findings, {} bytes)",
                path.display(),
                sarif.len(),
            );
        }
        None => {
            print!("{sarif}");
        }
    }
    Ok(())
}

fn count_findings(entries: &[drift_static_profiler::tree::CallTreeNode]) -> usize {
    fn walk(n: &drift_static_profiler::tree::CallTreeNode) -> usize {
        n.findings.len() + n.children.iter().map(walk).sum::<usize>()
    }
    entries.iter().map(walk).sum()
}

fn run_tags(root: &std::path::Path) -> Result<()> {
    let stats = compute_language_stats(root);
    print_language_summary(&stats);
    let files: Vec<_> = match stats.dominant_supported {
        Some(target) => discover_source_files(root)
            .into_iter()
            .filter(|(_, l)| *l == target)
            .collect(),
        None => {
            eprintln!("note: no supported language detected; nothing to tag");
            return Ok(());
        }
    };
    for (file, lang) in files {
        match extract_tags(&file, lang) {
            Ok(tags) => {
                for s in &tags.symbols {
                    let parent = s.parent.clone().unwrap_or_default();
                    let kind = match s.kind {
                        drift_static_profiler::SymbolKind::Function => "fn",
                        drift_static_profiler::SymbolKind::Method => "method",
                        drift_static_profiler::SymbolKind::Class => "class",
                    };
                    println!(
                        "DEF  {} {parent}.{name}  ({file}:{line})",
                        kind,
                        name = s.name,
                        file = s.file.display(),
                        line = s.line,
                    );
                }
                for r in &tags.references {
                    let inside = r.in_symbol.clone().unwrap_or("<file>".into());
                    println!(
                        "REF  {name}  (called inside {inside} @ {file}:{line})",
                        name = r.name,
                        file = r.file.display(),
                        line = r.line,
                    );
                }
            }
            Err(e) => eprintln!("warn: failed to parse {}: {e:#}", file.display()),
        }
    }
    Ok(())
}

/// Render a GitHub-style language bar and announce which supported language
/// drift will profile. Goes to stderr so it doesn't contaminate `--json`
/// output on stdout.
fn print_language_summary(stats: &LanguageStats) {
    if stats.breakdown.is_empty() {
        eprintln!("languages: (no programming files detected)");
        return;
    }
    let top: Vec<String> = stats
        .breakdown
        .iter()
        .take(6)
        .map(|e| {
            let marker = if e.supported { "*" } else { "" };
            format!("{}{} {:.1}%", e.language, marker, e.percent)
        })
        .collect();
    eprintln!(
        "languages: {}  ({} files, {} bytes)",
        top.join(", "),
        stats.total_files,
        stats.total_bytes,
    );
    match (&stats.dominant_supported_name, stats.dominant_supported_percent) {
        (Some(name), Some(pct)) => {
            eprintln!("profiling: {name} ({pct:.1}% of code) — marked with *")
        }
        _ => eprintln!("profiling: (no supported language present)"),
    }
}

/// Render the per-category findings rollup as a short stderr block.
/// One line per non-empty category with the per-kind breakdown, plus a
/// second line for the ORM family split when any ORM finding exists.
/// Designed to be visible at a glance without scrolling — same role as
/// `print_language_summary`'s "languages: …" line.
fn print_category_breakdown(s: &drift_static_profiler::report::Summary) {
    if s.findings_by_category.is_empty() {
        return;
    }
    eprintln!("\nfindings by category:");
    // Same canonical order as FindingCategory::all() to keep output stable.
    let order = [
        "orm",
        "sql",
        "performance",
        "security",
        "reliability",
        "observability",
        "ai",
        "maintenance",
    ];
    for name in order {
        let Some(roll) = s.findings_by_category.get(name) else {
            continue;
        };
        let breakdown: Vec<String> = roll
            .by_kind
            .iter()
            .map(|(k, n)| format!("{k}={n}"))
            .collect();
        eprintln!(
            "  {:<14} {:>4}  [{}]",
            name,
            roll.total,
            breakdown.join(", ")
        );
    }
    if !s.findings_by_orm_family.is_empty() {
        let parts: Vec<String> = s
            .findings_by_orm_family
            .iter()
            .map(|(fam, n)| format!("{fam}={n}"))
            .collect();
        eprintln!("  orm-family breakdown: {}", parts.join(", "));
    }
}
