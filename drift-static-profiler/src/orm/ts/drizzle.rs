//! Drizzle — reified expression tree (F1 family per master plan §CCC.2).
//!
//! Phase 2 v1 rules:
//! - `DRZ-LMT-001` — `.limit()` without `.orderBy()` (non-deterministic)
//! - `DRZ-N1-002` — `db.select()...where(eq(t.id, loopVar))` inside a loop
//! - `DRZ-CTR-003` — `.select().from(t)` followed by `.length` (use `count()`)

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::{BindingKind, CallChain, ChainRoot, PyOrmContext, TsClientKind};
use crate::orm::dialect::OrmDialect;
use crate::orm::sql_ir::{
    LimitSpec, OrmKind, PredictedSql, PredictedStatement, Projection, SqlDialect, SqlFidelity,
    SqlOp, TableRef, WhereExpr,
};
use crate::orm::{Framework, MatchHit, OrmRule};

fn hit(chain: &CallChain, note: &str) -> MatchHit {
    MatchHit {
        line: chain.steps.last().map(|s| s.line).unwrap_or(1),
        byte_range: chain.byte_range.clone(),
        extra_evidence: vec![Evidence {
            call: note.to_string(),
            line: chain.steps.last().map(|s| s.line).unwrap_or(1),
            category: None,
        }],
    }
}

fn is_drizzle_chain(chain: &CallChain, ctx: &PyOrmContext<'_>) -> bool {
    let root_text = match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
        _ => return false,
    };
    if root_text == "db" || root_text == "drizzle" {
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        return methods
            .iter()
            .any(|m| matches!(*m, "select" | "insert" | "update" | "delete"));
    }
    if let Some(b) = ctx.binding_at(&root_text, chain.byte_range.start) {
        if let BindingKind::TsClient(facts) = &b.kind {
            return matches!(facts.kind, TsClientKind::Drizzle);
        }
    }
    false
}

// ─── DRZ-LMT-001: .limit() without .orderBy() ───────────────────────────

fn matches_drz_lmt_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !is_drizzle_chain(chain, ctx) {
            continue;
        }
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if methods.contains(&"limit") && !methods.contains(&"orderBy") {
            out.push(hit(chain, "DRZ-LMT-001"));
        }
    }
    out
}

// ─── DRZ-N1-002: select with where referencing loop var ─────────────────

fn matches_drz_n1_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        if !is_drizzle_chain(chain, ctx) {
            continue;
        }
        // any chain in a loop with select+where → likely N+1
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if methods.contains(&"select") && methods.contains(&"where") {
            out.push(hit(chain, "DRZ-N1-002"));
        }
    }
    out
}

// ─── DRZ-CTR-003: full-row select used for counting ─────────────────────
//
// Detection: a `db.select().from(t)` chain assigned to a variable that
// later appears as the root of a `<bound>.length` field-access chain.

fn matches_drz_ctr_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    let mut drizzle_list_bindings: std::collections::HashSet<String> = Default::default();
    for chain in &ctx.chains {
        if !is_drizzle_chain(chain, ctx) {
            continue;
        }
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if !methods.contains(&"select") || !methods.contains(&"from") {
            continue;
        }
        for (name, bs) in &ctx.bindings {
            for b in bs {
                if b.byte_range == chain.byte_range {
                    drizzle_list_bindings.insert(name.clone());
                }
            }
        }
    }
    if drizzle_list_bindings.is_empty() {
        return out;
    }
    for chain in &ctx.chains {
        // chain of shape `<name>.length` — root binding + first step 'length'.
        let root_text = match &chain.root {
            ChainRoot::Binding(t) | ChainRoot::Identifier(t) | ChainRoot::LoopVar(t) => t.clone(),
            _ => continue,
        };
        if !drizzle_list_bindings.contains(&root_text) {
            continue;
        }
        if chain.steps.first().map(|s| s.method.as_str()) == Some("length") {
            out.push(hit(chain, "DRZ-CTR-003"));
        }
    }
    out
}

pub const DRIZZLE_RULES: &[OrmRule] = &[
    OrmRule {
        id: "DRZ-LMT-001",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Trivial,
        message: "Drizzle `.limit(N)` without `.orderBy(...)` — result rows are non-deterministic.",
        remediation: "Add `.orderBy(...)` before `.limit(...)`.",
        confidence: 0.90,
        matches: matches_drz_lmt_001,
    },
    OrmRule {
        id: "DRZ-N1-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Drizzle `db.select(...).where(...)` inside a loop — N+1 round-trips.",
        remediation: "Collect keys and run a single `.where(inArray(t.id, ids))` query outside the loop.",
        confidence: 0.85,
        matches: matches_drz_n1_002,
    },
    OrmRule {
        id: "DRZ-CTR-003",
        framework: Framework::Generic,
        severity: Severity::Low,
        effort: Effort::Trivial,
        message: "Drizzle full-row select used for counting — use `count(*)`.",
        remediation: "Replace `(await db.select().from(t)).length` with `db.select({ c: count() }).from(t)`.",
        confidence: 0.55,
        matches: matches_drz_ctr_003,
    },
];

// ─── DrizzleDialect — predict_all ───────────────────────────────────────

pub struct DrizzleDialect;

impl OrmDialect for DrizzleDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Generic
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports.has_any_starting_with("drizzle-orm")
            || ctx.imports.has_any_starting_with("drizzle")
    }

    fn predict_all(&self, ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        let mut out = Vec::new();
        for chain in &ctx.chains {
            if !is_drizzle_chain(chain, ctx) {
                continue;
            }
            let mut op = SqlOp::Select;
            let mut table = String::new();
            let mut limit: Option<LimitSpec> = None;
            let mut order_by: Vec<String> = Vec::new();
            let mut where_present = false;
            for step in &chain.steps {
                match step.method.as_str() {
                    "select" => op = SqlOp::Select,
                    "insert" => op = SqlOp::Insert,
                    "update" => op = SqlOp::Update,
                    "delete" => op = SqlOp::Delete,
                    "from" | "into" => {
                        if let Some(t) = step.args_text.first() {
                            table = t.trim_matches('`').to_string();
                        }
                    }
                    "where" => where_present = true,
                    "limit" => {
                        limit = step
                            .args_text
                            .first()
                            .and_then(|a| a.parse::<u64>().ok())
                            .map(LimitSpec::Literal)
                            .or(Some(LimitSpec::Variable));
                    }
                    "orderBy" => {
                        order_by = step.args_text.clone();
                    }
                    _ => {}
                }
            }
            if table.is_empty() {
                continue;
            }
            let mut stmt = PredictedStatement {
                op,
                tables: vec![TableRef::name(table)],
                projection: Projection::Unspecified,
                where_expr: if where_present {
                    Some(WhereExpr::Raw {
                        text: "<where>".into(),
                        has_interpolation: false,
                    })
                } else {
                    None
                },
                order_by,
                limit,
                offset: None,
                in_loop: chain.in_loop,
                joins: Vec::new(),
            };
            let _ = &mut stmt;
            let line = chain.steps.last().map(|s| s.line).unwrap_or(1);
            out.push(PredictedSql {
                orm: OrmKind::Generic,
                dialect: SqlDialect::Postgres,
                statements: vec![stmt],
                fidelity: vec![SqlFidelity::Partial],
                source_range: chain.byte_range.clone(),
                line,
            });
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::ts::build_context;
    use tree_sitter::Parser;

    fn ctx<'a>(src: &'a str) -> (PyOrmContext<'a>, tree_sitter::Tree) {
        let mut p = Parser::new();
        p.set_language(&crate::languages::typescript::language())
            .unwrap();
        let tree = p.parse(src, None).unwrap();
        let c = build_context(src, unsafe { std::mem::transmute(&tree) });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = DRIZZLE_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn drz_lmt_001_fires_on_limit_without_order() {
        let src = "db.select().from(users).limit(10);\n";
        let hits = run_rule("DRZ-LMT-001", src);
        assert_eq!(hits.len(), 1);
    }

    #[test]
    fn drz_lmt_001_clean_with_orderby() {
        let src = "db.select().from(users).orderBy(users.id).limit(10);\n";
        let hits = run_rule("DRZ-LMT-001", src);
        assert!(hits.is_empty());
    }

    #[test]
    fn drz_n1_002_fires_in_loop() {
        let src = "for (const id of ids) {\n  await db.select().from(users).where(eq(users.id, id));\n}\n";
        let hits = run_rule("DRZ-N1-002", src);
        assert!(!hits.is_empty());
    }
}
