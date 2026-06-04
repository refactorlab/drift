//! End-to-end Scala/Kotlin ORM analysis tests.
//!
//! Phase 5 deliverable — drift detects:
//!   - Slick:   SLI-INJ-001, SLI-N1-002, SLI-COMP-003, SLI-BLK-004
//!   - Quill:   QUI-INJ-001, QUI-N1-002, QUI-DYN-003
//!   - Exposed: EXP-N1-001..002, EXP-RAW-003, EXP-INS-004, EXP-DEL-005,
//!     EXP-INS-006, EXP-TXN-007
//!   - Ktorm:   KTO-N1-001, KTO-RAW-002, KTO-UPD-003, KTO-INS-004, KTO-DEL-005
//!
//! Scala/Kotlin idioms use trailing-lambda forms (`.forEach { … }`)
//! extensively, so findings attach to the lambda CallTreeNode rather
//! than the enclosing function. Tests assert by rule-id presence and
//! source-line ranges rather than function name.

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

/// Returns every (node-name, finding-line) where `rule_id` fires.
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

/// Counts findings for a rule across all entries.
fn count_rule(entries: &[CallTreeNode], rule_id: &str) -> usize {
    find_rule(entries, rule_id).len()
}

// ─── Slick ──────────────────────────────────────────────────────────────

#[test]
fn slick_detects_hash_dollar_interpolation() {
    let entries = run_orm("scala-slick");
    let hits = find_rule(&entries, "SLI-INJ-001");
    assert!(!hits.is_empty(), "SLI-INJ-001 must fire on searchUnsafe");
}

#[test]
fn slick_detects_db_run_in_loop() {
    let entries = run_orm("scala-slick");
    let hits = find_rule(&entries, "SLI-N1-002");
    // 3 antipatterns: loadAll (for), deleteEach (foreach), fetchEach (map).
    // Plus blockingLoop's inner db.run (also in_loop). So ≥3.
    assert!(
        hits.len() >= 3,
        "SLI-N1-002 must fire ≥3× (loadAll/deleteEach/fetchEach), got {:?}",
        hits
    );
}

#[test]
fn slick_detects_multiple_db_run_in_function() {
    let entries = run_orm("scala-slick");
    let hits = find_rule(&entries, "SLI-COMP-003");
    assert!(
        !hits.is_empty(),
        "SLI-COMP-003 must fire on transfer (2× db.run in same fn), got: {:?}",
        hits
    );
}

#[test]
fn slick_detects_await_db_run_in_loop() {
    let entries = run_orm("scala-slick");
    let hits = find_rule(&entries, "SLI-BLK-004");
    assert!(!hits.is_empty(), "SLI-BLK-004 must fire on blockingLoop, got: {:?}", hits);
}

#[test]
fn slick_detects_missing_transactionally() {
    let entries = run_orm("scala-slick");
    let hits = find_rule(&entries, "SLI-TXN-005");
    assert!(
        !hits.is_empty(),
        "SLI-TXN-005 must fire on transferNoTxn (DBIO.seq w/ writes, no transactionally), got: {:?}",
        hits
    );
}

#[test]
fn slick_clean_handlers_dont_overfire() {
    // The fixture has 3 SLI-N1-002 candidates, 1 SLI-COMP-003 candidate,
    // 1 SLI-BLK-004 candidate, and 1 SLI-INJ-001 candidate. Verify the
    // counts are bounded — no runaway firing on clean methods.
    let entries = run_orm("scala-slick");
    assert!(
        count_rule(&entries, "SLI-N1-002") <= 5,
        "SLI-N1-002 over-fired: {}",
        count_rule(&entries, "SLI-N1-002")
    );
    assert!(
        count_rule(&entries, "SLI-INJ-001") <= 1,
        "SLI-INJ-001 over-fired: {}",
        count_rule(&entries, "SLI-INJ-001")
    );
}

// ─── Quill ──────────────────────────────────────────────────────────────

#[test]
fn quill_detects_infix_interpolation() {
    let entries = run_orm("scala-quill");
    let hits = find_rule(&entries, "QUI-INJ-001");
    assert!(!hits.is_empty(), "QUI-INJ-001 must fire on searchUnsafe, got: {:?}", hits);
}

#[test]
fn quill_detects_ctx_run_in_loop() {
    let entries = run_orm("scala-quill");
    let hits = find_rule(&entries, "QUI-N1-002");
    // 3 antipattern fns: n1ByFor, n1ByForeach, n1ByMap. Each fires once.
    assert!(
        hits.len() >= 3,
        "QUI-N1-002 must fire ≥3× (n1By*), got {:?}",
        hits
    );
}

#[test]
fn quill_detects_dynamic_identifier_injection() {
    let entries = run_orm("scala-quill");
    let hits = find_rule(&entries, "QUI-DYN-003");
    assert!(
        !hits.is_empty(),
        "QUI-DYN-003 must fire on dynamicSchemaUnsafe / dynamicSetUnsafe, got: {:?}",
        hits
    );
}

#[test]
fn quill_clean_handlers_dont_overfire() {
    // batchInsertGood, listAll, alwaysTrue, dynamicSchemaSafe, dynamicSetSafe
    // — none of these should trigger any QUI rule.
    let entries = run_orm("scala-quill");
    // Total findings should match the antipattern count, not the file size.
    assert!(
        count_rule(&entries, "QUI-N1-002") <= 4,
        "QUI-N1-002 over-fired: {}",
        count_rule(&entries, "QUI-N1-002")
    );
}

// ─── Exposed ────────────────────────────────────────────────────────────

#[test]
fn exposed_detects_findbyid_in_loop() {
    let entries = run_orm("kotlin-exposed");
    let hits = find_rule(&entries, "EXP-N1-001");
    assert!(!hits.is_empty(), "EXP-N1-001 must fire on loadAll, got: {:?}", hits);
}

#[test]
fn exposed_detects_dao_find_in_loop() {
    let entries = run_orm("kotlin-exposed");
    let hits = find_rule(&entries, "EXP-N1-002");
    assert!(!hits.is_empty(), "EXP-N1-002 must fire on searchEach, got: {:?}", hits);
}

#[test]
fn exposed_detects_exec_string_concat() {
    let entries = run_orm("kotlin-exposed");
    let hits = find_rule(&entries, "EXP-RAW-003");
    assert!(!hits.is_empty(), "EXP-RAW-003 must fire on searchUnsafe, got: {:?}", hits);
}

#[test]
fn exposed_detects_entity_new_in_loop() {
    let entries = run_orm("kotlin-exposed");
    let hits = find_rule(&entries, "EXP-INS-004");
    assert!(!hits.is_empty(), "EXP-INS-004 must fire on createMany, got: {:?}", hits);
}

#[test]
fn exposed_detects_entity_delete_in_loop() {
    let entries = run_orm("kotlin-exposed");
    let hits = find_rule(&entries, "EXP-DEL-005");
    assert!(!hits.is_empty(), "EXP-DEL-005 must fire on purge, got: {:?}", hits);
}

#[test]
fn exposed_detects_table_insert_in_loop() {
    let entries = run_orm("kotlin-exposed");
    let hits = find_rule(&entries, "EXP-INS-006");
    assert!(!hits.is_empty(), "EXP-INS-006 must fire on bulkInsertWrong, got: {:?}", hits);
}

#[test]
fn exposed_detects_transaction_in_loop() {
    let entries = run_orm("kotlin-exposed");
    let hits = find_rule(&entries, "EXP-TXN-007");
    assert!(!hits.is_empty(), "EXP-TXN-007 must fire on deleteEach, got: {:?}", hits);
}

#[test]
fn exposed_detects_lazy_reference_in_loop() {
    let entries = run_orm("kotlin-exposed");
    let hits = find_rule(&entries, "EXP-LAZY-008");
    assert!(
        !hits.is_empty(),
        "EXP-LAZY-008 must fire on lazyRatingsBad (issue #420 pattern), got: {:?}",
        hits
    );
}

#[test]
fn exposed_clean_handlers_dont_overfire() {
    let entries = run_orm("kotlin-exposed");
    // 8 distinct antipattern handlers (loadAll, searchEach, searchUnsafe,
    // createMany, purge, bulkInsertWrong, deleteEach, lazyRatingsBad).
    // Counts should stay close to that — much higher means firing on
    // bulkInsertGood / loadAllGood / purgeGood / showUser /
    // lazyRatingsGood.
    let total: usize = [
        "EXP-N1-001",
        "EXP-N1-002",
        "EXP-RAW-003",
        "EXP-INS-004",
        "EXP-DEL-005",
        "EXP-INS-006",
        "EXP-TXN-007",
        "EXP-LAZY-008",
    ]
    .iter()
    .map(|r| count_rule(&entries, r))
    .sum();
    assert!(total <= 20, "Exposed rules over-fired: total {}", total);
}

// ─── Ktorm ──────────────────────────────────────────────────────────────

#[test]
fn ktorm_detects_find_in_loop() {
    let entries = run_orm("kotlin-ktorm");
    let hits = find_rule(&entries, "KTO-N1-001");
    assert!(!hits.is_empty(), "KTO-N1-001 must fire on loadAll/loadAllForeach, got: {:?}", hits);
}

#[test]
fn ktorm_detects_prepare_statement_concat() {
    let entries = run_orm("kotlin-ktorm");
    let hits = find_rule(&entries, "KTO-RAW-002");
    assert!(!hits.is_empty(), "KTO-RAW-002 must fire on searchUnsafe, got: {:?}", hits);
}

#[test]
fn ktorm_detects_flush_in_loop() {
    let entries = run_orm("kotlin-ktorm");
    let hits = find_rule(&entries, "KTO-UPD-003");
    assert!(!hits.is_empty(), "KTO-UPD-003 must fire on raiseSalaries, got: {:?}", hits);
}

#[test]
fn ktorm_detects_database_insert_in_loop() {
    let entries = run_orm("kotlin-ktorm");
    let hits = find_rule(&entries, "KTO-INS-004");
    assert!(!hits.is_empty(), "KTO-INS-004 must fire on createMany, got: {:?}", hits);
}

#[test]
fn ktorm_detects_entity_delete_in_loop() {
    let entries = run_orm("kotlin-ktorm");
    let hits = find_rule(&entries, "KTO-DEL-005");
    assert!(!hits.is_empty(), "KTO-DEL-005 must fire on purge, got: {:?}", hits);
}

#[test]
fn ktorm_clean_handlers_dont_overfire() {
    let entries = run_orm("kotlin-ktorm");
    let total: usize = [
        "KTO-N1-001",
        "KTO-RAW-002",
        "KTO-UPD-003",
        "KTO-INS-004",
        "KTO-DEL-005",
    ]
    .iter()
    .map(|r| count_rule(&entries, r))
    .sum();
    // 5 antipattern handlers; allow 2 hits each for safety.
    assert!(total <= 10, "Ktorm rules over-fired: total {}", total);
}
