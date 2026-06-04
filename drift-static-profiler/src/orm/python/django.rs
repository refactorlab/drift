//! Django ORM static-analysis rules + dialect.
//!
//! 12 rules in v1 — see `research/ORM_STATIC_ANALYSIS_PLAN.md` §3.1.
//! Detection happens against a `PyOrmContext` populated by the
//! `super::build_context` second walk.

use crate::insights::{Effort, Evidence, Severity};
use crate::orm::context::{BindingKind, CallChain, ChainRoot, PyOrmContext};
use crate::orm::dialect::OrmDialect;
use crate::orm::sql_ir::{
    JoinKind, JoinSpec, LimitSpec, OrmKind, PredictedSql, PredictedStatement, Projection,
    SqlDialect, SqlFidelity, SqlOp, TableRef, WhereExpr,
};
use crate::orm::{Framework, MatchHit, OrmRule};

// ─── Helpers ────────────────────────────────────────────────────────────

fn chain_has_method(chain: &CallChain, name: &str) -> bool {
    chain.steps.iter().any(|s| s.method == name)
}

fn is_queryset_chain(chain: &CallChain, ctx: &PyOrmContext<'_>) -> bool {
    match &chain.root {
        ChainRoot::Identifier(t) => t.chars().next().map(|c| c.is_uppercase()).unwrap_or(false),
        ChainRoot::Binding(name) => match ctx.binding_at(name, chain.byte_range.start) {
            Some(b) => matches!(b.kind, BindingKind::DjangoQuerySet(_)),
            None => false,
        },
        _ => false,
    }
}

fn is_model_inst_chain(chain: &CallChain, ctx: &PyOrmContext<'_>) -> bool {
    match &chain.root {
        ChainRoot::Binding(name) | ChainRoot::LoopVar(name) | ChainRoot::Identifier(name) => {
            match ctx.binding_at(name, chain.byte_range.start) {
                Some(b) => matches!(b.kind, BindingKind::DjangoModelInst(_)),
                None => false,
            }
        }
        _ => false,
    }
}

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

// ─── DJ-N1-003: len(qs) ─────────────────────────────────────────────────

fn matches_dj_n1_003(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if chain.steps.len() == 1 && chain.steps[0].method == "len" {
            // arg must be a tracked queryset binding
            if let Some(arg) = chain.steps[0].args_text.first() {
                let bare = arg.trim();
                if let Some(b) = ctx.binding_at(bare, chain.byte_range.start) {
                    if matches!(b.kind, BindingKind::DjangoQuerySet(_)) {
                        out.push(hit(chain, "DJ-N1-003"));
                    }
                }
            }
        }
    }
    out
}

// ─── DJ-N1-004: qs.count() > 0 / == 0 / >= 1 (use .exists()) ────────────
//
// We can't see comparisons from the chain view; treat any `.count()`
// terminal on a queryset where the result is immediately compared to a
// literal as the match. Phase 1 conservative form: flag every `.count()`
// chain — the Beta tier acknowledges the false-positive risk.

fn matches_dj_n1_004(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !is_queryset_chain(chain, ctx) {
            continue;
        }
        let last = chain.steps.last();
        if last.map(|s| s.method.as_str()) == Some("count") {
            // Heuristic: only fire when the queryset has no prior `.exists()` call.
            if !chain_has_method(chain, "exists") {
                out.push(hit(chain, "DJ-N1-004"));
            }
        }
    }
    out
}

// ─── DJ-PERF-007: Manager.create() in loop ──────────────────────────────

fn matches_dj_perf_007(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        // shape: <Model>.objects.create(...)
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        let is_create = methods.last() == Some(&"create");
        let has_objects = methods.contains(&"objects");
        if is_create && has_objects {
            out.push(hit(chain, "DJ-PERF-007"));
        }
    }
    out
}

// ─── DJ-N1-001: queryset iter + related access without prefetch ─────────

/// DJ-N1-001 dispatcher.
///
/// All the work lives in the generic [`crate::orm::n_plus_one`] pipeline:
/// resolve the loop scope, walk the chain against the prefetch tree and
/// the model graph, emit a `MatchHit` per unsafe segment. Adding a new
/// per-ORM N+1 rule is one line.
fn matches_dj_n1_001(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    crate::orm::n_plus_one::detect(ctx, "DJ-N1-001")
}

// ─── DJ-N1-002: .count() then later use of same qs ──────────────────────
//
// Detection: find a `qs.count()` chain, then look for ANOTHER chain
// in the same file whose root is the same `qs` binding and whose
// byte_range is strictly after the count() chain. That means the
// queryset is evaluated twice (once for count, once for iteration).

fn matches_dj_n1_002(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    // Index queryset chains by root binding name.
    for (idx, chain) in ctx.chains.iter().enumerate() {
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if last != "count" {
            continue;
        }
        let root_name = match &chain.root {
            ChainRoot::Binding(t) | ChainRoot::Identifier(t) => t.clone(),
            _ => continue,
        };
        // Only fire when the root is a tracked queryset.
        let is_qs = ctx
            .binding_at(&root_name, chain.byte_range.start)
            .map(|b| matches!(b.kind, BindingKind::DjangoQuerySet(_)))
            .unwrap_or(false);
        if !is_qs {
            continue;
        }
        // Find a later use of the same queryset:
        //  - another chain with the same root binding, OR
        //  - a for-loop iterating that binding (e.g. `for u in qs:`).
        let count_end = chain.byte_range.end;
        let reused_by_chain = ctx.chains.iter().enumerate().any(|(j, other)| {
            if j == idx {
                return false;
            }
            if other.byte_range.start <= count_end {
                return false;
            }
            match &other.root {
                ChainRoot::Binding(t) | ChainRoot::Identifier(t) | ChainRoot::LoopVar(t) => {
                    t == &root_name
                }
                _ => false,
            }
        });
        let reused_by_loop = ctx
            .for_loops
            .iter()
            .any(|l| l.iterable_var.trim() == root_name && l.body_range.start > count_end);
        if reused_by_chain || reused_by_loop {
            out.push(hit(chain, "DJ-N1-002"));
        }
    }
    out
}

// ─── DJ-N1-005: if qs: / bool(qs) ───────────────────────────────────────

fn matches_dj_n1_005(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if chain.steps.len() == 1 && chain.steps[0].method == "bool" {
            if let Some(arg) = chain.steps[0].args_text.first() {
                if let Some(b) = ctx.binding_at(arg.trim(), chain.byte_range.start) {
                    if matches!(b.kind, BindingKind::DjangoQuerySet(_)) {
                        out.push(hit(chain, "DJ-N1-005"));
                    }
                }
            }
        }
    }
    out
}

// ─── DJ-PERF-006: obj.save() in loop ────────────────────────────────────

fn matches_dj_perf_006(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if last != "save" {
            continue;
        }
        if is_model_inst_chain(chain, ctx) {
            out.push(hit(chain, "DJ-PERF-006"));
        }
    }
    out
}

// ─── DJ-PERF-008: per-row update vs qs.update() ─────────────────────────
//
// Detection: a `<model_inst>.save()` chain inside a loop where the
// loop iterates a tracked queryset. The fix is `qs.update(field=value)`
// — a single UPDATE — instead of save() per row.
//
// We're stricter than DJ-PERF-006: we require the loop variable's
// queryset binding to be present (so `update()` is feasible). When
// only DJ-PERF-006 applies (loose-instance save in loop), DJ-PERF-008
// stays silent.

fn matches_dj_perf_008(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        if !chain.in_loop {
            continue;
        }
        let last = chain.steps.last().map(|s| s.method.as_str()).unwrap_or("");
        if last != "save" {
            continue;
        }
        // root must be a model instance loop var with a tracked qs
        let root_name = match &chain.root {
            ChainRoot::Binding(t) | ChainRoot::LoopVar(t) | ChainRoot::Identifier(t) => t.clone(),
            _ => continue,
        };
        let Some(b) = ctx.binding_at(&root_name, chain.byte_range.start) else { continue };
        let source_qs = match &b.kind {
            BindingKind::DjangoModelInst(m) => m.source_queryset.clone(),
            _ => None,
        };
        let Some(qs_name) = source_qs else { continue };
        // Must be a tracked queryset binding (so .update() applies).
        let qs_is_tracked = ctx
            .binding_at(&qs_name, chain.byte_range.start)
            .map(|b| matches!(b.kind, BindingKind::DjangoQuerySet(_)))
            .unwrap_or(false);
        if qs_is_tracked {
            out.push(hit(chain, "DJ-PERF-008"));
        }
    }
    out
}

// ─── DJ-EAGER-009: .iterator() after prefetch_related ───────────────────

fn matches_dj_eager_009(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if methods.contains(&"iterator") && methods.contains(&"prefetch_related") {
            out.push(hit(chain, "DJ-EAGER-009"));
        }
    }
    out
}

// ─── DJ-PROJ-010: qs.values('m2m_field') ────────────────────────────────
//
// Phase 5 lift: consults the workspace ModelGraph to confirm the argument
// names an actual *-to-many field on the chain's model. When ModelGraph
// is empty (unit test path), falls back to the conservative behaviour.

fn matches_dj_proj_010(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let Some(graph) = ctx.model_graph else {
        return Vec::new();
    };
    if graph.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for chain in &ctx.chains {
        // We need to know the chain's model. Derive from root or from
        // an earlier `objects` step — for `<Model>.objects.<m>...`,
        // root is the model name.
        let model = match &chain.root {
            ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => t.clone(),
            _ => continue,
        };
        // Find a `.values(...)` or `.values_list(...)` step.
        for step in &chain.steps {
            if step.method != "values" && step.method != "values_list" {
                continue;
            }
            for arg in &step.args_text {
                let field_name = arg.trim_matches(['"', '\'']).trim();
                if graph.is_collection_field(&model, field_name) {
                    out.push(hit(chain, "DJ-PROJ-010"));
                    break;
                }
            }
        }
    }
    out
}

// ─── DJ-RAW-011: Model.objects.raw(f"...") / extra(where=f"...") ───────

fn matches_dj_raw_011(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        for step in &chain.steps {
            if step.method == "raw" || step.method == "extra" {
                for arg in &step.args_text {
                    if arg.starts_with("f\"") || arg.starts_with("f'") || arg.contains(" % ") {
                        out.push(hit(chain, "DJ-RAW-011"));
                        break;
                    }
                }
            }
        }
    }
    out
}

// ─── DJ-PAG-012: Paginator deep page ────────────────────────────────────

fn matches_dj_pag_012(ctx: &PyOrmContext<'_>) -> Vec<MatchHit> {
    let mut out = Vec::new();
    for chain in &ctx.chains {
        // Paginator(qs, ...) with .page(n) where n is unbounded — advisory only.
        let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
        if methods.first() == Some(&"Paginator") && methods.contains(&"page") {
            out.push(hit(chain, "DJ-PAG-012"));
        }
    }
    out
}

// ─── Rule slice ─────────────────────────────────────────────────────────

pub const DJANGO_RULES: &[OrmRule] = &[
    OrmRule {
        id: "DJ-N1-003",
        framework: Framework::Django,
        severity: Severity::Medium,
        effort: Effort::Trivial,
        message: "`len(queryset)` evaluates the entire queryset — use `.count()` for SQL COUNT(*).",
        remediation: "Replace `len(qs)` with `qs.count()`. Or use `.exists()` if you only need a boolean.",
        confidence: 0.95,
        matches: matches_dj_n1_003,
    },
    OrmRule {
        id: "DJ-N1-004",
        framework: Framework::Django,
        severity: Severity::Low,
        effort: Effort::Trivial,
        message: "`qs.count()` for an existence check — use `.exists()` (single-row LIMIT 1).",
        remediation: "Replace `qs.count() > 0` / `qs.count() == 0` with `qs.exists()` / `not qs.exists()`.",
        confidence: 0.95,
        matches: matches_dj_n1_004,
    },
    OrmRule {
        id: "DJ-PERF-007",
        framework: Framework::Django,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`Model.objects.create(...)` inside a loop — issues one INSERT per row.",
        remediation: "Collect rows and use `Model.objects.bulk_create(...)` once.",
        confidence: 0.90,
        matches: matches_dj_perf_007,
    },
    OrmRule {
        id: "DJ-N1-001",
        framework: Framework::Django,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Iterating a queryset and accessing related fields without `select_related`/`prefetch_related` — classic N+1.",
        remediation: "Add `.select_related('fk_field')` for FK / `.prefetch_related('m2m_field')` for reverse + M2M.",
        confidence: 0.85,
        matches: matches_dj_n1_001,
    },
    OrmRule {
        id: "DJ-N1-002",
        framework: Framework::Django,
        severity: Severity::Low,
        effort: Effort::Small,
        message: "`.count()` followed by another use of the same queryset — issues two queries.",
        remediation: "Materialize once into a list, then `len(list)` and iterate.",
        confidence: 0.70,
        matches: matches_dj_n1_002,
    },
    OrmRule {
        id: "DJ-N1-005",
        framework: Framework::Django,
        severity: Severity::Medium,
        effort: Effort::Trivial,
        message: "`bool(queryset)` forces full evaluation — use `.exists()` for cheap existence.",
        remediation: "Replace `bool(qs)` / `if qs:` with `qs.exists()`.",
        confidence: 0.80,
        matches: matches_dj_n1_005,
    },
    OrmRule {
        id: "DJ-PERF-006",
        framework: Framework::Django,
        severity: Severity::High,
        effort: Effort::Small,
        message: "`obj.save()` inside a loop — one UPDATE/INSERT per row.",
        remediation: "Collect and use `Model.objects.bulk_update(objs, fields=[...])` or `bulk_create`.",
        confidence: 0.85,
        matches: matches_dj_perf_006,
    },
    OrmRule {
        id: "DJ-PERF-008",
        framework: Framework::Django,
        severity: Severity::Low,
        effort: Effort::Medium,
        message: "Per-row attribute set + save inside loop — use `qs.update(...)` for a single UPDATE.",
        remediation: "Replace loop with `Model.objects.filter(...).update(field=value)`.",
        confidence: 0.65,
        matches: matches_dj_perf_008,
    },
    OrmRule {
        id: "DJ-EAGER-009",
        framework: Framework::Django,
        severity: Severity::Medium,
        effort: Effort::Trivial,
        message: "`.iterator()` after `prefetch_related` silently drops the prefetch (pre-Django 4.1).",
        remediation: "Remove `.iterator()` or pass `chunk_size=` (Django 4.1+ supports prefetch with iterator).",
        confidence: 0.85,
        matches: matches_dj_eager_009,
    },
    OrmRule {
        id: "DJ-PROJ-010",
        framework: Framework::Django,
        severity: Severity::Medium,
        effort: Effort::Medium,
        message: "`.values('m2m_field')` over a many-to-many relation produces a cartesian-shaped result.",
        remediation: "Use `prefetch_related('m2m')` then project in Python, or annotate with `ArrayAgg(...)`.",
        // Lifted to 0.90 in v0.5 once cross-file ModelGraph is wired —
        // we now only fire when the workspace registry confirms the
        // field is *-to-many.
        confidence: 0.90,
        matches: matches_dj_proj_010,
    },
    OrmRule {
        id: "DJ-RAW-011",
        framework: Framework::Django,
        severity: Severity::High,
        effort: Effort::Small,
        message: "Interpolation inside `Model.objects.raw(...)` / `.extra(...)` — SQL injection risk.",
        remediation: "Use parameterized queries: `Model.objects.raw('SELECT ... WHERE col = %s', [value])`.",
        confidence: 0.95,
        matches: matches_dj_raw_011,
    },
    OrmRule {
        id: "DJ-PAG-012",
        framework: Framework::Django,
        severity: Severity::Low,
        effort: Effort::Medium,
        message: "Django `Paginator(...).page(...)` with no bound on page number — deep OFFSET risk.",
        remediation: "Validate the requested page against `paginator.num_pages`, or switch to keyset pagination.",
        confidence: 0.40,
        matches: matches_dj_pag_012,
    },
];

// ─── DjangoDialect (predict_all for SQL-IR rules) ────────────────────────

/// Shape-based fallback when no `import django` is present. Driven by
/// the generic [`crate::orm::shape::matches_by_shape`] engine using
/// this static table. Two evidence classes:
///
///   1. **Anchor methods** — names that only Django exposes
///      (`select_related`, `prefetch_related`, `bulk_create`,
///      `get_or_create`, …). One occurrence is enough.
///   2. **Manager pattern**: `<UpperCamelModel>.objects.<*>` chain.
///      `objects` alone is too generic (jQuery, numpy, generic getters),
///      but `<Model>.objects` is uniquely Django.
const DJANGO_SHAPE: crate::orm::shape::ShapeSpec = crate::orm::shape::ShapeSpec {
    anchors: &[
        "select_related",
        "prefetch_related",
        "bulk_create",
        "bulk_update",
        "get_or_create",
        "update_or_create",
        "values_list",
    ],
    combos: &[crate::orm::shape::ComboRule {
        first_method: "objects",
        root: crate::orm::shape::RootPredicate::FirstCharUppercase,
        continuation_any: &[],
    }],
};

fn matches_dj_by_shape(ctx: &PyOrmContext<'_>) -> bool {
    crate::orm::shape::matches_by_shape(&ctx.chains, &DJANGO_SHAPE)
}

pub struct DjangoDialect;

impl OrmDialect for DjangoDialect {
    fn orm(&self) -> OrmKind {
        OrmKind::Django
    }

    fn matches(&self, ctx: &PyOrmContext<'_>) -> bool {
        ctx.imports.has_any_starting_with("django")
            || ctx
                .imports
                .modules
                .keys()
                .any(|m| m == "django" || m.starts_with("django."))
            || matches_dj_by_shape(ctx)
    }

    fn predict_all(&self, ctx: &PyOrmContext<'_>) -> Vec<PredictedSql> {
        let mut out = Vec::new();
        for chain in &ctx.chains {
            if !looks_like_django(chain) {
                continue;
            }
            let Some(pred) = predict_django_chain(chain, ctx) else {
                continue;
            };
            out.push(pred);
        }
        out
    }
}

fn looks_like_django(chain: &CallChain) -> bool {
    let methods: Vec<&str> = chain.steps.iter().map(|s| s.method.as_str()).collect();
    methods.contains(&"objects")
        || methods.contains(&"filter")
        || methods.contains(&"select_related")
        || methods.contains(&"prefetch_related")
        || methods.contains(&"annotate")
        || methods.contains(&"values")
}

fn predict_django_chain(chain: &CallChain, _ctx: &PyOrmContext<'_>) -> Option<PredictedSql> {
    let table = match &chain.root {
        ChainRoot::Identifier(t) | ChainRoot::Binding(t) | ChainRoot::LoopVar(t) => {
            normalize_table(t)
        }
        _ => return None,
    };
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
            "objects" => {}
            "all" => {}
            "filter" | "exclude" => {
                let w = parse_kwargs_to_where(&step.args_text, step.method == "exclude");
                stmt.where_expr = match stmt.where_expr.take() {
                    Some(prev) => Some(and_combine(prev, w)),
                    None => Some(w),
                };
                if step.args_text.iter().any(|a| !is_literal_arg(a)) {
                    fidelity = downgrade(fidelity);
                }
            }
            "select_related" => {
                for a in &step.args_text {
                    stmt.joins.push(JoinSpec {
                        table: TableRef::name(a.trim_matches(['"', '\'']).to_string()),
                        on: Some(WhereExpr::Eq {
                            column: format!("{}.id", a.trim_matches(['"', '\''])),
                            value: "?".into(),
                            value_is_variable: true,
                        }),
                        kind: JoinKind::Left,
                    });
                }
            }
            "values" | "values_list" => {
                let cols: Vec<String> = step
                    .args_text
                    .iter()
                    .map(|a| a.trim_matches(['"', '\'']).to_string())
                    .collect();
                if !cols.is_empty() {
                    stmt.projection = Projection::Cols(cols);
                }
            }
            "only" => {
                let cols: Vec<String> = step
                    .args_text
                    .iter()
                    .map(|a| a.trim_matches(['"', '\'']).to_string())
                    .collect();
                if !cols.is_empty() {
                    stmt.projection = Projection::Cols(cols);
                }
            }
            "annotate" => {
                // Mark as correlated subquery for SQLIR-011.
                stmt.projection = Projection::Aggregate("annotate_per_outer_row_".into());
            }
            "order_by" => {
                stmt.order_by = step
                    .args_text
                    .iter()
                    .map(|a| a.trim_matches(['"', '\'']).to_string())
                    .collect();
            }
            "count" => {
                stmt.projection = Projection::Aggregate("COUNT(*)".into());
            }
            "first" => {
                stmt.limit = Some(LimitSpec::Literal(1));
            }
            "exists" => {
                stmt.projection = Projection::Aggregate("1".into());
                stmt.limit = Some(LimitSpec::Literal(1));
            }
            "iterator" => {}
            "prefetch_related" => {}
            "get" => {
                stmt.limit = Some(LimitSpec::Literal(1));
                if step.args_text.iter().any(|a| !is_literal_arg(a)) {
                    fidelity = downgrade(fidelity);
                }
            }
            "raw" | "extra" => {
                // Raw SQL — we can't predict shape, but the source is taint-shaped.
                let w = step
                    .args_text
                    .first()
                    .map(|a| WhereExpr::Raw {
                        text: a.clone(),
                        has_interpolation: a.starts_with("f\"") || a.starts_with("f'"),
                    })
                    .unwrap_or(WhereExpr::Raw {
                        text: "<raw>".into(),
                        has_interpolation: false,
                    });
                stmt.where_expr = Some(w);
                fidelity = downgrade(fidelity);
            }
            _ => {
                fidelity = downgrade(fidelity);
            }
        }
    }

    let line = chain.steps.last().map(|s| s.line).unwrap_or(1);
    Some(PredictedSql {
        orm: OrmKind::Django,
        dialect: SqlDialect::Postgres,
        statements: vec![stmt],
        fidelity: vec![fidelity],
        source_range: chain.byte_range.clone(),
        line,
    })
}

fn downgrade(f: SqlFidelity) -> SqlFidelity {
    match f {
        SqlFidelity::Concrete => SqlFidelity::Partial,
        SqlFidelity::Partial => SqlFidelity::Skeletal,
        SqlFidelity::Skeletal => SqlFidelity::Skeletal,
    }
}

fn is_literal_arg(arg: &str) -> bool {
    let a = arg.split('=').nth(1).unwrap_or(arg).trim();
    matches!(a, "True" | "False" | "None")
        || a.starts_with('"')
        || a.starts_with('\'')
        || a.parse::<f64>().is_ok()
}

fn and_combine(a: WhereExpr, b: WhereExpr) -> WhereExpr {
    match (a, b) {
        (WhereExpr::And(mut xs), WhereExpr::And(ys)) => {
            xs.extend(ys);
            WhereExpr::And(xs)
        }
        (WhereExpr::And(mut xs), other) => {
            xs.push(other);
            WhereExpr::And(xs)
        }
        (a, WhereExpr::And(mut xs)) => {
            xs.insert(0, a);
            WhereExpr::And(xs)
        }
        (a, b) => WhereExpr::And(vec![a, b]),
    }
}

fn parse_kwargs_to_where(args: &[String], _exclude: bool) -> WhereExpr {
    // Django kwargs come as `field__lookup=value` or `field=value`.
    let mut parts: Vec<WhereExpr> = Vec::new();
    for arg in args {
        let Some((lhs, rhs)) = arg.split_once('=') else { continue };
        let lhs = lhs.trim();
        let rhs = rhs.trim();
        let is_var = !is_literal_arg(rhs);
        // strip lookup suffix for column name
        let (col, lookup) = match lhs.rsplit_once("__") {
            Some((c, l)) if is_known_lookup(l) => (c.to_string(), Some(l.to_string())),
            _ => (lhs.to_string(), None),
        };
        match lookup.as_deref() {
            Some("icontains") | Some("contains") | Some("istartswith") | Some("startswith") => {
                let pattern = if lookup.as_deref() == Some("icontains")
                    || lookup.as_deref() == Some("contains")
                {
                    format!("%{}%", rhs.trim_matches(['"', '\'']))
                } else {
                    format!("{}%", rhs.trim_matches(['"', '\'']))
                };
                parts.push(WhereExpr::Like {
                    column: col,
                    pattern,
                    value_is_variable: is_var,
                });
            }
            Some("in") => {
                parts.push(WhereExpr::In {
                    column: col,
                    n_values: 0,
                });
            }
            _ => {
                parts.push(WhereExpr::Eq {
                    column: col,
                    value: rhs.to_string(),
                    value_is_variable: is_var,
                });
            }
        }
    }
    match parts.len() {
        0 => WhereExpr::Raw {
            text: String::new(),
            has_interpolation: false,
        },
        1 => parts.pop().unwrap(),
        _ => WhereExpr::And(parts),
    }
}

fn is_known_lookup(s: &str) -> bool {
    matches!(
        s,
        "exact"
            | "iexact"
            | "contains"
            | "icontains"
            | "startswith"
            | "istartswith"
            | "endswith"
            | "iendswith"
            | "in"
            | "gt"
            | "gte"
            | "lt"
            | "lte"
            | "range"
            | "isnull"
            | "regex"
            | "iregex"
    )
}

fn normalize_table(model: &str) -> String {
    // Django default: lowercased classname. App label prefix is unknown
    // statically, so we drop it; rules that match on table name should
    // be schema-agnostic.
    let bare = model.rsplit('.').next().unwrap_or(model);
    let mut out = String::with_capacity(bare.len());
    for (i, c) in bare.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            out.push('_');
        }
        out.push(c.to_ascii_lowercase());
    }
    out
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
        // SAFETY: we leak the source lifetime by storing the tree
        // alongside the ctx; tests don't need to outlive the source.
        let c = build_context(src, unsafe {
            std::mem::transmute::<&tree_sitter::Tree, &tree_sitter::Tree>(&tree)
        });
        (c, tree)
    }

    fn run_rule(rule_id: &str, src: &str) -> Vec<MatchHit> {
        let (c, _t) = ctx(src);
        let rule = DJANGO_RULES.iter().find(|r| r.id == rule_id).unwrap();
        (rule.matches)(&c)
    }

    #[test]
    fn dj_n1_003_fires_on_len_qs() {
        let src = "qs = User.objects.filter(active=True)\nlen(qs)\n";
        assert_eq!(run_rule("DJ-N1-003", src).len(), 1);
    }

    #[test]
    fn dj_n1_003_does_not_fire_on_len_list() {
        let src = "users = ['a', 'b']\nlen(users)\n";
        assert!(run_rule("DJ-N1-003", src).is_empty());
    }

    #[test]
    fn dj_n1_004_fires_on_terminal_count() {
        let src = "qs = User.objects.filter(active=True)\nqs.count()\n";
        let hits = run_rule("DJ-N1-004", src);
        assert!(!hits.is_empty(), "count() on tracked queryset must fire");
    }

    #[test]
    fn dj_perf_007_fires_in_loop() {
        let src = "for i in range(10):\n    User.objects.create(name='x')\n";
        let hits = run_rule("DJ-PERF-007", src);
        assert_eq!(hits.len(), 1);
    }

    #[test]
    fn dj_perf_007_does_not_fire_outside_loop() {
        let src = "User.objects.create(name='x')\n";
        assert!(run_rule("DJ-PERF-007", src).is_empty());
    }

    #[test]
    fn dj_perf_006_does_not_fire_on_non_django_loop() {
        // Regression test for the v0.6 audit fix: a `for u in <not a
        // queryset>:` block must NOT bind the loop var as a Django
        // model instance, so `u.save()` inside that loop must NOT
        // fire DJ-PERF-006 when there's no Django queryset involved.
        let src = "users = [1, 2, 3]\nfor u in users:\n    u.save()\n";
        let hits = run_rule("DJ-PERF-006", src);
        assert!(
            hits.is_empty(),
            "DJ-PERF-006 must NOT fire on non-Django loop; got {} hits",
            hits.len()
        );
    }

    #[test]
    fn dj_perf_006_does_fire_on_django_qs_loop() {
        // Positive control: same shape but iterable IS a tracked qs.
        let src = "qs = User.objects.filter(active=True)\nfor u in qs:\n    u.save()\n";
        let hits = run_rule("DJ-PERF-006", src);
        assert!(
            !hits.is_empty(),
            "DJ-PERF-006 MUST fire when loop iterates a tracked Django queryset"
        );
    }

    #[test]
    fn dj_n1_001_fires_on_iter_lazy_access() {
        let src = "qs = User.objects.filter(active=True)\nfor u in qs:\n    u.posts.count()\n";
        let hits = run_rule("DJ-N1-001", src);
        assert_eq!(hits.len(), 1);
    }

    #[test]
    fn dj_n1_001_does_not_fire_with_prefetch() {
        let src = "qs = User.objects.filter(active=True).prefetch_related('posts')\nfor u in qs:\n    u.posts.count()\n";
        let hits = run_rule("DJ-N1-001", src);
        assert!(hits.is_empty(), "prefetch_related should suppress");
    }

    #[test]
    fn dj_n1_001_does_not_fire_after_values_list() {
        // `.values_list(...)` collapses rows to tuples — any later
        // attribute access cannot trigger a lazy relation load.
        let src = "qs = User.objects.filter(active=True).values_list('id', 'name')\nfor u in qs:\n    u.posts.count()\n";
        let hits = run_rule("DJ-N1-001", src);
        assert!(hits.is_empty(), ".values_list() must short-circuit");
    }

    #[test]
    fn dj_n1_001_does_not_fire_after_values() {
        let src = "qs = User.objects.filter(active=True).values('id')\nfor u in qs:\n    u.posts.count()\n";
        let hits = run_rule("DJ-N1-001", src);
        assert!(hits.is_empty(), ".values() must short-circuit");
    }

    #[test]
    fn dj_n1_001_fires_inside_list_comprehension() {
        let src = "qs = User.objects.filter(active=True)\ncounts = [u.posts.count() for u in qs]\n";
        let hits = run_rule("DJ-N1-001", src);
        assert!(
            !hits.is_empty(),
            "N+1 inside list comprehension must fire"
        );
    }

    #[test]
    fn dj_n1_001_fires_inside_generator_expression() {
        let src = "qs = User.objects.filter(active=True)\ntotal = sum(u.posts.count() for u in qs)\n";
        let hits = run_rule("DJ-N1-001", src);
        assert!(
            !hits.is_empty(),
            "N+1 inside generator expression must fire"
        );
    }

    #[test]
    fn dj_n1_001_does_not_fire_in_comp_with_prefetch() {
        let src = "qs = User.objects.filter(active=True).prefetch_related('posts')\ncounts = [u.posts.count() for u in qs]\n";
        let hits = run_rule("DJ-N1-001", src);
        assert!(
            hits.is_empty(),
            "prefetch_related must suppress N+1 in list comp"
        );
    }

    #[test]
    fn dj_n1_001_does_not_fire_with_nested_prefetch() {
        // Nested `__` path — only `orders__items` is declared, and
        // `u.orders.first().items` traverses both segments. Should be
        // suppressed by the prefetch tree.
        let src = "qs = User.objects.filter(active=True).prefetch_related('orders__items')\nfor u in qs:\n    u.orders.first()\n";
        let hits = run_rule("DJ-N1-001", src);
        assert!(
            hits.is_empty(),
            "nested prefetch `orders__items` must suppress access to `orders`"
        );
    }

    #[test]
    fn dj_n1_001_fires_inside_fstring() {
        let src = "qs = User.objects.filter(active=True)\nparts = []\nfor user in qs:\n    parts.append(f\"{user.name}: {user.posts.count()}\")\n";
        let hits = run_rule("DJ-N1-001", src);
        assert!(!hits.is_empty(), "N+1 inside f-string interpolation must fire");
    }

    #[test]
    fn dj_n1_002_fires_on_count_then_reuse() {
        let src = "qs = User.objects.filter(active=True)\nn = qs.count()\nfor u in qs:\n    pass\n";
        let hits = run_rule("DJ-N1-002", src);
        assert!(!hits.is_empty(), "count() then re-use of same qs must fire DJ-N1-002");
    }

    #[test]
    fn dj_n1_002_does_not_fire_on_count_only() {
        let src = "qs = User.objects.filter(active=True)\nn = qs.count()\n";
        let hits = run_rule("DJ-N1-002", src);
        assert!(hits.is_empty(), "no re-use → no DJ-N1-002");
    }

    #[test]
    fn dj_perf_008_fires_on_attr_save_in_loop() {
        let src = "qs = User.objects.filter(active=True)\nfor u in qs:\n    u.save()\n";
        let hits = run_rule("DJ-PERF-008", src);
        assert!(!hits.is_empty(), "save() on row of tracked qs must fire DJ-PERF-008");
    }

    #[test]
    fn dj_n1_001_fires_on_full_fixture() {
        // Exact source from tests/fixtures/python-django/app/views.py
        let src = "from django.http import HttpResponse\nfrom .models import User, Post\n\n\ndef show_users(request):\n    \"\"\"Canonical N+1: iterate qs + access .posts inside loop.\n    Should fire DJ-N1-001 (qs iter without prefetch) and SQLIR-N+1 family.\"\"\"\n    qs = User.objects.filter(active=True)\n    parts = []\n    for user in qs:\n        parts.append(f\"{user.name}: {user.posts.count()}\")\n    return HttpResponse(\"\\n\".join(parts))\n";
        let hits = run_rule("DJ-N1-001", src);
        assert!(!hits.is_empty(), "must fire on canonical N+1 fixture; got {} hits", hits.len());
    }

    #[test]
    fn dj_raw_011_fires_on_fstring_raw() {
        let src = "User.objects.raw(f\"SELECT * FROM u WHERE name = {x}\")\n";
        let hits = run_rule("DJ-RAW-011", src);
        assert_eq!(hits.len(), 1);
    }

    #[test]
    fn predict_filter_emits_select_with_where() {
        let src = "User.objects.filter(active=True).all()\n";
        let (c, _t) = ctx(src);
        let preds = DjangoDialect.predict_all(&c);
        assert!(!preds.is_empty());
        let sql = preds[0].primary_render().unwrap();
        assert!(sql.contains("SELECT"));
        assert!(sql.contains("FROM user"));
        assert!(sql.contains("WHERE active = True"));
    }

    #[test]
    fn predict_icontains_emits_leading_wildcard() {
        let src = "User.objects.filter(name__icontains='foo').all()\n";
        let (c, _t) = ctx(src);
        let preds = DjangoDialect.predict_all(&c);
        let sql = preds[0].primary_render().unwrap();
        assert!(sql.contains("LIKE '%foo%'"), "got: {sql}");
    }

    #[test]
    fn matches_by_shape_anchor_prefetch_related() {
        // No `import django` — only the anchor method name appears.
        let src = "qs = repo.fetch().prefetch_related('posts')\n";
        let (c, _t) = ctx(src);
        assert!(
            matches_dj_by_shape(&c),
            "prefetch_related alone must trigger Django shape detection"
        );
    }

    #[test]
    fn matches_by_shape_manager_pattern() {
        // Canonical Manager shape: `<UpperCamel>.objects.<method>(...)`.
        let src = "qs = User.objects.filter(active=True)\n";
        let (c, _t) = ctx(src);
        assert!(
            matches_dj_by_shape(&c),
            "<Model>.objects.filter(...) must trigger Django shape detection"
        );
    }

    #[test]
    fn matches_by_shape_negative_lowercase_objects() {
        // `obj.objects.append(...)` on a lowercase root is NOT Django —
        // could be any Python class with a member named `objects`.
        let src = "result = obj.objects.append(x)\n";
        let (c, _t) = ctx(src);
        assert!(
            !matches_dj_by_shape(&c),
            "lowercase-rooted `.objects` chain must not false-trigger Django"
        );
    }
}
