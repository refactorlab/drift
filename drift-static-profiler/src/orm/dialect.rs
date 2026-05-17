//! `OrmDialect` trait — per-ORM strategy that knows how to walk call
//! chains in its dialect and lower them into the `PredictedSql` IR.
//!
//! Each dialect lives under `orm/<lang>/<name>.rs` (Phase 1:
//! `orm/python/django.rs`, `orm/python/sqlalchemy.rs`). New ORMs in
//! later phases implement the same trait — the `collect_orm_findings`
//! dispatcher in `orm/mod.rs` is open for extension via this trait.

use super::context::PyOrmContext;
use super::sql_ir::{OrmKind, PredictedSql};

pub trait OrmDialect {
    fn orm(&self) -> OrmKind;

    /// Does this dialect apply to the given file? Cheap test on
    /// `ctx.imports` — heavy work happens in `predict_all`.
    fn matches(&self, ctx: &PyOrmContext) -> bool;

    /// Lower every recognized call chain to a `PredictedSql`. Chains
    /// the dialect doesn't recognize (helper-function returns, opaque
    /// builders) are simply omitted — precision over recall.
    fn predict_all(&self, ctx: &PyOrmContext) -> Vec<PredictedSql>;
}
