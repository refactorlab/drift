//! Public library entry point: analyze a project root and build a Report.
//!
//! Both the CLI (`main.rs`) and external library consumers should use
//! [`analyze`] (for explicit entries) or [`analyze_roots`] (for
//! auto-discovered entry points) to produce a [`Report`]. Keeping the
//! orchestration here ensures the `drift-static-profiler` binary and any
//! embedded usage stay behaviorally identical.

use anyhow::Result;
use std::path::{Path, PathBuf};

use crate::{
    docker::{self, EntryDecl},
    graph::CallGraph,
    linguist::{compute_language_stats_from_entries, LanguageStats},
    progress::{NullProgress, Progress},
    report::Report,
    roots::{DiscoverOpts, DiscoveredRoot},
    sql_lint::{SqlDialect, SqlFileOpts},
    tags::extract_tags_for_files,
    tree::{CallTreeNode, TreeBuilder},
    walker::{walk_files_classified_with, ClassifiedFile, WalkOpts},
    FileTags, Language,
};

#[derive(Debug, Clone)]
pub struct AnalyzeOptions {
    pub max_depth: usize,
    pub skip_accessors: bool,
    /// Walker-level filter: skip test/spec/mock files entirely so they
    /// don't appear as roots, callees, dead_code, or anywhere in the
    /// graph. Off by default — the historical scan walks tests.
    /// Forwarded to `WalkOpts.exclude_tests` in `build_graph_context`.
    pub exclude_tests: bool,
    /// Walker-level filter: skip directories matching `static`/`assets`
    /// (see [`crate::walker::STATIC_ASSET_DIRS`]). Default **true** because
    /// these dirs almost always hold vendored minified bundles that
    /// dominate the entry-point picker with synthetic top callers
    /// (e.g. swagger-ui's `Gk`, `Ek` with reach 4000+). Forwarded to
    /// `WalkOpts.exclude_static_assets`. UI surfaces this as a settings
    /// toggle so users analyzing a project where these dirs really hold
    /// hand-written source can disable the filter.
    pub exclude_static_assets: bool,
    /// Run the `.sql`-file scan pass (plan §3.2). When `true`, drift
    /// walks the project root for `*.sql` files, parses each with the
    /// inferred dialect, and emits a synthetic entry per file
    /// carrying the SQL rule findings. Default `true`. Opt-out via CLI
    /// `--no-sql-files`.
    pub scan_sql_files: bool,
    /// Explicit SQL dialect override for the `.sql`-file scan pass.
    /// When `None` (default), drift infers the dialect per-file from
    /// path and sibling configs ([`crate::sql_lint::infer_dialect_for_path`]).
    /// When `Some(d)`, every `.sql` file uses `d`, ignoring inference.
    /// Driven by CLI `--sql-dialect <name>`.
    pub sql_dialect_override: Option<SqlDialect>,
    /// PR-scope cap: maximum number of affected roots to build call
    /// trees for. Reverse-reachability marks nearly every root
    /// "affected" when a PR touches a foundational/high-fan-in file;
    /// building a full depth-N tree for each then explodes memory.
    /// Roots arrive reach-sorted, so the top `max_affected` (highest
    /// reach = most impactful) are kept and the long tail dropped. Only
    /// consulted by [`analyze_pr_with_progress`]. `usize::MAX` = no cap.
    pub max_affected: usize,
    /// Per-tree safety cap: stop expanding a single call tree once it
    /// has produced this many nodes (cutoff marked `node-budget`).
    /// Bounds one god-function tree, which a dense graph plus
    /// cycles-as-leaves can blow up to tens of thousands of nodes.
    /// `usize::MAX` = no cap.
    pub max_nodes_per_tree: usize,
    /// Global safety cap across ALL trees in one build pass: once the
    /// cumulative node count crosses this, `build_trees_from_ids` stops
    /// building further trees. Backstop for many individually-bounded
    /// trees still summing to a memory blowup. `usize::MAX` = no cap.
    pub max_total_nodes: usize,
    /// Retain at most this many detailed callers per tree node (the
    /// count metric stays exact). The dominant per-node allocation on
    /// dense graphs; `usize::MAX` = no cap. Forwarded to
    /// [`crate::tree::TreeBuilder::max_callers_per_node`].
    pub max_callers_per_node: usize,
    /// Soft memory ceiling (bytes) for the tree-build phase. After each
    /// tree, [`build_trees_from_ids`] samples peak RSS via [`crate::mem`]
    /// and stops building further trees once it crosses this, emitting a
    /// WARN that names memory as the cause. The node budgets above are
    /// byte-blind — one `CallTreeNode` on a dense graph runs ~150 KB once
    /// its caller list is cloned — so a node count well under budget can
    /// still OOM the runner. This converts an uncatchable kernel
    /// OOM-kill (SIGKILL → "operation canceled" with no log) into a
    /// graceful, logged partial report. `usize::MAX` = no ceiling.
    pub max_rss_bytes: usize,
}

impl Default for AnalyzeOptions {
    fn default() -> Self {
        Self {
            max_depth: 12,
            skip_accessors: false,
            exclude_tests: false,
            exclude_static_assets: true,
            scan_sql_files: true,
            sql_dialect_override: None,
            // Generic scans stay unbounded — these caps are a PR-scope
            // safety valve. `run_scan_pr` overrides them with finite CLI
            // defaults; every other path keeps today's behavior.
            max_affected: usize::MAX,
            max_nodes_per_tree: usize::MAX,
            max_total_nodes: usize::MAX,
            max_callers_per_node: usize::MAX,
            max_rss_bytes: usize::MAX,
        }
    }
}

/// Materialize the `SqlFileOpts` Report::build expects, OR `None` to
/// disable the pass entirely. Single source of truth for translating
/// public `AnalyzeOptions` into private pipeline opts — keeps the
/// `Report::build_with_progress` call sites identical.
fn sql_file_opts_from(opts: &AnalyzeOptions) -> Option<SqlFileOpts> {
    if !opts.scan_sql_files {
        return None;
    }
    Some(SqlFileOpts {
        dialect_override: opts.sql_dialect_override,
    })
}

#[derive(Debug, Clone)]
pub struct AnalyzeOutcome {
    pub report: Report,
    /// Entry-point names from `entries` that didn't match any symbol.
    pub unresolved_entries: Vec<String>,
    /// Linguist-style language breakdown of the project tree, plus which
    /// supported language was picked for profiling.
    pub language_stats: LanguageStats,
    /// The language that drift actually profiled (i.e. the dominant supported
    /// language). `None` when the project contained no source files for any
    /// of the four shipped tree-sitter parsers.
    pub profiled_language: Option<Language>,
    /// Auto-discovered roots — populated only by [`analyze_roots`]. Empty for
    /// the explicit-entry [`analyze`] path. Listed here on the outcome (not
    /// the Report) so it doesn't leak into the JSON schema unless explicitly
    /// surfaced by the caller.
    pub discovered_roots: Vec<DiscoveredRoot>,
    /// Structural containment relation — `class → [methods]` /
    /// `struct → [receiver methods]`. Built alongside the call graph
    /// from per-language `ContainmentExtractor`s. Kept separate from
    /// the call graph so PageRank / call-site-count statistics aren't
    /// polluted by structural edges. Defaults to empty when the scan
    /// produced no symbols.
    pub containment: crate::containment::ContainmentGraph,
}

/// Shared first phase: walk → linguist breakdown → filter → extract → graph.
/// Both [`analyze`] and [`analyze_roots`] start here so the graph build is
/// only paid for once per call, and the language picking logic stays in one
/// place.
struct GraphContext {
    all_tags: Vec<FileTags>,
    graph: CallGraph,
    /// Structural containment built once per scan from per-language
    /// extractors. See `crate::containment` for the design rationale.
    containment: crate::containment::ContainmentGraph,
    language_stats: LanguageStats,
    profiled_language: Option<Language>,
    entry_declarations: Vec<EntryDecl>,
    /// Walker posture used for the main source walk. Carried through to
    /// `Report::build_with_progress` so the post-graph ORM and SQL-file
    /// passes apply the SAME `exclude_tests` / `exclude_static_assets` /
    /// gitignore / driftignore rules — otherwise findings can surface
    /// against files the user explicitly filtered out.
    walk_opts: WalkOpts,
}

/// The supported language most represented among a PR's changed files (by
/// file count; ties broken alphabetically by slug for determinism).
///
/// Returns `None` when no changed file maps to a supported language — the
/// caller then falls back to the whole-repo dominant language. This is the
/// fix for the single-dominant-language scan ignoring a PR that only touches
/// a *non-dominant* language: a PR editing only the TypeScript action in this
/// Rust-dominant repo used to be profiled as Rust, so every changed file
/// landed outside the parsed graph and `affected` came back 0. We can only
/// profile ONE language per scan (the call graph is built for a single
/// language), so "the language this PR mostly touches" is the right pick.
fn dominant_changed_language(changed_files: &[PathBuf]) -> Option<Language> {
    Language::all()
        .iter()
        .copied()
        .map(|lang| {
            let count = changed_files
                .iter()
                .filter(|p| Language::from_path(p.as_path()) == Some(lang))
                .count();
            (lang, count)
        })
        .filter(|&(_, count)| count > 0)
        // Most-changed wins; on a tie the alphabetically-first slug wins so the
        // pick never depends on `Language` enum declaration order.
        .max_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.slug().cmp(a.0.slug())))
        .map(|(lang, _)| lang)
}

/// Every supported language the PR touches, deduped (declaration order).
///
/// Drives the MULTI-LANGUAGE parse filter: a monorepo PR that edits both Rust
/// and TypeScript must parse BOTH languages so the call graph — and the
/// change-anchored diff diagram — can show the changes in each. (A single
/// dominant pick would silently drop every file in the non-dominant language,
/// which is exactly why a TS feature change was invisible on a Rust-heavy
/// branch.) Empty for a full-repo scan with no changed files, where the caller
/// falls back to the single repo-dominant language to bound parse cost.
fn changed_languages(changed_files: &[PathBuf]) -> Vec<Language> {
    let mut langs: Vec<Language> = Vec::new();
    for p in changed_files {
        if let Some(l) = Language::from_path(p.as_path()) {
            if !langs.contains(&l) {
                langs.push(l);
            }
        }
    }
    langs
}

/// Re-point the reported dominant language at the language we actually
/// profiled, so `report.rs`'s `profiled_language` / `profiled_language_percent`
/// stay truthful when `build_graph_context` profiles the changed-files language
/// instead of the whole-repo dominant one. The `breakdown` is left untouched
/// (it still shows the real repo mix); only the "dominant supported" pointer
/// the report reads is realigned, and its percent is taken from the matching
/// breakdown entry so the number is exactly what the linguist computed.
fn realign_dominant_to_profiled(
    stats: &mut LanguageStats,
    walked: &[ClassifiedFile],
    profiled: Language,
) {
    if stats.dominant_supported == Some(profiled) {
        return;
    }
    // `lang_name` is the linguist display label (e.g. "TypeScript"), carried on
    // every classified file AND used as the `breakdown` entry key — so it maps
    // the profiled `Language` → its display name → its already-computed percent.
    let name = walked
        .iter()
        .find(|f| f.language == Some(profiled))
        .and_then(|f| f.lang_name);
    let percent = name.and_then(|n| {
        stats
            .breakdown
            .iter()
            .find(|e| e.language == n)
            .map(|e| e.percent)
    });
    stats.dominant_supported = Some(profiled);
    stats.dominant_supported_name = name.map(str::to_string);
    stats.dominant_supported_percent = percent;
}

fn build_graph_context(
    root: &Path,
    changed_files: &[PathBuf],
    opts: &AnalyzeOptions,
    progress: &dyn Progress,
) -> GraphContext {
    let phase_started_at = std::time::Instant::now();
    tracing::info!(
        root = %root.display(),
        max_depth = opts.max_depth,
        exclude_tests = opts.exclude_tests,
        exclude_static_assets = opts.exclude_static_assets,
        scan_sql_files = opts.scan_sql_files,
        "graph context build start"
    );
    // ── 1. ONE filesystem walk, classified up-front ──────────────────────
    //
    // The legacy implementation walked the repo twice: once for the
    // linguist byte-counting and once for source-file discovery. On a
    // large monorepo that doubled inode reads and gitignore evaluation.
    //
    // We now walk once, classifying each file as it's discovered, then
    // feed the same vector to (a) the linguist breakdown and (b) the
    // source-file filter below. `ClassifiedFile` carries both the
    // language NAME (for the bar) and the supported `Language` enum
    // (for the parse filter).
    //
    // The breakdown intentionally sees the WHOLE walk (not test-
    // filtered), so a repo that's 78% TypeScript still reads as 78%
    // TypeScript when the user passes `--no-tests`. The parse-filter
    // step below applies `exclude_tests`.
    let walk_opts = WalkOpts {
        exclude_tests: opts.exclude_tests,
        exclude_static_assets: opts.exclude_static_assets,
        ..WalkOpts::default()
    };
    let walked = walk_files_classified_with(root, &walk_opts, progress);
    let mut language_stats = compute_language_stats_from_entries(&walked);
    // Prefer the language this PR actually touches. In a polyglot repo the
    // whole-repo dominant language is often NOT the one a given PR changes
    // (e.g. a TS-only PR in a Rust-dominant repo); profiling the repo-dominant
    // language there parses files the PR never touched and reports 0 affected.
    // For a full-repo scan `changed_files` is empty → we keep the repo
    // dominant. We can only profile one language, so realign the reported
    // "dominant supported" to match what we parse (keeps report.rs truthful).
    let repo_dominant = language_stats.dominant_supported;
    let changed_dominant = dominant_changed_language(changed_files);
    let profiled_language = changed_dominant.or(repo_dominant);
    if let Some(profiled) = profiled_language {
        realign_dominant_to_profiled(&mut language_stats, &walked, profiled);
    }
    // Languages to PARSE. A PR is profiled MULTI-LANGUAGE: every language the
    // diff touches is parsed, so a mixed Rust+TS change graphs both (a single
    // dominant pick would drop the non-dominant language's files before parsing,
    // hiding those changes entirely). A full-repo scan (no changed files) has no
    // diff to anchor on, so it keeps the single repo-dominant language to bound
    // parse cost. `profiled_language` above stays the *reported* dominant.
    let parse_languages: Vec<Language> = {
        let changed = changed_languages(changed_files);
        if !changed.is_empty() {
            changed
        } else {
            profiled_language.into_iter().collect()
        }
    };
    tracing::info!(
        walked = walked.len(),
        changed_files = changed_files.len(),
        repo_dominant = repo_dominant.map(|l| l.slug()).unwrap_or("none"),
        profiled = profiled_language.map(|l| l.slug()).unwrap_or("none"),
        parse_languages = parse_languages.iter().map(|l| l.slug()).collect::<Vec<_>>().join("+").as_str(),
        changed_driven = changed_dominant.is_some(),
        "language picked"
    );

    // ── 2. Filter to source files in ANY parsed language ────────────────
    //
    // Single pass through `walked` keeping every entry whose `Language` is in
    // `parse_languages` (multi-language; see above). The `walked` vector is
    // consumed here — we don't need it again after this step, so we drop it to
    // release the path/size memory before the parse loop's peak (which holds
    // source strings for parallelism × largest_file bytes simultaneously).
    let files: Vec<(PathBuf, Language)> = if parse_languages.is_empty() {
        drop(walked);
        Vec::new()
    } else {
        walked
            .into_iter()
            .filter_map(|f| match f.language {
                Some(lang) if parse_languages.contains(&lang) => Some((f.path, lang)),
                _ => None,
            })
            .collect()
    };

    // ── 3. Parse all source files in parallel ────────────────────────────
    //
    // `extract_tags_for_files` uses rayon's worker pool with a
    // thread-local Parser+Query cache (see `tags.rs` for the cache
    // design). Net effect on a large repo:
    //   - Query compilation is paid once per (thread, language)
    //     instead of once per file.
    //   - Tree-sitter parsing scales with available cores.
    //   - Errors are logged and the file is skipped — one corrupt
    //     source file does NOT fail the whole scan.
    let all_tags = extract_tags_for_files(&files, progress);

    // ── 4. Build the symbol graph and discover entry declarations ────────
    //
    // `build_with_progress` emits one `step_*` bar per internal pass
    // (indexing → wiring edges → counting call sites → PageRank). On
    // a large monorepo the wiring pass alone can take tens of
    // seconds; without per-pass progress the user sees the single
    // "building call graph…" phase apparently hang.
    let graph = CallGraph::build_with_progress(&all_tags, progress);
    // Containment is cheap (per-file O(N log N) sweep + one linear
    // post-merge) so we always build it. Per-language extractor is
    // chosen via `profile_for(lang).containment_extractor()` so
    // Go/Rust receiver-based logic plugs in without touching this
    // call site. See `src/containment.rs` for the design.
    progress.phase("building containment graph…");
    let containment = crate::containment::build_containment_graph(&all_tags, |lang| {
        crate::languages::profile_for(lang).containment_extractor()
    });

    // Walk container-deployment files (Dockerfile + docker-compose)
    // AND per-language manifests (package.json, pyproject.toml,
    // Cargo.toml, deno.json). Both families produce `EntryDecl` values
    // so the matcher can wire them to in-graph symbols uniformly.
    //
    // Independent of profiled_language — a Java service can still
    // have its Dockerfile read, and a polyglot monorepo may have
    // manifests for several languages.
    progress.phase("collecting entry declarations…");
    let mut entry_declarations = docker::collect(root, &all_tags, &graph);
    let mut manifest_entries = crate::manifest::collect(root);
    crate::docker::match_entries(&mut manifest_entries, &all_tags, &graph);
    entry_declarations.extend(manifest_entries);
    tracing::info!(
        symbols = graph.symbols.len(),
        edges = graph.edges.values().map(|v| v.len()).sum::<usize>(),
        entry_decls = entry_declarations.len(),
        elapsed_ms = phase_started_at.elapsed().as_millis() as u64,
        "graph context build end"
    );
    GraphContext {
        all_tags,
        graph,
        containment,
        language_stats,
        profiled_language,
        entry_declarations,
        walk_opts,
    }
}

fn build_trees_from_ids(
    ctx: &GraphContext,
    root: &Path,
    ids: &[crate::graph::SymbolId],
    opts: &AnalyzeOptions,
    progress: &dyn Progress,
) -> Vec<CallTreeNode> {
    let started_at = std::time::Instant::now();
    let mut builder = TreeBuilder::new(&ctx.graph, root);
    builder.max_depth = opts.max_depth;
    builder.skip_accessors = opts.skip_accessors;
    builder.max_nodes_per_tree = opts.max_nodes_per_tree;
    builder.max_callers_per_node = opts.max_callers_per_node;
    let total = ids.len();
    // 0 = unlimited, so the log stays readable instead of printing the
    // usize::MAX sentinel as a 20-digit ceiling.
    let max_rss_mb = if opts.max_rss_bytes == usize::MAX {
        0
    } else {
        opts.max_rss_bytes / (1024 * 1024)
    };
    tracing::info!(
        entries = total,
        max_depth = opts.max_depth,
        skip_accessors = opts.skip_accessors,
        max_nodes_per_tree = opts.max_nodes_per_tree,
        max_total_nodes = opts.max_total_nodes,
        max_rss_mb,
        rss_start_mb = crate::mem::peak_rss_mb().unwrap_or(0),
        "tree build start"
    );
    progress.step_start("building call trees", total);
    let mut out = Vec::with_capacity(ids.len());
    // Global node budget across ALL trees. Each `CallTreeNode` is a
    // heavyweight struct (callers/externals/findings vecs, a category
    // map, several owned strings), so an unbounded sum of trees on a
    // high-fan-in PR is what OOM-kills the runner. We tally each tree's
    // `subtree_size` and stop once the cumulative count crosses the cap.
    let mut total_nodes: usize = 0;
    let mut budget_stopped_at: Option<usize> = None;
    // Set when the memory soft-limit trips (distinct from the node
    // budget) so the post-loop WARN can name memory as the cause.
    let mut rss_stopped_mb: Option<u64> = None;
    for (i, id) in ids.iter().enumerate() {
        if total_nodes >= opts.max_total_nodes {
            budget_stopped_at = Some(i);
            break;
        }
        // Memory soft-limit. The node budgets above are byte-blind: a
        // single CallTreeNode on a dense graph runs ~150 KB once its
        // caller list is cloned, so a node count well under budget can
        // still walk the process into the kernel OOM-killer — which
        // SIGKILLs us with no log line, surfacing on CI as the opaque
        // "operation canceled". Sample our own peak RSS and stop here,
        // *voluntarily*, leaving a WARN that names the cause.
        if opts.max_rss_bytes != usize::MAX {
            if let Some(rss) = crate::mem::peak_rss_bytes() {
                if rss as usize >= opts.max_rss_bytes {
                    rss_stopped_mb = Some(rss / (1024 * 1024));
                    break;
                }
            }
        }
        // "Current item" indicator — same role as the file-path
        // display during parse. Surfacing the entry symbol name
        // turns "building call trees: 12/179" into something the
        // user can debug: which entry is slow? (Often the answer
        // is a god-function with thousands of transitive callees.)
        if let Some(sym) = ctx.graph.symbols.get(id) {
            progress.set_current(&sym.name);
        }
        if let Some(node) = builder.build(id) {
            total_nodes += node.subtree_size;
            out.push(node);
        }
        // Trees can be expensive individually on highly-connected
        // entry points, so we update every 16 trees (not 64 like the
        // graph passes) to keep the bar lively even with few entries.
        // The paired RSS+node trace is the breadcrumb whose absence made
        // the original OOM undiagnosable: even if a later run dies, the
        // last line printed shows how high memory had climbed and on
        // which tree.
        if i & 0x0F == 0 {
            progress.step_progress(i, total);
            tracing::debug!(
                built = out.len(),
                total_nodes,
                rss_mb = crate::mem::peak_rss_mb().unwrap_or(0),
                "tree build progress"
            );
        }
    }
    progress.step_progress(total, total);
    progress.step_end();
    if let Some(rss_mb) = rss_stopped_mb {
        tracing::warn!(
            built = out.len(),
            skipped = total.saturating_sub(out.len()),
            total_nodes,
            rss_mb,
            max_rss_mb,
            "tree build halted: memory soft-limit reached — emitting partial report (raise --max-rss-mb, or tighten --max-affected / --max-nodes-per-tree)"
        );
    } else if let Some(stopped_at) = budget_stopped_at {
        tracing::warn!(
            built = out.len(),
            skipped = total.saturating_sub(stopped_at),
            total_nodes,
            max_total_nodes = opts.max_total_nodes,
            "tree build halted: global node budget reached"
        );
    }
    tracing::info!(
        entries = out.len(),
        skipped = total.saturating_sub(out.len()),
        total_nodes,
        rss_peak_mb = crate::mem::peak_rss_mb().unwrap_or(0),
        elapsed_ms = started_at.elapsed().as_millis() as u64,
        "tree build end"
    );
    out
}

pub fn analyze(root: &Path, entries: &[String], opts: &AnalyzeOptions) -> Result<AnalyzeOutcome> {
    analyze_with_progress(root, entries, opts, &NullProgress)
}

/// Same as [`analyze`] but lets the caller observe pipeline progress.
///
/// The CLI's `scan` / `analyze-root` commands pass a `CliProgress`
/// sink so terminal users see a live progress bar; library consumers
/// can plug in their own implementation, or stay on the silent
/// [`analyze`] entry point.
pub fn analyze_with_progress(
    root: &Path,
    entries: &[String],
    opts: &AnalyzeOptions,
    progress: &dyn Progress,
) -> Result<AnalyzeOutcome> {
    let started_at = std::time::Instant::now();
    tracing::info!(
        root = %root.display(),
        entries = entries.len(),
        "analyze start"
    );
    // Full-repo scan: no PR scope, so the whole-repo dominant language is used.
    let ctx = build_graph_context(root, &[], opts, progress);

    progress.phase("resolving entry points…");
    let mut entry_ids = Vec::new();
    let mut unresolved = Vec::new();
    for q in entries {
        let ids = ctx.graph.find_entry_points(q);
        if ids.is_empty() {
            unresolved.push(q.clone());
            continue;
        }
        entry_ids.extend(ids);
    }
    tracing::info!(
        requested = entries.len(),
        resolved = entry_ids.len(),
        unresolved = unresolved.len(),
        "entry points resolved"
    );
    let mut roots = build_trees_from_ids(&ctx, root, &entry_ids, opts, progress);
    docker::label_call_tree_entries(&ctx.entry_declarations, &mut roots);
    // `build_with_progress` emits a per-pass step bar for each
    // finding-attach + a real bar for collect_hot_paths + phase
    // labels for the remaining sub-rollups, so the user never sees
    // "assembling report…" hang silently for minutes on a 700-entry
    // repo.
    let sql_opts = sql_file_opts_from(opts);
    let report = Report::build_with_progress(
        &ctx.all_tags,
        &ctx.graph,
        roots,
        &ctx.language_stats,
        Some(root),
        ctx.entry_declarations,
        sql_opts.as_ref(),
        &ctx.walk_opts,
        progress,
    );
    // NOTE: we deliberately do NOT call `progress.finish()` here.
    // Callers may have additional progress phases to emit *after*
    // analyze returns (e.g. the CLI's JSON serialize + file write),
    // and finish() commits the overall bar to scrollback — locking
    // out any post-analyze phase from contributing to the visible
    // progress. Ownership of the bar lifecycle therefore lives with
    // the caller (main.rs's run_scan / run_analyze_root).
    tracing::info!(
        entries = report.entries.len(),
        symbols = report.summary.symbols,
        elapsed_ms = started_at.elapsed().as_millis() as u64,
        "analyze end"
    );
    Ok(AnalyzeOutcome {
        report,
        unresolved_entries: unresolved,
        language_stats: ctx.language_stats,
        profiled_language: ctx.profiled_language,
        discovered_roots: Vec::new(),
        containment: ctx.containment,
    })
}

/// Auto-discover every plausible root entry point in the project (symbols
/// with no in-graph caller, ranked by transitive reach) and analyze each
/// one. The returned [`AnalyzeOutcome.report.entries`] contains one
/// [`CallTreeNode`] per discovered root, ordered the same as
/// [`AnalyzeOutcome.discovered_roots`] (biggest reach first).
///
/// This is the static-analysis equivalent of Chrome DevTools' "Top-Down"
/// view, pprof's `top -cum`, or Speedscope's Sandwich view: a project-wide
/// roots overview from which the user drills into a specific call tree.
pub fn analyze_roots(
    root: &Path,
    discover: &DiscoverOpts,
    opts: &AnalyzeOptions,
) -> Result<AnalyzeOutcome> {
    analyze_roots_with_progress(root, discover, opts, &NullProgress)
}

/// Same as [`analyze_roots`] but lets the caller observe pipeline
/// progress. See [`analyze_with_progress`] for the design rationale.
pub fn analyze_roots_with_progress(
    root: &Path,
    discover: &DiscoverOpts,
    opts: &AnalyzeOptions,
    progress: &dyn Progress,
) -> Result<AnalyzeOutcome> {
    let started_at = std::time::Instant::now();
    tracing::info!(
        root = %root.display(),
        min_reach = discover.min_reach,
        max_roots = discover.max_roots,
        "analyze-roots start"
    );
    // Full-repo scan: no PR scope, so the whole-repo dominant language is used.
    let ctx = build_graph_context(root, &[], opts, progress);
    // discover_roots_with_progress emits its own "scanning roots"
    // step bar — no extra `phase()` label needed here.
    let discovered = crate::roots::discover_roots_with_progress(
        &ctx.graph,
        root,
        discover,
        progress,
    );
    let ids: Vec<_> = discovered.iter().map(|r| r.id.clone()).collect();
    let mut roots = build_trees_from_ids(&ctx, root, &ids, opts, progress);
    docker::label_call_tree_entries(&ctx.entry_declarations, &mut roots);
    // See the matching call in `analyze_with_progress` above for the
    // motivation — `analyze-root` with `--min-reach 1` produced the
    // 700+ entry case the user hit, which is exactly where the
    // per-pass progress matters most.
    let sql_opts = sql_file_opts_from(opts);
    let report = Report::build_with_progress(
        &ctx.all_tags,
        &ctx.graph,
        roots,
        &ctx.language_stats,
        Some(root),
        ctx.entry_declarations,
        sql_opts.as_ref(),
        &ctx.walk_opts,
        progress,
    );
    // NOTE: we deliberately do NOT call `progress.finish()` here.
    // Callers may have additional progress phases to emit *after*
    // analyze returns (e.g. the CLI's JSON serialize + file write),
    // and finish() commits the overall bar to scrollback — locking
    // out any post-analyze phase from contributing to the visible
    // progress. Ownership of the bar lifecycle therefore lives with
    // the caller (main.rs's run_scan / run_analyze_root).
    tracing::info!(
        roots = discovered.len(),
        entries = report.entries.len(),
        symbols = report.summary.symbols,
        elapsed_ms = started_at.elapsed().as_millis() as u64,
        "analyze-roots end"
    );
    Ok(AnalyzeOutcome {
        report,
        unresolved_entries: Vec::new(),
        language_stats: ctx.language_stats,
        profiled_language: ctx.profiled_language,
        discovered_roots: discovered,
        containment: ctx.containment,
    })
}

/// Application-level metadata describing a PR-scoped scan. Carried
/// alongside the standard `AnalyzeOutcome` on `AnalyzePrOutcome` so the
/// CLI (or any other adapter) can render the "this PR touched these
/// roots / these files are dead code" block on top of the standard
/// report JSON.
///
/// Deliberately NOT part of `AnalyzeOutcome` so existing scan-all flows
/// stay byte-identical: the standard `Report` schema is unchanged,
/// `pr_scope` is purely an outer-envelope concept.
#[derive(Debug, Clone)]
pub struct PrScopeSummary {
    /// The original list of changed files the caller passed in,
    /// preserved verbatim (we don't canonicalize or rewrite them) so
    /// downstream tooling can match them back against PR diff data.
    pub changed_files: Vec<PathBuf>,
    /// Names of roots whose call tree transitively reaches at least
    /// one symbol from a changed file. Same ordering as the standard
    /// `discover_roots` output (biggest reach first).
    pub affected_root_names: Vec<String>,
    /// Changed files that had ≥1 in-graph symbol but whose upward BFS
    /// reached no root — i.e. "dead code touched by this PR". Files
    /// with zero in-graph symbols (READMEs, JSON, removed paths) are
    /// NOT included; only real source files whose symbols are
    /// orphans.
    pub unreachable_changes: Vec<PathBuf>,
}

/// Output of [`analyze_pr_with_progress`]: the standard
/// `AnalyzeOutcome` plus the PR-scope summary. Kept as a wrapper (not
/// a new field on `AnalyzeOutcome`) so existing analyze paths don't
/// have to construct a stub PrScopeSummary; the type system says
/// "this outcome came from a PR scan" by virtue of being
/// `AnalyzePrOutcome`.
#[derive(Debug, Clone)]
pub struct AnalyzePrOutcome {
    pub outcome: AnalyzeOutcome,
    pub pr_scope: PrScopeSummary,
    /// Total symbols in the call graph (NOT just the affected subset).
    /// The denominator for `centrality_multiple = pagerank × N` — pagerank
    /// values sum to ~1.0 over all N nodes, so they shrink as N grows;
    /// multiplying by N yields a scale-invariant "× the uniform baseline"
    /// used by `pr_quality`'s inversion/blast-radius centrality arms.
    pub total_symbols: usize,
}

/// PR-scoped scan: build the graph, discover ALL roots, then filter
/// them down to only the roots whose call trees transitively cover at
/// least one symbol from `changed_files`. The resulting report
/// contains only those filtered roots — so PR review tooling sees the
/// SAME shape it does for a normal scan, but scoped to the call trees
/// the PR actually touched.
///
/// Pipeline:
///
///   walk → graph → discover_roots → pr_scope::affected_roots
///        → build_trees_for(only_affected) → Report::build_with_progress
///
/// All shared steps reuse the same `build_graph_context` and
/// `build_trees_from_ids` helpers the existing scan paths use — this
/// function is purely additive orchestration; the existing flows are
/// untouched.
///
/// Path matching: `changed_files` entries can be repo-relative
/// (`src/users.py`) or absolute (`/abs/repo/src/users.py`); see
/// [`crate::pr_scope::affected_roots`] for the component-aware suffix
/// match. The caller (a GitHub Action wrapper) is responsible for
/// resolving paths to whatever form best matches the walker's output
/// — but in practice, either form works.
pub fn analyze_pr_with_progress(
    root: &Path,
    changed_files: &[PathBuf],
    discover: &DiscoverOpts,
    opts: &AnalyzeOptions,
    progress: &dyn Progress,
) -> Result<AnalyzePrOutcome> {
    let started_at = std::time::Instant::now();
    tracing::info!(
        root = %root.display(),
        changed_files = changed_files.len(),
        min_reach = discover.min_reach,
        "analyze-pr start"
    );
    // PR scan: profile the language this PR actually changes (falls back to the
    // whole-repo dominant when no changed file maps to a supported language).
    let ctx = build_graph_context(root, changed_files, opts, progress);
    // Capture graph N now (for pr_quality's pagerank×N centrality); cheap,
    // and avoids any borrow concern at the outcome-construction site below.
    let total_symbols = ctx.graph.symbols.len();

    // Discover EVERY root first; the pr_scope filter winnows it down
    // afterward. We can't short-circuit discovery to "just the
    // changed-file roots" because a changed file's symbol may have
    // an ancestor root that's defined in an unchanged file — the
    // whole point of reverse-reachability is to find those.
    let all_discovered = crate::roots::discover_roots_with_progress(
        &ctx.graph,
        root,
        discover,
        progress,
    );

    // Pure filter — no I/O, no per-language code (see pr_scope.rs).
    progress.phase("filtering roots by PR scope…");
    let mut affected = crate::pr_scope::affected_roots(&ctx.graph, &all_discovered, changed_files);
    let affected_total = affected.roots.len();
    // PRIORITIZE roots that are themselves DEFINED IN a changed file, before
    // the reach-based truncation below. Truncation keeps the highest-reach
    // roots; in a polyglot PR the highest-reach roots belong to the dominant
    // language (e.g. the Rust binary's `main`, reaching thousands of nodes),
    // which would starve the entry roots of a SECONDARY language the PR also
    // touches (a React app's `main.tsx`, reaching a few dozen). Those entry
    // roots' trees would never be built, so that language's flow can't appear
    // in the diff diagram at all. A STABLE partition (changed-file roots first,
    // reach order preserved within each group) guarantees every touched
    // language's entry points survive the cap. Cheap: one symbol lookup per root.
    affected.roots.sort_by_key(|r| {
        let in_changed_file = ctx
            .graph
            .symbols
            .get(&r.id)
            .is_some_and(|s| changed_files.iter().any(|c| s.file.ends_with(c)));
        u8::from(!in_changed_file)
    });
    // Cap how many affected roots we build trees for. Roots are
    // reach-sorted by discover_roots and affected_roots preserves that
    // order, so truncating keeps the highest-reach (most impactful)
    // roots and drops the long tail. Without this, a PR touching a
    // foundational/high-fan-in file marks nearly every root affected
    // (here 1637/1792) and the per-root depth-N tree build OOM-kills
    // the runner — surfacing as "The operation was canceled".
    if affected.roots.len() > opts.max_affected {
        affected.roots.truncate(opts.max_affected);
    }
    tracing::info!(
        all_roots = all_discovered.len(),
        affected = affected.roots.len(),
        affected_total,
        max_affected = opts.max_affected,
        unreachable = affected.unreachable_changes.len(),
        rss_mb = crate::mem::peak_rss_mb().unwrap_or(0),
        "pr scope filtered"
    );
    if affected_total > affected.roots.len() {
        tracing::warn!(
            kept = affected.roots.len(),
            dropped = affected_total - affected.roots.len(),
            max_affected = opts.max_affected,
            "pr scope capped affected roots (highest-reach kept)"
        );
    }

    // Fair-share the global node budget across the affected roots.
    //
    // A flat per-tree cap spends the budget badly: a foundational change
    // marks ~all roots affected, the first dozen build huge trees, the
    // global budget trips, and the remaining ~140 roots get NO tree at
    // all (measured here: 12 of 150 reviewed at peak ~1.4 GB). Conversely
    // a flat *small* cap would needlessly truncate a tiny PR that has
    // budget to spare. So each affected root gets an equal slice of the
    // global budget — min(configured cap, budget / roots) — floored so a
    // tree never collapses to a stub. Small PR (few roots) → each gets a
    // deep tree; foundational PR (hundreds) → each gets a shallower but
    // still-substantial one and ALL of them get reviewed. Peak memory is
    // unchanged (the global budget is the real governor; same ~1.4 GB),
    // but coverage scales with the budget instead of with tree girth.
    const PR_MIN_NODES_PER_TREE: usize = 300;
    let n_affected = affected.roots.len().max(1);
    let fair_share = (opts.max_total_nodes / n_affected).max(PR_MIN_NODES_PER_TREE);
    let mut tree_opts = opts.clone();
    tree_opts.max_nodes_per_tree = opts.max_nodes_per_tree.min(fair_share);
    if tree_opts.max_nodes_per_tree != opts.max_nodes_per_tree {
        tracing::info!(
            roots = n_affected,
            per_tree_budget = tree_opts.max_nodes_per_tree,
            configured_cap = opts.max_nodes_per_tree,
            total_budget = opts.max_total_nodes,
            "fair-shared node budget across affected roots"
        );
    }

    // Build trees only for the affected roots. Reusing
    // `build_trees_from_ids` keeps the focused report's per-entry
    // structure identical to a normal scan — same docker labelling,
    // same tree-builder limits, same progress reporting.
    let ids: Vec<_> = affected.roots.iter().map(|r| r.id.clone()).collect();
    let mut roots_trees = build_trees_from_ids(&ctx, root, &ids, &tree_opts, progress);
    docker::label_call_tree_entries(&ctx.entry_declarations, &mut roots_trees);

    let sql_opts = sql_file_opts_from(opts);
    let report = Report::build_with_progress(
        &ctx.all_tags,
        &ctx.graph,
        roots_trees,
        &ctx.language_stats,
        Some(root),
        ctx.entry_declarations,
        sql_opts.as_ref(),
        &ctx.walk_opts,
        progress,
    );

    let pr_scope = PrScopeSummary {
        changed_files: changed_files.to_vec(),
        // Present each affected root human-readably — synthetic identities
        // (`<module>` / `<anonymous@N>`) become `file.ext` / `anon <file:line>`
        // and a real class is prepended (`OrderService.createOrder`), exactly
        // as `tests_in_graph::uncovered_roots` and `nfr_edge_cases::per_root`
        // do. This is REQUIRED, not cosmetic: the action joins these three
        // lists by string (per-root coverage = affected ∩ uncovered), so all
        // must humanize identically. A root's graph `Symbol` and its
        // `CallTreeNode` agree on every input — `CallTreeNode.parent_class`
        // is `Symbol.parent` (see `tree.rs`), `name`/`file`/`line` are shared
        // — so the same root yields the same label on both sides.
        affected_root_names: affected
            .roots
            .iter()
            .map(|r| match ctx.graph.symbols.get(&r.id) {
                Some(sym) => crate::pr_algorithms::symbol_label::display_symbol_label(
                    &sym.name,
                    sym.parent.as_deref(),
                    &sym.file.to_string_lossy(),
                    sym.line,
                ),
                None => r.name.clone(),
            })
            .collect(),
        unreachable_changes: affected.unreachable_changes,
    };
    let outcome = AnalyzeOutcome {
        report,
        unresolved_entries: Vec::new(),
        language_stats: ctx.language_stats,
        profiled_language: ctx.profiled_language,
        // Carry through the affected roots (not the full all_discovered
        // list) — consumers expect `discovered_roots` to match the
        // entries in the report, and the report only contains affected
        // ones.
        discovered_roots: affected.roots,
        containment: ctx.containment,
    };
    tracing::info!(
        entries = outcome.report.entries.len(),
        symbols = outcome.report.summary.symbols,
        rss_peak_mb = crate::mem::peak_rss_mb().unwrap_or(0),
        elapsed_ms = started_at.elapsed().as_millis() as u64,
        "analyze-pr end"
    );
    Ok(AnalyzePrOutcome { outcome, pr_scope, total_symbols })
}

/// One row of display data for the interactive root picker — enough
/// for the caller (e.g. a CLI prompt) to render a meaningful menu
/// without needing to know about `CallGraph` or `GraphContext`.
///
/// `callers` is the resolved (name, file, line) for each in-graph
/// caller of this root. For most genuine entry points the list is
/// empty; for symbols called only by the synthetic `<module>` symbol
/// (Python `if __name__`, module-top-level invocations) it contains
/// that single entry.
#[derive(Debug, Clone)]
pub struct PickerRoot {
    pub id: crate::graph::SymbolId,
    pub name: String,
    pub reach: usize,
    /// File path relative to the scanned `root` directory.
    pub file: String,
    pub line: usize,
    pub callers: Vec<PickerCaller>,
}

#[derive(Debug, Clone)]
pub struct PickerCaller {
    pub name: String,
    pub file: String,
    pub line: usize,
}

/// Build the graph + discover roots + hand the top-N to a caller-supplied
/// `pick` closure. If the closure returns `Some(index)`, build a focused
/// report containing only the call tree of that root; if it returns
/// `None`, abort cleanly without doing any tree work.
///
/// Design notes (Clean Code split):
///   - All terminal I/O (prompt rendering, stdin parsing) lives in the
///     `pick` closure — the library crate has no awareness of TTYs.
///   - The closure receives pre-decorated `PickerRoot` rows, not the
///     raw graph, so it can't accidentally mutate analyzer state.
///   - We only build trees AFTER a selection is made. The expensive
///     per-root expansion (max_depth recursion) is paid exactly once,
///     for the one root the user actually wants.
///
/// `discover.max_roots` is honored: pass `10` (or whatever cap the UI
/// wants) so the picker doesn't get handed thousands of rows.
pub fn analyze_picked_with_progress<F>(
    root: &Path,
    discover: &DiscoverOpts,
    opts: &AnalyzeOptions,
    progress: &dyn Progress,
    pick: F,
) -> Result<Option<AnalyzeOutcome>>
where
    F: FnOnce(&[PickerRoot]) -> Option<usize>,
{
    // Interactive picker over the full repo: no PR scope → whole-repo dominant.
    let ctx = build_graph_context(root, &[], opts, progress);
    let discovered = crate::roots::discover_roots_with_progress(
        &ctx.graph,
        root,
        discover,
        progress,
    );

    // Empty-graph short-circuit: nothing to pick. The caller decides
    // how to surface this; we just return None.
    if discovered.is_empty() {
        return Ok(None);
    }

    let rows = decorate_roots_for_picker(&ctx, root, &discovered);

    let picked_idx = match pick(&rows) {
        Some(i) if i < discovered.len() => i,
        _ => return Ok(None),
    };
    let picked = &discovered[picked_idx];

    // Single-entry build path: identical to `analyze_with_progress`
    // beyond this point but with a 1-element `ids` slice.
    let ids = vec![picked.id.clone()];
    let mut roots = build_trees_from_ids(&ctx, root, &ids, opts, progress);
    docker::label_call_tree_entries(&ctx.entry_declarations, &mut roots);
    let sql_opts = sql_file_opts_from(opts);
    let report = Report::build_with_progress(
        &ctx.all_tags,
        &ctx.graph,
        roots,
        &ctx.language_stats,
        Some(root),
        ctx.entry_declarations,
        sql_opts.as_ref(),
        &ctx.walk_opts,
        progress,
    );
    Ok(Some(AnalyzeOutcome {
        report,
        unresolved_entries: Vec::new(),
        language_stats: ctx.language_stats,
        profiled_language: ctx.profiled_language,
        // Carry the discovered roots through so the caller can echo
        // metadata about what was on the menu.
        discovered_roots: discovered,
        containment: ctx.containment,
    }))
}

/// Resolve each `DiscoveredRoot` to a `PickerRoot` carrying display
/// fields. Path-stripping mirrors `tree::build_inner`'s convention:
/// paths under the scanned root render relative; anything outside
/// renders absolute.
fn decorate_roots_for_picker(
    ctx: &GraphContext,
    root_dir: &Path,
    discovered: &[crate::roots::DiscoveredRoot],
) -> Vec<PickerRoot> {
    discovered
        .iter()
        .filter_map(|r| {
            let sym = ctx.graph.symbols.get(&r.id)?;
            let file = sym
                .file
                .strip_prefix(root_dir)
                .unwrap_or(&sym.file)
                .display()
                .to_string();
            let callers = ctx
                .graph
                .callers
                .get(&r.id)
                .map(|cids| {
                    cids.iter()
                        .filter_map(|cid| {
                            let s = ctx.graph.symbols.get(cid)?;
                            Some(PickerCaller {
                                name: s.name.clone(),
                                file: s
                                    .file
                                    .strip_prefix(root_dir)
                                    .unwrap_or(&s.file)
                                    .display()
                                    .to_string(),
                                line: s.line,
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            Some(PickerRoot {
                id: r.id.clone(),
                name: r.name.clone(),
                reach: r.reach,
                file,
                line: sym.line,
                callers,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::linguist::{LangKind, LanguageBreakdownEntry};

    fn paths(ps: &[&str]) -> Vec<PathBuf> {
        ps.iter().map(PathBuf::from).collect()
    }

    fn cf(path: &str, name: Option<&'static str>, lang: Option<Language>) -> ClassifiedFile {
        ClassifiedFile {
            path: PathBuf::from(path),
            size: 100,
            lang_name: name,
            lang_kind: name.map(|_| LangKind::Programming),
            language: lang,
        }
    }

    #[test]
    fn dominant_changed_language_empty_is_none() {
        assert_eq!(dominant_changed_language(&[]), None);
    }

    #[test]
    fn dominant_changed_language_picks_the_only_supported_language() {
        // A PR that only touches the TypeScript action profiles TypeScript —
        // the regression this whole change fixes.
        let files = paths(&["action/src/render/sections/quality_gauges.ts", "action/x.tsx"]);
        assert_eq!(dominant_changed_language(&files), Some(Language::TypeScript));
    }

    #[test]
    fn dominant_changed_language_picks_the_most_changed() {
        // 3 Rust vs 1 TS → Rust wins on count regardless of repo composition.
        let files = paths(&["a.rs", "b.rs", "c.rs", "d.ts"]);
        assert_eq!(dominant_changed_language(&files), Some(Language::Rust));
    }

    #[test]
    fn dominant_changed_language_ignores_unsupported_files() {
        // Non-source files don't count; a lone .ts still wins.
        assert_eq!(
            dominant_changed_language(&paths(&["README.md", "data.json", "x.ts"])),
            Some(Language::TypeScript)
        );
        // No supported file at all → None, so the caller falls back to the
        // whole-repo dominant language (old behaviour, unchanged).
        assert_eq!(dominant_changed_language(&paths(&["README.md", "ci.yaml"])), None);
    }

    #[test]
    fn dominant_changed_language_tie_breaks_alphabetically_not_by_enum_order() {
        // 1 .ts + 1 .js is a count tie. TypeScript precedes JavaScript in the
        // `Language` enum, but slug "javascript" < "typescript", so the
        // alphabetical winner (JavaScript) proves the pick ignores enum order.
        assert_eq!(
            dominant_changed_language(&paths(&["a.ts", "b.js"])),
            Some(Language::JavaScript)
        );
        // Order of the input list must not change the deterministic winner.
        assert_eq!(
            dominant_changed_language(&paths(&["b.js", "a.ts"])),
            Some(Language::JavaScript)
        );
    }

    #[test]
    fn realign_repoints_dominant_to_profiled_language() {
        let mut stats = LanguageStats {
            total_bytes: 1000,
            total_files: 10,
            breakdown: vec![
                LanguageBreakdownEntry {
                    language: "Rust".into(),
                    bytes: 600,
                    files: 6,
                    percent: 60.0,
                    supported: true,
                },
                LanguageBreakdownEntry {
                    language: "TypeScript".into(),
                    bytes: 300,
                    files: 3,
                    percent: 30.0,
                    supported: true,
                },
            ],
            dominant_supported: Some(Language::Rust),
            dominant_supported_name: Some("Rust".into()),
            dominant_supported_percent: Some(60.0),
        };
        let walked = vec![
            cf("a.rs", Some("Rust"), Some(Language::Rust)),
            cf("b.ts", Some("TypeScript"), Some(Language::TypeScript)),
        ];
        realign_dominant_to_profiled(&mut stats, &walked, Language::TypeScript);
        // The reported dominant pointer + percent now match what we profile,
        // and the percent is taken verbatim from the breakdown entry.
        assert_eq!(stats.dominant_supported, Some(Language::TypeScript));
        assert_eq!(stats.dominant_supported_name.as_deref(), Some("TypeScript"));
        assert_eq!(stats.dominant_supported_percent, Some(30.0));
        // The breakdown is untouched — it still reports the real repo mix.
        assert_eq!(stats.breakdown.len(), 2);
        assert_eq!(stats.breakdown[0].language, "Rust");
    }

    #[test]
    fn realign_is_a_noop_when_already_dominant() {
        let mut stats = LanguageStats {
            total_bytes: 1000,
            total_files: 10,
            breakdown: vec![LanguageBreakdownEntry {
                language: "Rust".into(),
                bytes: 600,
                files: 6,
                percent: 60.0,
                supported: true,
            }],
            dominant_supported: Some(Language::Rust),
            dominant_supported_name: Some("Rust".into()),
            dominant_supported_percent: Some(60.0),
        };
        let walked = vec![cf("a.rs", Some("Rust"), Some(Language::Rust))];
        realign_dominant_to_profiled(&mut stats, &walked, Language::Rust);
        assert_eq!(stats.dominant_supported, Some(Language::Rust));
        assert_eq!(stats.dominant_supported_name.as_deref(), Some("Rust"));
        assert_eq!(stats.dominant_supported_percent, Some(60.0));
    }
}
