//! End-to-end TS/JS ORM analysis tests.
//!
//! Phase 2 deliverable — drift v0.3 detects Prisma N+1 / raw / deep
//! includes / deep skip; Drizzle limit-without-order / N+1; TypeORM
//! N+1 / eager / SQL injection / synchronize-in-prod.

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

fn run_orm(name: &str) -> Vec<CallTreeNode> {
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

fn find_rule(entries: &[CallTreeNode], rule_id: &str) -> Vec<(String, usize)> {
    fn walk(node: &CallTreeNode, rule_id: &str, out: &mut Vec<(String, usize)>) {
        for f in &node.findings {
            if f.evidence.iter().any(|e| e.call == rule_id) {
                out.push((node.name.clone(), f.line));
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

// ─── Prisma ─────────────────────────────────────────────────────────────

#[test]
fn prisma_detects_deep_include() {
    let entries = run_orm("typescript-prisma");
    let hits = find_rule(&entries, "PRI-INC-001");
    assert!(
        hits.iter().any(|(n, _)| n == "deepInclude"),
        "PRI-INC-001 must fire on deepInclude, got: {:?}",
        hits
    );
}

#[test]
fn prisma_detects_find_unique_in_loop() {
    let entries = run_orm("typescript-prisma");
    let hits = find_rule(&entries, "PRI-N1-002");
    assert!(
        hits.iter().any(|(n, _)| n == "nPlusOneByIds"),
        "PRI-N1-002 must fire on nPlusOneByIds, got: {:?}",
        hits
    );
}

#[test]
fn prisma_detects_raw_unsafe_interpolation() {
    let entries = run_orm("typescript-prisma");
    let hits = find_rule(&entries, "PRI-RAW-003");
    assert!(
        hits.iter().any(|(n, _)| n == "rawUnsafe"),
        "PRI-RAW-003 must fire on rawUnsafe, got: {:?}",
        hits
    );
}

#[test]
fn prisma_detects_deep_pagination() {
    let entries = run_orm("typescript-prisma");
    let hits = find_rule(&entries, "PRI-PAG-004");
    assert!(
        hits.iter().any(|(n, _)| n == "deepPagination"),
        "PRI-PAG-004 must fire on deepPagination, got: {:?}",
        hits
    );
}

#[test]
fn prisma_clean_handler_has_no_findings() {
    // showUsers is a plain findMany — must NOT fire any PRI- rule.
    let entries = run_orm("typescript-prisma");
    for id in ["PRI-INC-001", "PRI-N1-002", "PRI-RAW-003", "PRI-PAG-004"] {
        let hits = find_rule(&entries, id);
        assert!(
            !hits.iter().any(|(n, _)| n == "showUsers"),
            "{id} should NOT fire on showUsers, got: {:?}",
            hits
        );
    }
}

// ─── Drizzle ────────────────────────────────────────────────────────────

#[test]
fn drizzle_detects_limit_without_order() {
    let entries = run_orm("typescript-drizzle");
    let hits = find_rule(&entries, "DRZ-LMT-001");
    assert!(
        hits.iter().any(|(n, _)| n == "listTop10"),
        "DRZ-LMT-001 must fire on listTop10, got: {:?}",
        hits
    );
    assert!(
        !hits.iter().any(|(n, _)| n == "listTop10Sorted"),
        "DRZ-LMT-001 must NOT fire on listTop10Sorted (orderBy present)"
    );
}

#[test]
fn drizzle_detects_select_in_loop() {
    let entries = run_orm("typescript-drizzle");
    let hits = find_rule(&entries, "DRZ-N1-002");
    assert!(
        hits.iter().any(|(n, _)| n == "lookupByIds"),
        "DRZ-N1-002 must fire on lookupByIds, got: {:?}",
        hits
    );
    assert!(
        !hits.iter().any(|(n, _)| n == "lookupByIdsBulk"),
        "DRZ-N1-002 must NOT fire on lookupByIdsBulk (single bulk query)"
    );
}

// ─── TypeORM ────────────────────────────────────────────────────────────

#[test]
fn typeorm_detects_findone_in_loop() {
    let entries = run_orm("typescript-typeorm");
    let hits = find_rule(&entries, "TO-N1-001");
    assert!(
        hits.iter().any(|(n, _)| n == "nPlusOne"),
        "TO-N1-001 must fire on nPlusOne, got: {:?}",
        hits
    );
}

#[test]
fn typeorm_detects_eager_one_to_many() {
    let entries = run_orm("typescript-typeorm");
    let hits = find_rule(&entries, "TO-EAGER-002");
    assert!(
        !hits.is_empty(),
        "TO-EAGER-002 must fire on @OneToMany with eager:true, got: {:?}",
        hits
    );
}

#[test]
fn typeorm_detects_querybuilder_injection() {
    let entries = run_orm("typescript-typeorm");
    let hits = find_rule(&entries, "TO-QB-003");
    assert!(
        hits.iter().any(|(n, _)| n == "unsafeSearch"),
        "TO-QB-003 must fire on unsafeSearch, got: {:?}",
        hits
    );
}

#[test]
fn typeorm_detects_synchronize_true() {
    let entries = run_orm("typescript-typeorm");
    let hits = find_rule(&entries, "TO-SYNC-004");
    assert!(
        !hits.is_empty(),
        "TO-SYNC-004 must fire on DataSource with synchronize:true, got: {:?}",
        hits
    );
}
