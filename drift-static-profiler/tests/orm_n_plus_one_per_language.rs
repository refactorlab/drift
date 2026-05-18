//! Per-language N+1 detection coverage.
//!
//! One test per (language, ORM) pair confirms the framework's canonical
//! N+1 rule fires on the corresponding fixture. The point isn't to retest
//! each rule's algorithm — the unit tests do that — but to lock in the
//! integration contract: every supported ORM must have at least one N+1
//! finding visible at the call-tree level for the demo workloads.
//!
//! Coverage map:
//!   - Python / Django      → DJ-N1-001
//!   - Python / SQLAlchemy  → SA-N1-001
//!   - TypeScript / Prisma  → PRI-N1-002
//!   - TypeScript / Drizzle → DRZ-N1-002
//!   - TypeScript / TypeORM → TO-N1-001
//!   - TypeScript / Sequelize → SEQ-N1-001
//!   - TypeScript / Mongoose  → MNG-N1-002
//!   - Java / JPA           → JPA-N1-001
//!   - Go / GORM            → GORM-N1-001
//!   - Rust / sqlx          → SQLX-N1-002

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

fn has_rule(entries: &[CallTreeNode], rule_id: &str) -> bool {
    fn walk(node: &CallTreeNode, rule_id: &str) -> bool {
        for f in &node.findings {
            if f.evidence.iter().any(|e| e.call == rule_id) {
                return true;
            }
        }
        node.children.iter().any(|c| walk(c, rule_id))
    }
    entries.iter().any(|e| walk(e, rule_id))
}

fn assert_fires(fixture_name: &str, rule_id: &str) {
    let entries = run(fixture_name);
    assert!(
        has_rule(&entries, rule_id),
        "{rule_id} must fire on '{fixture_name}' fixture"
    );
}

// ─── Python ─────────────────────────────────────────────────────────────

#[test]
fn python_django_n_plus_one_fires() {
    assert_fires("python-django", "DJ-N1-001");
}

#[test]
fn python_sqlalchemy_n_plus_one_fires() {
    assert_fires("python-sqlalchemy", "SA-N1-001");
}

// ─── TypeScript / JavaScript ────────────────────────────────────────────

#[test]
fn typescript_prisma_n_plus_one_fires() {
    assert_fires("typescript-prisma", "PRI-N1-002");
}

#[test]
fn typescript_drizzle_n_plus_one_fires() {
    assert_fires("typescript-drizzle", "DRZ-N1-002");
}

#[test]
fn typescript_typeorm_n_plus_one_fires() {
    assert_fires("typescript-typeorm", "TO-N1-001");
}

#[test]
fn typescript_sequelize_n_plus_one_fires() {
    assert_fires("typescript-sequelize", "SEQ-N1-001");
}

#[test]
fn typescript_mongoose_n_plus_one_fires() {
    assert_fires("typescript-mongoose", "MNG-N1-002");
}

// ─── JVM ────────────────────────────────────────────────────────────────

#[test]
fn java_jpa_n_plus_one_fires() {
    assert_fires("java-jpa", "JPA-N1-001");
}

// ─── Go ─────────────────────────────────────────────────────────────────

#[test]
fn go_gorm_n_plus_one_fires() {
    assert_fires("go-gorm", "GORM-N1-001");
}

// ─── Rust ───────────────────────────────────────────────────────────────

#[test]
fn rust_sqlx_n_plus_one_fires() {
    assert_fires("rust-sqlx", "SQLX-N1-002");
}
