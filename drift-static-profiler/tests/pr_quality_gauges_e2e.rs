//! End-to-end integration test for the PR-quality GAUGE projection.
//!
//! Runs the FULL production path on a real fixture — graph build →
//! `analyze_pr_with_progress` → `pr_algorithms::enrich` → the 18 gauges —
//! and asserts the render-ready contract the action's gauge report depends
//! on. This is the load-bearing "the values are actually in the scan-pr
//! output" guarantee: if the projection regresses, this fails (the per-module
//! unit tests use synthetic nodes; THIS uses a real call graph).

use drift_static_profiler::pr_algorithms::counts::ChangedFile;
use drift_static_profiler::pr_algorithms::{enrich, EnrichInputs};
use drift_static_profiler::{analyze_pr_with_progress, AnalyzeOptions, DiscoverOpts, NullProgress};
use std::collections::BTreeSet;
use std::path::PathBuf;

fn fixture(name: &str) -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests/fixtures");
    p.push(name);
    p
}

fn cf(path: &str, additions: usize, deletions: usize) -> ChangedFile {
    ChangedFile {
        path: path.to_string(),
        status: Some("modified".to_string()),
        additions,
        deletions,
        ..Default::default()
    }
}

#[test]
fn gauges_end_to_end_on_fastapi_fixture() {
    let root = fixture("python-fastapi");
    let changed = vec![
        PathBuf::from("app/services.py"),
        PathBuf::from("app/repositories.py"),
    ];

    let outcome = analyze_pr_with_progress(
        &root,
        &changed,
        &DiscoverOpts::default(),
        &AnalyzeOptions::default(),
        &NullProgress,
    )
    .expect("analyze_pr");

    // total_symbols must be wired (the inversion's pagerank×N arm).
    assert!(
        outcome.total_symbols > 0,
        "graph N should be populated, got {}",
        outcome.total_symbols
    );

    // Diff stats (additions/deletions) so the token gauges are non-zero —
    // exactly what the action must pass via --diff-stats in production.
    let changed_files = vec![cf("app/services.py", 120, 30), cf("app/repositories.py", 80, 10)];
    let commits = vec!["feat: add order service".to_string(), "fix: empty payload".to_string()];

    let enriched = enrich(EnrichInputs {
        outcome: &outcome,
        commit_messages: &commits,
        changed_files: &changed_files,
        pr_context: None,
        repo_root: Some(root.as_path()),
        progress: None,
    });

    let pq = &enriched.pr_review_ext.pr_quality;

    // ── the 18-gauge contract ─────────────────────────────────────────
    assert_eq!(pq.gauges.len(), 18, "expected 18 gauges");
    for g in &pq.gauges {
        assert!(g.score <= 100, "{} score out of range: {}", g.id, g.score);
        assert!(
            ["low", "moderate", "high", "critical"].contains(&g.level.as_str()),
            "{} bad level {}",
            g.id,
            g.level
        );
        assert!(["↑", "↓"].contains(&g.arrow.as_str()), "{} bad arrow", g.id);
        assert!(!g.label.is_empty() && !g.group.is_empty() && !g.description.is_empty());
    }

    // every group + a representative id from each is present.
    let ids: BTreeSet<&str> = pq.gauges.iter().map(|g| g.id.as_str()).collect();
    for id in [
        "token_footprint",
        "context_window_pressure",
        "agent_reviewability",
        "semantic_density",
        "explainability",
        "context_dependency",
        "decision_transparency",
        "maintenance_burden",
        "debt_delta",
        "fragility_index",
        "test_coverage",
        "repeatability",
        "edge_case_surface",
        "rollback_complexity",
        "observability",
        "blast_radius",
        "knowledge_concentration",
        "review_fatigue",
    ] {
        assert!(ids.contains(id), "missing gauge id: {id}");
    }
    let groups: BTreeSet<&str> = pq.gauges.iter().map(|g| g.group.as_str()).collect();
    assert_eq!(groups.len(), 6, "expected 6 groups, got {groups:?}");

    // ── summary ────────────────────────────────────────────────────────
    assert!(
        pq.gauge_summary.token_estimate > 0,
        "token estimate should be non-zero with diff stats (240 LOC), got {}",
        pq.gauge_summary.token_estimate
    );
    assert!(!pq.gauge_summary.highest.is_empty(), "highest-risk list populated");
    assert!(!pq.composite.band.is_empty(), "composite band present");

    // ── known fixture truth: the changed code has no test reaching it,
    //    so the (quality) coverage gauge is a CRITICAL risk. ───────────
    let cov = pq.gauges.iter().find(|g| g.id == "test_coverage").unwrap();
    assert!(cov.higher_is_better, "coverage is a quality metric");
    assert_eq!(cov.level, "critical", "fastapi changed code is uncovered → critical");

    // ── JSON integrity: the whole block serializes (serde rejects NaN/Inf). ──
    let json = serde_json::to_string(pq).expect("pr_quality serializes");
    assert!(json.contains("\"gauges\""));
    assert!(!json.contains("NaN") && !json.contains("Infinity"));
}

#[test]
fn gauges_deterministic_across_two_runs() {
    let root = fixture("python-fastapi");
    let changed = vec![PathBuf::from("app/services.py")];
    let run = || {
        let outcome = analyze_pr_with_progress(
            &root,
            &changed,
            &DiscoverOpts::default(),
            &AnalyzeOptions::default(),
            &NullProgress,
        )
        .unwrap();
        let cf = vec![cf("app/services.py", 40, 5)];
        let enriched = enrich(EnrichInputs {
            outcome: &outcome,
            commit_messages: &[],
            changed_files: &cf,
            pr_context: None,
            repo_root: Some(root.as_path()),
            progress: None,
        });
        serde_json::to_string(&enriched.pr_review_ext.pr_quality.gauges).unwrap()
    };
    assert_eq!(run(), run(), "gauges must be deterministic on identical input");
}
