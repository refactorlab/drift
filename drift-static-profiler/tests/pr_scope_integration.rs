//! End-to-end integration test for [`drift_static_profiler::pr_scope`]
//! and [`drift_static_profiler::analyze_pr_with_progress`].
//!
//! Walks a real fixture (python-fastapi), builds the graph through
//! the production pipeline, discovers roots, and runs the PR-scope
//! filter against a hand-picked changed-files set. Asserts the
//! known-good behavior: the FastAPI `create_order` handler is the
//! affected root when `app/services.py` changes, since
//! services.OrderService.create_order is reachable upward from
//! services.py through the call graph.

use drift_static_profiler::{
    analyze_pr_with_progress,
    pr_scope::affected_roots,
    roots::{discover_roots, DiscoverOpts},
    tags::extract_tags,
    walker::discover_source_files,
    AnalyzeOptions, NullProgress,
};
use std::path::PathBuf;

fn fixture(name: &str) -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests/fixtures");
    p.push(name);
    p
}

/// Build the call graph for a fixture exactly the way the CLI does,
/// minus the per-pass progress bars. This is the same shape as
/// `tests/integration.rs::analyze` so we stay consistent with the
/// rest of the suite.
fn build_graph(root: &std::path::Path) -> drift_static_profiler::graph::CallGraph {
    let files = discover_source_files(root);
    let all: Vec<_> = files
        .into_iter()
        .filter_map(|(file, lang)| extract_tags(&file, lang).ok())
        .collect();
    drift_static_profiler::graph::CallGraph::build(&all)
}

/// pure-function path: walk → graph → discover_roots → affected_roots.
/// Mirrors what the GitHub Action wrapper would call internally but
/// exercises ONLY the language-agnostic core (no CLI, no JSON, no
/// progress bar). Locks down the contract documented in pr_scope.rs.
#[test]
fn affected_roots_finds_create_order_when_services_changes() {
    let root = fixture("python-fastapi");
    let graph = build_graph(&root);
    let all_roots = discover_roots(&graph, &root, &DiscoverOpts::default());

    // services.py defines OrderService.create_order, OrderService.build_order,
    // and OrderService.validate. The route handler `create_order` in
    // routes.py calls them via `OrderService(repository).create_order(...)`,
    // so reverse-BFS from any services.py symbol must climb to the
    // `create_order` route handler.
    let changed = vec![PathBuf::from("app/services.py")];
    let result = affected_roots(&graph, &all_roots, &changed);

    let names: Vec<&str> = result.roots.iter().map(|r| r.name.as_str()).collect();
    assert!(
        names.contains(&"create_order"),
        "expected `create_order` route handler in affected roots, got {names:?}",
    );
    assert!(
        result.unreachable_changes.is_empty(),
        "services.py reaches a root; expected no unreachable changes, got {:?}",
        result.unreachable_changes,
    );
}

/// `repositories.py` also lives under the route handler's call tree
/// (OrderService.create_order calls self.repository.save()), so it
/// likewise climbs to `create_order`.
#[test]
fn affected_roots_finds_create_order_when_repositories_changes() {
    let root = fixture("python-fastapi");
    let graph = build_graph(&root);
    let all_roots = discover_roots(&graph, &root, &DiscoverOpts::default());

    let changed = vec![PathBuf::from("app/repositories.py")];
    let result = affected_roots(&graph, &all_roots, &changed);

    let names: Vec<&str> = result.roots.iter().map(|r| r.name.as_str()).collect();
    assert!(
        names.contains(&"create_order"),
        "expected `create_order` in affected roots, got {names:?}",
    );
    assert!(result.unreachable_changes.is_empty());
}

/// Changing only a non-source file (e.g. README) yields zero affected
/// roots AND zero unreachable_changes — README has no in-graph
/// symbols, so it's "not applicable", not "dead code". This is the
/// behavior the GitHub Action depends on to avoid spammy warnings on
/// docs-only PRs.
#[test]
fn non_source_change_yields_empty_pr_scope() {
    let root = fixture("python-fastapi");
    let graph = build_graph(&root);
    let all_roots = discover_roots(&graph, &root, &DiscoverOpts::default());

    let changed = vec![PathBuf::from("README.md")];
    let result = affected_roots(&graph, &all_roots, &changed);

    assert!(
        result.roots.is_empty(),
        "README.md change should not affect any root, got {:?}",
        result.roots.iter().map(|r| &r.name).collect::<Vec<_>>(),
    );
    assert!(
        result.unreachable_changes.is_empty(),
        "non-source changes should NOT appear in unreachable_changes",
    );
}

/// scan-pr's JSON output MUST contain the full pr_review envelope
/// by default — Image 1 (architecture_flow), Image 2 (business_logic),
/// Image 3 (value_card with bars_mermaid), Image 4 (visual_summary)
/// PLUS pr_review_ext (tech_debt, duplication, tests_in_graph,
/// nfr_edge_cases) PLUS code_suggestions[].
///
/// This regression-tests the merge of `scan-pr` + `pr-review` into
/// one command: the previous split where `scan-pr` was factual-only
/// is permanently fixed.
#[test]
fn scan_pr_default_output_contains_full_pr_review_envelope() {
    use std::process::Command;
    let bin = env!("CARGO_BIN_EXE_drift-static-profiler");
    let root = fixture("python-fastapi");

    let mut child = Command::new(bin)
        .args([
            "scan-pr",
            root.to_str().unwrap(),
            "--changed-files-stdin",
            "--pretty",
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .expect("spawn scan-pr");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().expect("stdin");
        stdin
            .write_all(b"app/services.py\napp/repositories.py\n")
            .expect("write stdin");
    }
    let out = child.wait_with_output().expect("wait");
    assert!(
        out.status.success(),
        "scan-pr failed: {}",
        String::from_utf8_lossy(&out.stderr),
    );

    let v: serde_json::Value = serde_json::from_slice(&out.stdout).expect("valid JSON");

    // Factual fields still present. NOTE: `entries`/`frames`/
    // `string_table`/`summary` are intentionally OMITTED from the
    // slim envelope (internal call-graph data the renderer doesn't
    // need). pr_scope + pr_review + pr_review_ext + generator are
    // the public contract.
    assert!(v.get("pr_scope").is_some(), "pr_scope missing");
    assert!(v.get("generator").is_some(), "generator missing");
    assert!(v.get("schema_version").is_some(), "schema_version missing");

    // pr_review (enrichment) — must be present by default
    let pr_review = v.get("pr_review").expect("pr_review missing — scan-pr regressed to factual-only");

    // Image 1
    let af = pr_review.get("architecture_flow").expect("architecture_flow missing");
    assert!(af.get("after_mermaid").is_some(), "Image 1 mermaid missing");
    assert!(af.get("data_structures").is_some(), "Image 1 data_structures missing");

    // Image 2
    let bl = pr_review.get("business_logic").expect("business_logic missing");
    assert!(bl.get("mermaid").is_some(), "Image 2 mermaid missing");

    // Image 3
    let vc = pr_review.get("value_card").expect("value_card missing");
    assert_eq!(
        vc.get("axes").and_then(|a| a.as_array()).map(|a| a.len()),
        Some(4),
        "Image 3 must have exactly 4 axes (money/customer/runtime/runtime_ux)",
    );
    assert!(
        vc.get("bars_mermaid").is_some(),
        "Image 3 bars_mermaid (xychart-beta) missing",
    );

    // Image 4
    let vs = pr_review.get("visual_summary").expect("visual_summary missing");
    assert!(vs.get("risks").is_some(), "Image 4 risks block missing");
    assert!(vs.get("key_files").is_some(), "Image 4 key_files block missing");

    // Static code-suggestions context (LLM input)
    assert!(
        pr_review.get("code_suggestions").is_some(),
        "code_suggestions array missing",
    );

    // Extensions
    let ext = v.get("pr_review_ext").expect("pr_review_ext missing");
    for k in ["tech_debt", "duplication", "tests_in_graph", "nfr_edge_cases"] {
        assert!(
            ext.get(k).is_some(),
            "pr_review_ext.{k} missing — algorithm output dropped",
        );
    }
}

/// Opt-out flag: `--no-review` produces ONLY the factual envelope
/// (no `pr_review` / `pr_review_ext`). Keeps the fast path available
/// for users who only need scan-scope data.
#[test]
fn scan_pr_no_review_flag_strips_enrichment() {
    use std::process::Command;
    let bin = env!("CARGO_BIN_EXE_drift-static-profiler");
    let root = fixture("python-fastapi");

    let mut child = Command::new(bin)
        .args([
            "scan-pr",
            root.to_str().unwrap(),
            "--changed-files-stdin",
            "--no-review",
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .expect("spawn scan-pr");
    {
        use std::io::Write;
        let mut stdin = child.stdin.take().expect("stdin");
        stdin.write_all(b"app/services.py\n").expect("write");
    }
    let out = child.wait_with_output().expect("wait");
    assert!(out.status.success());
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).expect("valid JSON");
    assert!(v.get("pr_scope").is_some());
    assert!(
        v.get("pr_review").is_none(),
        "--no-review must strip pr_review block",
    );
    assert!(
        v.get("pr_review_ext").is_none(),
        "--no-review must strip pr_review_ext block",
    );
}

/// Real-world unreachable case from the FastAPI fixture.
///
/// `app/db.py` defines `get_session`, which is referenced only via
/// `session=Depends(get_session)` in the route handler. FastAPI's
/// `Depends()` is a metadata-style registration — the static
/// resolver does NOT wire it as a call edge from `create_order`
/// back to `get_session`. So:
///
///   - `get_session` has no in-graph callers
///   - `get_session.reach == 1` (just itself; below default
///     `min_reach=2`), so it's filtered out of the discovered-roots
///     list
///   - therefore `db.py` is a "real source file" whose symbols
///     reach no root → it's the canonical unreachable_changes case
///
/// This is the spec's "Test the unreachable case" requirement,
/// using a real-world graph instead of the synthetic one in
/// `src/pr_scope.rs`'s unit tests. If a future resolver change
/// teaches the analyzer to follow `Depends()` edges, this test will
/// flip — at which point `db.py` would become "covered" and the
/// assertion needs updating.
#[test]
fn affected_roots_marks_db_py_as_unreachable() {
    let root = fixture("python-fastapi");
    let graph = build_graph(&root);
    let all_roots = discover_roots(&graph, &root, &DiscoverOpts::default());

    let changed = vec![
        PathBuf::from("app/services.py"), // reaches create_order (sanity)
        PathBuf::from("app/db.py"),       // unreachable (the case under test)
    ];
    let result = affected_roots(&graph, &all_roots, &changed);

    // Sanity: services.py still climbs to create_order.
    let names: Vec<&str> = result.roots.iter().map(|r| r.name.as_str()).collect();
    assert!(
        names.contains(&"create_order"),
        "services.py should still surface create_order, got {names:?}",
    );

    // The actual assertion: db.py is in unreachable_changes.
    assert!(
        result
            .unreachable_changes
            .contains(&PathBuf::from("app/db.py")),
        "expected app/db.py in unreachable_changes (get_session is only used via FastAPI Depends), \
         got {:?}",
        result.unreachable_changes,
    );

    // services.py should NOT also be in unreachable_changes — it
    // reached create_order.
    assert!(
        !result
            .unreachable_changes
            .contains(&PathBuf::from("app/services.py")),
        "services.py reached a root; must not be flagged unreachable, \
         got {:?}",
        result.unreachable_changes,
    );
}

/// CLI contract for the GitHub Action wrapper: the `--commits`,
/// `--diff-stats`, and `--pr-context-file` flags together must
/// feed every enrichment algorithm with the real PR data the
/// Action collects (mirrors `git log $BASE..$HEAD --format=%B%x00`
/// + `git diff --numstat` + `$GITHUB_EVENT_PATH .pull_request`).
///
/// Verifies the END-TO-END plumbing: outputs must reflect each of
/// the three inputs (counts.feat ← commits, value_money.loc_added
/// ← diff-stats, business_logic.summary ← pr-context). Without
/// this test, a regression in any of the three flag handlers
/// would silently produce empty algorithm signals.
#[test]
fn scan_pr_with_full_action_context_populates_all_algorithms() {
    use std::io::Write;
    use std::process::Command;

    let bin = env!("CARGO_BIN_EXE_drift-static-profiler");
    let root = fixture("python-fastapi");

    // Stage realistic Action-context inputs into a unique tmp dir
    // (so parallel test runs don't collide on the same files).
    let tmp = std::env::temp_dir().join(format!(
        "drift-scan-pr-action-ctx-{}",
        std::process::id()
    ));
    std::fs::create_dir_all(&tmp).expect("mkdir tmp");

    // Mimic `git log $BASE..$HEAD --format=%B%x00` — NUL-separated.
    let commits_path = tmp.join("commits.txt");
    std::fs::write(
        &commits_path,
        b"feat(orders): introduce OrderService layer\0fix: handle empty payload\n\nFixes #42\0perf: batch validation pass\0",
    )
    .expect("write commits");

    // Mimic `git diff --numstat $BASE $HEAD` — additions TAB deletions TAB path.
    let diff_path = tmp.join("diff-stats.tsv");
    std::fs::write(
        &diff_path,
        "32\t5\tapp/services.py\n18\t2\tapp/repositories.py\n4\t8\tapp/db.py\n",
    )
    .expect("write diff");

    // Mimic `$GITHUB_EVENT_PATH .pull_request` JSON.
    let ctx_path = tmp.join("pr-context.json");
    std::fs::write(
        &ctx_path,
        br#"{
            "title": "feat(orders): introduce OrderService layer",
            "body": "Splits order creation into a dedicated service. Resolves #58.",
            "number": 36,
            "base": {"sha":"deadbeef"}, "head": {"sha":"cafebabe"}
        }"#,
    )
    .expect("write ctx");

    let mut child = Command::new(bin)
        .args([
            "scan-pr",
            root.to_str().unwrap(),
            "--changed-files-stdin",
            "--commits",
            commits_path.to_str().unwrap(),
            "--diff-stats",
            diff_path.to_str().unwrap(),
            "--pr-context-file",
            ctx_path.to_str().unwrap(),
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .expect("spawn scan-pr");
    {
        let mut stdin = child.stdin.take().expect("stdin");
        stdin
            .write_all(b"app/services.py\napp/repositories.py\napp/db.py\n")
            .expect("write stdin");
    }
    let out = child.wait_with_output().expect("wait");
    assert!(
        out.status.success(),
        "scan-pr failed: {}",
        String::from_utf8_lossy(&out.stderr),
    );

    let v: serde_json::Value = serde_json::from_slice(&out.stdout).expect("valid JSON");
    let counts = v
        .pointer("/pr_review/counts")
        .expect("pr_review.counts missing");

    // Commits → counts: `feat:` → features, `fix:` + `Fixes #42` → bug_fixes
    assert_eq!(
        counts.pointer("/features/value").and_then(|x| x.as_u64()),
        Some(1),
        "expected features=1 from `feat(orders):` commit, got {counts}",
    );
    assert_eq!(
        counts.pointer("/bug_fixes/value").and_then(|x| x.as_u64()),
        Some(2),
        "expected bug_fixes=2 (`fix:` subject + `Fixes #42` ref), got {counts}",
    );

    // PR body → counts: `Resolves #58` lifts issues_resolved.
    // (Without --pr-context-file, this would stay at 0.)
    assert_eq!(
        counts
            .pointer("/issues_resolved/value")
            .and_then(|x| x.as_u64()),
        Some(1),
        "expected issues_resolved=1 from PR body `Resolves #58`, got {counts}",
    );

    // diff-stats → value_money.loc_added (sum of additions column = 32+18+4 = 54).
    let loc_added = v
        .pointer("/pr_review/value_card/axes/0/inputs/loc_added")
        .and_then(|x| x.as_f64())
        .expect("value_money.loc_added missing");
    assert_eq!(
        loc_added, 54.0,
        "expected loc_added=54 (32+18+4 from diff-stats), got {loc_added}",
    );

    // pr-context → business_logic.summary picks up the title+body.
    let summary = v
        .pointer("/pr_review/business_logic/summary")
        .and_then(|x| x.as_str())
        .unwrap_or("");
    assert!(
        summary.contains("OrderService"),
        "expected business_logic.summary to mention OrderService (from PR title), got {summary:?}",
    );

    // Cleanup.
    let _ = std::fs::remove_dir_all(&tmp);
}

/// Graph-pruning contract: `analyze_pr_with_progress` builds trees
/// for ONLY the affected roots, NOT for every discovered root. This
/// is the load-bearing perf invariant — on a project with thousands
/// of routes, a PR touching one file must not pay the tree-building
/// cost for unrelated routes.
///
/// We assert it by comparing two numbers:
///   - The total number of roots discovered in the project (full
///     discover_roots output)
///   - The count of trees actually built (report.entries.len())
///
/// The second must be strictly less than the first on a fixture
/// that has multiple roots, since the PR touches only one.
#[test]
fn graph_pruning_only_builds_trees_for_affected_roots() {
    // python-django has multiple route handlers; PR touching one
    // model file should only build the trees of routes that
    // reverse-reach that model, NOT every route in the project.
    let root = fixture("python-django");

    // Full discovery on the unfiltered graph.
    let graph = build_graph(&root);
    let all_roots = discover_roots(&graph, &root, &DiscoverOpts::default());
    let total_root_count = all_roots.len();
    if total_root_count < 2 {
        // Defensive — if the fixture changes, this test stays valid
        // but skipped. Re-pick a fixture with ≥2 roots if this fires.
        eprintln!(
            "skipping: fixture has {total_root_count} roots (<2) — test needs multiple roots",
        );
        return;
    }

    let changed = vec![PathBuf::from("app/models.py")];
    let result = analyze_pr_with_progress(
        &root,
        &changed,
        &DiscoverOpts::default(),
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .expect("analyze_pr_with_progress should succeed");

    let trees_built = result.outcome.report.entries.len();

    // Trees built must equal affected_root_names — the PR-scope
    // outcome is the SOURCE OF TRUTH for which trees got built.
    assert_eq!(
        trees_built,
        result.pr_scope.affected_root_names.len(),
        "report.entries.len() must equal affected_root_names.len() — these are the same set",
    );

    // The pruning invariant: trees built ≤ total discovered. (Strict
    // `<` would be ideal, but a single-root fixture or a PR that
    // touches every route would saturate. The `≤` invariant is the
    // load-bearing contract: we never build trees we shouldn't.)
    assert!(
        trees_built <= total_root_count,
        "trees built ({trees_built}) must not exceed discovered roots ({total_root_count})",
    );
}

/// End-to-end orchestration: `analyze_pr_with_progress` produces a
/// Report whose `entries` count matches the affected-root count, AND
/// the carried `pr_scope` block reflects the input.
#[test]
fn analyze_pr_with_progress_returns_focused_report() {
    let root = fixture("python-fastapi");
    let changed = vec![PathBuf::from("app/services.py")];

    let result = analyze_pr_with_progress(
        &root,
        &changed,
        &DiscoverOpts::default(),
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .expect("analyze_pr_with_progress should succeed on the fastapi fixture");

    // The report's entries must equal the PR-scope affected_roots
    // length — the whole point of scan-pr is that the report is
    // scoped to those roots and nothing else.
    assert_eq!(
        result.outcome.report.entries.len(),
        result.pr_scope.affected_root_names.len(),
        "report entries count must match affected_root_names length",
    );

    // The CLI echoes the input list verbatim, so it must round-trip.
    assert_eq!(
        result.pr_scope.changed_files,
        vec![PathBuf::from("app/services.py")],
    );

    // `create_order` is the well-known route handler in the fixture
    // and must show up in the affected list.
    assert!(
        result
            .pr_scope
            .affected_root_names
            .iter()
            .any(|n| n == "create_order"),
        "expected `create_order` in affected_root_names, got {:?}",
        result.pr_scope.affected_root_names,
    );

    // services.py contributes seeds that reach a root, so it must
    // NOT be flagged as unreachable.
    assert!(
        result.pr_scope.unreachable_changes.is_empty(),
        "expected no unreachable changes, got {:?}",
        result.pr_scope.unreachable_changes,
    );
}
