//! JetBrains Exposed — rules + dialect detection.
//!
//! Exposed's DAO API has lazy-loaded references and a `.findById(id)`
//! convenience that's the canonical N+1 trap. The DSL layer is closer
//! to raw SQL and harder to misuse, so v1 focuses on DAO antipatterns
//! plus the obvious raw-`exec` injection vector.
//!
//! Rules:
//! - `EXP-N1-001` — `*.findById(id)` inside a loop / `forEach`
//! - `EXP-N1-002` — DAO `*.find { … }` inside a loop
//! - `EXP-RAW-003` — `exec("…" + var)` / `prepareStatement("…" + var)` concat
//! - `EXP-INS-004` — `Entity.new { … }` inside a loop
//! - `EXP-DEL-005` — `entity.delete()` inside a loop
//! - `EXP-INS-006` — `Table.insert { … }` (DSL) inside a loop
//! - `EXP-TXN-007` — `transaction { … }` (or `newSuspendedTransaction`)
//!   inside a loop — opens N connections.
//! - `EXP-LAZY-008` — accessing a lazy reference (`loopVar.refField`)
//!   inside a loop body without `.with(...)` on the enclosing query.
//!   This is the headlining Exposed N+1 (issue #420): each iteration
//!   triggers a query for the unloaded reference. Fix: load eagerly
//!   with `.with(Entity::refField)` before iterating.
//!
//! KEY DISAMBIGUATION (from research):
//! - `transaction { … }`, `newSuspendedTransaction { … }`,
//!   `useConnection { … }`, `useTransaction { … }` are SCOPE BLOCKS,
//!   not loops. The Kotlin lambda dispatcher in `mod.rs` already
//!   excludes them from loop ranges.
//! - DAO findById/find vs DSL Table.select/insert — receiver tells:
//!   capitalised receiver name (typically ending in `Entity`) ⇒ DAO;
//!   `*.insert { … }` / `*.select { … }` on a `Table` ⇒ DSL.

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

/// Treat any capitalised receiver as a candidate DAO companion — DAO
/// objects in Exposed are `class XEntity(...) : IntEntity(id)` with a
/// companion `object : IntEntityClass<XEntity>(XTable)`, so calls
/// look like `XEntity.findById(...)`.
fn looks_like_dao_companion(chain: &CallChain) -> bool {
    let t = root_text(chain);
    if t.is_empty() {
        return false;
    }
    t.chars().next().map(|c| c.is_ascii_uppercase()).unwrap_or(false)
        || t.ends_with("Entity")
        || t.ends_with("DAO")
        || t.ends_with("Dao")
}

// ─── EXP-N1-001: `*.findById(id)` inside a loop ─────────────────────────

fn matches_exp_n1_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !looks_like_dao_companion(chain) {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if last == "findById" {
            out.push(hit(chain, "EXP-N1-001"));
        }
    }
    out
}

// ─── EXP-N1-002: DAO `*.find { ... }` inside a loop ─────────────────────

fn matches_exp_n1_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !looks_like_dao_companion(chain) {
            continue;
        }
        // `find { ... }` can be either the last step (`UserEntity.find { ... }`)
        // or an intermediate step (`UserEntity.find { ... }.firstOrNull()`).
        // Either way, the per-row query is the `find` call itself.
        let has_find = chain.steps.iter().any(|s| {
            matches!(
                s.method.as_str(),
                "find" | "findSingleByAndUpdate" | "findByIdAndUpdate"
            )
        });
        if has_find {
            out.push(hit(chain, "EXP-N1-002"));
        }
    }
    out
}

// ─── EXP-RAW-003: `exec("…" + var)` / `prepareStatement("…" + var)` ─────

fn matches_exp_raw_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if !matches!(last, "exec" | "prepareStatement") {
            continue;
        }
        // Inspect the arg text. Argument is `("..." + var)`-style; we
        // look for the binary-concat decorator that overlaps this chain.
        let chain_range = &chain.byte_range;
        let concat_match = ctx.decorators.iter().any(|d| {
            d.function_name == "concat"
                && d.byte_range.start >= chain_range.start
                && d.byte_range.end <= chain_range.end
        });
        if concat_match {
            out.push(hit(chain, "EXP-RAW-003"));
        }
    }
    out
}

// ─── EXP-INS-004: `Entity.new { … }` inside a loop ──────────────────────

fn matches_exp_ins_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !looks_like_dao_companion(chain) {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if last == "new" {
            out.push(hit(chain, "EXP-INS-004"));
        }
    }
    out
}

// ─── EXP-DEL-005: `entity.delete()` inside a loop ───────────────────────

fn matches_exp_del_005(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if last != "delete" {
            continue;
        }
        // Skip the DSL form `Table.deleteWhere { ... }` (which is `deleteWhere`,
        // not `delete`) and `Table.deleteAll()` (which is `deleteAll`).
        // Bare `*.delete()` is the per-entity DAO form — the antipattern.
        // Also skip on a Table receiver (capitalised + ends in `Table`):
        // `Table.delete(joinDef)` exists as a DSL form.
        let root_text = root_text(chain);
        if root_text.ends_with("Table") {
            continue;
        }
        out.push(hit(chain, "EXP-DEL-005"));
    }
    out
}

// ─── EXP-INS-006: DSL `Table.insert { ... }` inside a loop ──────────────

fn matches_exp_ins_006(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if !matches!(last, "insert" | "insertAndGetId" | "insertIgnore") {
            continue;
        }
        // Anchor on a Table-looking receiver. Tables are capitalised
        // (often plural like `Users`) and don't end in `Entity`.
        let root = root_text(chain);
        let is_table_receiver = root
            .chars()
            .next()
            .map(|c| c.is_ascii_uppercase())
            .unwrap_or(false)
            && !root.ends_with("Entity")
            && !root.ends_with("DAO")
            && !root.ends_with("Dao");
        if !is_table_receiver {
            continue;
        }
        out.push(hit(chain, "EXP-INS-006"));
    }
    out
}

// ─── EXP-TXN-007: `transaction { ... }` inside a loop ───────────────────

fn matches_exp_txn_007(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if !matches!(
            last,
            "transaction"
                | "newSuspendedTransaction"
                | "suspendTransaction"
                | "suspendedTransactionAsync"
                | "inTopLevelTransaction"
        ) {
            continue;
        }
        // Only fire when the chain root is bare (no receiver) — these
        // are typically called as top-level functions: `transaction { ... }`.
        out.push(hit(chain, "EXP-TXN-007"));
    }
    out
}

// ─── EXP-LAZY-008: lazy reference access in loop body ───────────────────

fn matches_exp_lazy_008(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    // Map loop-var name → iterable expression text, only for loops whose
    // iterable looks DAO-shaped (`Entity.all()`, `Entity.find { ... }`,
    // a name ending in `Entity` or capitalised), AND which lacks `.with(`
    // (the eager-loading marker).
    let mut dao_loop_vars: std::collections::HashMap<&str, &str> =
        std::collections::HashMap::new();
    for l in &ctx.for_loops {
        let iter = l.iterable_var.trim();
        // Skip eager-loaded iterables.
        if iter.contains(".with(") || iter.contains(".load(") {
            continue;
        }
        // DAO source heuristic: `.all()` / `.find {` somewhere, OR a
        // bare capitalised identifier we don't recognise (could be a
        // local variable holding a previously-fetched query result).
        let dao_shape = iter.contains(".all()")
            || iter.contains(".find {")
            || iter.contains(".find{")
            || iter.ends_with("Entity")
            || iter.ends_with("Entities");
        if !dao_shape {
            continue;
        }
        dao_loop_vars.insert(l.loop_var.as_str(), iter);
    }
    if dao_loop_vars.is_empty() {
        return out;
    }
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let root = match &chain.root {
            ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => {
                t.trim_start_matches("this.").trim().to_string()
            }
            _ => continue,
        };
        if !dao_loop_vars.contains_key(root.as_str()) {
            continue;
        }
        if chain.steps.len() < 2 {
            continue;
        }
        // Skip mutators — those are covered by EXP-DEL-005 / KTO-UPD-003.
        let last_method = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if matches!(
            last_method,
            "flushChanges" | "delete" | "save" | "refresh" | "merge"
        ) {
            continue;
        }
        // Skip chains whose first step is a known scalar-ish accessor
        // — these aren't relations.
        let first_method = chain.steps.first().map(|s| s.method.as_str()).unwrap_or("");
        if matches!(
            first_method,
            "toString"
                | "hashCode"
                | "equals"
                | "id"
                | "value"
                | "uppercase"
                | "lowercase"
                | "trim"
        ) {
            continue;
        }
        out.push(hit(chain, "EXP-LAZY-008"));
    }
    out
}

pub const EXPOSED_RULES: &[OrmRule] = &[
    OrmRule {
        id: "EXP-N1-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Exposed `*.findById(...)` inside a loop / `forEach` — N+1 round-trips.",
        remediation: "Collect ids and use `Entity.find { Table.id inList ids }.toList()`; or call `.with(refs)` on the result to eager-load lazy references.",
        confidence: 0.90,
        matches: matches_exp_n1_001,
    },
    OrmRule {
        id: "EXP-N1-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Exposed DAO `*.find { ... }` inside a loop — repeated single-row selects.",
        remediation: "Move the predicate outside the loop and use `inList` / a `JOIN`; or pre-load with `.with(refs)` for lazy references.",
        confidence: 0.85,
        matches: matches_exp_n1_002,
    },
    OrmRule {
        id: "EXP-RAW-003",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Exposed `exec(\"…\" + var)` / `prepareStatement(\"…\" + var)` — string concat is SQL injection.",
        remediation: "Use parameterised statements: `exec(\"… WHERE id = ?\", listOf(IntegerColumnType() to id))` or stick to the DSL/DAO.",
        confidence: 0.92,
        matches: matches_exp_raw_003,
    },
    OrmRule {
        id: "EXP-INS-004",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "Exposed `Entity.new { ... }` inside a loop — one INSERT per row.",
        remediation: "Use `Table.batchInsert(rows) { row -> this[col] = row.field }` to issue a single batched INSERT.",
        confidence: 0.85,
        matches: matches_exp_ins_004,
    },
    OrmRule {
        id: "EXP-DEL-005",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "Exposed `entity.delete()` inside a loop — one DELETE per row.",
        remediation: "Use `Table.deleteWhere { Table.id inList ids }` (DSL) to issue a single DELETE.",
        confidence: 0.85,
        matches: matches_exp_del_005,
    },
    OrmRule {
        id: "EXP-INS-006",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "Exposed DSL `Table.insert { ... }` inside a loop — one INSERT per row.",
        remediation: "Use `Table.batchInsert(rows) { row -> this[col] = row.field }` (single batched INSERT).",
        confidence: 0.85,
        matches: matches_exp_ins_006,
    },
    OrmRule {
        id: "EXP-TXN-007",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`transaction { ... }` / `newSuspendedTransaction { ... }` inside a loop — opens N connections.",
        remediation: "Open ONE transaction outside the loop and put the loop body inside it.",
        confidence: 0.90,
        matches: matches_exp_txn_007,
    },
    OrmRule {
        id: "EXP-LAZY-008",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Lazy reference access (`loopVar.refField...`) inside a loop without `.with(...)` — N+1 queries for the reference.",
        remediation: "Eager-load with `.with(Entity::refField)` on the outer query, or use `.load(Entity::refField)` on a single entity.",
        confidence: 0.75,
        matches: matches_exp_lazy_008,
    },
];

pub struct ExposedDialect;

impl OrmDialect for ExposedDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Generic
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports.has_any_starting_with("org.jetbrains.exposed")
            // Shape-based fallback: a DAO-shaped chain like
            // `XEntity.findById(...)` over a non-imported `XEntity`.
            || ctx.chains.iter().any(|c| {
                let last = c.steps.last().map(|s| s.method.as_str()).unwrap_or("");
                matches!(last, "findById" | "findByIdAndUpdate") && looks_like_dao_companion(c)
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
        let rule = EXPOSED_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn exp_n1_001_fires_on_findbyid_in_for() {
        let src = r#"
import org.jetbrains.exposed.dao.IntEntity
fun bad(ids: List<Int>) {
  for (id in ids) { UserEntity.findById(id) }
}
"#;
        let hits = run_rule("EXP-N1-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn exp_n1_001_fires_on_findbyid_in_foreach() {
        let src = r#"
fun bad(ids: List<Int>) { ids.forEach { id -> UserEntity.findById(id) } }
"#;
        let hits = run_rule("EXP-N1-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn exp_n1_001_clean_outside_loop() {
        let src = r#"fun good(id: Int) = UserEntity.findById(id)"#;
        let hits = run_rule("EXP-N1-001", src);
        assert!(hits.is_empty());
    }

    #[test]
    fn exp_n1_002_fires_on_find_lambda_in_loop() {
        let src = r#"
fun bad(ids: List<Int>) {
  for (id in ids) {
    UserEntity.find { Users.id eq id }.firstOrNull()
  }
}
"#;
        let hits = run_rule("EXP-N1-002", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn exp_raw_003_fires_on_exec_concat() {
        let src = r#"
fun bad(id: String) {
  transaction.exec("SELECT * FROM users WHERE id = " + id)
}
"#;
        let hits = run_rule("EXP-RAW-003", src);
        assert!(!hits.is_empty(), "EXP-RAW-003 must fire on exec concat");
    }

    #[test]
    fn exp_ins_004_fires_on_new_in_loop() {
        let src = r#"
fun bad(names: List<String>) {
  for (n in names) { UserEntity.new { name = n } }
}
"#;
        let hits = run_rule("EXP-INS-004", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn dialect_matches_with_exposed_import() {
        let src = r#"
import org.jetbrains.exposed.dao.IntEntity
fun f() {}
"#;
        let (c, _t) = ctx(src);
        assert!(ExposedDialect.matches(&c));
    }

    #[test]
    fn dialect_matches_by_shape_without_import() {
        let src = r#"
fun f(id: Int) = UserEntity.findById(id)
"#;
        let (c, _t) = ctx(src);
        assert!(ExposedDialect.matches(&c), "shape-based fallback must trigger");
    }

    // ─── EXP-DEL-005 ────────────────────────────────────────────────────

    #[test]
    fn exp_del_005_fires_on_entity_delete_in_loop() {
        let src = r#"
fun bad() {
  UserEntity.all().forEach { it.delete() }
}
"#;
        let hits = run_rule("EXP-DEL-005", src);
        assert!(!hits.is_empty(), "EXP-DEL-005 must fire on entity.delete() in forEach");
    }

    #[test]
    fn exp_del_005_clean_on_delete_where() {
        // `Table.deleteWhere { ... }` is single-shot DML, not per-entity.
        let src = r#"
fun good() {
  UsersTable.deleteWhere { UsersTable.active eq false }
}
"#;
        let hits = run_rule("EXP-DEL-005", src);
        assert!(hits.is_empty(), "EXP-DEL-005 must NOT fire on Table.deleteWhere");
    }

    #[test]
    fn exp_del_005_clean_outside_loop() {
        let src = r#"
fun good(u: UserEntity) {
  u.delete()
}
"#;
        let hits = run_rule("EXP-DEL-005", src);
        assert!(hits.is_empty(), "EXP-DEL-005 must NOT fire on single delete outside loop");
    }

    // ─── EXP-INS-006 ────────────────────────────────────────────────────

    #[test]
    fn exp_ins_006_fires_on_table_insert_in_for() {
        let src = r#"
fun bad(rows: List<Row>) {
  for (r in rows) {
    UsersTable.insert {
      it[name] = r.name
    }
  }
}
"#;
        let hits = run_rule("EXP-INS-006", src);
        assert!(!hits.is_empty(), "EXP-INS-006 must fire on Table.insert in for loop");
    }

    #[test]
    fn exp_ins_006_clean_on_batch_insert() {
        let src = r#"
fun good(rows: List<Row>) {
  UsersTable.batchInsert(rows) { r ->
    this[UsersTable.name] = r.name
  }
}
"#;
        let hits = run_rule("EXP-INS-006", src);
        assert!(hits.is_empty(), "EXP-INS-006 must NOT fire on batchInsert");
    }

    // ─── EXP-TXN-007 ────────────────────────────────────────────────────

    #[test]
    fn exp_txn_007_fires_on_transaction_in_loop() {
        let src = r#"
fun bad(ids: List<Int>) {
  ids.forEach { id ->
    transaction {
      StarWarsFilmsTable.deleteWhere { StarWarsFilmsTable.id eq id }
    }
  }
}
"#;
        let hits = run_rule("EXP-TXN-007", src);
        assert!(!hits.is_empty(), "EXP-TXN-007 must fire on transaction inside forEach");
    }

    #[test]
    fn exp_txn_007_clean_on_top_level_transaction() {
        let src = r#"
fun good() {
  transaction {
    SchemaUtils.create(Users)
  }
}
"#;
        let hits = run_rule("EXP-TXN-007", src);
        assert!(hits.is_empty(), "EXP-TXN-007 must NOT fire on top-level transaction");
    }

    // ─── False-positive guards ──────────────────────────────────────────

    #[test]
    fn exp_n1_001_clean_on_findbyid_inside_transaction() {
        // `transaction { findById(...) }` — once. Must NOT fire.
        let src = r#"
fun good(id: Int) {
  transaction {
    UserEntity.findById(id)
  }
}
"#;
        let hits = run_rule("EXP-N1-001", src);
        assert!(hits.is_empty(), "EXP-N1-001 must NOT fire on findById inside transaction");
    }

    #[test]
    #[allow(non_snake_case)]
    fn exp_n1_001_clean_on_findbyid_inside_useConnection() {
        // `useConnection { ... findById(id) }` — once. Must NOT fire.
        let src = r#"
fun good(id: Int) {
  database.useConnection { UserEntity.findById(id) }
}
"#;
        let hits = run_rule("EXP-N1-001", src);
        assert!(
            hits.is_empty(),
            "EXP-N1-001 must NOT fire on findById inside useConnection"
        );
    }

    // ─── EXP-LAZY-008 ───────────────────────────────────────────────────

    #[test]
    fn exp_lazy_008_fires_on_nested_foreach_over_reference() {
        // `UserEntity.all().forEach { user -> user.ratings.forEach { ... } }`
        // — the inner `.ratings` is a lazy reference (N+1 trigger).
        let src = r#"
fun bad() {
  transaction {
    UserEntity.all().forEach { user ->
      user.ratings.forEach { r -> println(r.value) }
    }
  }
}
"#;
        let hits = run_rule("EXP-LAZY-008", src);
        assert!(
            !hits.is_empty(),
            "EXP-LAZY-008 must fire on user.ratings.forEach inside forEach"
        );
    }

    #[test]
    fn exp_lazy_008_clean_with_eager_loading() {
        // `.with(UserEntity::ratings)` — eager-loaded. No N+1.
        let src = r#"
fun good() {
  transaction {
    UserEntity.all().with(UserEntity::ratings).forEach { user ->
      user.ratings.forEach { r -> println(r.value) }
    }
  }
}
"#;
        let hits = run_rule("EXP-LAZY-008", src);
        assert!(
            hits.is_empty(),
            "EXP-LAZY-008 must NOT fire when .with() is applied"
        );
    }

    #[test]
    fn exp_lazy_008_clean_on_scalar_access() {
        // `it.id` / `it.toString()` are not lazy refs — must NOT fire.
        let src = r#"
fun good() {
  UserEntity.all().forEach { user -> println(user.id) }
}
"#;
        let hits = run_rule("EXP-LAZY-008", src);
        assert!(
            hits.is_empty(),
            "EXP-LAZY-008 must NOT fire on scalar field access"
        );
    }

    #[test]
    fn exp_lazy_008_clean_on_non_dao_collection() {
        // Iterating a plain List<String> — not a DAO source.
        let src = r#"
fun good(names: List<String>) {
  names.forEach { n -> println(n.uppercase().length) }
}
"#;
        let hits = run_rule("EXP-LAZY-008", src);
        assert!(
            hits.is_empty(),
            "EXP-LAZY-008 must NOT fire on non-DAO collection iteration"
        );
    }

    #[test]
    fn exp_ins_004_clean_on_entity_new_inside_transaction() {
        let src = r#"
fun good() {
  transaction {
    UserEntity.new { name = "x" }
  }
}
"#;
        let hits = run_rule("EXP-INS-004", src);
        assert!(
            hits.is_empty(),
            "EXP-INS-004 must NOT fire on Entity.new inside top-level transaction"
        );
    }
}
