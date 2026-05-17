//! End-to-end integration tests for Phase 5 (cross-file ModelGraph)
//! + Phase 2.1 (Sequelize + Mongoose).

use drift_static_profiler::{
    api::{analyze_roots, AnalyzeOptions},
    roots::DiscoverOpts,
    tree::CallTreeNode,
};
use std::path::PathBuf;

fn fixture(name: &str) -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests/fixtures");
    p.push(name);
    p
}

fn run(name: &str) -> Vec<CallTreeNode> {
    let root = fixture(name);
    let opts = AnalyzeOptions::default();
    let discover = DiscoverOpts {
        min_reach: 1,
        skip_tests: false,
        ..DiscoverOpts::default()
    };
    let outcome = analyze_roots(&root, &discover, &opts).expect("analyze_roots succeeds");
    outcome.report.entries
}

fn find_rule(entries: &[CallTreeNode], rule_id: &str) -> Vec<(String, usize, f64)> {
    fn walk(node: &CallTreeNode, rule_id: &str, out: &mut Vec<(String, usize, f64)>) {
        for f in &node.findings {
            if f.evidence.iter().any(|e| e.call == rule_id) {
                out.push((node.name.clone(), f.line, f.confidence));
            }
        }
        for c in &node.children {
            walk(c, rule_id, out);
        }
    }
    let mut out = Vec::new();
    for e in entries {
        walk(e, rule_id, &mut out);
    }
    out
}

// ─── Phase 5: cross-file ModelGraph lifts DJ-PROJ-010 ──────────────────

#[test]
fn dj_proj_010_fires_with_modelgraph_on_m2m_values() {
    // python-django fixture has `User.groups = ManyToManyField(Group)`
    // in models.py and `User.objects.values('groups')` in views.py.
    // DJ-PROJ-010 should fire at high confidence (post-fusion ≥0.90).
    let entries = run("python-django");
    let hits = find_rule(&entries, "DJ-PROJ-010");
    assert!(
        hits.iter().any(|(n, _, _)| n == "cartesian_values"),
        "DJ-PROJ-010 must fire on cartesian_values, got: {:?}",
        hits
    );
    let max_conf = hits
        .iter()
        .map(|(_, _, c)| *c)
        .fold(0.0_f64, f64::max);
    assert!(
        max_conf >= 0.90,
        "DJ-PROJ-010 confidence should be ≥0.90 with ModelGraph; got {max_conf}"
    );
}

// ─── Phase 2.1: Sequelize ───────────────────────────────────────────────

#[test]
fn sequelize_detects_findbypk_in_loop() {
    let entries = run("typescript-sequelize");
    let hits = find_rule(&entries, "SEQ-N1-001");
    assert!(
        hits.iter().any(|(n, _, _)| n == "nPlusOne"),
        "SEQ-N1-001 must fire on nPlusOne, got: {:?}",
        hits
    );
}

#[test]
fn sequelize_detects_save_in_loop() {
    let entries = run("typescript-sequelize");
    let hits = find_rule(&entries, "SEQ-SAVE-003");
    assert!(
        hits.iter().any(|(n, _, _)| n == "saveLoop"),
        "SEQ-SAVE-003 must fire on saveLoop, got: {:?}",
        hits
    );
}

#[test]
fn sequelize_detects_raw_template_interpolation() {
    let entries = run("typescript-sequelize");
    let hits = find_rule(&entries, "SEQ-RAW-002");
    assert!(
        hits.iter().any(|(n, _, _)| n == "rawUnsafe"),
        "SEQ-RAW-002 must fire on rawUnsafe, got: {:?}",
        hits
    );
}

#[test]
fn sequelize_detects_sync_force_true() {
    let entries = run("typescript-sequelize");
    let hits = find_rule(&entries, "SEQ-SYNC-004");
    assert!(
        !hits.is_empty(),
        "SEQ-SYNC-004 must fire on sequelize.sync({{force:true}}), got: {:?}",
        hits
    );
}

// ─── Phase 2.1: Mongoose ────────────────────────────────────────────────

#[test]
fn mongoose_detects_deep_populate() {
    let entries = run("typescript-mongoose");
    let hits = find_rule(&entries, "MNG-POP-001");
    assert!(
        hits.iter().any(|(n, _, _)| n == "deepPopulate"),
        "MNG-POP-001 must fire on deepPopulate, got: {:?}",
        hits
    );
}

#[test]
fn mongoose_detects_findbyid_in_loop() {
    let entries = run("typescript-mongoose");
    let hits = find_rule(&entries, "MNG-N1-002");
    assert!(
        hits.iter().any(|(n, _, _)| n == "nPlusOne"),
        "MNG-N1-002 must fire on nPlusOne, got: {:?}",
        hits
    );
}

#[test]
fn mongoose_detects_lean_missing() {
    let entries = run("typescript-mongoose");
    let hits = find_rule(&entries, "MNG-LEAN-003");
    assert!(
        hits.iter().any(|(n, _, _)| n == "leanMissing"),
        "MNG-LEAN-003 must fire on leanMissing, got: {:?}",
        hits
    );
}

#[test]
fn mongoose_detects_where_injection() {
    let entries = run("typescript-mongoose");
    let hits = find_rule(&entries, "MNG-RAW-004");
    assert!(
        hits.iter().any(|(n, _, _)| n == "whereInjection"),
        "MNG-RAW-004 must fire on whereInjection, got: {:?}",
        hits
    );
}

#[test]
fn mongoose_clean_query_has_no_findings() {
    let entries = run("typescript-mongoose");
    for id in ["MNG-POP-001", "MNG-N1-002", "MNG-LEAN-003", "MNG-RAW-004"] {
        let hits = find_rule(&entries, id);
        assert!(
            !hits.iter().any(|(n, _, _)| n == "cleanQuery"),
            "{id} must NOT fire on cleanQuery, got: {:?}",
            hits
        );
    }
}
