//! Ktorm — rules + dialect detection.
//!
//! Ktorm splits between a thin Query DSL (returns rows) and an
//! entity-sequence API that auto-joins referenced tables. The
//! sequence API's automatic joins are convenient but expensive when
//! used inside a loop: each `.find { ... }` / `.first { ... }` is a
//! round-trip. Updates are similarly per-row via `flushChanges()`.
//!
//! Rules:
//! - `KTO-N1-001` — sequence `.find` / `.first` / `.firstOrNull` /
//!   `.single` / `.singleOrNull` inside a loop / `forEach`
//! - `KTO-RAW-002` — `database.useConnection { … prepareStatement("…" + var) }`
//!   string concat (SQL injection)
//! - `KTO-UPD-003` — `.flushChanges()` inside a loop (N updates)
//! - `KTO-INS-004` — `database.insert(Table) { ... }` inside a loop
//!   (N inserts) — use `batchInsert` instead.
//! - `KTO-DEL-005` — `entity.delete()` / `database.delete(...)` inside a loop
//!
//! KEY DISAMBIGUATION (from the Ktorm research):
//! - `database.useConnection { conn -> ... }` is a CALLBACK, not a
//!   loop. Same for `useTransaction { tx -> ... }` and `transactional`.
//!   The Kotlin lambda dispatcher in `mod.rs` already excludes these.
//! - `database.from(...).select(...).forEach { row -> ... }` iterates
//!   rows of ONE query — `.forEach` here is row-mapping, not N+1.
//!   We anchor on `database.<seq>.find/.first` etc.; row-mapping
//!   forEach on a Query doesn't touch those methods.
//! - `batchInsert { for (x in xs) item { ... } }` — the inner `for`
//!   builds items for ONE batch statement. The `item { ... }` blocks
//!   contain `set(col, val)` calls, not `database.*` calls, so the
//!   N+1 rule never fires.

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::{CallChain, ChainRoot, PyOrmContext};
use crate::orm::dialect::OrmDialect;
use crate::orm::sql_ir::{OrmKind, PredictedSql};
use crate::orm::{Framework, MatchHit, OrmRule};

fn hit(chain: &CallChain, note: &str) -> MatchHit {
    let line = chain.steps.last().map(|s| s.line).unwrap_or(1);
    MatchHit {
        line,
        byte_range: chain.byte_range.clone(),
        extra_evidence: vec![Evidence {
            call: note.to_string(),
            line,
            category: None,
        }],
    }
}

fn root_text(chain: &CallChain) -> String {
    match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => {
            t.trim_start_matches("this.").trim().to_string()
        }
        _ => String::new(),
    }
}

/// Ktorm sequence operations are anchored on a `database` instance,
/// e.g. `database.employees.find { ... }`. We accept the literal
/// `database` name AND any `*.database` / `*Database` pattern.
fn looks_like_ktorm_database(chain: &CallChain) -> bool {
    let t = root_text(chain);
    t == "database"
        || t == "db"
        || t.ends_with("Database")
        || t.ends_with(".database")
        || t.ends_with(".db")
}

// ─── KTO-N1-001: sequence `.find` / `.first` inside a loop ──────────────

fn matches_kto_n1_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !looks_like_ktorm_database(chain) {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if matches!(
            last,
            "find" | "first" | "firstOrNull" | "single" | "singleOrNull"
        ) {
            out.push(hit(chain, "KTO-N1-001"));
        }
    }
    out
}

// ─── KTO-RAW-002: `prepareStatement("…" + var)` inside useConnection ────

fn matches_kto_raw_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if !matches!(last, "prepareStatement" | "executeQuery" | "executeUpdate") {
            continue;
        }
        let chain_range = &chain.byte_range;
        let concat_match = ctx.decorators.iter().any(|d| {
            d.function_name == "concat"
                && d.byte_range.start >= chain_range.start
                && d.byte_range.end <= chain_range.end
        });
        if concat_match {
            out.push(hit(chain, "KTO-RAW-002"));
        }
    }
    out
}

// ─── KTO-UPD-003: `.flushChanges()` inside a loop ───────────────────────

fn matches_kto_upd_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if last == "flushChanges" {
            out.push(hit(chain, "KTO-UPD-003"));
        }
    }
    out
}

// ─── KTO-INS-004: `database.insert(Table) { ... }` in a loop ────────────

fn matches_kto_ins_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !looks_like_ktorm_database(chain) {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if matches!(last, "insert" | "insertAndGenerateKey" | "update" | "delete") {
            out.push(hit(chain, "KTO-INS-004"));
        }
    }
    out
}

// ─── KTO-DEL-005: `entity.delete()` / `database.delete(...)` in loop ────

fn matches_kto_del_005(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if last != "delete" {
            continue;
        }
        // Skip `database.delete(...)` which is already covered by
        // KTO-INS-004; that rule's recommendation (batch / sequence
        // removeIf) is correct for the DB-DSL form.
        if looks_like_ktorm_database(chain) {
            continue;
        }
        out.push(hit(chain, "KTO-DEL-005"));
    }
    out
}

pub const KTORM_RULES: &[OrmRule] = &[
    OrmRule {
        id: "KTO-N1-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Ktorm sequence `.find` / `.first` inside a loop — one query per row.",
        remediation: "Hoist the predicate outside the loop and use a single `.filter { it.column inList ids }.toList()`.",
        confidence: 0.85,
        matches: matches_kto_n1_001,
    },
    OrmRule {
        id: "KTO-RAW-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Ktorm raw `prepareStatement(\"…\" + var)` — string concat is SQL injection.",
        remediation: "Use `?` placeholders and `setX` on the PreparedStatement, or stick to Ktorm's DSL / sequence APIs.",
        confidence: 0.92,
        matches: matches_kto_raw_002,
    },
    OrmRule {
        id: "KTO-UPD-003",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "Ktorm `.flushChanges()` inside a loop — one UPDATE per entity.",
        remediation: "Use `database.batchUpdate(Table) { ... }` to issue a single batched UPDATE.",
        confidence: 0.85,
        matches: matches_kto_upd_003,
    },
    OrmRule {
        id: "KTO-INS-004",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Ktorm `database.{insert|update|delete}(Table) { ... }` inside a loop — one statement per row.",
        remediation: "Use `database.batchInsert(Table) { for (x in xs) item { … } }` / `batchUpdate` for batched DML.",
        confidence: 0.85,
        matches: matches_kto_ins_004,
    },
    OrmRule {
        id: "KTO-DEL-005",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "Ktorm `entity.delete()` inside a loop — one DELETE per row.",
        remediation: "Use `database.<sequence>.removeIf { it.col inList ids }` for a single DELETE.",
        confidence: 0.80,
        matches: matches_kto_del_005,
    },
];

pub struct KtormDialect;

impl OrmDialect for KtormDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Generic
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports.has_any_starting_with("org.ktorm")
            // Shape-based fallback for files that get a Database via
            // constructor injection.
            || ctx.chains.iter().any(|c| {
                let last = c.steps.last().map(|s| s.method.as_str()).unwrap_or("");
                matches!(last, "useConnection" | "flushChanges" | "joinReferencesAndSelect")
            })
    }

    fn predict_all(&self, _ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::jvm_kotlin::build_context;
    use tree_sitter::Parser;

    fn ctx<'a>(src: &'a str) -> (PyOrmContext<'a>, tree_sitter::Tree) {
        let mut p = Parser::new();
        p.set_language(&crate::languages::kotlin::language()).unwrap();
        let tree = p.parse(src, None).unwrap();
        let c = build_context(src, unsafe { std::mem::transmute(&tree) });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = KTORM_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn kto_n1_001_fires_on_find_in_for() {
        let src = r#"
import org.ktorm.entity.sequenceOf
fun bad(ids: List<Int>) {
  for (id in ids) {
    database.users.find { it.id eq id }
  }
}
"#;
        let hits = run_rule("KTO-N1-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn kto_n1_001_fires_on_first_in_foreach() {
        let src = r#"
fun bad(ids: List<Int>) {
  ids.forEach { id -> database.users.first { it.id eq id } }
}
"#;
        let hits = run_rule("KTO-N1-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn kto_n1_001_clean_outside_loop() {
        let src = r#"fun good() = database.users.find { it.id eq 1 }"#;
        let hits = run_rule("KTO-N1-001", src);
        assert!(hits.is_empty());
    }

    #[test]
    fn kto_raw_002_fires_on_prepare_statement_concat() {
        let src = r#"
fun bad(id: String) {
  database.useConnection { conn ->
    conn.prepareStatement("SELECT * FROM users WHERE id = " + id)
  }
}
"#;
        let hits = run_rule("KTO-RAW-002", src);
        assert!(!hits.is_empty(), "KTO-RAW-002 must fire on prepareStatement concat");
    }

    #[test]
    fn kto_upd_003_fires_on_flush_in_loop() {
        let src = r#"
fun bad(users: List<UserEntity>) {
  for (u in users) { u.flushChanges() }
}
"#;
        let hits = run_rule("KTO-UPD-003", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn dialect_matches_with_ktorm_import() {
        let src = r#"
import org.ktorm.dsl.from
fun f() {}
"#;
        let (c, _t) = ctx(src);
        assert!(KtormDialect.matches(&c));
    }

    #[test]
    fn dialect_matches_by_shape_useconnection() {
        let src = r#"fun f() { database.useConnection { } }"#;
        let (c, _t) = ctx(src);
        assert!(KtormDialect.matches(&c), "shape-based fallback must trigger on useConnection");
    }

    // ─── KTO-INS-004 ────────────────────────────────────────────────────

    #[test]
    fn kto_ins_004_fires_on_database_insert_in_loop() {
        let src = r#"
fun bad(users: List<User>) {
  users.forEach { user ->
    database.insert(Users) {
      set(it.name, user.name)
    }
  }
}
"#;
        let hits = run_rule("KTO-INS-004", src);
        assert!(!hits.is_empty(), "KTO-INS-004 must fire on database.insert in forEach");
    }

    #[test]
    fn kto_ins_004_fires_on_database_update_in_for() {
        let src = r#"
fun bad(ids: List<Int>) {
  for (id in ids) {
    database.update(Users) {
      set(it.active, false)
      where { it.id eq id }
    }
  }
}
"#;
        let hits = run_rule("KTO-INS-004", src);
        assert!(!hits.is_empty(), "KTO-INS-004 must fire on database.update in for");
    }

    #[test]
    fn kto_ins_004_clean_on_batch_insert() {
        // The canonical batch form — must NOT fire even though there's
        // a `for` inside the builder. Reason: the `for` builds `item`
        // blocks; it doesn't contain a top-level `database.insert(...)`
        // call inside the loop body.
        let src = r#"
fun good(users: List<User>) {
  database.batchInsert(Users) {
    for (user in users) {
      item {
        set(it.name, user.name)
      }
    }
  }
}
"#;
        let hits = run_rule("KTO-INS-004", src);
        assert!(
            hits.is_empty(),
            "KTO-INS-004 must NOT fire on canonical batchInsert pattern"
        );
    }

    #[test]
    fn kto_ins_004_clean_on_single_insert() {
        let src = r#"
fun good() {
  database.insert(Users) { set(it.name, "x") }
}
"#;
        let hits = run_rule("KTO-INS-004", src);
        assert!(hits.is_empty(), "KTO-INS-004 must NOT fire on single insert");
    }

    // ─── KTO-DEL-005 ────────────────────────────────────────────────────

    #[test]
    fn kto_del_005_fires_on_entity_delete_in_loop() {
        let src = r#"
fun bad(users: List<UserEntity>) {
  users.forEach { u -> u.delete() }
}
"#;
        let hits = run_rule("KTO-DEL-005", src);
        assert!(!hits.is_empty(), "KTO-DEL-005 must fire on entity.delete in loop");
    }

    #[test]
    fn kto_del_005_clean_on_database_delete() {
        // database.delete is reported by KTO-INS-004 (broader DML rule),
        // not KTO-DEL-005.
        let src = r#"
fun bad(ids: List<Int>) {
  for (id in ids) { database.delete(Users) { it.id eq id } }
}
"#;
        let hits = run_rule("KTO-DEL-005", src);
        assert!(hits.is_empty(), "KTO-DEL-005 must NOT fire on database.delete (covered by KTO-INS-004)");
    }

    // ─── False-positive guards ──────────────────────────────────────────

    #[test]
    fn kto_n1_001_clean_on_find_inside_useconnection() {
        // `useConnection` is a callback, not iteration.
        let src = r#"
fun good() {
  database.useConnection { conn ->
    database.users.find { it.id eq 1 }
  }
}
"#;
        let hits = run_rule("KTO-N1-001", src);
        assert!(
            hits.is_empty(),
            "KTO-N1-001 must NOT fire on find inside useConnection (callback, not loop)"
        );
    }

    #[test]
    fn kto_upd_003_clean_on_flush_inside_transaction() {
        let src = r#"
fun good(emp: UserEntity) {
  database.useTransaction { tx ->
    emp.salary = 100
    emp.flushChanges()
  }
}
"#;
        let hits = run_rule("KTO-UPD-003", src);
        assert!(
            hits.is_empty(),
            "KTO-UPD-003 must NOT fire on flushChanges in transaction"
        );
    }

    #[test]
    #[allow(non_snake_case)]
    fn kto_n1_001_fires_on_grouping_eachCount_clean() {
        // Verify the agent's recommended fix `groupingBy().eachCount()`
        // does NOT trigger N+1.
        let src = r#"
fun good() {
  val counts = database.employees
    .groupingBy { it.departmentId }
    .eachCount()
}
"#;
        let hits = run_rule("KTO-N1-001", src);
        assert!(hits.is_empty(), "KTO-N1-001 must NOT fire on groupingBy().eachCount()");
    }
}
