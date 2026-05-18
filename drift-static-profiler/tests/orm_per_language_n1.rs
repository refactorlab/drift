//! Cross-language ORM N+1 smoke test.
//!
//! One canonical N+1 case per (language, ORM) pair — proves the
//! end-to-end pipeline (`analyze_roots` → dialect rules → call tree)
//! catches the classic per-row-query-in-loop pattern in every supported
//! language. This is a single-file guard against regressions in any one
//! ORM dialect's loop / chain analysis.
//!
//! Coverage matrix:
//!   Python / Django       → DJ-N1-001  (PrefetchTree + LoopScope path)
//!   Python / SQLAlchemy   → SA-N1-001  (LoopScope + options(joinedload) path)
//!   TypeScript / Prisma   → PRI-N1-002 (findUnique in loop)
//!   TypeScript / Drizzle  → DRZ-N1-002 (db.select().where() in loop)
//!   TypeScript / TypeORM  → TO-N1-001  (repo.findOne in loop)
//!   TypeScript / Sequelize→ SEQ-N1-001 (Model.findOne / findByPk in loop)
//!   TypeScript / Mongoose → MNG-N1-002 (findById in loop)
//!   Go / GORM             → GORM-N1-001 (db.First/Take/Last in loop)
//!   Java / JPA            → JPA-N1-001  (repo.findById in loop)
//!   Rust / sqlx           → SQLX-N1-002 (sqlx::query! in loop)
//!
//! Scala is intentionally excluded — there is no Scala ORM rule set yet
//! (Slick / Quill / Doobie are not in the dialect matcher table). When a
//! Scala dialect is added, append a `scala_*` case below.

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
        // Fixtures live under tests/fixtures/ — skip_tests would drop them.
        skip_tests: false,
        ..DiscoverOpts::default()
    };
    let outcome = analyze_roots(&root, &discover, &opts).expect("analyze_roots succeeds");
    outcome.report.entries
}

fn rule_fires(entries: &[CallTreeNode], rule_id: &str) -> bool {
    fn walk(node: &CallTreeNode, rule_id: &str) -> bool {
        if node
            .findings
            .iter()
            .any(|f| f.evidence.iter().any(|e| e.call == rule_id))
        {
            return true;
        }
        node.children.iter().any(|c| walk(c, rule_id))
    }
    entries.iter().any(|e| walk(e, rule_id))
}

// ─── Python ─────────────────────────────────────────────────────────────

#[test]
fn python_django_n1() {
    let entries = run("python-django");
    assert!(
        rule_fires(&entries, "DJ-N1-001"),
        "DJ-N1-001 must fire on the python-django fixture"
    );
}

#[test]
fn python_sqlalchemy_n1() {
    let entries = run("python-sqlalchemy");
    assert!(
        rule_fires(&entries, "SA-N1-001"),
        "SA-N1-001 must fire on the python-sqlalchemy fixture"
    );
}

// ─── TypeScript / JavaScript ────────────────────────────────────────────

#[test]
fn typescript_prisma_n1() {
    let entries = run("typescript-prisma");
    assert!(
        rule_fires(&entries, "PRI-N1-002"),
        "PRI-N1-002 must fire on the typescript-prisma fixture"
    );
}

#[test]
fn typescript_drizzle_n1() {
    let entries = run("typescript-drizzle");
    assert!(
        rule_fires(&entries, "DRZ-N1-002"),
        "DRZ-N1-002 must fire on the typescript-drizzle fixture"
    );
}

#[test]
fn typescript_typeorm_n1() {
    let entries = run("typescript-typeorm");
    assert!(
        rule_fires(&entries, "TO-N1-001"),
        "TO-N1-001 must fire on the typescript-typeorm fixture"
    );
}

#[test]
fn typescript_sequelize_n1() {
    let entries = run("typescript-sequelize");
    assert!(
        rule_fires(&entries, "SEQ-N1-001"),
        "SEQ-N1-001 must fire on the typescript-sequelize fixture"
    );
}

#[test]
fn typescript_mongoose_n1() {
    let entries = run("typescript-mongoose");
    assert!(
        rule_fires(&entries, "MNG-N1-002"),
        "MNG-N1-002 must fire on the typescript-mongoose fixture"
    );
}

// ─── Go ─────────────────────────────────────────────────────────────────

#[test]
fn go_gorm_n1() {
    let entries = run("go-gorm");
    assert!(
        rule_fires(&entries, "GORM-N1-001"),
        "GORM-N1-001 must fire on the go-gorm fixture"
    );
}

// ─── Java / JVM ─────────────────────────────────────────────────────────

#[test]
fn java_jpa_n1() {
    let entries = run("java-jpa");
    assert!(
        rule_fires(&entries, "JPA-N1-001"),
        "JPA-N1-001 must fire on the java-jpa fixture"
    );
}

// ─── Rust ───────────────────────────────────────────────────────────────

#[test]
fn rust_sqlx_n1() {
    let entries = run("rust-sqlx");
    assert!(
        rule_fires(&entries, "SQLX-N1-002"),
        "SQLX-N1-002 must fire on the rust-sqlx fixture"
    );
}
