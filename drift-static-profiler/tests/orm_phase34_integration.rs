//! End-to-end integration tests for Phase 3 (JVM) + Phase 4 (Go/Rust)
//! + parallel tracks (LLM, Auth/Crypto).

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

// ─── JPA / Hibernate ────────────────────────────────────────────────────

#[test]
fn jpa_detects_findbyid_in_loop() {
    let entries = run("java-jpa");
    let hits = find_rule(&entries, "JPA-N1-001");
    assert!(
        hits.iter().any(|(n, _)| n == "loadAll"),
        "JPA-N1-001 must fire on loadAll, got: {:?}",
        hits
    );
}

#[test]
fn jpa_detects_save_in_loop() {
    let entries = run("java-jpa");
    let hits = find_rule(&entries, "JPA-SAVE-004");
    assert!(
        hits.iter().any(|(n, _)| n == "saveAll"),
        "JPA-SAVE-004 must fire on saveAll, got: {:?}",
        hits
    );
}

#[test]
fn jpa_detects_query_concat_injection() {
    let entries = run("java-jpa");
    let hits = find_rule(&entries, "JPA-QRY-002");
    assert!(
        !hits.is_empty(),
        "JPA-QRY-002 must fire on the @Query string-concat, got: {:?}",
        hits
    );
}

#[test]
fn jpa_detects_eager_fetch_type() {
    let entries = run("java-jpa");
    let hits = find_rule(&entries, "JPA-EAGER-003");
    assert!(
        !hits.is_empty(),
        "JPA-EAGER-003 must fire on @ManyToOne(fetch=EAGER), got: {:?}",
        hits
    );
}

// ─── GORM ───────────────────────────────────────────────────────────────

#[test]
fn gorm_detects_n_plus_one() {
    let entries = run("go-gorm");
    let hits = find_rule(&entries, "GORM-N1-001");
    assert!(
        hits.iter().any(|(n, _)| n == "NPlusOne"),
        "GORM-N1-001 must fire on NPlusOne, got: {:?}",
        hits
    );
}

#[test]
fn gorm_detects_raw_sprintf() {
    let entries = run("go-gorm");
    let hits = find_rule(&entries, "GORM-RAW-002");
    assert!(
        hits.iter().any(|(n, _)| n == "RawUnsafe"),
        "GORM-RAW-002 must fire on RawUnsafe, got: {:?}",
        hits
    );
}

#[test]
fn gorm_detects_automigrate() {
    let entries = run("go-gorm");
    let hits = find_rule(&entries, "GORM-AUTO-003");
    assert!(
        !hits.is_empty(),
        "GORM-AUTO-003 must fire on AutoMigrate, got: {:?}",
        hits
    );
}

#[test]
fn gorm_detects_save_in_loop() {
    let entries = run("go-gorm");
    let hits = find_rule(&entries, "GORM-SAVE-004");
    assert!(
        hits.iter().any(|(n, _)| n == "SaveLoop"),
        "GORM-SAVE-004 must fire on SaveLoop, got: {:?}",
        hits
    );
}

// ─── SQLx (Rust) ────────────────────────────────────────────────────────

#[test]
fn sqlx_detects_format_in_query() {
    let entries = run("rust-sqlx");
    let hits = find_rule(&entries, "SQLX-RAW-001");
    assert!(
        hits.iter().any(|(n, _)| n == "lookup_unsafe"),
        "SQLX-RAW-001 must fire on lookup_unsafe, got: {:?}",
        hits
    );
}

#[test]
fn sqlx_detects_query_in_loop() {
    let entries = run("rust-sqlx");
    let hits = find_rule(&entries, "SQLX-N1-002");
    assert!(
        hits.iter().any(|(n, _)| n == "n_plus_one"),
        "SQLX-N1-002 must fire on n_plus_one, got: {:?}",
        hits
    );
}

// ─── LLM / AI ───────────────────────────────────────────────────────────

#[test]
fn llm_detects_client_per_request() {
    let entries = run("python-llm");
    let hits = find_rule(&entries, "LLM-CLI-001");
    assert!(
        hits.iter().any(|(n, _)| n == "client_per_request"),
        "LLM-CLI-001 must fire on client_per_request, got: {:?}",
        hits
    );
}

#[test]
fn llm_detects_completion_in_loop() {
    let entries = run("python-llm");
    let hits = find_rule(&entries, "LLM-LOOP-002");
    assert!(
        hits.iter().any(|(n, _)| n == "loop_completions"),
        "LLM-LOOP-002 must fire on loop_completions, got: {:?}",
        hits
    );
}

#[test]
fn llm_detects_anthropic_without_cache_control() {
    let entries = run("python-llm");
    let hits = find_rule(&entries, "LLM-CACHE-004");
    assert!(
        hits.iter().any(|(n, _)| n == "no_cache_control"),
        "LLM-CACHE-004 must fire on no_cache_control, got: {:?}",
        hits
    );
}

// ─── Auth / Crypto ──────────────────────────────────────────────────────

#[test]
fn ac_detects_bcrypt_in_loop() {
    let entries = run("python-auth-crypto");
    let hits = find_rule(&entries, "AC-BCRYPT-001");
    assert!(
        hits.iter().any(|(n, _)| n == "rotate_passwords"),
        "AC-BCRYPT-001 must fire on rotate_passwords, got: {:?}",
        hits
    );
}

#[test]
fn ac_detects_rsa_keygen() {
    let entries = run("python-auth-crypto");
    let hits = find_rule(&entries, "AC-RSA-002");
    assert!(
        hits.iter().any(|(n, _)| n == "fresh_keypair"),
        "AC-RSA-002 must fire on fresh_keypair, got: {:?}",
        hits
    );
}

#[test]
fn ac_detects_jwks_per_request() {
    let entries = run("python-auth-crypto");
    let hits = find_rule(&entries, "AC-JWKS-003");
    assert!(
        hits.iter().any(|(n, _)| n == "verify_jwt"),
        "AC-JWKS-003 must fire on verify_jwt, got: {:?}",
        hits
    );
}
