//! SQLx — compile-time checked Rust queries. Phase 4 v1 rules:
//! - `SQLX-RAW-001` — `sqlx::query(&format!(...))` — runtime SQL string
//! - `SQLX-N1-002` — `sqlx::query!(...)` / `sqlx::query_as!(...)` inside a loop
//! - `SQLX-FETCH-003` — `.fetch_all(...)` without `LIMIT` in the SQL

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::{CallChain, ChainRoot, PyOrmContext};
use crate::orm::dialect::OrmDialect;
use crate::orm::shape::{matches_by_shape, ComboRule, RootPredicate, ShapeSpec};
use crate::orm::sql_ir::{OrmKind, PredictedSql};
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

fn matches_sqlx_raw_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        for step in &chain.steps {
            if step.method != "query"
                && step.method != "execute"
            {
                continue;
            }
            let root_is_sqlx = matches!(
                &chain.root,
                ChainRoot::Identifier(t) if t.starts_with("sqlx")
            );
            if !root_is_sqlx {
                continue;
            }
            for arg in &step.args_text {
                if arg.contains("format!") || arg.contains(".to_string()") {
                    out.push(hit(chain, "SQLX-RAW-001"));
                    break;
                }
            }
        }
    }
    out
}

fn matches_sqlx_n1_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let first = chain.steps.first().map(|s| s.method.as_str()).unwrap_or("");
        if matches!(
            first,
            "query" | "query_as" | "query_scalar" | "query_unchecked" | "query_file"
        ) {
            let root_is_sqlx = matches!(
                &chain.root,
                ChainRoot::Identifier(t) if t.starts_with("sqlx")
            );
            if root_is_sqlx {
                out.push(hit(chain, "SQLX-N1-002"));
            }
        }
    }
    out
}

fn matches_sqlx_fetch_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if !methods.iter().any(|m| matches!(*m, "fetch_all" | "fetch")) {
            continue;
        }
        // Look at the query!/query_as! args — if no LIMIT, flag.
        let has_limit = chain.steps.iter().any(|step| {
            step.args_text
                .iter()
                .any(|a| a.to_uppercase().contains("LIMIT"))
        });
        if !has_limit {
            // Also require it to be a sqlx::query* macro / fn.
            let is_sqlx = matches!(
                &chain.root,
                ChainRoot::Identifier(t) if t.starts_with("sqlx")
            ) || methods.first().map(|m| m.starts_with("query")).unwrap_or(false);
            if is_sqlx {
                out.push(hit(chain, "SQLX-FETCH-003"));
            }
        }
    }
    out
}

pub const SQLX_RULES: &[OrmRule] = &[
    OrmRule {
        id: "SQLX-RAW-001",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`sqlx::query(&format!(...))` — runtime SQL string bypasses compile-time checking and is injection-shaped.",
        remediation: "Use the `sqlx::query!` macro: `sqlx::query!(\"SELECT * FROM u WHERE name = $1\", name)`.",
        confidence: 0.95,
        matches: matches_sqlx_raw_001,
    },
    OrmRule {
        id: "SQLX-N1-002",
        framework: Framework::Generic,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`sqlx::query!` / `query_as!` inside a loop — N+1 round-trips.",
        remediation: "Use a single `WHERE id = ANY($1)` query with the id list as a slice.",
        confidence: 0.85,
        matches: matches_sqlx_n1_002,
    },
    OrmRule {
        id: "SQLX-FETCH-003",
        framework: Framework::Generic,
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "`.fetch_all(...)` with no `LIMIT` in the query — unbounded materialization.",
        remediation: "Add `LIMIT N`, or use `.fetch(...)` and stream the rows.",
        confidence: 0.75,
        matches: matches_sqlx_fetch_003,
    },
];

/// Shape-based fallback for sqlx. The compile-time macros
/// (`sqlx::query!`, `sqlx::query_as!`) typically appear as bare
/// identifier roots in chains. The fetch_*/execute methods are sqlx
/// conventions — `fetch_optional`, `fetch_one`, `fetch_all` are not
/// in std nor in popular Rust DB crates outside sqlx/sea-orm. The
/// combo gates on `pool` / `conn` / `executor` style roots that
/// indicate a sqlx executor handle.
pub(crate) const SQLX_SHAPE: ShapeSpec = ShapeSpec {
    anchors: &[
        "fetch_optional",
        "fetch_one",
        "fetch_all",
        "execute_many",
        "query_as",
        "query_scalar",
        "query_with",
        "query_as_with",
    ],
    combos: &[ComboRule {
        first_method: "execute",
        root: RootPredicate::ContainsIgnoreCase("pool"),
        continuation_any: &[],
    }],
};

pub struct SqlxDialect;

impl OrmDialect for SqlxDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Generic
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports
            .modules
            .keys()
            .any(|m| m.starts_with("sqlx") || m.contains("::sqlx"))
            || matches_by_shape(&ctx.chains, &SQLX_SHAPE)
    }

    fn predict_all(&self, _ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        // SQLx is compile-time: the SQL text is in the macro arg.
        // Phase 1 v1 doesn't lower it into PredictedSql — rules above
        // operate directly on the macro chain. v2 will integrate via
        // sqlparser-rs on the macro arg text.
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::rust_lang::build_context;
    use tree_sitter::Parser;

    fn ctx<'a>(src: &'a str) -> (PyOrmContext<'a>, tree_sitter::Tree) {
        let mut p = Parser::new();
        p.set_language(&crate::languages::rust::language()).unwrap();
        let tree = p.parse(src, None).unwrap();
        let c = build_context(src, unsafe {
            std::mem::transmute::<&tree_sitter::Tree, &tree_sitter::Tree>(&tree)
        });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = SQLX_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn sqlx_raw_001_fires_on_format() {
        let src = "fn f(pool: &Pool, name: String) { sqlx::query(&format!(\"SELECT * FROM u WHERE name = '{}'\", name)); }\n";
        let hits = run_rule("SQLX-RAW-001", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn sqlx_n1_002_fires_in_loop() {
        let src = "fn f(pool: &Pool, ids: Vec<i64>) {\nfor id in ids {\n  let _ = sqlx::query!(\"SELECT * FROM u WHERE id = $1\", id);\n}\n}\n";
        let hits = run_rule("SQLX-N1-002", src);
        assert!(!hits.is_empty(), "sqlx::query! macro in for-loop must fire");
    }

    #[test]
    fn sqlx_n1_002_safe_outside_loop() {
        // Single sqlx::query at top level — not N+1.
        let src = "fn f(pool: &Pool, id: i64) { let _ = sqlx::query!(\"SELECT * FROM u WHERE id = $1\", id); }\n";
        let hits = run_rule("SQLX-N1-002", src);
        assert!(hits.is_empty(), "SQLX-N1-002 must NOT fire outside a loop");
    }

    #[test]
    fn sqlx_n1_002_safe_with_any_batch() {
        // `WHERE id = ANY($1)` is the canonical batched fix.
        let src = "fn f(pool: &Pool, ids: Vec<i64>) { let _ = sqlx::query!(\"SELECT * FROM u WHERE id = ANY($1)\", &ids); }\n";
        let hits = run_rule("SQLX-N1-002", src);
        assert!(hits.is_empty(), "SQLX-N1-002 must NOT fire on ANY($1) batch query");
    }

    #[test]
    fn shape_anchor_fetch_one_fires_without_import() {
        // No `use sqlx` — only the distinctive fetch_one method.
        let src = "async fn f(q: Query<'_>) { let _ = q.fetch_one(&pool).await; }\n";
        let (c, _t) = ctx(src);
        assert!(matches_by_shape(&c.chains, &SQLX_SHAPE));
    }

    #[test]
    fn shape_combo_pool_execute_fires() {
        let src = "async fn f(pool: &Pool) { let _ = pool.execute(\"SELECT 1\").await; }\n";
        let (c, _t) = ctx(src);
        assert!(matches_by_shape(&c.chains, &SQLX_SHAPE));
    }

    #[test]
    fn shape_negative_unrelated_fetch_does_not_fire() {
        // `client.fetch(url)` is reqwest-style; no sqlx-specific spelling.
        let src = "async fn f() { let _ = client.fetch(\"http://x\").await; }\n";
        let (c, _t) = ctx(src);
        assert!(!matches_by_shape(&c.chains, &SQLX_SHAPE));
    }

    // ─── sqlx N+1 — additional coverage ──────────────────────────────────

    #[test]
    fn sqlx_n1_002_does_not_fire_outside_loop() {
        // Top-level single query — fine.
        let src = "fn f(pool: &Pool) { let _ = sqlx::query!(\"SELECT 1\"); }\n";
        let hits = run_rule("SQLX-N1-002", src);
        assert!(hits.is_empty(), "SQLX-N1-002 must not fire on a single top-level query");
    }

    #[test]
    fn sqlx_n1_002_does_not_fire_on_bulk_in_query() {
        // The fix for the N+1: use IN ($1) with the slice. Single query → no fire.
        let src = "fn f(pool: &Pool, ids: Vec<i64>) { let _ = sqlx::query!(\"SELECT * FROM u WHERE id = ANY($1)\", &ids); }\n";
        let hits = run_rule("SQLX-N1-002", src);
        assert!(hits.is_empty(), "SQLX-N1-002 must not fire when one query handles all ids");
    }

    #[test]
    fn sqlx_n1_002_fires_on_query_as_in_loop() {
        // `sqlx::query_as!` is just as bad as `sqlx::query!` in a loop.
        let src = "fn f(pool: &Pool, ids: Vec<i64>) {\nfor id in ids {\n  let _ = sqlx::query_as!(User, \"SELECT * FROM u WHERE id = $1\", id);\n}\n}\n";
        let hits = run_rule("SQLX-N1-002", src);
        assert!(!hits.is_empty(), "SQLX-N1-002 must fire on sqlx::query_as! in loop");
    }
}
