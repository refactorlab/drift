//! Integration test for the fast file-based `orm-scan` entrypoint.
//!
//! Calls `orm::scan_workspace` directly (no disk output) on the
//! existing Python/TS fixtures and asserts the same rules fire as the
//! tree-based pipeline, but in milliseconds.

use drift_static_profiler::orm::scan_workspace;
use std::path::PathBuf;

fn fixture(name: &str) -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests/fixtures");
    p.push(name);
    p
}

fn rule_ids(findings: &[(PathBuf, drift_static_profiler::insights::Finding)]) -> Vec<String> {
    findings
        .iter()
        .filter_map(|(_, f)| f.evidence.first().map(|e| e.call.clone()))
        .collect()
}

#[test]
fn orm_scan_python_django_finds_expected_rules() {
    let root = fixture("python-django");
    let findings = scan_workspace(&root, 1000);
    let ids = rule_ids(&findings);
    for expected in ["DJ-N1-001", "DJ-PERF-007", "DJ-RAW-011", "DJ-N1-003"] {
        assert!(
            ids.iter().any(|r| r == expected),
            "orm-scan must fire {expected} on python-django fixture; got: {ids:?}"
        );
    }
}

#[test]
fn orm_scan_python_sqlalchemy_finds_expected_rules() {
    let root = fixture("python-sqlalchemy");
    let findings = scan_workspace(&root, 1000);
    let ids = rule_ids(&findings);
    for expected in ["SA-EXEC-009", "SA-LAZY-008", "SA-SESS-007", "SA-N1-001"] {
        assert!(
            ids.iter().any(|r| r == expected),
            "orm-scan must fire {expected} on python-sqlalchemy fixture; got: {ids:?}"
        );
    }
}

#[test]
fn orm_scan_typescript_prisma_finds_expected_rules() {
    let root = fixture("typescript-prisma");
    let findings = scan_workspace(&root, 1000);
    let ids = rule_ids(&findings);
    for expected in ["PRI-N1-002", "PRI-RAW-003", "PRI-PAG-004"] {
        assert!(
            ids.iter().any(|r| r == expected),
            "orm-scan must fire {expected} on typescript-prisma fixture; got: {ids:?}"
        );
    }
}

#[test]
fn orm_scan_java_jpa_finds_expected_rules() {
    let root = fixture("java-jpa");
    let findings = scan_workspace(&root, 1000);
    let ids = rule_ids(&findings);
    for expected in ["JPA-N1-001", "JPA-SAVE-004"] {
        assert!(
            ids.iter().any(|r| r == expected),
            "orm-scan must fire {expected} on java-jpa fixture; got: {ids:?}"
        );
    }
}

#[test]
fn orm_scan_go_gorm_finds_expected_rules() {
    let root = fixture("go-gorm");
    let findings = scan_workspace(&root, 1000);
    let ids = rule_ids(&findings);
    for expected in ["GORM-N1-001", "GORM-RAW-002", "GORM-AUTO-003"] {
        assert!(
            ids.iter().any(|r| r == expected),
            "orm-scan must fire {expected} on go-gorm fixture; got: {ids:?}"
        );
    }
}

#[test]
fn orm_scan_rust_sqlx_finds_expected_rules() {
    let root = fixture("rust-sqlx");
    let findings = scan_workspace(&root, 1000);
    let ids = rule_ids(&findings);
    for expected in ["SQLX-RAW-001", "SQLX-N1-002"] {
        assert!(
            ids.iter().any(|r| r == expected),
            "orm-scan must fire {expected} on rust-sqlx fixture; got: {ids:?}"
        );
    }
}

#[test]
fn orm_scan_python_llm_finds_expected_rules() {
    let root = fixture("python-llm");
    let findings = scan_workspace(&root, 1000);
    let ids = rule_ids(&findings);
    for expected in ["LLM-CLI-001", "LLM-LOOP-002", "LLM-SYNC-003", "LLM-CACHE-004"] {
        assert!(
            ids.iter().any(|r| r == expected),
            "orm-scan must fire {expected} on python-llm fixture; got: {ids:?}"
        );
    }
}

#[test]
fn orm_scan_python_auth_crypto_finds_expected_rules() {
    let root = fixture("python-auth-crypto");
    let findings = scan_workspace(&root, 1000);
    let ids = rule_ids(&findings);
    for expected in ["AC-BCRYPT-001", "AC-RSA-002", "AC-JWKS-003"] {
        assert!(
            ids.iter().any(|r| r == expected),
            "orm-scan must fire {expected} on python-auth-crypto fixture; got: {ids:?}"
        );
    }
}

#[test]
fn orm_scan_is_fast() {
    // All fixtures combined should scan in well under 5 seconds.
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let start = std::time::Instant::now();
    let findings = scan_workspace(&root, 8000);
    let elapsed = start.elapsed();
    assert!(
        elapsed.as_secs() < 5,
        "orm-scan over all test fixtures should take <5s; took {:?}",
        elapsed
    );
    assert!(!findings.is_empty(), "should find SOMETHING");
}
