//! Cross-ORM `SqlIrRule` catalog. Each rule fires on a `PredictedSql`
//! produced by any dialect — Django N+1, SQLAlchemy raw-text, Prisma
//! includes all funnel through the same 14 rules.
//!
//! Each rule carries a `FidelityWeight` that scales its confidence by
//! how reliable the input prediction is (Concrete > Partial > Skeletal).
//! See `research/ORM_STATIC_ANALYSIS_PLAN.md` §FFF for the rationale.

use super::sql_ir::{
    JoinKind, OffsetSpec, PredictedSql, PredictedStatement, Projection, SqlFidelity, SqlOp,
    WhereExpr,
};
use super::MatchHit;
use crate::insights::{Effort, Evidence, Severity};

/// Per-fidelity confidence multipliers. Five archetypes cover all 14
/// Phase-1 rules; new rules pick the archetype closest to their semantics.
#[derive(Debug, Clone, Copy)]
pub struct FidelityWeight {
    pub concrete: f64,
    pub partial: f64,
    pub symbolic: f64,
}

impl FidelityWeight {
    pub const DEFAULT: Self = Self {
        concrete: 1.00,
        partial: 0.60,
        symbolic: 0.30,
    };
    pub const TAINT: Self = Self {
        concrete: 1.00,
        partial: 0.95,
        symbolic: 0.70,
    };
    pub const LITERAL_DEPENDENT: Self = Self {
        concrete: 1.00,
        partial: 0.30,
        symbolic: 0.05,
    };
    pub const CARDINALITY: Self = Self {
        concrete: 1.00,
        partial: 0.50,
        symbolic: 0.10,
    };
    pub const SHAPE_ONLY: Self = Self {
        concrete: 1.00,
        partial: 0.80,
        symbolic: 0.50,
    };

    pub fn at(&self, fidelity: SqlFidelity) -> f64 {
        match fidelity {
            SqlFidelity::Concrete => self.concrete,
            SqlFidelity::Partial => self.partial,
            SqlFidelity::Skeletal => self.symbolic,
        }
    }
}

pub struct SqlIrRule {
    pub id: &'static str,
    pub severity: Severity,
    pub effort: Effort,
    pub message: &'static str,
    pub remediation: &'static str,
    pub base_confidence: f64,
    pub fidelity_weight: FidelityWeight,
    pub matches: fn(&PredictedSql) -> Vec<MatchHit>,
}

impl SqlIrRule {
    pub fn effective_confidence(&self, fidelity: SqlFidelity) -> f64 {
        (self.base_confidence * self.fidelity_weight.at(fidelity)).clamp(0.0, 1.0)
    }
}

// ─── Matcher helpers ────────────────────────────────────────────────────

fn hit_from_stmt(stmt: &PredictedStatement, pred: &PredictedSql, note: &str) -> MatchHit {
    let _ = stmt;
    MatchHit {
        line: pred.line,
        byte_range: pred.source_range.clone(),
        extra_evidence: vec![Evidence {
            call: note.to_string(),
            line: pred.line,
            category: None,
        }],
    }
}

fn each_stmt<F: Fn(&PredictedStatement) -> bool>(
    pred: &PredictedSql,
    note: &str,
    f: F,
) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for stmt in &pred.statements {
        if f(stmt) {
            out.push(hit_from_stmt(stmt, pred, note));
        }
    }
    out
}

// ─── The 14 SQLIR rules ─────────────────────────────────────────────────

fn rule_select_star(p: &PredictedSql) -> Vec<MatchHit> {
    // Only fire on EXPLICIT `SELECT *` literals — never on the
    // ORM-default Unspecified projection, which would FP on every
    // `Model.objects.filter(...)` chain.
    each_stmt(p, "SELECT *", |s| {
        matches!(s.op, SqlOp::Select) && matches!(s.projection, Projection::Full)
    })
}

fn rule_missing_where_update_delete(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "UPDATE/DELETE without WHERE", |s| {
        matches!(s.op, SqlOp::Update | SqlOp::Delete) && s.where_expr.is_none()
    })
}

fn rule_implicit_insert_cols(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "INSERT without explicit columns", |s| {
        matches!(s.op, SqlOp::Insert) && matches!(s.projection, Projection::Full)
    })
}

fn rule_leading_wildcard_like(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "LIKE '%...'", |s| match &s.where_expr {
        Some(w) => has_leading_wildcard(w),
        None => false,
    })
}

fn has_leading_wildcard(w: &WhereExpr) -> bool {
    match w {
        WhereExpr::Like { pattern, value_is_variable, .. } => {
            !*value_is_variable && pattern.starts_with('%')
        }
        WhereExpr::And(xs) | WhereExpr::Or(xs) => xs.iter().any(has_leading_wildcard),
        _ => false,
    }
}

fn rule_limit_without_order(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "LIMIT without ORDER BY", |s| {
        s.limit.is_some() && s.order_by.is_empty()
    })
}

fn rule_or_chain(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "OR chain in WHERE", |s| match &s.where_expr {
        Some(w) => has_or(w),
        None => false,
    })
}

fn has_or(w: &WhereExpr) -> bool {
    match w {
        WhereExpr::Or(_) => true,
        WhereExpr::And(xs) => xs.iter().any(has_or),
        _ => false,
    }
}

fn rule_func_on_column(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "Function on indexed column", |s| match &s.where_expr {
        Some(w) => has_func_on_col(w),
        None => false,
    })
}

fn has_func_on_col(w: &WhereExpr) -> bool {
    match w {
        WhereExpr::FuncOnColumn { .. } => true,
        WhereExpr::And(xs) | WhereExpr::Or(xs) => xs.iter().any(has_func_on_col),
        _ => false,
    }
}

fn rule_deep_nesting(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "WHERE depth > 3", |s| match &s.where_expr {
        Some(w) => where_depth(w) > 3,
        None => false,
    })
}

fn where_depth(w: &WhereExpr) -> usize {
    match w {
        WhereExpr::And(xs) | WhereExpr::Or(xs) => {
            1 + xs.iter().map(where_depth).max().unwrap_or(0)
        }
        _ => 1,
    }
}

fn rule_cartesian_join(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "Cartesian join", |s| {
        s.joins.iter().any(|j| matches!(j.kind, JoinKind::Cartesian))
            || (s.tables.len() > 1 && s.where_expr.is_none() && s.joins.is_empty())
    })
}

fn rule_update_without_limit(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "UPDATE without LIMIT (MySQL)", |s| {
        matches!(s.op, SqlOp::Update) && s.limit.is_none()
    })
}

fn rule_subquery_in_projection(p: &PredictedSql) -> Vec<MatchHit> {
    // Marker: aggregate projection with `_per_outer_row_` token reserved
    // for correlated subqueries the walker stamps in. Phase 1 emits this
    // for `qs.annotate(Count(...))` chains.
    each_stmt(p, "Correlated subquery in SELECT", |s| match &s.projection {
        Projection::Aggregate(a) => a.contains("_per_outer_row_"),
        _ => false,
    })
}

fn rule_unbounded_scan(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "Unbounded SELECT", |s| {
        matches!(s.op, SqlOp::Select) && s.where_expr.is_none() && s.limit.is_none()
    })
}

fn rule_deep_offset(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "Deep OFFSET", |s| match &s.offset {
        Some(OffsetSpec::Literal(n)) => *n >= 1000,
        _ => false,
    })
}

fn rule_join_without_equality(p: &PredictedSql) -> Vec<MatchHit> {
    each_stmt(p, "JOIN without equality", |s| {
        s.joins.iter().any(|j| j.on.is_none() && !matches!(j.kind, JoinKind::Cartesian))
    })
}

pub const BUILTIN_SQL_IR_RULES: &[SqlIrRule] = &[
    SqlIrRule {
        id: "SQLIR-001",
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "Predicted SQL is `SELECT *` — leaks every column, defeats covering indexes.",
        remediation: "Select only the columns you need (`.values(...)`, `select(M.id, M.name)`).",
        base_confidence: 0.85,
        fidelity_weight: FidelityWeight::SHAPE_ONLY,
        matches: rule_select_star,
    },
    SqlIrRule {
        id: "SQLIR-002",
        severity: Severity::High,
        effort: Effort::Small,
        message: "Predicted UPDATE/DELETE with no WHERE clause — affects every row.",
        remediation: "Add a WHERE clause or scope via `.filter(...)` on the queryset before update/delete.",
        base_confidence: 0.95,
        fidelity_weight: FidelityWeight::SHAPE_ONLY,
        matches: rule_missing_where_update_delete,
    },
    SqlIrRule {
        id: "SQLIR-003",
        severity: Severity::Low,
        effort: Effort::Small,
        message: "Predicted INSERT without an explicit column list — fragile to schema changes.",
        remediation: "Pass explicit column names to `create(...)` / `insert(...)`.",
        base_confidence: 0.80,
        fidelity_weight: FidelityWeight::SHAPE_ONLY,
        matches: rule_implicit_insert_cols,
    },
    SqlIrRule {
        id: "SQLIR-004",
        severity: Severity::High,
        effort: Effort::Small,
        message: "Leading-wildcard LIKE pattern — cannot use a btree index.",
        remediation: "Use a trigram index, full-text search, or a different filter shape.",
        base_confidence: 0.95,
        fidelity_weight: FidelityWeight::LITERAL_DEPENDENT,
        matches: rule_leading_wildcard_like,
    },
    SqlIrRule {
        id: "SQLIR-005",
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "LIMIT without ORDER BY — non-deterministic which rows you get.",
        remediation: "Add `.order_by(...)` before `[:N]` / `.limit(N)`.",
        base_confidence: 0.85,
        fidelity_weight: FidelityWeight::SHAPE_ONLY,
        matches: rule_limit_without_order,
    },
    SqlIrRule {
        id: "SQLIR-006",
        severity: Severity::Low,
        effort: Effort::Medium,
        message: "OR chain in WHERE — planner may not use indexes on either side.",
        remediation: "Consider `UNION ALL` of two indexed queries, or a covering composite index.",
        base_confidence: 0.65,
        fidelity_weight: FidelityWeight::DEFAULT,
        matches: rule_or_chain,
    },
    SqlIrRule {
        id: "SQLIR-007",
        severity: Severity::Medium,
        effort: Effort::Medium,
        message: "Function applied to a column in WHERE — disables index unless functional index exists.",
        remediation: "Add a functional/expression index, or normalize at write time.",
        base_confidence: 0.70,
        fidelity_weight: FidelityWeight::DEFAULT,
        matches: rule_func_on_column,
    },
    SqlIrRule {
        id: "SQLIR-008",
        severity: Severity::Low,
        effort: Effort::Medium,
        message: "Deeply nested WHERE (>3 levels) — readability and planner risk.",
        remediation: "Refactor into CTEs or split the query.",
        base_confidence: 0.75,
        fidelity_weight: FidelityWeight::SHAPE_ONLY,
        matches: rule_deep_nesting,
    },
    SqlIrRule {
        id: "SQLIR-009",
        severity: Severity::High,
        effort: Effort::Medium,
        message: "Cartesian join — every row of A combined with every row of B.",
        remediation: "Add a join condition, or replace the implicit cross-join with explicit `JOIN ... ON`.",
        base_confidence: 0.95,
        fidelity_weight: FidelityWeight::SHAPE_ONLY,
        matches: rule_cartesian_join,
    },
    SqlIrRule {
        id: "SQLIR-010",
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "UPDATE without LIMIT — on MySQL this can lock huge ranges.",
        remediation: "Batch updates with `LIMIT` + loop, or rely on the ORM's batched-update primitive.",
        base_confidence: 0.80,
        fidelity_weight: FidelityWeight::SHAPE_ONLY,
        matches: rule_update_without_limit,
    },
    SqlIrRule {
        id: "SQLIR-011",
        severity: Severity::High,
        effort: Effort::Medium,
        message: "Correlated subquery in SELECT — runs once per outer row (SQL-side N+1).",
        remediation: "Rewrite as a LEFT JOIN + GROUP BY, or as an aggregate CTE.",
        base_confidence: 0.85,
        fidelity_weight: FidelityWeight::CARDINALITY,
        matches: rule_subquery_in_projection,
    },
    SqlIrRule {
        id: "SQLIR-012",
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "Unbounded SELECT — no WHERE, no LIMIT.",
        remediation: "Add a WHERE clause or a LIMIT, or stream with `.iterator()` / `.chunk(...)`.",
        base_confidence: 0.85,
        fidelity_weight: FidelityWeight::SHAPE_ONLY,
        matches: rule_unbounded_scan,
    },
    SqlIrRule {
        id: "SQLIR-013",
        severity: Severity::High,
        effort: Effort::Medium,
        message: "Deep OFFSET (≥1000) — the database must read and discard every prior row.",
        remediation: "Use keyset pagination (`WHERE id > last_id ORDER BY id LIMIT N`).",
        base_confidence: 0.95,
        fidelity_weight: FidelityWeight::LITERAL_DEPENDENT,
        matches: rule_deep_offset,
    },
    SqlIrRule {
        id: "SQLIR-014",
        severity: Severity::High,
        effort: Effort::Medium,
        message: "JOIN without an equality condition — likely cartesian or full-scan join.",
        remediation: "Add an equality predicate on the join key.",
        base_confidence: 0.95,
        fidelity_weight: FidelityWeight::SHAPE_ONLY,
        matches: rule_join_without_equality,
    },
];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::sql_ir::{OrmKind, PredictedSql, PredictedStatement, SqlDialect, SqlFidelity};

    fn empty_pred() -> PredictedSql {
        PredictedSql {
            orm: OrmKind::Django,
            dialect: SqlDialect::Postgres,
            statements: vec![PredictedStatement::default()],
            fidelity: vec![SqlFidelity::Concrete],
            source_range: 0..0,
            line: 1,
        }
    }

    #[test]
    fn select_star_fires_on_default_select() {
        let p = empty_pred();
        let hits = rule_select_star(&p);
        assert_eq!(hits.len(), 1, "default Select projection is Full → SELECT *");
    }

    #[test]
    fn missing_where_fires_on_naked_delete() {
        let mut p = empty_pred();
        p.statements[0].op = SqlOp::Delete;
        let hits = rule_missing_where_update_delete(&p);
        assert_eq!(hits.len(), 1);
    }

    #[test]
    fn fidelity_weight_clamps() {
        let r = &BUILTIN_SQL_IR_RULES[0];
        assert!(r.effective_confidence(SqlFidelity::Concrete) <= 1.0);
        assert!(r.effective_confidence(SqlFidelity::Skeletal) >= 0.0);
    }
}
