//! `PredictedSql` IR: the cross-ORM intermediate representation.
//!
//! Each dialect's `predict_all` lowers ORM call chains into one or more
//! `PredictedStatement`s. `SqlIrRule`s in `sql_ir_rules.rs` then fire
//! against this IR, decoupling rule logic from any specific ORM.
//!
//! Fidelity tier is tracked per-statement (not per-prediction) because
//! a single chain like `qs.prefetch_related('posts')` emits one Concrete
//! primary SELECT plus one Partial secondary IN-load.

use serde::{Deserialize, Serialize};
use std::ops::Range;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrmKind {
    Django,
    SqlAlchemy,
    Alembic,
    Generic,
}

/// SQL dialect for `sqlparser`-driven rendering and parsing. Tracks the
/// existing `crate::sql_lint`'s dialect handling so SQL-IR rules can
/// reuse the same parser configuration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SqlDialect {
    Postgres,
    Mysql,
    Sqlite,
    Generic,
}

/// How much of the predicted SQL came from literals vs symbolic
/// inference. Drives per-rule confidence weighting (`FidelityWeight`).
///
/// * **Concrete** — every clause derived from literals; matches what
///   the ORM would actually emit at runtime.
/// * **Partial** — some clauses contain placeholders for variables;
///   taint / shape rules still trustworthy, literal-dependent rules less so.
/// * **Skeletal** — only the operation shape known (e.g. "this is a
///   SELECT with WHERE and LIMIT"). Only the broadest rules apply.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SqlFidelity {
    Concrete,
    Partial,
    Skeletal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SqlOp {
    Select,
    Insert,
    Update,
    Delete,
}

#[derive(Debug, Clone)]
pub enum Projection {
    /// `SELECT *` — explicitly the literal wildcard. Only emitted by
    /// dialects that observe `SELECT *` in source (e.g. raw SQL
    /// literals); ORM dialects that DEFAULT to full-row selection
    /// (Django `Model.objects.filter(...)`, GORM `db.Find(...)`) use
    /// `Unspecified` to avoid 100% FP rates from SQLIR-001 on every
    /// queryset.
    Full,
    /// Dialect didn't tell us what columns are loaded; we render this
    /// as the entity name in `render()` but rules that key on `SELECT *`
    /// MUST NOT fire on it. Most ORM `find/all/filter` chains land here.
    Unspecified,
    /// `SELECT col1, col2, ...` — column projection.
    Cols(Vec<String>),
    /// `SELECT COUNT(*) / SUM(x) / ...` — aggregate-only projection.
    Aggregate(String),
}

#[derive(Debug, Clone)]
pub struct TableRef {
    pub name: String,
    pub alias: Option<String>,
}

impl TableRef {
    pub fn name(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            alias: None,
        }
    }
}

/// Lightweight WHERE-expression representation. We don't (yet) reuse
/// sqlparser's full `Expr` because predictions live before sqlparser
/// parsing; we keep this minimal IR and serialize on render.
#[derive(Debug, Clone)]
pub enum WhereExpr {
    /// `col = ?` or `col = literal`. `value_is_variable=true` ⇒ Partial.
    Eq {
        column: String,
        value: String,
        value_is_variable: bool,
    },
    /// `col LIKE 'pattern'` — captured for leading-wildcard detection.
    Like {
        column: String,
        pattern: String,
        value_is_variable: bool,
    },
    /// `col IN (...)`.
    In { column: String, n_values: usize },
    /// Conjunction.
    And(Vec<WhereExpr>),
    /// Disjunction — flagged by `SQLIR-006`.
    Or(Vec<WhereExpr>),
    /// Function call on indexed column: `LOWER(email) = ?` triggers
    /// `SQLIR-007`.
    FuncOnColumn { func: String, column: String },
    /// Raw / interpolated SQL fragment — typically taint.
    Raw {
        text: String,
        has_interpolation: bool,
    },
}

#[derive(Debug, Clone)]
pub struct JoinSpec {
    pub table: TableRef,
    pub on: Option<WhereExpr>,
    pub kind: JoinKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JoinKind {
    Inner,
    Left,
    Right,
    Full,
    /// FROM A, B with no ON clause — cartesian product.
    Cartesian,
}

#[derive(Debug, Clone)]
pub struct PredictedStatement {
    pub op: SqlOp,
    pub tables: Vec<TableRef>,
    pub projection: Projection,
    pub where_expr: Option<WhereExpr>,
    pub joins: Vec<JoinSpec>,
    pub order_by: Vec<String>,
    pub limit: Option<LimitSpec>,
    pub offset: Option<OffsetSpec>,
    /// True when this statement is emitted inside a tracked loop's body.
    /// Drives the SQL-side N+1 detector.
    pub in_loop: bool,
}

#[derive(Debug, Clone)]
pub enum LimitSpec {
    Literal(u64),
    Variable,
}

#[derive(Debug, Clone)]
pub enum OffsetSpec {
    Literal(u64),
    Variable,
}

impl Default for PredictedStatement {
    fn default() -> Self {
        Self {
            op: SqlOp::Select,
            tables: Vec::new(),
            projection: Projection::Full,
            where_expr: None,
            joins: Vec::new(),
            order_by: Vec::new(),
            limit: None,
            offset: None,
            in_loop: false,
        }
    }
}

impl PredictedStatement {
    /// Render to a SQL-like string for the viewer and for `predicted_sql`
    /// on findings. Not a round-trip parse target — we'd lower via
    /// `sqlparser::ast::Statement` for that in v0.3.
    pub fn render(&self) -> String {
        let mut out = String::new();
        match self.op {
            SqlOp::Select => out.push_str("SELECT "),
            SqlOp::Insert => out.push_str("INSERT INTO "),
            SqlOp::Update => out.push_str("UPDATE "),
            SqlOp::Delete => out.push_str("DELETE FROM "),
        }
        if matches!(self.op, SqlOp::Select) {
            match &self.projection {
                Projection::Full => out.push('*'),
                Projection::Unspecified => out.push_str("<entity>"),
                Projection::Cols(cs) => out.push_str(&cs.join(", ")),
                Projection::Aggregate(a) => out.push_str(a),
            }
            out.push_str(" FROM ");
        }
        let tables: Vec<String> = self.tables.iter().map(|t| t.name.clone()).collect();
        out.push_str(&tables.join(", "));
        for join in &self.joins {
            match join.kind {
                JoinKind::Inner => out.push_str(" JOIN "),
                JoinKind::Left => out.push_str(" LEFT JOIN "),
                JoinKind::Right => out.push_str(" RIGHT JOIN "),
                JoinKind::Full => out.push_str(" FULL JOIN "),
                JoinKind::Cartesian => out.push_str(", "),
            }
            out.push_str(&join.table.name);
            if let Some(on) = &join.on {
                out.push_str(" ON ");
                out.push_str(&render_where(on));
            }
        }
        if let Some(w) = &self.where_expr {
            out.push_str(" WHERE ");
            out.push_str(&render_where(w));
        }
        if !self.order_by.is_empty() {
            out.push_str(" ORDER BY ");
            out.push_str(&self.order_by.join(", "));
        }
        if let Some(l) = &self.limit {
            out.push_str(" LIMIT ");
            match l {
                LimitSpec::Literal(n) => out.push_str(&n.to_string()),
                LimitSpec::Variable => out.push('?'),
            }
        }
        if let Some(o) = &self.offset {
            out.push_str(" OFFSET ");
            match o {
                OffsetSpec::Literal(n) => out.push_str(&n.to_string()),
                OffsetSpec::Variable => out.push('?'),
            }
        }
        // Truncate to 200 chars per `Finding.predicted_sql` contract.
        if out.len() > 200 {
            out.truncate(200);
        }
        out
    }
}

fn render_where(w: &WhereExpr) -> String {
    match w {
        WhereExpr::Eq { column, value, value_is_variable } => {
            let v = if *value_is_variable { "?".to_string() } else { value.clone() };
            format!("{column} = {v}")
        }
        WhereExpr::Like { column, pattern, value_is_variable } => {
            let p = if *value_is_variable {
                "?".to_string()
            } else {
                format!("'{pattern}'")
            };
            format!("{column} LIKE {p}")
        }
        WhereExpr::In { column, n_values } => format!("{column} IN ({n_values} values)"),
        WhereExpr::And(xs) => xs.iter().map(render_where).collect::<Vec<_>>().join(" AND "),
        WhereExpr::Or(xs) => xs.iter().map(render_where).collect::<Vec<_>>().join(" OR "),
        WhereExpr::FuncOnColumn { func, column } => format!("{func}({column}) = ?"),
        WhereExpr::Raw { text, .. } => text.clone(),
    }
}

#[derive(Debug, Clone)]
pub struct PredictedSql {
    pub orm: OrmKind,
    pub dialect: SqlDialect,
    pub statements: Vec<PredictedStatement>,
    pub fidelity: Vec<SqlFidelity>,
    pub source_range: Range<usize>,
    pub line: usize,
}

impl PredictedSql {
    /// Render the first (primary) statement. Used for `Finding.predicted_sql`.
    pub fn primary_render(&self) -> Option<String> {
        self.statements.first().map(|s| s.render())
    }

    pub fn primary_fidelity(&self) -> SqlFidelity {
        self.fidelity.first().copied().unwrap_or(SqlFidelity::Skeletal)
    }
}
