//! SQLAlchemy 1.x + 2.x rules + dialect.
//!
//! 10 rules in v1 — see `research/ORM_STATIC_ANALYSIS_PLAN.md` §3.2.

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::{CallChain, ChainRoot, PyOrmContext};
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

// ─── SA-EXEC-009: text(f"...") inside session.execute / select ──────────

fn matches_sa_exec_009(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        for step in &chain.steps {
            if step.method == "text" {
                for arg in &step.args_text {
                    if arg.starts_with("f\"") || arg.starts_with("f'") || arg.contains(" % ") {
                        out.push(hit(chain, "SA-EXEC-009"));
                        break;
                    }
                }
            }
        }
    }
    out
}

// ─── SA-N1-001: iteration over session.scalars(...).all() + .<rel> ──────

fn matches_sa_n1_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if methods.iter().any(|m| {
            *m == "joinedload" || *m == "selectinload" || *m == "raiseload"
        }) {
            continue;
        }
        // Skip chains that look like writes / session mutations — those
        // are caught by SA-SESS-007 and SA-PERF-005. We only want
        // *attribute-access* chains on a loop-var row (canonical N+1).
        let is_write = matches!(
            methods.last().copied().unwrap_or(""),
            "add" | "delete" | "commit" | "flush" | "execute" | "bulk_save_objects"
                | "add_all" | "refresh" | "merge"
        );
        if is_write {
            continue;
        }
        // Require root to be a loop-var-shaped identifier (lowercase
        // leading char and resolvable to a loop binding).
        let root_text = match &chain.root {
            super::super::context::ChainRoot::Binding(t)
            | super::super::context::ChainRoot::LoopVar(t)
            | super::super::context::ChainRoot::Identifier(t) => t.clone(),
            _ => continue,
        };
        if root_text
            .chars()
            .next()
            .map(|c| !c.is_lowercase())
            .unwrap_or(true)
        {
            continue;
        }
        // Must have at least one attribute step (e.g. `.posts.count()`)
        // beyond the trivial root-only chain.
        if methods.len() < 2 {
            continue;
        }
        out.push(hit(chain, "SA-N1-001"));
    }
    out
}

// ─── SA-N1-002: joinedload on *-to-many ────────────────────────────────
//
// Phase 5 lift: consult ModelGraph to confirm the relation passed to
// `joinedload(...)` is a collection. Joining + Cartesian-fanning out
// rows can balloon query memory.

fn matches_sa_n1_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let Some(graph) = ctx.model_graph else {
        return Vec::new();
    };
    if graph.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for chain in &ctx.chains {
        for step in &chain.steps {
            if step.method != "joinedload" {
                continue;
            }
            for arg in &step.args_text {
                // Args look like `User.posts` — split on '.'.
                let (model, field) = match arg.split_once('.') {
                    Some((m, f)) => (m.trim(), f.trim_matches(|c: char| c == ')' || c == ',').trim()),
                    None => continue,
                };
                if graph.is_collection_field(model, field) {
                    out.push(hit(chain, "SA-N1-002"));
                    break;
                }
            }
        }
    }
    out
}

// ─── SA-N1-003: yield_per + joinedload/subqueryload on same chain ───────

fn matches_sa_n1_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        // Eager-load options may appear as a method call (`.joinedload(...)`)
        // OR — more commonly — as an arg passed to `.options(...)`.
        let has_eager = methods.contains(&"joinedload")
            || methods.contains(&"subqueryload")
            || chain.steps.iter().any(|s| {
                s.method == "options"
                    && s.args_text
                        .iter()
                        .any(|a| a.contains("joinedload") || a.contains("subqueryload"))
            });
        if methods.contains(&"yield_per") && has_eager {
            out.push(hit(chain, "SA-N1-003"));
        }
    }
    out
}

// ─── SA-PERF-004: Query.with_entities(...).all() then len(...) ──────────
//
// Two-chain detection: chain A is `session.query(X).with_entities(...).all()`
// (or `select(X).where(...).all()` in 2.x), bound to a local var, and
// chain B is `len(<that var>)`. The user wants a row count — `func.count()`
// is cheaper than allocating the materialised list.

fn matches_sa_perf_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    // Find variables bound to a `.with_entities(...)...all()` or
    // `select(...)...all()` chain.
    let mut sa_list_bindings: std::collections::HashSet<String> = Default::default();
    for chain in &ctx.chains {
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        let is_query_all = methods.iter().any(|m| *m == "with_entities" || *m == "query")
            && methods.last() == Some(&"all");
        if !is_query_all {
            continue;
        }
        // Pull LHS by scanning the source byte range backward via the
        // binding map: any binding whose value byte_range matches our
        // chain's byte_range corresponds to this assignment.
        for (name, binds) in &ctx.bindings {
            for b in binds {
                if b.byte_range == chain.byte_range {
                    sa_list_bindings.insert(name.clone());
                }
            }
        }
    }
    if sa_list_bindings.is_empty() {
        return out;
    }
    for chain in &ctx.chains {
        if chain.steps.len() != 1 || chain.steps[0].method != "len" {
            continue;
        }
        if let Some(arg) = chain.steps[0].args_text.first() {
            let bare = arg.trim().to_string();
            if sa_list_bindings.contains(&bare) {
                out.push(hit(chain, "SA-PERF-004"));
            }
        }
    }
    out
}

// ─── SA-PERF-005: select(X).where(X.id == loop_var) in loop ─────────────

fn matches_sa_perf_005(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if methods.iter().any(|m| *m == "select") {
            out.push(hit(chain, "SA-PERF-005"));
        }
    }
    out
}

// ─── SA-DTO-006: select(User) then access only .id/.name ────────────────
//
// Detection: a `select(<Model>)` chain whose entity is later iterated
// (loop var binding present) and the loop body's only attribute access
// on that loop var is a small set of columns. We approximate with a
// shape match: select-chain whose result feeds a for-loop, and the
// loop body has ≤2 distinct attribute steps on the loop var.

fn matches_sa_dto_006(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        // Match a `select(M)` chain — not `with_entities` or `values`.
        if !methods.contains(&"select") || methods.contains(&"with_entities") {
            continue;
        }
        // Find variable bound to this chain.
        let bound_name = ctx
            .bindings
            .iter()
            .find_map(|(name, bs)| {
                bs.iter().find(|b| b.byte_range == chain.byte_range).map(|_| name.clone())
            });
        let Some(bound_name) = bound_name else { continue };
        // For each loop iterating that binding, count distinct attribute
        // accesses on the loop var.
        for loop_r in &ctx.for_loops {
            if loop_r.iterable_var.trim() != bound_name {
                continue;
            }
            let body_range = &loop_r.body_range;
            let mut attrs: std::collections::HashSet<String> = Default::default();
            for inner in &ctx.chains {
                if !body_range.contains(&inner.byte_range.start) {
                    continue;
                }
                let root_text = match &inner.root {
                    ChainRoot::Binding(t) | ChainRoot::LoopVar(t) | ChainRoot::Identifier(t) => {
                        t.clone()
                    }
                    _ => continue,
                };
                if root_text != loop_r.loop_var {
                    continue;
                }
                if let Some(first) = inner.steps.first() {
                    attrs.insert(first.method.clone());
                }
            }
            if !attrs.is_empty() && attrs.len() <= 2 {
                out.push(hit(chain, "SA-DTO-006"));
                break;
            }
        }
    }
    out
}

// ─── SA-SESS-007: session.add() in loop without batched flush outside ───

fn matches_sa_sess_007(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if methods.last() == Some(&"add") {
            out.push(hit(chain, "SA-SESS-007"));
        }
    }
    out
}

// ─── SA-LAZY-008: relationship(lazy="dynamic") — class body scan ────────

fn matches_sa_lazy_008(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    // Phase 1: detect by scanning all chains for `relationship` calls
    // with a `lazy="dynamic"` kwarg.
    for chain in &ctx.chains {
        for step in &chain.steps {
            if step.method == "relationship" {
                let lazy_dyn = step
                    .args_text
                    .iter()
                    .any(|a| a.contains("lazy=") && a.contains("\"dynamic\""))
                    || step
                        .args_text
                        .iter()
                        .any(|a| a.contains("lazy=") && a.contains("'dynamic'"));
                if lazy_dyn {
                    out.push(hit(chain, "SA-LAZY-008"));
                }
            }
        }
    }
    out
}

// ─── SA-AUTO-010: autoflush in hot loop ─────────────────────────────────
//
// Detection: a for-loop whose body contains BOTH a `session.add(...)`
// AND a `session.execute(select(...))`. With autoflush on (default),
// the execute() triggers a flush per iteration. Fix: `with
// session.no_autoflush:` around the loop, or `autoflush=False` on the
// session.

fn matches_sa_auto_010(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for loop_r in &ctx.for_loops {
        let body = &loop_r.body_range;
        let mut has_add = None;
        let mut has_execute = None;
        for chain in &ctx.chains {
            if !body.contains(&chain.byte_range.start) {
                continue;
            }
            let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
            let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
            if last == "add" {
                has_add = Some(chain);
            }
            // `session.execute(select(...))` — `select` lives inside
            // the args of the `execute` step, not as its own chain
            // step.
            let select_in_args = chain
                .steps
                .iter()
                .any(|s| s.method == "execute" && s.args_text.iter().any(|a| a.contains("select(")));
            if last == "execute" && (methods.iter().any(|m| *m == "select") || select_in_args) {
                has_execute = Some(chain);
            }
        }
        if let (Some(_a), Some(e)) = (has_add, has_execute) {
            out.push(hit(e, "SA-AUTO-010"));
        }
    }
    out
}

pub const SQLALCHEMY_RULES: &[OrmRule] = &[
    OrmRule {
        id: "SA-EXEC-009",
        framework: Framework::SqlAlchemy,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`text(f\"...{var}...\")` — interpolation inside SQLAlchemy text() is SQL injection.",
        remediation: "Use bind params: `text('SELECT ... WHERE x = :x').bindparams(x=value)`.",
        confidence: 0.95,
        matches: matches_sa_exec_009,
    },
    OrmRule {
        id: "SA-N1-001",
        framework: Framework::SqlAlchemy,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Iterating SQLAlchemy results and accessing related attributes without `joinedload`/`selectinload`.",
        remediation: "Add `.options(joinedload(M.rel))` or `.options(selectinload(M.rel))`.",
        confidence: 0.80,
        matches: matches_sa_n1_001,
    },
    OrmRule {
        id: "SA-N1-002",
        framework: Framework::SqlAlchemy,
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "`joinedload(rel)` on a *-to-many collection — Cartesian shape.",
        remediation: "Use `selectinload(rel)` for collection relationships.",
        // Lifted to 0.92 in v0.5 once cross-file ModelGraph confirms the
        // relation is a *-to-many before firing.
        confidence: 0.92,
        matches: matches_sa_n1_002,
    },
    OrmRule {
        id: "SA-N1-003",
        framework: Framework::SqlAlchemy,
        severity: Severity::High,
        effort: Effort::Trivial,
        message: "`yield_per(N)` combined with `joinedload`/`subqueryload` — incompatible eager-load strategies.",
        remediation: "Drop the eager-load options or switch to `selectinload(...)`.",
        confidence: 0.95,
        matches: matches_sa_n1_003,
    },
    OrmRule {
        id: "SA-PERF-004",
        framework: Framework::SqlAlchemy,
        severity: Severity::Medium,
        effort: Effort::Trivial,
        message: "`Query.with_entities(...).all()` then `len(...)` — issues full SELECT for a count.",
        remediation: "Use `func.count()` aggregate.",
        confidence: 0.85,
        matches: matches_sa_perf_004,
    },
    OrmRule {
        id: "SA-PERF-005",
        framework: Framework::SqlAlchemy,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Single-row `session.execute(select(X).where(X.id == loop_var))` inside a loop — N+1.",
        remediation: "Collect ids and use `WHERE X.id.in_(ids)` once.",
        confidence: 0.85,
        matches: matches_sa_perf_005,
    },
    OrmRule {
        id: "SA-DTO-006",
        framework: Framework::SqlAlchemy,
        severity: Severity::Low,
        effort: Effort::Small,
        message: "`select(User)` loads the full entity but only one or two columns are read.",
        remediation: "Use `select(User.id, User.name)` for column projection.",
        confidence: 0.55,
        matches: matches_sa_dto_006,
    },
    OrmRule {
        id: "SA-SESS-007",
        framework: Framework::SqlAlchemy,
        severity: Severity::Medium,
        effort: Effort::Small,
        message: "`session.add(obj)` inside loop — each add can trigger autoflush.",
        remediation: "Use `session.add_all(list_of_objs)` or `session.bulk_save_objects(...)` outside the loop.",
        confidence: 0.65,
        matches: matches_sa_sess_007,
    },
    OrmRule {
        id: "SA-LAZY-008",
        framework: Framework::SqlAlchemy,
        severity: Severity::Medium,
        effort: Effort::Medium,
        message: "`relationship(..., lazy=\"dynamic\")` returns AppenderQuery — `len()` triggers COUNT and `list()` loads all.",
        remediation: "Avoid `lazy=\"dynamic\"` for relations frequently materialized; use a normal relationship with eager-load.",
        confidence: 0.85,
        matches: matches_sa_lazy_008,
    },
    OrmRule {
        id: "SA-AUTO-010",
        framework: Framework::SqlAlchemy,
        severity: Severity::Low,
        effort: Effort::Small,
        message: "Long for-loop with `session.add` + `session.execute(select(...))` — autoflush per query.",
        remediation: "Wrap with `with session.no_autoflush:` or set `autoflush=False`.",
        confidence: 0.55,
        matches: matches_sa_auto_010,
    },
];

// ─── SqlalchemyDialect ──────────────────────────────────────────────────

use crate::orm::shape::{ComboRule, RootPredicate, ShapeSpec};

/// Shape-based fallback when no `import sqlalchemy` is present. Defined
/// declaratively here, evaluated by the generic engine in `orm/shape.rs`.
/// Adding a SA-distinctive method = appending one entry to `ANCHORS`;
/// no detector code changes.
pub(crate) const SA_SHAPE: ShapeSpec = ShapeSpec {
    anchors: &[
        "joinedload",
        "selectinload",
        "raiseload",
        "subqueryload",
        "yield_per",
        "scalar_one",
        "scalar_one_or_none",
        "bulk_save_objects",
        "execution_options",
        "with_entities",
        "filter_by",
    ],
    combos: &[
        // `session.query(...)` shape — root contains "session" /
        // "Session" so pandas's `.query()` doesn't false-trigger.
        ComboRule {
            first_method: "query",
            root: RootPredicate::ContainsIgnoreCase("session"),
            continuation_any: &[],
        },
        // SA 2.x: `select(...).where(...).limit(...)`. Bare `select`
        // alone is too ambiguous; we require an SA-shaped continuation.
        ComboRule {
            first_method: "select",
            root: RootPredicate::Any,
            continuation_any: &[
                "where", "options", "scalars", "order_by", "group_by", "limit", "offset",
                "having",
            ],
        },
    ],
};

pub struct SqlalchemyDialect;

impl OrmDialect for SqlalchemyDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::SqlAlchemy
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports.has_any_starting_with("sqlalchemy")
            || crate::orm::shape::matches_by_shape(&ctx.chains, &SA_SHAPE)
    }

    fn predict_all(&self, ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        let mut out = Vec::new();
        for chain in &ctx.chains {
            let Some(pred) = predict_sa_chain(chain, ctx) else { continue };
            out.push(pred);
        }
        out
    }
}

fn predict_sa_chain(chain: &CallChain, _ctx: &PyOrmContext<'_>) -> Option<PredictedSql> {
    let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
    if !methods.contains(&"select") && !methods.contains(&"query") {
        return None;
    }
    let entity = chain
        .steps
        .iter()
        .find(|s| s.method == "select" || s.method == "query")
        .and_then(|s| s.args_text.first().cloned())
        .unwrap_or_else(|| "?".to_string());
    let table = lowercase(&entity);
    let mut stmt = PredictedStatement {
        op: SqlOp::Select,
        tables: vec![TableRef::name(table)],
        projection: Projection::Unspecified,
        ..Default::default()
    };
    stmt.in_loop = chain.in_loop;
    let mut fidelity = SqlFidelity::Concrete;
    for step in &chain.steps {
        match step.method.as_str() {
            "where" | "filter" | "filter_by" => {
                // Args are SQLAlchemy comparison exprs; we can't fully parse them but
                // can mark them as where present and downgrade fidelity to Partial.
                stmt.where_expr = Some(WhereExpr::Raw {
                    text: step.args_text.join(", "),
                    has_interpolation: false,
                });
                fidelity = SqlFidelity::Partial;
            }
            "limit" => {
                stmt.limit = step
                    .args_text
                    .first()
                    .and_then(|a| a.parse::<u64>().ok())
                    .map(LimitSpec::Literal)
                    .or(Some(LimitSpec::Variable));
            }
            "offset" => {
                stmt.offset = step
                    .args_text
                    .first()
                    .and_then(|a| a.parse::<u64>().ok())
                    .map(crate::orm::sql_ir::OffsetSpec::Literal)
                    .or(Some(crate::orm::sql_ir::OffsetSpec::Variable));
            }
            "order_by" => {
                stmt.order_by = step.args_text.clone();
            }
            "count" => {
                stmt.projection = Projection::Aggregate("COUNT(*)".into());
            }
            _ => {}
        }
    }
    let line = chain.steps.last().map(|s| s.line).unwrap_or(1);
    Some(PredictedSql {
        orm: OrmKind::SqlAlchemy,
        dialect: SqlDialect::Postgres,
        statements: vec![stmt],
        fidelity: vec![fidelity],
        source_range: chain.byte_range.clone(),
        line,
    })
}

fn lowercase(s: &str) -> String {
    s.trim().to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orm::python::build_context;
    use tree_sitter::Parser;

    fn ctx<'a>(src: &'a str) -> (PyOrmContext<'a>, tree_sitter::Tree) {
        let mut p = Parser::new();
        p.set_language(&tree_sitter_python::LANGUAGE.into()).unwrap();
        let tree = p.parse(src, None).unwrap();
        let c = build_context(src, unsafe { std::mem::transmute(&tree) });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let r = SQLALCHEMY_RULES.iter().find(|x| x.id == rule_id).unwrap();
        (r.matches)(&c)
    }

    #[test]
    fn sa_exec_009_fires_on_fstring_text() {
        let src = "from sqlalchemy import text\nsession.execute(text(f\"SELECT {x}\"))\n";
        assert_eq!(run_rule("SA-EXEC-009", src).len(), 1);
    }

    #[test]
    fn sa_exec_009_clean_on_bindparams() {
        let src = "from sqlalchemy import text\nsession.execute(text('SELECT :x').bindparams(x=1))\n";
        assert!(run_rule("SA-EXEC-009", src).is_empty());
    }

    #[test]
    fn sa_n1_003_fires_on_yield_per_with_joinedload() {
        let src = "select(User).options(joinedload(User.posts)).yield_per(100)\n";
        let hits = run_rule("SA-N1-003", src);
        assert!(!hits.is_empty());
    }

    #[test]
    fn sa_perf_004_fires_on_with_entities_then_len() {
        let src = "rows = session.query(User).with_entities(User.id).all()\nn = len(rows)\n";
        let hits = run_rule("SA-PERF-004", src);
        assert!(!hits.is_empty(), "with_entities().all() + len(...) must fire SA-PERF-004");
    }

    #[test]
    fn sa_auto_010_fires_on_add_plus_execute_in_loop() {
        let src = "for x in xs:\n    session.add(User(name=x))\n    session.execute(select(Other).where(Other.id == 1))\n";
        let hits = run_rule("SA-AUTO-010", src);
        assert!(!hits.is_empty(), "add + execute(select) in loop must fire SA-AUTO-010");
    }

    #[test]
    fn sa_lazy_008_fires_on_dynamic_relationship() {
        let src = "posts = relationship('Post', lazy=\"dynamic\")\n";
        let hits = run_rule("SA-LAZY-008", src);
        assert_eq!(hits.len(), 1);
    }

    #[test]
    fn matches_by_shape_anchor_joinedload() {
        // No `import sqlalchemy` anywhere — only the anchor method name.
        let src = "stmt = sel.options(joinedload(User.posts))\n";
        let (c, _t) = ctx(src);
        assert!(
            crate::orm::shape::matches_by_shape(&c.chains, &SA_SHAPE),
            "joinedload alone must trigger SA shape detection"
        );
    }

    #[test]
    fn matches_by_shape_session_query() {
        // Inherited-usage shape: `session.query(...).filter(...)`.
        let src = "with self.session() as session:\n    result = session.query(Model).filter(Model.x == 1).all()\n";
        let (c, _t) = ctx(src);
        assert!(
            crate::orm::shape::matches_by_shape(&c.chains, &SA_SHAPE),
            "session.query(...).filter(...) must trigger SA shape detection"
        );
    }

    #[test]
    fn matches_by_shape_select_where() {
        let src = "stmt = select(User).where(User.id == 1).limit(10)\n";
        let (c, _t) = ctx(src);
        assert!(
            crate::orm::shape::matches_by_shape(&c.chains, &SA_SHAPE),
            "select(...).where(...).limit(...) must trigger SA 2.x shape detection"
        );
    }

    #[test]
    fn matches_by_shape_negative_pandas_filter() {
        // Pandas-style `.filter(...)` on a lowercase root must NOT trigger.
        let src = "result = df.filter(items=['a', 'b']).groupby('x').first()\n";
        let (c, _t) = ctx(src);
        assert!(
            !crate::orm::shape::matches_by_shape(&c.chains, &SA_SHAPE),
            "pandas-style filter() chain must not false-trigger SA"
        );
    }
}
