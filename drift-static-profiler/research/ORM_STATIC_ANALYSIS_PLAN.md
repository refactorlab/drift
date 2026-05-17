# ORM Static Analysis — Implementation Plan (Python + TS/JS + JVM/Go/Rust + Unified SQL Engine)

> Note: this document grew over multiple research rounds.
> - **Part I** — Python (Django, SQLAlchemy, Alembic)
> - **Part II** — TypeScript/JavaScript (Prisma, Drizzle, TypeORM, Sequelize, Mongoose)
> - **Part III** — JVM (Java/Kotlin/Scala: Hibernate/JPA, Spring Data, jOOQ, MyBatis, Exposed, Ktorm, Slick, Doobie, Quill) + Go (GORM, ent, bun, sqlc) + Rust (Diesel, SQLx, SeaORM)
> - **Part IV** — The Unified SQL Diagnostic Engine: ORM → SQL translation IR, cross-ORM rule layer, fidelity ladder
> - **Part V** — 90 %-precision strategy: triangulation, calibration, corpus
> - **Part VI** — Full step-by-step build order across all parts
>
> Cross-cutting architectural decisions in later parts supersede earlier ones where they conflict.

---

# Part I — Python ORM Static Analysis

Add purely static, tree-sitter-backed detectors for Django, SQLAlchemy, and Alembic to `drift-static-profiler`. No runtime hooks, no Python interpreter, no `pip install` of the target project.

Target layout (per user request):

```
src/orm/
  mod.rs                    — dispatcher; declares the OrmRule trait + Catalog
  python/
    mod.rs                  — Python-specific shared scaffolding (binding map, loop-detector, queryset-id propagation)
    django.rs               — Django ORM rule catalog + matchers
    sqlalchemy.rs           — SQLAlchemy 1.x/2.x rule catalog + matchers
    alembic.rs              — Alembic migration safety rule catalog
```

The wider repo already has [research/ORM_EAGERLOAD_DTO_CACHE_STREAM_CATALOG.md](ORM_EAGERLOAD_DTO_CACHE_STREAM_CATALOG.md) and [research/MIGRATION_AST_SHAPES.md](MIGRATION_AST_SHAPES.md) which enumerate the antipatterns; this plan covers **how to detect them statically with tree-sitter + Rust**, not what to detect.

---

## 1 — Why purely static, and what that buys / costs us

### Buys
- Zero install of the user's project. We parse files directly — no Django settings module, no SQLAlchemy `MetaData`.
- Runs on any branch / PR / dead code. Runtime tools (`nplusone`, `django-silk`, `dogpile.cache` hooks) only see code that executes.
- O(LOC) — single tree-sitter pass per file, shared with the existing pipeline. We pay zero extra parse cost.

### Costs
- No real type inference. `def foo(qs)` — we can't know `qs` is a QuerySet without callers.
- Aliases and dynamic attribute access (`getattr(obj, name)`) defeat us. We accept this and report `confidence < 1.0`.
- Cross-file model graph (Django `ForeignKey`/SQLAlchemy `relationship()`) requires a second indexing pass — feasible but not in v1.

### Prior art benchmark
- **richardhapb/django-check** (Rust, LSP) is the closest analog. Crates: `parser` / `ir` (ModelGraph) / `passes` / `diagnostic`. Does **not** use tree-sitter — uses its own Python parser. Builds a project-wide ModelGraph. We will follow the same architecture (parser → IR → passes → diagnostic), but reuse tree-sitter as the parser and the existing `Finding` shape as the diagnostic.
- **nplusone** (Python, runtime). Reference for the *what*. We replicate its findings shape statically.
- **Squawk** (Rust, Postgres migration linter). Reference for Alembic rules. It parses raw SQL DDL; we operate at the Python-call layer (`op.add_column`, `op.alter_column`) so we catch things *before* they hit raw SQL.
- **Semgrep django rules**. Pattern-based. We will mine their YAML for low-cost rules (column-trim, exists-vs-count) but rebuild as Rust predicates since tree-sitter queries are 10–100× faster than Semgrep's pattern matcher.

---

## 2 — The static analysis pipeline

```
tree-sitter parse  ──►  per-file capture (tags.rs)  ──►  per-file ORM context  ──►  rule pass  ──►  Finding
        (already)         (already; widen captures)         (new)                  (new)         (existing)
```

### 2.1 Widen the tree-sitter captures

`src/languages/python.rs` already captures `@def.*`, `@ref.*`, `@import.*`, `@ref.sql_literal`. We add three new ORM-specific captures, scoped via predicates so non-ORM files cost zero:

```scheme
; Variable assignment whose RHS is a call — used by binding-map.
; e.g.  qs = User.objects.filter(...)
(assignment
  left: (identifier) @bind.lhs
  right: (call
    function: [(identifier) @bind.rhs.fn
               (attribute attribute: (identifier) @bind.rhs.method)])) @bind.assign

; For-loop iterator + body — used to find loops over querysets.
(for_statement
  left: (_) @loop.var
  right: (_) @loop.iter
  body: (_) @loop.body) @loop.stmt

; Decorator over a function — used for @transaction.atomic, @cache, etc.
(decorated_definition
  (decorator (_) @decorator.expr)
  definition: (function_definition name: (identifier) @decorator.fn)) @decorator.site
```

These captures are **language-agnostic shapes** (loops, bindings, decorators) — Java/Go/TS detectors will reuse them later, so they belong in `python.rs` for now and graduate to `languages/python.rs` proper.

### 2.2 Per-file ORM context

New struct in `src/orm/python/mod.rs`:

```rust
pub struct PyOrmContext<'a> {
    pub file: &'a str,
    pub imports: ImportMap,           // dotted_name → alias OR alias → fqn
    pub bindings: BindingMap,         // var_name → BindingKind
    pub for_loops: Vec<LoopRange>,    // byte-range + loop-var bindings
    pub class_defs: Vec<ClassDef>,    // for Django Model / SQLAlchemy declarative_base subclasses
    pub references: &'a [Reference],  // shared with the rest of drift-static-profiler
}

pub enum BindingKind {
    DjangoQuerySet { model: Option<String> },   // qs = User.objects.filter(...)
    DjangoManager  { model: Option<String> },   // mgr = User.objects
    DjangoModelInst{ model: Option<String> },   // u = qs.first()
    SaSelect        { entity: Option<String> }, // stmt = select(User)
    SaSession,                                  // sess = Session(); sess = sessionmaker()()
    AlembicOp,                                  // imported as `from alembic import op`
    Unknown,
}
```

**Inference rules** (cheap; no SAT, no fixpoint):
- `X.objects.filter(...)` / `X.objects.all()` / `X.objects.exclude(...)` etc → DjangoQuerySet{model=X}
- `<DjangoQuerySet>.filter(...)` / `.exclude(...)` / `.annotate(...)` / `.select_related(...)` / `.prefetch_related(...)` → DjangoQuerySet (propagate model)
- `<DjangoQuerySet>.first()` / `.get(...)` / `.last()` → DjangoModelInst (propagate model)
- `select(X)` (imported from `sqlalchemy`) → SaSelect{entity=X}
- `from alembic import op` → bindings["op"] = AlembicOp

**Loop binding propagation:**
- `for u in qs:` where bindings["qs"] == DjangoQuerySet{model=User} ⇒ inside loop body, bindings["u"] = DjangoModelInst{model=User}
- Loop body scope = byte-range of the `body: (_) @loop.body` capture. References within that range carry an `in_loop: bool` flag (already on `ExternalCall`).

### 2.3 Rule catalog — `OrmRule` trait

Mirror the existing `SqlRule` shape (`src/sql_lint.rs:67`):

```rust
pub struct OrmRule {
    pub id: &'static str,
    pub framework: Framework,           // Django | SqlAlchemy | Alembic | Generic
    pub severity: Severity,
    pub effort: Effort,
    pub message: &'static str,
    pub remediation: &'static str,
    pub matches: fn(&PyOrmContext, &Reference) -> Option<MatchHit>,
}

pub struct MatchHit {
    pub line: usize,
    pub confidence: f64,
    pub extra_evidence: Vec<Evidence>,
}
```

Per-framework catalogs live next to their matchers:
- `django.rs`: `pub const DJANGO_RULES: &[OrmRule] = &[...]`
- `sqlalchemy.rs`: `pub const SQLALCHEMY_RULES: &[OrmRule] = &[...]`
- `alembic.rs`: `pub const ALEMBIC_RULES: &[OrmRule] = &[...]`

The dispatcher in `orm/mod.rs` concatenates them (Open/Closed; same pattern as `sql_lint.rs`'s `BUILTIN_RULES`).

### 2.4 Plug-in points (file:line in current repo)

| Where | What |
|---|---|
| [src/languages/python.rs:18](../src/languages/python.rs#L18) `TAGS_QUERY` | append the 3 new captures (`@bind.*`, `@loop.*`, `@decorator.*`) |
| [src/tags.rs:308](../src/tags.rs#L308) `extract_sql_string` neighborhood | extend the capture-name match to populate a new `BindingHint` field on `Reference` |
| [src/insights.rs:518](../src/insights.rs#L518) `collect_node_findings` | add `out.extend(orm::python::collect_findings(sym, ctx));` |
| [src/report.rs:226](../src/report.rs#L226) attach-pass region | (optional, only if we go cross-file) attach a project-wide ModelGraph pass |
| [Cargo.toml:50](../Cargo.toml#L50) `[dependencies]` | nothing new — we reuse `tree-sitter-python`, `sqlparser`, `serde_json` |
| [schema/profile.schema.json:434](../schema/profile.schema.json) `FindingKind` enum | append `"django_antipattern"`, `"sqlalchemy_antipattern"`, `"alembic_migration"` (or fold all under a single `"orm_antipattern"` and use `evidence[0].call` to carry the rule id) — see §6 |

---

## 3 — v1 rule set (high-precision, low-FP)

This is the subset of [ORM_EAGERLOAD_DTO_CACHE_STREAM_CATALOG.md](ORM_EAGERLOAD_DTO_CACHE_STREAM_CATALOG.md) we ship first. Each rule is purely syntactic on tree-sitter captures + the `PyOrmContext` binding map — no cross-file resolution needed.

### 3.1 Django (target: 12 rules in v1)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `DJ-N1-001` | Iterating a queryset and accessing `x.related` without `select_related` / `prefetch_related` | `for x in qs:` ∧ `x.<attr>.<deeper>` in loop body ∧ `qs` chain has no `select_related`/`prefetch_related`/`only` mentioning `<attr>` | 0.85 |
| `DJ-N1-002` | `.count()` followed by another use of the same queryset | `qs.count()` ∧ later `for _ in qs:` or `qs.filter(...)` in same function — issues two queries | 0.70 |
| `DJ-N1-003` | `len(qs)` instead of `qs.count()` | `call function:(identifier "len") arguments:(qs_binding)` | 0.95 |
| `DJ-N1-004` | `qs.count() > 0` / `qs.count() == 0` instead of `qs.exists()` | `comparison_operator` LHS=`<qs>.count()` RHS=literal 0 | 0.95 |
| `DJ-N1-005` | `bool(qs)` / `if qs:` truthy-check forces full evaluation | `if` whose condition is a queryset identifier directly | 0.80 |
| `DJ-PERF-006` | `obj.save()` in a loop (use `bulk_update` / `bulk_create`) | call `<DjangoModelInst>.save()` ∧ `in_loop=true` | 0.85 |
| `DJ-PERF-007` | `Model.objects.create(...)` in a loop (use `bulk_create`) | call `<DjangoManager>.create(...)` ∧ `in_loop=true` | 0.90 |
| `DJ-PERF-008` | `.update(...)` per-row vs `qs.update(...)` | `<DjangoModelInst>.<attr> = ...` then `.save()` in loop | 0.65 |
| `DJ-EAGER-009` | `qs.iterator()` after `prefetch_related` | both calls in same chain — `prefetch_related` is silently dropped pre-4.1 | 0.85 |
| `DJ-PROJ-010` | `qs.values('m2m_field')` triggers cartesian | `values()`/`values_list()` arg matches a relation name in same-file Model | 0.55 (needs ModelGraph for 0.95) |
| `DJ-RAW-011` | `Model.objects.raw(f"...{user}")` or `extra(where=f"...")` — SQLi vector | f-string / `%` formatting inside `raw()`/`extra()` args | 0.95 |
| `DJ-PAG-012` | `Paginator(qs, ...)` over very deep page | `OFFSET` heuristic — flag `Paginator` with a `.page(...)` call whose arg is not bounded | 0.40 (advisory) |

### 3.2 SQLAlchemy (target: 10 rules in v1)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `SA-N1-001` | Iteration over `session.scalars(...).all()` then `.<rel>` access — N+1 default | for-loop body accesses `<row>.<rel>` ∧ no `joinedload`/`selectinload`/`raiseload` in chain | 0.80 |
| `SA-N1-002` | `joinedload(rel)` on a *-to-many collection | argument to `joinedload` matches a relationship marked `uselist=True` / typed `Mapped[List[...]]` in same file | 0.70 |
| `SA-N1-003` | `yield_per(N)` combined with `joinedload(...)` / `subqueryload(...)` | both options on same `Select` chain | 0.95 |
| `SA-PERF-004` | `Query.with_entities(...)` followed by `.all()` then `len(...)` | use `func.count()` instead | 0.85 |
| `SA-PERF-005` | Single-row `session.execute(select(X).where(X.id == id))` in a loop — should be `IN (...)` | `select(...).where(... == <loop_var>...)` ∧ in_loop | 0.85 |
| `SA-DTO-006` | `select(User)` to read 1–2 cols then projected — should be `select(User.id, User.name)` | full-entity select followed only by `.id`/`.name` access | 0.55 |
| `SA-SESS-007` | `session.add(obj)` in a loop without batched `flush` / `commit` outside loop | `session.add` ∧ in_loop ∧ no `session.flush` outside loop in same fn | 0.65 |
| `SA-LAZY-008` | `relationship(..., lazy="dynamic")` field used via `len()`/`list()`/iteration | dynamic relationships return AppenderQuery; `len()` triggers COUNT, `list()` loads all | 0.85 |
| `SA-EXEC-009` | `session.execute(text(f"...{x}"))` — SQLi-shaped + bypasses ORM | f-string inside `text(...)` first arg | 0.95 |
| `SA-AUTO-010` | `autoflush=True` (default) within a hot loop — flushes per query | session created with `autoflush=False` is fine; flag when long for-loop contains both `session.add` and `session.execute(select(...))` | 0.55 |

### 3.3 Alembic (target: 8 rules in v1)

Alembic migrations are individual Python files in `<project>/alembic/versions/*.py` shaped as `def upgrade(): ... def downgrade(): ...`. Each `op.*` call maps to DDL. Rule catalog mirrors Squawk's at the Python layer.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `AL-NULL-001` | `op.add_column(..., nullable=False)` without a preceding `op.execute(...)` UPDATE / data-migration in same `upgrade()` | order matters: scan for `add_column` with `nullable=False` and no prior `op.execute` / `op.bulk_insert` in fn body | 0.85 |
| `AL-NULL-002` | `op.alter_column(..., nullable=False)` without a preceding backfill | same shape; `alter_column` with `nullable=False` ∧ no prior `op.execute("UPDATE ...")` | 0.85 |
| `AL-DROP-003` | `op.drop_column(...)` — breaking change unless prior deploy stopped reading it | always warn unless `# drift-allow: drop-column` comment | 0.50 (advisory) |
| `AL-IDX-004` | `op.create_index(...)` without `postgresql_concurrently=True` | call with no kwarg `postgresql_concurrently` | 0.90 |
| `AL-FK-005` | `op.create_foreign_key(...)` without `postgresql_not_valid` followed later by `VALIDATE CONSTRAINT` | single-call shape | 0.75 |
| `AL-RENAME-006` | `op.alter_column(... new_column_name=...)` — backward-incompatible | always warn | 0.50 |
| `AL-DATA-007` | `op.bulk_insert(table, [...])` of >1000 rows inside `upgrade()` | list literal arg with >1000 elements; should chunk | 0.70 |
| `AL-SQLI-008` | `op.execute(f"...{var}...")` — SQLi-shaped, even in migrations | f-string in `op.execute` arg | 0.95 |

---

## 4 — Step-by-step build order

Each step is independently testable and shippable.

### Step 1 — Skeleton + scaffolding (no rules yet, just plumbing)
- Create `src/orm/mod.rs`, `src/orm/python/mod.rs` with empty `Framework` enum, `OrmRule` struct, `PyOrmContext` struct.
- Wire `collect_findings()` stub into [src/insights.rs:518](../src/insights.rs#L518) — returns `vec![]`.
- Add integration test: parse a fixture file, assert `collect_findings()` is called.

**Done when:** `cargo test` passes; the new dispatcher is in the call path but emits nothing.

### Step 2 — Widen tree-sitter captures + build the binding map
- Append `@bind.*`, `@loop.*`, `@decorator.*` captures to [src/languages/python.rs:18](../src/languages/python.rs#L18).
- Populate `PyOrmContext.bindings` / `for_loops` from the new captures in `tags.rs`.
- Test: feed a synthetic Python file with `qs = User.objects.filter(...)` and `for u in qs:`; assert `bindings["qs"] = DjangoQuerySet{model=User}` and `bindings["u"] = DjangoModelInst{model=User}` *only inside the loop body byte-range*.

**Done when:** Binding propagation tests pass; existing tags-extraction tests still pass.

### Step 3 — Django rules (highest-ROI, simplest)
Implement rules in this order:
1. `DJ-N1-003` (`len(qs)`) — pure syntactic, 0 binding required → smoke-test the rule plumbing
2. `DJ-N1-004` (`count() > 0`) — comparison-operator AST walk
3. `DJ-PERF-007` (`Manager.create()` in loop) — uses `in_loop` flag + binding map
4. `DJ-N1-001` (queryset iteration + related access) — full binding-map exercise
5. Remaining DJ-*

Each rule = one tiny matcher function + one fixture file under `tests/fixtures/orm/django/`.

**Done when:** Each rule has a positive fixture and at least 2 negative fixtures (no false positive on similar-shaped non-ORM code).

### Step 4 — SQLAlchemy rules
Same shape as Django. Two extra wrinkles:
- 1.x vs 2.x: 1.x uses `session.query(...)`, 2.x uses `select(...)` + `session.scalars(...)`. Detect API generation from imports: `from sqlalchemy.orm import Session` + `select` in imports ⇒ 2.x.
- `relationship()` declarations live on Model classes — for `SA-LAZY-008` we need to scan class bodies for `Mapped[...]` annotations or `relationship(lazy="dynamic")` kwargs.

### Step 5 — Alembic rules
- Alembic detection gate: file path matches `.*/alembic/versions/.*\.py` OR file imports `from alembic import op`. Use the second — robust against project-specific layout.
- All Alembic rules are intra-function (look only at `def upgrade(): ...`). No cross-file analysis needed for v1.

### Step 6 — Report integration + JSON schema update
- Decide `FindingKind` strategy (§6 below).
- Update [schema/profile.schema.json](../schema/profile.schema.json) and the validator test in [tests/integration.rs](../tests/integration.rs).

### Step 7 — Docs + corpus
- Add `tests/fixtures/orm/{django,sqlalchemy,alembic}/` with one file per rule (positive + negative).
- Smoke-test on 3 OSS Django projects and 3 OSS SQLAlchemy projects, count findings by rule id, eyeball false-positive rate, tune `confidence`.

---

## 5 — Hard edges and how we handle them

### 5.1 Aliasing / re-export
`from django.db.models import QuerySet as QS` — track via `@import.alias` (already captured by `python.rs`). `ImportMap` resolves both directions.

### 5.2 Cross-file model graph
v1 ships without it. `DJ-PROJ-010` (cartesian on `.values('m2m')`) and the `SA-N1-002` *-to-many detection both want it. v2 plan: a project-wide pass that scans for `class X(models.Model):` or `class X(Base):` bodies, extracts `ForeignKey` / `relationship()` declarations, builds a `ProjectModelGraph`, and re-runs the rules that opted into it. Same crate, separate pass — no schema change.

### 5.3 Conditional `select_related` / `prefetch_related`
```python
qs = User.objects.all()
if include_posts:
    qs = qs.prefetch_related("posts")
for u in qs: u.posts.all()  # N+1 on the `else` branch
```
We flag with `confidence: 0.55` — accept the FP. Alternative: control-flow-sensitive binding (`BindingKind::Maybe(...)`) is doable but doubles the binding-map size; defer to v2.

### 5.4 Dynamic attribute access
`getattr(obj, attr_name)` — give up, emit nothing. We chose precision over recall.

### 5.5 Decorated methods / managers
Custom managers (`class UserManager(models.Manager): def active(self): return self.filter(...)`) — `User.objects.active()` should be inferable as `DjangoQuerySet` because `active()` is defined on a `Manager` subclass. v1: only built-in Manager methods (`filter`, `all`, `exclude`, `get`, …). v2: scan `class _(models.Manager)` bodies and learn the custom methods.

### 5.6 Async (Django 4.x, SQLAlchemy AsyncSession)
`aiter(qs)` / `await qs.aiterator()` — the same rules apply; just add async-call shapes to the capture set.

---

## 6 — `FindingKind` strategy

Two options:

**(a) One flat kind per framework** — adds 3 new variants (`django_antipattern`, `sqlalchemy_antipattern`, `alembic_migration`). Pros: viewer can filter "show only Django" with one click. Cons: schema enum grows by 3 every time we add a framework (Tortoise, Peewee, Beanie, …).

**(b) One umbrella kind `orm_antipattern`** — rule id carried in `evidence[0].call` (matches how `sql_lint.rs:97` does it). Pros: schema stable, follows existing convention. Cons: viewer needs to read evidence to group by framework.

**Recommendation: (b).** It mirrors the SQL-lint convention and the rule id prefix (`DJ-*` / `SA-*` / `AL-*`) cleanly identifies the framework. Schema change: one new enum value `"orm_antipattern"` in [schema/profile.schema.json:434](../schema/profile.schema.json). Code change: one new variant `FindingKind::OrmAntipattern` in [src/insights.rs:91](../src/insights.rs#L91).

---

## 7 — Effort estimate

| Step | Effort |
|---|---|
| 1 — Skeleton | 0.5 day |
| 2 — Captures + binding map | 1.5 days |
| 3 — Django rules (12) | 2 days |
| 4 — SQLAlchemy rules (10) | 2 days |
| 5 — Alembic rules (8) | 1 day |
| 6 — Report integration + schema | 0.5 day |
| 7 — Fixtures + OSS corpus tuning | 1.5 days |
| **Total v1** | **~9 working days** |

v2 (cross-file ModelGraph, custom Manager learning, control-flow-sensitive bindings, async, Tortoise/Peewee): another 2–3 weeks.

---

## 8 — Open questions for the user

1. **One umbrella `FindingKind` or per-framework?** Plan recommends (b); confirm before §6.
2. **Should detection be gated by import?** (e.g. only run Django rules if `django.db.models` is imported in the file). Recommend yes — keeps cost near-zero on non-ORM files. Counter-argument: a file that imports nothing but uses an injected `qs` parameter is missed.
3. **Confidence threshold for inclusion in the report?** drift-static-profiler currently includes all findings. Some v1 rules (`DJ-PAG-012`, `AL-DROP-003`) are advisory at ~0.40–0.50 confidence — should those go in a separate `informational` bucket?
4. **Cross-file model graph in v1 or v2?** v2 keeps v1 shippable in 9 days; v1+graph pushes total to ~3 weeks and requires a second-phase report.rs pass.

---

## Sources

- [richardhapb/django-check](https://github.com/richardhapb/django-check) — closest prior art, Rust LSP-based static N+1 detector (no tree-sitter; custom parser + ModelGraph IR)
- [django-check VSCode extension](https://marketplace.visualstudio.com/items?itemName=richardhapb.Django-Check)
- [django-query-doctor v2.0 forum post](https://forum.djangoproject.com/t/django-query-doctor-v2-0-sql-compilation-cache-ast-serializer-analysis-baseline-regression-detection/44909)
- [nplusone (jmcarp)](https://github.com/jmcarp/nplusone) — Python runtime detector; reference for *what* to detect
- [Squawk — Postgres migration linter](https://squawkhq.com/docs/rules) — model for Alembic rule catalog
- [Semgrep django ruleset](https://semgrep.dev/p/django) — pattern catalog mining source
- [SQLAlchemy 2.0 Relationship Loading Techniques](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html)
- [SQLAlchemy lazy="dynamic" + yield_per incompatibility](https://docs.sqlalchemy.org/en/20/orm/queryguide/api.html)
- [Django QuerySet API reference](https://docs.djangoproject.com/en/6.0/ref/models/querysets/)
- [Alembic Operation Reference](https://alembic.sqlalchemy.org/en/latest/ops.html)
- [Django antipatterns catalog](https://www.django-antipatterns.com/) — community catalog
- Internal: [ORM_EAGERLOAD_DTO_CACHE_STREAM_CATALOG.md](ORM_EAGERLOAD_DTO_CACHE_STREAM_CATALOG.md), [MIGRATION_AST_SHAPES.md](MIGRATION_AST_SHAPES.md), [ORM_TO_SQL_TRANSLATION.md](ORM_TO_SQL_TRANSLATION.md)

---

# Addendum — Deeper Research (round 2)

Findings from a second research pass after the initial code/architecture review. This appendix supersedes the corresponding sections above where it disagrees with them; the rest of the plan stands. **Net effect:** sharper algorithm, fewer architectural ambiguities, ~14–18 day v1 (was 9), and a credible path to v2 cross-file precision.

## A — How `django-check` actually does it (read the source)

Verified by reading [crates/django-check_semantic/src/passes/{n_plus_one,functions,mod}.rs](https://github.com/richardhapb/django-check/tree/main/crates/django-check_semantic/src/passes) and [src/ir/model.rs](https://github.com/richardhapb/django-check/blob/main/crates/django-check_semantic/src/ir/model.rs).

### A.1 The data model (the part we copy verbatim)

```rust
// project-wide
pub struct ModelGraph {
    models: HashMap<String, ModelDef>,  // keyed by Model class name
}
pub struct ModelDef {
    pub name: String,
    pub file_path: String,
    pub line: usize,
    pub relations: Vec<Relation>,
    is_abstract: bool,
}
pub struct Relation {
    pub field_name: String,
    pub target_model: String,
    pub relation_type: RelationType,   // FK | OneToOne | ManyToMany | GenericFK
    related_name: String,
}
```

Lookup operations: `graph.get("User")`, `graph.dependents("User")` (reverse relations), `graph.dependency_depth()` (cycle-aware). It really is *just a string-keyed HashMap*. No fancy graph crate — `petgraph` (already a dependency) is overkill for this shape.

### A.2 The attribute-chain extractor (the function we copy verbatim, ~20 lines)

This is the load-bearing helper that turns `user.profile.settings.theme` into `("user", ["profile", "settings", "theme"])`. From django-check `passes/mod.rs`:

```rust
fn extract_attribute_chain(attr: &ExprAttribute) -> (&str, Vec<&str>) {
    let mut chain = vec![attr.attr.id.as_str()];
    let mut current = attr.value.as_ref();
    loop {
        match current {
            Expr::Attribute(attr) => {
                chain.push(attr.attr.id.as_str());
                current = attr.value.as_ref();
            }
            Expr::Call(call) => { current = call.func.as_ref(); }
            Expr::Name(name) => { chain.reverse(); return (name.id.as_str(), chain); }
            _ => return ("", Vec::new()),
        }
    }
}
```

Our tree-sitter port walks `attribute` nodes recursively (instead of `Expr::Attribute`) — same shape, ~30 lines. **This function is the actual core algorithm** — everything else is bookkeeping around it.

### A.3 The N+1 algorithm itself

```
on entering for_statement:
  resolve(iterable_expr) → maybe QuerySet or ModelInstance
  if yes: push LoopContext { loop_var, queryset_state }

on attribute access whose base == loop_var:
  (root, chain) = extract_attribute_chain(node)
  walked = ""
  for segment in chain:
    walked.push(segment)
    if walked not in queryset_state.prefetched_relations:
      emit_n_plus_one(node, walked)
      break  # don't double-report deeper segments

on leaving for_statement: pop LoopContext
```

Total: **~1100 lines of Rust** in [django-check passes/n_plus_one.rs](https://github.com/richardhapb/django-check/blob/main/crates/django-check_semantic/src/passes/n_plus_one.rs) — including ~50 test cases. That's the realistic size for our `orm/python/django.rs` N+1 detector alone. The original plan estimated "2 days for 12 Django rules"; this finding alone justifies the revised estimate of 3–4 days for Django.

### A.4 What django-check **doesn't** do — and why we don't either

Reading [`passes/functions.rs`](https://github.com/richardhapb/django-check/blob/main/crates/django-check_semantic/src/passes/functions.rs) directly: despite the README's claim of "interprocedural analysis", the pass operates only within one function at a time (`functions.iter().enumerate().next_back()` selects the most-recent function). They do not track:

- Function-call data flow (helper functions that return querysets)
- Return-value propagation
- Cross-function parameter inference

In their model, `def get_users() -> QuerySet[User]: return User.objects.all()` followed by `for u in get_users():` is **not** detected. The way they ship that case is via an explicit type annotation on the parameter (`def fn(users: QuerySet[User])`), which they recognize by name.

**Decision for our v1: same scope, same trade-off.** Cross-function flow lives in v2 alongside the project-wide ModelGraph.

## B — Why we are **not** adopting `stack-graphs`

[stack-graphs](https://github.com/github/stack-graphs) is GitHub's tree-sitter-based, language-agnostic name-resolution framework — exactly what we'd want for cross-file binding resolution. But:

- **Archived 2025-09-09** — read-only on GitHub, no longer supported. ([repo notice](https://github.com/github/stack-graphs))
- **Python implementation at v0.3.0** (Dec 2024 release), changelog shows recent crashes on lambdas and nested function definitions
- Heavyweight: requires defining graph-construction rules in TSG (tree-sitter-graph DSL); the [stack graphs paper](https://arxiv.org/pdf/2211.01224) is 36 pages of algorithmic substrate
- Our actual need is narrower: 3 frameworks, ~30 rules, single-language. A direct tree-walk implementation is ~500 lines; stack-graphs would be ~2000 lines plus the .tsg files

**Decision:** roll our own ~500-line binding tracker. Revisit stack-graphs (or its successor) for v2 cross-file ModelGraph **only if** drift-static-profiler grows a real semantic layer.

Background reading kept for the record:
- [Introducing stack graphs](https://github.blog/open-source/introducing-stack-graphs/) — the algorithmic intuition (symbol stacks, push-on-reference, pop-on-definition, pathfinding through merged per-file graphs)
- [tree-sitter-graph](https://github.com/tree-sitter/tree-sitter-graph) — the underlying DSL, still alive (not archived)

## C — Adopt Ruff's `BindingKind` taxonomy as the reference model

[Ruff](https://github.com/astral-sh/ruff) is the canonical Rust-based Python static analyzer. Its [`ruff_python_semantic` crate](https://github.com/astral-sh/ruff/tree/main/crates/ruff_python_semantic) ships a 21-variant `BindingKind` enum that's the de facto vocabulary for Python static analysis:

```rust
pub enum BindingKind<'a> {
    Annotation, Argument, NamedExprAssignment, Assignment,
    TypeParam, LoopVar, WithItemVar,
    Global(Option<BindingId>), Nonlocal(BindingId, ScopeId),
    Builtin, ClassDefinition(ScopeId), FunctionDefinition(ScopeId),
    Export(Export<'a>), FutureImport,
    Import(Import<'a>), FromImport(FromImport<'a>), SubmoduleImport(SubmoduleImport<'a>),
    Deletion, BoundException, UnboundException(Option<BindingId>), DunderClassCell,
}
pub struct Binding<'a> {
    pub kind: BindingKind<'a>,
    pub range: TextRange,                  // ← byte-offset anchor (not line)
    pub scope: ScopeId,
    pub context: ExecutionContext,
    pub source: Option<NodeId>,
    pub references: Vec<ResolvedReferenceId>,
    pub exceptions: Exceptions,
    pub flags: BindingFlags,
}
```

**Two lessons we steal:**

1. **`TextRange` (byte offsets), not line numbers.** drift-static-profiler currently anchors `Reference` by line. For ORM analysis we need precise byte ranges (e.g. to test "is *this exact reference* inside *that loop body*?"). The existing `Reference.byte_offset` field is the right anchor — extend the binding map to use byte ranges, not lines.

2. **Bindings carry references back-pointers.** Ruff's `Binding.references: Vec<ResolvedReferenceId>` is the "all the places this name is used" inverted index. Our `PyOrmContext.bindings: HashMap<&str, Vec<RefId>>` mirrors it.

**Decision:** extend `BindingKind` with ORM-specific variants (`DjangoQuerySet { facts: QuerySetFacts }`, etc.) and use byte-range anchors. Do **not** depend on `ruff_python_semantic` directly — Ruff's lifetimes (`<'a>` bound to a source-buffer arena) are wired into their parser; we don't want to pull in their parser. Copy the shapes; don't link.

## D — Tree lifetime: walk before drop (verified)

Verified by reading [src/tags.rs:200–215](../src/tags.rs#L200): the tree-sitter `Tree` is created at `parser.parse(source, None)` inside `extract_tags_inner` and **dropped at function return**. Only the extracted `FileTags` survives.

This gives us a clean tree-lifetime answer that the original plan §2.3 left ambiguous:

**Decision:** add a **second tree walk inside `extract_tags_inner`**, before the tree is dropped, that builds `PyOrmContext`. Attach `PyOrmContext` to `FileTags` as an optional field (only populated for files with framework imports — cost zero on non-ORM files).

```
fn extract_tags_inner(...) -> FileTags {
    let tree = parser.parse(source, None)?;
    // existing: run TAGS_QUERY, build references/symbols/imports
    let tags = run_existing_capture_pass(&tree, source, ...)?;
    // NEW: if file imports a framework, walk the tree once more
    let orm_ctx = if tags.imports.has_any_orm() {
        Some(orm::python::build_context(&tree, source, &tags)?)
    } else { None };
    tree.drop();  // existing behavior
    FileTags { ..tags, orm_ctx }
}
```

Cost: one extra `TreeCursor` traversal per ORM file. tree-sitter cursor traversal is ~0.5ms/file at the sizes we see in real Django projects. Acceptable.

This **eliminates** the need to widen the existing `TAGS_QUERY` with `@bind.*` / `@loop.*` / `@attr.access` captures. Original plan §2.1 was wrong about this; the right place to extract this information is a code walk, not a capture pattern. Tree-sitter queries are good at pattern matching; they're bad at "show me every assignment whose LHS is in scope of this for-loop's body" — that needs imperative walking.

## E — SQLAlchemy 2.0 typed annotations are a partial free model graph

The 2.0 typed declarative API gives us cardinality without any extra inference:

```python
class User(Base):
    posts: Mapped[List["Post"]] = relationship(back_populates="user")   # collection
    profile: Mapped["Profile"] = relationship(back_populates="user")    # scalar
```

[SQLAlchemy 2.0 docs](https://docs.sqlalchemy.org/en/20/orm/basic_relationships.html) — the `Mapped[X]` vs `Mapped[List[X]]` distinction is *parsed by SQLAlchemy itself* to set `uselist`. We can parse the same shape from the tree-sitter AST:

```scheme
(assignment
  left: (identifier) @rel.field
  type: (generic_type
    (identifier) @rel.mapped (#eq? @rel.mapped "Mapped")
    (type_parameter
      (type [(identifier) @rel.target              ; scalar:  Mapped[Post]
             (subscript                            ; collection: Mapped[List[Post]]
               value: (identifier) @rel.container
               subscript: (type (identifier) @rel.target))]))))
```

This gives us, per-file, a populated mini-ModelGraph for the classes defined in that file. **Promotes SA-N1-002** (joinedload on collection) from confidence 0.70 → 0.95 because we now *know* cardinality. **Promotes SA-LAZY-008** (dynamic-relationship + `len()`) similarly.

Caveat: forward-reference strings (`Mapped["Post"]` where `Post` is defined in another file) require either v2 cross-file lookup or an in-file fallback to "assume the class exists and is a Model". For v1, in-file is enough — most real codebases declare relationships next to the model class.

## F — Alembic ordering is trivial AST traversal, not data-flow

Worth being explicit: Alembic migration safety rules look like data-flow problems but aren't.

```python
def upgrade():
    op.add_column("users", sa.Column("email", sa.String(), nullable=True))   # ok
    op.execute("UPDATE users SET email = ''")                                # backfill
    op.alter_column("users", "email", nullable=False)                        # ok b/c backfill above
```

To prove `AL-NULL-002` (`alter_column(nullable=False)` without preceding backfill), we don't need a CFG. We need **statement-order traversal of the function body**:

```rust
struct AlembicState {
    added_nullable: HashMap<(String, String), usize>,  // (table, col) → stmt_idx
    backfilled: HashSet<(String, String)>,             // (table, col)
}

fn check_upgrade(body: &[Statement]) -> Vec<Finding> {
    let mut state = AlembicState::default();
    for (i, stmt) in body.iter().enumerate() {
        match classify(stmt) {
            OpAddColumn { table, col, nullable: true }  => state.added_nullable.insert((table, col), i);
            OpExecute(sql) if sql.contains("UPDATE")    => for (t, c) in mentioned(sql) { state.backfilled.insert((t, c)); }
            OpAlterColumn { table, col, nullable: false } if !state.backfilled.contains(&(table, col)) =>
                findings.push(...),
            _ => {}
        }
    }
    findings
}
```

Linear walk through the `function_definition` body block. Tree-sitter gives us body statements in source order. No CFG, no fixed-point iteration. ~150 lines for the full Alembic rule set.

**Caveats:**

- Conditionals (`if some_flag: op.execute(...)`) defeat the simple linear walk. v1 policy: treat `if`-branched statements as *not* preceding (conservative — may FP, won't FN). v2 can do branch-merging.
- Helper functions (`def _backfill(): ...` called from `upgrade()`) defeat the walk. v1 policy: opaque helper = "no backfill happened". v2 can inline.
- SQL inside `op.execute("UPDATE ...")` — we already have `sqlparser-rs` in the build (`Cargo.toml:59`); use it to extract `(table, column)` tuples instead of substring search.

## G — Performance budget (concrete)

The original plan handwaved performance. Pinning numbers:

| Phase | Cost per file | Total for 10K-file repo |
|---|---|---|
| tree-sitter parse (existing) | ~0.5 ms | 5 s |
| existing TAGS_QUERY pass | ~0.3 ms | 3 s |
| **NEW: ORM context walk** (only ORM files) | ~1 ms × ~10% files = 0.1 ms avg | **+1 s** |
| **NEW: rule pass** (per ORM file) | ~0.5 ms × ~10% = 0.05 ms avg | **+0.5 s** |
| **NEW: cross-file ModelGraph build (v2)** | ~10 ms one-shot | **+10 s** (v2 only) |

References:
- Tree-sitter query benchmarks: ~16 ms for a single execution on full-file traversal; queries with shallow captures are much faster ([tree-sitter discussions #1976](https://github.com/tree-sitter/tree-sitter/discussions/1976))
- Ruff parses + lints ~10K files in ~1 s on M1 — for reference; we're slower because tree-sitter is less optimized than Ruff's hand-written parser, but tree-sitter is reused across our existing pipeline

**v1 budget:** add ≤2 s to existing pipeline on 10K-file repos. **v2 budget:** add ≤15 s including cross-file resolution.

Drift's existing pipeline parallelizes parsing via [Rayon](../Cargo.toml#L39); the ORM passes inherit that parallelism for free as long as `PyOrmContext` is built inside `extract_tags_inner` (which runs in parallel).

## H — False-positive calibration: what "good" looks like

No public benchmark exists for static N+1 detection specifically. Adjacent benchmarks ([SAST FP rate comparison](https://www.mobb.ai/blog/sast-tools-false-positive-comparison)):

- Veracode: ~1% FP rate (enterprise SAST)
- Checkmarx: ~36% FP rate
- SonarQube: ~1% on OWASP Benchmark, much higher in the wild

For our class of rule (performance, not security), reasonable targets:

- **High-confidence rules** (≥0.90 confidence): target **<5%** FP rate. Examples: `DJ-N1-003` (`len(qs)` — `qs` is provably a queryset), `AL-SQLI-008` (f-string in `op.execute`), `SA-EXEC-009` (f-string in `text()`).
- **Standard rules** (0.70–0.89): target **<15%** FP rate. Examples: `DJ-N1-001` (loop iteration + related access), `SA-PERF-005` (per-row select in loop).
- **Advisory rules** (<0.70): target **<30%** FP rate; emitted as `informational` severity. Examples: `DJ-PAG-012` (deep pagination), `AL-DROP-003` (column drop).

**Calibration plan:**

1. Hand-curate a ground-truth corpus of 200 findings across 5 OSS Django/SQLAlchemy projects (suggested targets: `sentry`, `mastodon-py`, `Saleor`, `pretalx`, `airflow`). Public, large, and well-engineered — false positives are real bugs in the detector, not in the code.
2. Each finding classified as TP / FP / opinion-dependent.
3. Per-rule FP rate gated at ship time: rules above their tier's FP budget get downgraded confidence or held back from v1.

This replaces the original plan's vague "smoke test on 3 OSS projects". It's also why the revised effort estimate (§I) is 2–3 days for corpus work, not 1.5.

## I — Revised effort estimate (supersedes §7 above)

| Step | Original | Revised | Why |
|---|---|---|---|
| 1 — Skeleton | 0.5 d | 0.5 d | unchanged |
| 2 — Tree walker + binding map | 1.5 d | **3–4 d** | django-check's algorithm is ~500 LOC; chain extractor + loop ctx + prefetched-set tracking |
| 3 — Django rules | 2 d | **3–4 d** | first rules ~1d each for plumbing exercise; remaining ~2/d |
| 4 — SQLAlchemy rules | 2 d | **3–4 d** | adds `Mapped[]` annotation parsing (E above) |
| 5 — Alembic rules | 1 d | **1.5–2 d** | adds SQL extraction from `op.execute` strings |
| 6 — Report + schema | 0.5 d | 0.5 d | unchanged; **but** schema gets 3 distinct FindingKinds (not umbrella — reversing the original recommendation per the review) |
| 7 — Corpus + calibration | 1.5 d | **2–3 d** | 5 projects, 200 findings, per-rule FP-rate gating |
| **v1 total** | 9 d | **~14–18 d** | |

v2 (cross-file ModelGraph, custom managers, control-flow-sensitive bindings, async, Tortoise/Peewee): unchanged 2–3 weeks, but more credible given the v1 foundation is right-shaped.

## J — Open questions resolved by this round

The original plan's §8 questions, now with research-backed answers:

1. **Umbrella `FindingKind` or per-framework?** Per-framework — three variants (`DjangoAntipattern`, `SqlAlchemyAntipattern`, `AlembicMigration`). Rationale: §I above + the architecture-review note. (Reverses the original recommendation.)
2. **Gate by import?** Yes, in `extract_tags_inner` via `tags.imports.has_any_orm()`. §D above.
3. **Confidence threshold for inclusion?** Three tiers: high (≥0.90, <5% FP target), standard (0.70–0.89, <15%), advisory (<0.70, emitted as `informational`). §H above.
4. **Cross-file ModelGraph in v1?** No, v2. v1 ships with intraprocedural + in-file `Mapped[]` mini-graph. §A.4 above.

## K — What's still open

Things this research round did **not** resolve; will need to be settled during implementation:

- **Comprehension-scope handling.** Python's `[x.related for x in qs]` is a list comprehension, not a `for_statement`. tree-sitter-python exposes `list_comprehension` / `set_comprehension` / `dict_comprehension` / `generator_expression`. Each has a `for_in_clause`. Whether `LoopContext` semantics apply uniformly across all four is something we'll have to verify on fixtures.
- **`async for`.** `async_for_statement` in tree-sitter-python is its own node. Should behave identically for our purposes, but worth a fixture.
- **Class-body bindings.** `class UserView: queryset = User.objects.all()` — `queryset` is a class attribute, used as `self.queryset` later. Whether to model `self.X` as a binding inheriting from the class body is a v1.5 call.
- **Custom `Manager` subclasses with chainable methods.** `User.objects.active().popular()` where `active`/`popular` are custom Manager methods. v2.
- **Salsa-style incrementality.** [ty](https://astral.sh/blog/ty) uses Salsa to re-analyze only changed scopes; 80× faster than Pyright on PyTorch. drift-static-profiler is batch today, but as it grows toward IDE-grade latency, Salsa adoption is the eventual path. **Out of scope for v1/v2.**

## Additional sources (round 2)

- [django-check N+1 pass source (~1100 LOC)](https://github.com/richardhapb/django-check/blob/main/crates/django-check_semantic/src/passes/n_plus_one.rs) — reference algorithm
- [django-check ModelGraph IR](https://github.com/richardhapb/django-check/blob/main/crates/django-check_semantic/src/ir/model.rs) — data shape
- [Ruff `ruff_python_semantic` crate](https://github.com/astral-sh/ruff/tree/main/crates/ruff_python_semantic) — Binding/Scope vocabulary
- [Stack graphs (archived)](https://github.com/github/stack-graphs) — name-resolution framework we decided **against**
- [Stack graphs paper (Creager 2022)](https://arxiv.org/pdf/2211.01224) — algorithmic background
- [Introducing stack graphs (GitHub Blog)](https://github.blog/open-source/introducing-stack-graphs/)
- [Astral ty: incremental Python type checker](https://astral.sh/blog/ty) — Salsa-based incrementality reference
- [Astral ty (deepwiki)](https://deepwiki.com/astral-sh/ruff/6-red-knot-type-checker)
- [SQLAlchemy 2.0 Basic Relationship Patterns](https://docs.sqlalchemy.org/en/20/orm/basic_relationships.html) — `Mapped[List[X]]` vs `Mapped[X]`
- [Pyflakes checker source](https://github.com/PyCQA/pyflakes/blob/main/pyflakes/checker.py) — older but battle-tested scope/binding model
- [SAST FP rate comparison (Mobb)](https://www.mobb.ai/blog/sast-tools-false-positive-comparison) — adjacent FP-rate benchmarks
- [Tree-sitter query performance discussion](https://github.com/tree-sitter/tree-sitter/discussions/1976)

---

# Part II — TypeScript / JavaScript ORM Static Analysis

Extends Part I to cover JS-ecosystem ORMs. Same architectural shape (per-file context + per-ORM rule catalog + per-framework `FindingKind`), with framework-specific tweaks.

Target layout:

```
src/orm/
  mod.rs              — shared trait/scaffolding (Part I §2.3 OrmRule, etc.)
  python/
    mod.rs            — PyOrmContext, binding map, loop tracker
    django.rs
    sqlalchemy.rs
    alembic.rs
  ts/                 — NEW
    mod.rs            — TsOrmContext, binding map, decorator tracker
    prisma.rs         — uses `psl` crate for schema.prisma + tree-sitter for client.ts
    drizzle.rs        — tree-sitter-only; schema is TS
    typeorm.rs        — decorator-driven; tree-sitter
    sequelize.rs      — most-dynamic; least-precise rules
    mongoose.rs       — populate-chain analysis
```

The existing [src/languages/typescript.rs](../src/languages/typescript.rs) already exposes function/method/class definitions, calls with receiver, imports, and SQL sinks for `pg`, `mysql2`, `Knex`, Prisma `$queryRaw`, TypeORM `dataSource.query`. We extend (carefully — see Part I §D for the same lesson on tree-sitter queries vs walks) only with **decorator captures**.

---

## L — Why JS/TS ORMs need a different shape per family

| ORM | Schema lives in | Cross-file model graph? | N+1 mechanism | Static-analysis difficulty |
|---|---|---|---|---|
| **Prisma** | `schema.prisma` DSL | **Free** — official Rust parser (`psl`) gives full graph | Fluent API; missing `include`/`select`; deep pagination | **Easy** (graph is gift-wrapped) |
| **Drizzle** | TS code (`pgTable(...)`, `relations(...)`) | Inferable from same file | Manual joins + cartesian; not using `with` | **Medium** (parse TS declarations) |
| **TypeORM** | TS decorators (`@Entity`, `@OneToMany`) | Inferable from decorators | `@OneToMany({eager: true})`; `leftJoinAndSelect` multi-collection; lazy `Promise<Entity>` in loop | **Medium** (decorator-heavy) |
| **Sequelize** | TS/JS classes + `init()` calls | Inferable from `init()` arguments | Multiple `include: [{model}]` with `hasMany` → cartesian | **Hard** (highly dynamic) |
| **Mongoose** | TS/JS `Schema(...)` calls | Inferable, but document-store semantics differ | `.populate('x').populate('y')` chain; non-lean serialization | **Medium** (populate chain is clear shape) |

**Implication**: unlike Python where three frameworks share an inference engine, the JS side wants **per-ORM model extractors** because the schema shape itself differs.

---

## M — Prisma is the easy one (use the official parser)

Prisma is the only ORM in this whole plan with an **official Rust parser**: [`psl`](https://prisma.github.io/prisma-engines/doc/psl/) from prisma-engines. Public API:

```rust
use psl::parse_schema;
let validated_schema: ValidatedSchema = parse_schema(source_text)?;
// validated_schema.db gives a fully-resolved parser_database::ParserDatabase
// with models, fields, relations, indexes, datasource, generators
```

This is **the** Prisma source of truth — it's what Prisma Client codegen, Prisma Migrate, and Prisma Studio all consume. Using it means our schema interpretation is byte-identical to Prisma's. Free 0.95-confidence model graph.

### M.1 Project detection and schema loading

```
on walker init:
  for each candidate schema path in: [
      "schema.prisma",
      "prisma/schema.prisma",
      "prisma/schema/*.prisma",   // multi-file schema (Prisma 5.x preview, stable in 6.x)
  ]:
    if exists: load + psl::parse_schema → PrismaModelGraph
    cache one graph per workspace root
```

### M.2 Prisma client analysis (TS side, tree-sitter)

The Prisma client invocations live in `.ts` files: `prisma.user.findMany(...)`, `prisma.user.findUnique(...).posts()`, etc. We tag them via the existing TS captures + a binding map that recognizes:

- `import { PrismaClient } from "@prisma/client"` — gate
- `const prisma = new PrismaClient()` — anchor binding `prisma: PrismaClient`
- `prisma.<model>.<method>(...)` — resolve `<model>` against `PrismaModelGraph`
- Fluent calls: `prisma.user.findUnique({where}).posts()` — the second `.posts()` is a *new* DB call

### M.3 Prisma rules (v1: 8 rules)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `PR-N1-001` | Loop over `findMany()` accessing relation not in `include`/`select` | for-of over result of `findMany` ∧ `row.<rel>` access ∧ `<rel>` not in the `include`/`select` keys of the call | 0.90 |
| `PR-N1-002` | Fluent API: `findUnique(...).<rel>()` in a loop | two-step chain on `findUnique` whose first call's result is iterated, OR fluent chain inside a `for`/`map` body | 0.85 |
| `PR-PAG-003` | `findMany({ skip: N, take })` with large or unbounded `skip` | numeric literal `>1000` in `skip` kwarg — cursor pagination preferred | 0.85 |
| `PR-COUNT-004` | `(await prisma.user.findMany()).length` instead of `prisma.user.count()` | `.length` accessed on the awaited result of `findMany` | 0.95 |
| `PR-MIX-005` | `include` and `select` at same level — Prisma rejects at runtime | object literal contains both keys | 0.99 |
| `PR-TAKE-006` | `include: { posts: { take: N } }` — `take` is per-parent (surprising) | nested `take` inside `include` value — emit *informational*, not warning | 0.50 |
| `PR-CACHE-007` | Mutation followed by `cacheStrategy.tags` invalidation missing | only if Accelerate detected via import — defer to v2 | — |
| `PR-RAW-008` | `prisma.$queryRawUnsafe(\`...${x}...\`)` — SQLi | template-string interpolation in `$queryRawUnsafe`/`$executeRawUnsafe` first arg | 0.99 |

**Rule plumbing notes**:
- `PR-N1-001` and `PR-N1-002` benefit hugely from `PrismaModelGraph` — we know which keys in `include` are valid relations vs typos
- `PR-RAW-008` is the highest-precision rule; ship it first as a smoke test
- Prisma's existing [`eslint-plugin-prisma`](https://github.com/lucas-gregoire/eslint-plugin-prisma) covers schema-side conventions only — no overlap with our rules

---

## N — Drizzle: schema is TS, so tree-sitter sees everything

Drizzle's whole proposition is "no codegen, schema is your TypeScript". We parse it as TS:

```typescript
// schema.ts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
});
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
});
// v1 syntax (still very common):
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));
```

### N.1 Schema extraction via tree-sitter

```scheme
; Capture pgTable / mysqlTable / sqliteTable declarations
(variable_declarator
  name: (identifier) @drizzle.table_var
  value: (call_expression
    function: (identifier) @drizzle.table_fn (#match? @drizzle.table_fn "^(pgTable|mysqlTable|sqliteTable)$")
    arguments: (arguments
      (string (string_fragment) @drizzle.table_name)
      (object) @drizzle.columns)))

; Capture relations() declarations (v1)
(call_expression
  function: (identifier) @drizzle.rel_fn (#eq? @drizzle.rel_fn "relations")
  arguments: (arguments
    (identifier) @drizzle.rel_subject
    (arrow_function body: (_) @drizzle.rel_body)))

; defineRelations (v2)
(call_expression
  function: (identifier) @drizzle.rel_fn2 (#eq? @drizzle.rel_fn2 "defineRelations")
  arguments: (arguments (object) @drizzle.rel_v2_obj))
```

Build a per-file `DrizzleSchema { tables: Map<&str, TableDef>, relations: Map<&str, Vec<Rel>> }`. Cross-file: aggregate during the existing per-tree pass.

### N.2 Drizzle rules (v1: 7 rules)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `DR-DEL-001` | `.delete(table)` without `.where(...)` (port from Drizzle's own ESLint plugin) | call chain `.delete(...)` not followed by `.where(...)` | 0.98 |
| `DR-UPD-002` | `.update(table).set(...)` without `.where(...)` (port from Drizzle's ESLint plugin) | similar | 0.98 |
| `DR-N1-003` | Loop over `db.select().from(t).all()` then per-row `db.select()...` | manual select in a loop body | 0.85 |
| `DR-N1-004` | Loop over `db.query.X.findMany()` not using `with: {}` then accessing relation | for-of over findMany ∧ row.rel access ∧ no `with` clause | 0.80 |
| `DR-JOIN-005` | Multiple `.leftJoin(...)` to hasMany tables in single `.select()` chain | core API with ≥2 hasMany joins — emits cartesian | 0.75 |
| `DR-REL-006` | Using `with: { x: true }` where `x` is not declared in `relations(...)` | `with` key not in `DrizzleSchema.relations` | 0.95 |
| `DR-RAW-007` | `sql\`SELECT ... ${userVar}\`` raw template with unsanitized interpolation | `sql\`\`` template tag with identifier interpolation | 0.85 |

**Rules `DR-DEL-001` and `DR-UPD-002` are direct ports** of [Drizzle's own ESLint plugin](https://orm.drizzle.team/docs/eslint-plugin) — same rule, same semantics. We ship them in Rust for parity. Drizzle dev team explicitly says "no built-in N+1" — we're filling a gap.

---

## O — TypeORM: decorator-heavy, needs decorator captures

TypeORM relies on TS decorators for the entire model graph. Adding decorator captures to `src/languages/typescript.rs` is necessary anyway for any decorator-based detection.

### O.1 New TS captures for decorators

```scheme
; Captures @Entity(), @OneToMany(...), @ManyToOne(...), @Column(...), @PrimaryGeneratedColumn()
(decorator
  (call_expression
    function: (identifier) @dec.name
    arguments: (arguments) @dec.args)) @dec.site

; Decorator-without-args: @Entity, @Index
(decorator
  (identifier) @dec.name) @dec.site

; Class field with decorator (TypeORM field-level annotations)
(public_field_definition
  (decorator)+ @dec.field_decs
  name: (property_identifier) @dec.field_name
  type: (type_annotation)? @dec.field_type) @dec.field
```

Tree-sitter-typescript supports decorators natively — [grammar](https://github.com/tree-sitter/tree-sitter-typescript/blob/master/common/define-grammar.js). The TSX dialect uses the same shape.

### O.2 TypeORM rules (v1: 8 rules)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `TO-EAGER-001` | `@OneToMany({ eager: true })` decorator | object literal arg to `@OneToMany`/`@ManyToMany` contains `eager: true` | 0.95 |
| `TO-CART-002` | `qb.leftJoinAndSelect("a.coll1", "x").leftJoinAndSelect("a.coll2", "y")` where both are hasMany | two+ chained `leftJoinAndSelect` calls — needs `@OneToMany` decorator knowledge | 0.80 |
| `TO-CART-003` | `repo.find({ relations: ["coll1", "coll2"] })` where both are hasMany | array literal in `relations` key, both resolve to `@OneToMany` decorators | 0.80 |
| `TO-N1-004` | `Promise<Entity>` lazy relation accessed in a loop | type annotation `Promise<X>` on field ∧ `await row.field` in loop | 0.85 |
| `TO-COUNT-005` | `(await repo.find()).length` instead of `repo.count()` | `.length` accessed on awaited `repo.find()` result | 0.95 |
| `TO-QB-006` | QueryBuilder with no `.where()` followed by `.delete()` / `.update()` | similar to Drizzle DEL/UPD rules but for TypeORM | 0.95 |
| `TO-RAW-007` | `dataSource.query(\`SELECT ... ${x}\`)` with interpolation | template-string interpolation in `query`/`raw` | 0.99 |
| `TO-TYPE-008` | Decorator type vs TS type mismatch (`@Column("int") field: string`) | port from [eslint-plugin-typeorm-typescript](https://github.com/daniel7grant/eslint-plugin-typeorm-typescript) | 0.90 |

**Note**: `TO-TYPE-008` overlaps with the existing ESLint plugin. We port it so users running drift only get the coverage; the rule fires only if the TS types and decorator types differ syntactically (no need to invoke `tsc`).

---

## P — Sequelize: hardest to analyze, ship only high-precision rules

Sequelize models are defined imperatively: `User.init({...}, {sequelize})` then `User.hasMany(Post)`. Most things are runtime-configurable, which means our model graph is approximate.

### P.1 Sequelize rules (v1: 5 rules — quality over quantity)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `SQ-CART-001` | `findAll({ include: [Post, Comment] })` where both are `hasMany` | array literal in `include` ∧ both elements resolve to `hasMany` declarations via `Model.hasMany(...)` calls | 0.65 |
| `SQ-CART-002` | Missing `separate: true` on nested `hasMany` include with `limit` | `include: [{model, limit}]` where `model` is `hasMany`-associated | 0.80 |
| `SQ-RAW-003` | `sequelize.query(\`...${x}...\`)` with template interpolation | template-string interpolation in `sequelize.query`/`literal` first arg | 0.99 |
| `SQ-CNT-004` | `(await Model.findAll()).length` instead of `Model.count()` | similar pattern | 0.95 |
| `SQ-LOOP-005` | `Model.create(...)` in a for-loop without `bulkCreate` | call to `Model.create` ∧ in_loop | 0.85 |

We **deliberately skip**:
- N+1 on lazy associations (Sequelize doesn't have proxies; relations are explicit calls — hard to confuse with regular property access)
- `raw: true` vs hydrated — pre-existing behavior, not an antipattern

---

## Q — Mongoose: populate-chain analysis

Mongoose is a special case — it's a document-store ORM, but the N+1 vector is identical to relational ORMs (populate = secondary query per path).

### Q.1 Mongoose rules (v1: 6 rules)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `MG-POP-001` | `.populate('a').populate('b')` — emits 2 secondary queries serially | chained `.populate()` calls; each is one round-trip | 0.95 |
| `MG-POP-002` | `.populate({ path, populate: { path: ... } })` — depth >1 = N queries | nested `populate` in option object | 0.85 |
| `MG-LEAN-003` | Query returned to JSON without `.lean()` | result of `Model.find()` passed to `JSON.stringify` or response.json without `.lean()` in chain | 0.70 |
| `MG-CURS-004` | `Model.find().populate('x').cursor()` — populate breaks cursor batching | `.populate(...)` followed by `.cursor(...)` in same chain | 0.95 |
| `MG-AUTO-005` | `mongoose-autopopulate` plugin imported — hidden N+1 | import detection only — emit informational | 0.50 |
| `MG-COUNT-006` | `(await Model.find()).length` instead of `Model.countDocuments()` | same pattern as PR-COUNT-004 / TO-COUNT-005 | 0.95 |

**`MG-COUNT-006`, `PR-COUNT-004`, `TO-COUNT-005`, `SQ-CNT-004`, `DJ-N1-003`, `SA-PERF-004`** are the **same rule** at the conceptual level: "loaded N entities to compute their count". Tempting to extract a cross-framework `count-by-length` rule. **Don't.** Framework-specific message text + remediation matters for UX (Prisma users want to know about `.count()`, Mongoose users about `.countDocuments()`). Keep them separate; have them share a helper.

---

## R — TS-specific context model

Mirrors `PyOrmContext` from Part I §2.2 with TS-specific binding kinds:

```rust
pub struct TsOrmContext<'a> {
    pub file: &'a str,
    pub imports: ImportMap,            // same shape as Python
    pub bindings: BindingMap,
    pub for_loops: Vec<LoopRange>,
    pub array_method_callbacks: Vec<CallbackRange>,  // .map / .forEach / .filter bodies
    pub decorators: Vec<DecoratorSite<'a>>,          // NEW for TS
    pub class_defs: Vec<TsClassDef<'a>>,
    pub prisma_schema: Option<&'a PrismaModelGraph>, // populated if project has schema.prisma
    pub drizzle_schema: Option<DrizzleSchema<'a>>,   // populated per-file
}

pub enum TsBindingKind<'a> {
    PrismaClient,                                            // const prisma = new PrismaClient()
    PrismaModelQuery { model: &'a str },                     // prisma.user
    PrismaQueryResult { model: &'a str, eager: Vec<&'a str> },
    TypeOrmEntity { class: &'a str },                        // class User { @Entity }
    TypeOrmRepository { entity: &'a str },                   // userRepo: Repository<User>
    TypeOrmQueryBuilder { entity: &'a str },
    DrizzleTable { name: &'a str },                          // const users = pgTable(...)
    DrizzleQueryResult { table: &'a str, with: Vec<&'a str> },
    SequelizeModel { name: &'a str },                        // const User = sequelize.define(...)
    MongooseModel { name: &'a str },                         // mongoose.model('User', schema)
    MongooseQuery,                                           // Model.find()
    Unknown,
}
```

**Key TS-specific concern**: array methods (`.map`, `.forEach`, `.filter`, `.reduce`) are JS's equivalent of for-loops for our purposes. A callback inside `.map((u) => ...)` is "in a loop" semantically. The `array_method_callbacks` field tracks these ranges separately, but rules treat them the same as `for_loops` when checking "is this call in iteration context?".

This is **distinct from Python** (where comprehensions exist but are less common than `.map` is in TS) — Python plan §K mentions comprehensions as v1.5; for TS, array-method callbacks are **v1 required** because real TS code uses them for everything.

---

## S — Path-gating per ORM (same idea as Python §D)

Cheap upfront detection so unused ORMs cost nothing:

```rust
pub fn detect_frameworks(imports: &ImportMap) -> FrameworkSet {
    let mut s = FrameworkSet::empty();
    if imports.has_any_of(&["@prisma/client", "@prisma/extension-accelerate"]) { s.add(Prisma); }
    if imports.has_starting_with("drizzle-orm")                                 { s.add(Drizzle); }
    if imports.has_any_of(&["typeorm"])                                          { s.add(TypeOrm); }
    if imports.has_any_of(&["sequelize"])                                        { s.add(Sequelize); }
    if imports.has_any_of(&["mongoose"])                                         { s.add(Mongoose); }
    s
}
```

A file with no ORM imports → `TsOrmContext` not built → zero cost. Same gate as Python.

---

## T — Cargo additions for TS/JS support

```toml
# Cargo.toml — Part I needed no new deps. Part II needs one.

[dependencies]
# Official Prisma schema parser (BSD-3 + Apache-2.0). Re-exports
# parser_database, schema_ast, diagnostics. Used by `orm/ts/prisma.rs`
# to build `PrismaModelGraph` from `schema.prisma` files in the
# walked project root.
psl = "0.1"   # version pinning: track prisma-engines releases
```

**Risk to surface**: `psl` is `0.x` and lives in the `prisma-engines` workspace. It's the same code Prisma itself ships, so reliability is fine, but breaking changes between minor versions are possible. Pin tightly and bump deliberately. Alternative if breakage is too painful: switch to [`@mrleebo/prisma-ast`](https://github.com/MrLeebo/prisma-ast) by calling it via `node -e` — ugly, slow, but framework-stable. **Recommend `psl` for v1**; revisit if it bites.

No new tree-sitter grammars — `tree-sitter-typescript` (already in `Cargo.toml:20`) and `tree-sitter-javascript` (already at `Cargo.toml:21`) cover everything except `.prisma` files, which `psl` parses.

---

## U — TS-side rule count + revised effort estimate

| Module | Rules | Effort |
|---|---|---|
| `orm/ts/mod.rs` + TsOrmContext scaffolding | — | 2 d |
| TS captures (decorators, etc.) | — | 1 d |
| `prisma.rs` (8 rules + psl integration) | 8 | 3 d |
| `drizzle.rs` (7 rules + schema extraction) | 7 | 2.5 d |
| `typeorm.rs` (8 rules + decorator walk) | 8 | 3 d |
| `sequelize.rs` (5 rules) | 5 | 1.5 d |
| `mongoose.rs` (6 rules) | 6 | 2 d |
| Fixtures (1 positive + 2 negative per rule × 34 rules) | — | 2 d |
| Corpus calibration (5 OSS TS projects: Cal.com, Plane, Trigger.dev, Twenty, Documenso) | — | 2 d |
| **Part II total** | **34** | **~19 d** |

Combined with Part I revised estimate (~14–18 d for 30 Python rules):

- **Python v1 only**: 14–18 days, 30 rules
- **Python + TS v1**: ~33–37 days, 64 rules
- **v2 (cross-file ModelGraph, custom managers, async, comprehensions, control-flow-sensitive bindings)**: +2–3 weeks on top

If shipping incrementally, recommended order:

1. **Python first** (14–18 d) — established prior art (django-check), simpler grammar, faster iteration
2. **Prisma next** (3 d) — easy win because `psl` does the heavy lifting; also the most-asked-for ORM in 2026
3. **Drizzle + TypeORM** (5.5 d) — both rapidly growing; shared decorator-capture work
4. **Mongoose + Sequelize** (3.5 d) — long-tail; ship last

---

## V — TS/JS open questions

1. **Project root detection for Prisma**: how do we know which `schema.prisma` belongs to the file we're analyzing in a monorepo? Workspace conventions vary. v1: walk up from each analyzed file looking for `schema.prisma`; cache the first hit per directory. v2: respect `nx.json` / `pnpm-workspace.yaml`.

2. **JSX/TSX files**: server-component code calling Prisma directly inside JSX expressions is now common (Next.js App Router). The TSX grammar variant of tree-sitter-typescript needs the same captures. v1: add TSX to `language_for` if not already.

3. **Lazy promise-chain detection**: TypeORM's lazy relations (`Promise<Post>`) are accessed via `await user.posts`. Detecting this requires recognizing `Promise<X>` in type annotations. Tree-sitter captures type annotations as `generic_type`; we extract the inner identifier. Doable in v1.

4. **Sequelize models via `class X extends Model`**: ES6-class-style Sequelize models (`class User extends Model {}`) require following `User.init(...)` calls to learn the schema. v1 supports the class style only if `.init()` is in the same file. Cross-file model split: v2.

5. **Mongoose Schema-instance methods**: `userSchema.methods.fullName = function() {...}` — these are JS, not type-level. They don't affect our rules but are worth noting for context.

---

## W — Cross-language sharing of rule infrastructure

Both Part I (`orm/python/`) and Part II (`orm/ts/`) sit under `orm/mod.rs`. Shared concepts:

- `OrmRule` trait (Part I §2.3)
- `MatchHit` shape
- `FindingKind` variants — **revised final list**: `DjangoAntipattern`, `SqlAlchemyAntipattern`, `AlembicMigration`, `PrismaAntipattern`, `DrizzleAntipattern`, `TypeOrmAntipattern`, `SequelizeAntipattern`, `MongooseAntipattern`. Eight variants total — manageable.
- Loop / iteration context detection: language-specific implementation, but consumed via shared trait `IsInIteration` so rules don't need to know the host language

Rules that have direct cross-language analogs (e.g., `count-by-length`) are **separate per framework** but share a helper from `orm/mod.rs`:

```rust
// orm/mod.rs
pub fn match_length_on_query_result<'a>(
    ctx: &dyn OrmContext,
    receiver_pattern: ReceiverPattern,
    bad_method: &str,   // "find", "findMany", "findAll"
    good_method: &str,  // ".count()", ".countDocuments()", etc.
) -> Vec<MatchHit> { ... }
```

This shaves ~30% off the duplication that would otherwise exist across 5 nearly-identical count-by-length rules.

---

## X — Additional sources (round 3)

- [Prisma `psl` Rust crate (official)](https://prisma.github.io/prisma-engines/doc/psl/) — schema parser
- [Prisma `schema_ast` crate](https://prisma.github.io/prisma-engines/doc/schema_ast/index.html) — raw AST module re-exported by psl
- [Prisma Client API reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference)
- [Prisma Query optimization guide](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance)
- [Prisma fluent API N+1 issue #1984](https://github.com/prisma/prisma/issues/1984)
- [Prisma findMany batching discussion #16481](https://github.com/prisma/prisma/discussions/16481)
- [Drizzle ESLint Plugin docs](https://orm.drizzle.team/docs/eslint-plugin) — the two existing rules we port
- [Drizzle Relations v2](https://orm.drizzle.team/docs/relations-v2)
- [Drizzle Query Data](https://orm.drizzle.team/docs/data-querying)
- [Drizzle Joins](https://orm.drizzle.team/docs/joins)
- [Drizzle Schema declaration](https://orm.drizzle.team/docs/sql-schema-declaration)
- [TypeORM Performance optimization](https://typeorm.io/docs/advanced-topics/performance-optimizing/)
- [TypeORM Relations FAQ](https://typeorm.io/docs/relations/relations-faq/)
- [eslint-plugin-typeorm-typescript](https://github.com/daniel7grant/eslint-plugin-typeorm-typescript) — type-consistency rules we port
- [Sequelize Eager Loading docs](https://sequelize.org/docs/v6/advanced-association-concepts/eager-loading/) — separate vs subquery
- [Sequelize SELECT in depth](https://sequelize.org/docs/v7/querying/select-in-depth/)
- [Mongoose Populate docs](https://mongoosejs.com/docs/populate.html)
- [Mongoose Lean tutorial](https://mongoosejs.com/docs/tutorials/lean.html)
- [tree-sitter-typescript grammar](https://github.com/tree-sitter/tree-sitter-typescript) — decorator + class member shapes
- [ts-morph](https://github.com/dsherret/ts-morph) — alternative TS analysis approach (not used; reference only)
- [typescript-eslint scope-manager](https://typescript-eslint.io/packages/scope-manager/) — reference for scope analysis
- [@mrleebo/prisma-ast](https://github.com/MrLeebo/prisma-ast) — Node-side fallback if `psl` becomes unusable
- [tree-sitter-prisma-io crate](https://crates.io/crates/tree-sitter-prisma-io) — alternative if we wanted tree-sitter for `.prisma` instead of `psl`
- [eslint-plugin-prisma (lucas-gregoire)](https://github.com/lucas-gregoire/eslint-plugin-prisma) — existing Prisma rule set; checked for non-overlap

---

# Part III — JVM (Java/Kotlin/Scala) + Go + Rust ORM Static Analysis

The third research round covers the remaining language ecosystems drift-static-profiler already parses. Each language has tree-sitter coverage in [src/languages/](../src/languages/) — verified during this round. Notably [scala.rs](../src/languages/scala.rs#L19) already anticipates this work in a comment: *"Scala embedded SQL via Slick/Doobie/Quill is usually a typed DSL, not a string literal; covered by ORM-lint later, not by the inline-SQL pipeline."*

Target layout (mirrors Parts I + II):

```
src/orm/
  mod.rs              — shared scaffolding
  python/             — Part I
  ts/                 — Part II
  jvm/                — NEW; one orm rule catalog per framework
    mod.rs            — shared JpaContext (used by Java + Kotlin + Scala when Hibernate is detected)
    jpa.rs            — Hibernate / JPA annotations (used by all 3 JVM langs)
    spring_data.rs    — Spring Data JPA repository patterns
    jooq.rs           — jOOQ DSL (Java/Kotlin)
    mybatis.rs        — MyBatis XML + interface mappers
    exposed.rs        — JetBrains Exposed (Kotlin)
    ktorm.rs          — Ktorm sequence APIs (Kotlin)
    slick.rs          — Scala Slick
    doobie.rs         — Scala Doobie
    quill.rs          — Scala/Kotlin Quill macro-based
  go/                 — NEW
    mod.rs            — GoOrmContext
    gorm.rs
    ent.rs
    bun.rs
    sqlc.rs           — SQL-only, mostly hands off to existing sql_lint.rs
  rs/                 — NEW
    mod.rs            — RustOrmContext; small surface b/c compile-time ORMs catch most things
    diesel.rs
    sqlx.rs           — hands off to existing sql_lint.rs for SQL content
    seaorm.rs
```

---

## Y — Why JVM frameworks share infrastructure (and why the others don't)

The three JVM languages — Java, Kotlin, Scala — share **the JVM runtime, the JPA spec, and roughly half their ORM toolchains**. A typical Kotlin Spring Boot service uses Hibernate via JPA annotations; a typical Scala Play app might use Slick; but Kotlin + Hibernate is at least as common as Kotlin + Exposed.

| Framework | Java | Kotlin | Scala |
|---|---|---|---|
| Hibernate / JPA (annotations) | **primary** | **primary** | rare |
| Spring Data JPA | **primary** | **primary** | rare |
| jOOQ | **primary** | common | common |
| MyBatis | common | rare | rare |
| Exposed | — | **primary** | — |
| Ktorm | — | **primary** | — |
| Slick | — | — | **primary** |
| Doobie | — | — | **primary** |
| Quill | — | common | **primary** |

**Implication**: `jpa.rs`, `spring_data.rs`, and `jooq.rs` get **shared across Java/Kotlin/Scala**. The Hibernate annotation `@OneToMany(fetch=FetchType.EAGER)` looks essentially identical in tree-sitter Java's `marker_annotation` / `annotation` nodes and Kotlin's `annotation` / `user_type` nodes — capture once, match against the same `JpaRule` catalog. The language-specific layer only handles the captures; the rules are FQN-keyed (`jakarta.persistence.OneToMany`) and language-agnostic.

Go and Rust don't share this way — each ORM stands alone — so their layouts are flatter.

---

## Z — JVM / JPA: where the biggest user base lives

Hibernate + JPA + Spring Data is *the* most-deployed ORM stack in the industry. No mature open-source N+1 detector for it exists (SonarQube has [S2077](https://rules.sonarsource.com/java/tag/hibernate/rspec-2077/) for SQLi-shaped issues; [JPA Buddy](https://www.jpa-buddy.com/) is closed-source commercial; [AppMap](https://appmap.io/blog/2021/10/04/detecting_n_plus_one_for_spring_applications/) is runtime). Static N+1 detection for JVM is a real gap.

### Z.1 Tree-sitter capture additions for Java/Kotlin/Scala

All three need **annotation captures**. Currently [java.rs](../src/languages/java.rs), [kotlin.rs](../src/languages/kotlin.rs), [scala.rs](../src/languages/scala.rs) capture symbols and calls but not annotations.

```scheme
; Java — marker (@Entity), normal (@OneToMany(...)), single-element (@Cache(...))
(marker_annotation
  name: (identifier) @ann.name) @ann.site
(annotation
  name: (identifier) @ann.name
  arguments: (annotation_argument_list)? @ann.args) @ann.site
(field_declaration
  (modifiers (_)* @field.mods)
  type: (_) @field.type
  declarator: (variable_declarator name: (identifier) @field.name)) @field.decl

; Kotlin — uses `annotation` node with `user_type`
(annotation
  (user_type (type_identifier) @ann.name)
  (value_arguments)? @ann.args) @ann.site

; Scala — uses `annotation` with `simple_type`
(annotation
  (simple_type (type_identifier) @ann.name)
  (arguments)? @ann.args) @ann.site
```

The capture *names* are normalized across languages (`@ann.name`, `@ann.args`) so the rule layer doesn't care. Each per-language module owns the grammar specifics.

### Z.2 The `JpaContext` shared structure

```rust
pub struct JpaContext<'a> {
    pub host_lang: Language,       // Java / Kotlin / Scala
    pub imports: ImportMap,
    pub entities: HashMap<&'a str, EntityDef<'a>>,  // class FQN → entity facts
    pub repositories: HashMap<&'a str, RepoDef<'a>>,  // Spring Data repo interfaces
    pub query_calls: Vec<QueryCallSite<'a>>,
    pub for_loops: Vec<LoopRange>,
    pub stream_chains: Vec<StreamChain>,  // .stream().filter().map() ranges
}

pub struct EntityDef<'a> {
    pub class_name: &'a str,
    pub file: &'a str,
    pub fields: Vec<EntityField<'a>>,
}
pub struct EntityField<'a> {
    pub name: &'a str,
    pub type_name: &'a str,                  // "List<Order>" / "Order" / "Set<Tag>"
    pub annotations: Vec<JpaAnnotation<'a>>, // @OneToMany, @ManyToOne, @Cache, etc.
}
pub enum JpaAnnotation<'a> {
    Entity, Table { name: Option<&'a str> },
    OneToMany   { fetch: FetchType, mapped_by: Option<&'a str> },
    ManyToOne   { fetch: FetchType },
    OneToOne    { fetch: FetchType },
    ManyToMany  { fetch: FetchType },
    Fetch       { mode: FetchMode },       // org.hibernate.annotations.Fetch
    BatchSize   { size: i32 },             // org.hibernate.annotations.BatchSize
    Cache       { usage: CacheUsage },
    EntityGraph { attributes: Vec<&'a str> },
    Other(&'a str),
}
```

**Stream chains are JVM's equivalent of TS array-method callbacks** (Part II §R). `users.stream().filter(...).map(u -> u.getOrders())` is iteration with a callback body — same lambda-in-loop hazard as `arr.map(x => prisma.posts(...))`.

### Z.3 Hibernate / JPA rules (shared across Java/Kotlin/Scala — 12 rules)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `JPA-EAGER-001` | `@OneToMany(fetch=FetchType.EAGER)` or `@ManyToMany(fetch=EAGER)` | annotation site whose `fetch` arg is `EAGER` and host is a collection-typed field | 0.98 |
| `JPA-EAGER-002` | `@ManyToOne` defaulting to EAGER (the spec default) — flagged advisory | `@ManyToOne` with no explicit `fetch` argument | 0.50 (advisory; opinion-dependent — Vlad Mihalcea, Thorben Janssen, JPA spec authors all consider this an antipattern but the spec defaults to EAGER) |
| `JPA-BAG-003` | Multiple `List<Entity>` collections in same `@EntityGraph` or `JOIN FETCH` query | JPQL string contains 2+ `JOIN FETCH` over List fields → `MultipleBagFetchException` | 0.95 |
| `JPA-N1-004` | `findById` in a loop | call site `repo.findById(...)` ∧ `in_loop` ∧ repo extends `JpaRepository` — should use `findAllById` | 0.90 |
| `JPA-N1-005` | `findAll().stream().filter(...)` instead of method-name query | `findAll()` followed by `.stream().filter(...)` — should be `findByX(...)` | 0.85 |
| `JPA-N1-006` | Lazy collection accessed in a stream/loop without `@EntityGraph` or `JOIN FETCH` | `for (User u : users)` ∧ `u.getOrders()` ∧ `Orders` is `@OneToMany(LAZY)` ∧ enclosing query has no `@EntityGraph` | 0.80 |
| `JPA-PROJ-007` | `entityManager.find(User.class, id)` only used to read 1–2 fields | full-entity fetch followed only by 1–2 getter calls in same scope; should be DTO/JPQL projection | 0.55 |
| `JPA-COUNT-008` | `repo.findAll().size()` instead of `repo.count()` | call chain `.findAll().size()` | 0.95 |
| `JPA-FETCH-009` | `@Fetch(FetchMode.SELECT)` on a collection without `@BatchSize` | both annotations on same field; `@Fetch(SELECT)` alone = pure N+1 | 0.90 |
| `JPA-SAVE-010` | `repo.save(entity)` inside a loop without `saveAll` / batched flush | call `repo.save(...)` ∧ in_loop ∧ no `saveAll` in same fn | 0.85 |
| `JPA-EG-011` | `@EntityGraph(attributePaths=...)` referencing non-existent field | path doesn't match any field in entity's `EntityDef` | 0.90 |
| `JPA-CACHE-012` | `@Cache(usage=READ_WRITE)` on entity with frequent writes | static heuristic: count `repo.save` / `repo.delete` references to the entity; warn if >threshold | 0.45 (advisory) |

The rules are framework-agnostic at the rule-engine level — `JpaContext` is identical whether the host language is Java, Kotlin, or Scala (Scala JPA usage is rare but possible). Per-language modules only translate annotations into the shared `JpaAnnotation` enum.

### Z.4 Spring Data JPA rules (5 rules, builds on JPA context)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `SD-FIND-001` | `findById` in loop — repeat from [JPA-N1-004 above] but with Spring-specific remediation pointing at `findAllById` | same shape | 0.90 |
| `SD-PROJ-002` | Open (SpEL-based) projection — defeats fetch optimization | interface projection with `@Value("#{target.x + target.y}")` | 0.85 |
| `SD-PAGE-003` | `Page<T>` return type when only forward iteration is used | `Pageable` arg + no use of `Page.totalCount` / `Page.totalPages` in callers — unnecessary COUNT query | 0.50 (advisory; needs caller analysis to be precise) |
| `SD-NPLUS-004` | DRF-style: nested DTOs constructed via `.stream().map(u -> new UserDto(u.getOrders()))` without entity graph | stream callback dereferencing lazy collection ∧ no `@EntityGraph` on the repo method | 0.75 |
| `SD-MOD-005` | `@Query("SELECT u FROM User u")` without explicit `JOIN FETCH` followed by lazy-access loop | JPQL string + caller behavior; needs query-string parse | 0.65 |

### Z.5 jOOQ rules (4 rules — small surface; jOOQ is type-safe by construction)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `JQ-BAG-001` | Multiple `leftJoin` to to-many tables without MULTISET → simulated cartesian | DSL chain `.leftJoin(POSTS).leftJoin(COMMENTS)` where both target tables are to-many (needs schema metadata; v2) | 0.65 |
| `JQ-FETCH-002` | `.fetchInto(MyDto.class)` after JOIN — works but cartesian-multiplies rows | LEFT JOIN + `fetchInto` on a DTO that includes a `List<>` field | 0.60 |
| `JQ-RAW-003` | `DSL.field("..." + userVar)` — string concatenation in `field()` builder | concatenation operator or template-string in `DSL.field`/`DSL.condition` first arg | 0.95 |
| `JQ-MAP-004` | `fetchMap(keyFn, valueFn)` where keys may collide — throws at runtime | `fetchMap` over a query whose key column isn't `UNIQUE` (needs schema metadata; v2) | 0.50 |

References: [No More MultipleBagFetchException (jOOQ blog)](https://blog.jooq.org/no-more-multiplebagfetchexception-thanks-to-multiset-nested-collections/), [MULTISET manual](https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/multiset-value-constructor/).

### Z.6 MyBatis rules (3 rules)

MyBatis bridges Java code and XML mapper files. We currently don't parse XML — MyBatis mapper XML lint is v2 unless the user wants tree-sitter-xml. Java-side rules:

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `MB-N1-001` | `@Select` annotated method with nested `@Many` / `@One` lazy associations called in loop | `@Select` ∧ `@Many(...)` ∧ caller iterates ∧ accesses the relation | 0.80 |
| `MB-CACHE-002` | `@CacheNamespace` on mapper with frequent updates → stale reads | similar to JPA-CACHE-012 | 0.45 |
| `MB-RAW-003` | `${param}` (not `#{param}`) in SQL string — SQL injection vector | string literal contains `${...}` outside of `<bind>` block | 0.99 |

### Z.7 Exposed (Kotlin) rules (4 rules)

[JetBrains Exposed](https://www.jetbrains.com/exposed/) is the dominant native-Kotlin ORM.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `EX-N1-001` | Iteration over entity rows then access related entity without `.with(Table::relation)` | `for ... in Users.selectAll()` ∧ row.relation access ∧ no `with(...)` in chain | 0.85 |
| `EX-COUNT-002` | `Users.selectAll().toList().size` instead of `Users.selectAll().count()` | `.toList().size` chain on a query | 0.95 |
| `EX-TX-003` | DB ops outside a `transaction { ... }` block — Exposed requires it | `Users.insert(...)` or `Users.selectAll()` whose lexical-enclosing scope contains no `transaction { ... }` call | 0.90 |
| `EX-RAW-004` | `customFunction(...)` or `exec(...)` with interpolated user input | string template in Kotlin (`"...$x..."`) inside `exec` or `customFunction` first arg | 0.95 |

Kotlin's `transaction { }` is a top-level function call with a lambda — same capture shape as TS array-method callbacks (Part II §R), reusing infrastructure.

### Z.8 Ktorm (Kotlin) rules (3 rules)

[Ktorm](https://www.ktorm.org/) is a sequence-API-style ORM.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `KT-N1-001` | `database.sequenceOf(Users).map { it.profile }` — `it.profile` triggers per-row load | sequence chain `.map { ... }` body accesses a `@References`-marked field on iteration var | 0.85 |
| `KT-COUNT-002` | `database.sequenceOf(Users).toList().size` instead of `.count()` | similar to EX-COUNT-002 | 0.95 |
| `KT-JOIN-003` | Multi-`leftJoin` without using `Database.batchInsert` / explicit join builder properly | construction of nested joins manually instead of `joinReferencesAndSelect` | 0.55 |

### Z.9 Slick (Scala) rules (3 rules)

[Slick](https://scala-slick.org/) compiles for-comprehensions to SQL at compile time. Most categorical errors are caught by the type system.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `SL-N1-001` | `Future.sequence(users.map(u => userRepo.findById(u.id)))` — N+1 over Futures | `Future.sequence` over a `.map` that emits per-row DB Futures | 0.85 |
| `SL-AWAIT-002` | `Await.result` inside a loop or `.map` body — synchronous DB call in a Scala async context | `Await.result(query.result, ...)` in_loop or in_stream | 0.95 |
| `SL-DTO-003` | `query.result.map(_.head)` — fetch entire result then take first row | should be `query.take(1).result.headOption` | 0.85 |

### Z.10 Doobie (Scala) rules (2 rules)

[Doobie](https://tpolecat.github.io/doobie/) is functional/monadic; SQL via the `sql""` interpolator.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `DB-N1-001` | `users.traverse(u => sql"SELECT ... WHERE id = ${u.id}".query.unique)` — per-row query | `.traverse(...)` over a `ConnectionIO` constructing per-row queries | 0.85 |
| `DB-FRAG-002` | `Fragment.const(userInput)` — SQL injection vector (only Doobie's `const` skips escaping) | call to `Fragment.const` whose arg is not a literal | 0.95 |

### Z.11 Quill (Scala/Kotlin) rules (2 rules — small because compile-time)

[Quill](https://zio.dev/zio-quill/) generates SQL at compile time via macros. The compile-time guarantee eliminates entire classes of errors.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `QL-N1-001` | `quote { query[User].map(u => run(query[Order].filter(_.userId == u.id))) }` — nested run in a map | nested `run(...)` inside a `query[...].map(...)` body | 0.85 |
| `QL-DYN-002` | Use of dynamic `quote` outside a `quote` block — defeats compile-time generation | reference to a `Quoted[T]` value passed directly to runtime methods | 0.65 |

---

## AA — Go ORMs

Go has the broadest spread: 5 widely-used libraries with different patterns. drift-static-profiler already handles SQL sinks for `database/sql`, `sqlx`, `pgx`, GORM via [go.rs](../src/languages/go.rs#L25). For ORM detection, GORM is the highest-priority target by usage.

### AA.1 GORM rules (6 rules)

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `GR-N1-001` | Loop over `Find(&users)` result then `user.Posts` access without `Preload("Posts")` | for-range over slice populated by `db.Find` ∧ struct-field access on iteration var ∧ no `Preload` for that field in chain | 0.85 |
| `GR-JOIN-002` | `db.Joins("Posts").Find(...)` where `Posts` is `has_many` — Joins is only for `belongs_to`/`has_one` | `Joins(...)` ∧ the named field is a slice in struct definition | 0.90 |
| `GR-CREATE-003` | `db.Create(&user)` in loop instead of `db.Create(&users)` batch | call `db.Create(...)` ∧ in_loop ∧ singular arg | 0.90 |
| `GR-SAVE-004` | `db.Save(&user)` in loop without batched transaction | call `db.Save(...)` ∧ in_loop | 0.85 |
| `GR-COUNT-005` | `len(users) // after db.Find(&users)` instead of `db.Model(&User{}).Count(&count)` | `len(...)` on var populated by `db.Find` | 0.90 |
| `GR-RAW-006` | `db.Raw(fmt.Sprintf("... %s ...", userInput))` — SQLi | `fmt.Sprintf` arg to `db.Raw`/`db.Exec` | 0.99 |

### AA.2 ent rules (3 rules)

[ent](https://entgo.io/) — explicit eager loading via `.WithPosts()`.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `EN-N1-001` | Loop over `client.User.Query().All(ctx)` accessing edges without `.WithX(...)` | for-range ∧ method call resembling edge access ∧ chain lacks matching `With...` | 0.85 |
| `EN-COUNT-002` | `len(...All(ctx))` instead of `.Count(ctx)` | similar to GR-COUNT-005 | 0.95 |
| `EN-LIMIT-003` | `.Limit(N).Offset(very_large)` deep OFFSET | numeric literal `>10000` in `Offset` | 0.85 |

### AA.3 bun rules (2 rules)

[Bun](https://bun.uptrace.dev/) — Go SQL-first ORM with `Relation()` for eager loading.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `BU-N1-001` | Loop accessing relation without `db.NewSelect().Relation("X")` in chain | similar to GR-N1-001 with bun's API | 0.80 |
| `BU-RAW-002` | `bun.Safe(fmt.Sprintf(...))` — explicitly bypasses bun's escaping | `bun.Safe(...)` with non-literal arg | 0.95 |

### AA.4 sqlc — defer to existing `sql_lint.rs`

[sqlc](https://sqlc.dev/) generates type-safe Go from SQL files. The SQL **is** the source — our existing [sql_lint.rs](../src/sql_lint.rs) already catches `SELECT *`, missing `WHERE`, etc., on those SQL files. No new sqlc-specific module needed; just teach the walker to include `*.sql` files in sqlc-detected projects.

**Detection gate**: presence of `sqlc.yaml` at project root. v1 ships this as one line in [walker.rs](../src/walker.rs).

---

## BB — Rust ORMs (small surface — compile-time ORMs do our job)

Diesel and SQLx use Rust's type system / proc macros to catch most categorical errors at compile time. The remaining static-detectable antipatterns are runtime-level: loops, OFFSET, cardinality misuse. **Smaller rule count is by design, not omission.**

### BB.1 Diesel rules (3 rules)

[Diesel](https://diesel.rs/) — compile-time-typed DSL.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `DS-N1-001` | `users.iter().map(|u| posts.filter(post::user_id.eq(u.id)).load(conn))` — per-row load | `.map(...)` callback containing `.load(...)` / `.execute(...)` call | 0.90 |
| `DS-PAGE-002` | `.offset(very_large).limit(N)` deep OFFSET | similar to EN-LIMIT-003 | 0.85 |
| `DS-N1-003` | `belonging_to(...)` used inside a loop instead of `Posts::belonging_to(&users).load(conn)` | `belonging_to(&single_user)` ∧ in_loop ∧ helper that does the batch-load alternative exists in scope | 0.65 |

### BB.2 SQLx rules (3 rules — composes with `sql_lint.rs`)

[SQLx](https://github.com/launchbadge/sqlx) compile-time-checks SQL syntax + types against an actual DB. Still vulnerable to N+1 + OFFSET + projection issues.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `SX-N1-001` | `sqlx::query!(...)` macro invoked inside a loop with a per-row WHERE | `sqlx::query!`/`sqlx::query_as!` macro ∧ in_loop ∧ macro string contains `WHERE` referencing loop var | 0.90 |
| `SX-RAW-002` | `sqlx::query(format!(...))` — bypasses compile-time check | `format!` arg to `sqlx::query` (not `sqlx::query!`) | 0.95 |
| `SX-PAGE-003` | `OFFSET $N` macro with `$N` bound from large literal | bound parameter source is a numeric literal `>10000` | 0.80 |

Critically, the **SQL strings inside SQLx macros are already candidates for our existing [sql_lint.rs](../src/sql_lint.rs) rules**. The integration point: extend [tags.rs](../src/tags.rs#L308) to recognize `sqlx::query!(...)` macro invocations as SQL sinks, populating `Reference.sql_literal`. Then SQL001–SQL00N rules fire automatically. Free coverage.

### BB.3 SeaORM rules (3 rules)

[SeaORM](https://www.sea-ql.org/SeaORM/) — runtime, async, has `.find_with_related()` for eager loading.

| ID | Rule | Detection shape | Conf |
|---|---|---|---|
| `SE-N1-001` | `User::find().all(db)` then per-row `user.find_related(Posts)` in loop | similar shape to GR-N1-001 | 0.85 |
| `SE-COUNT-002` | `.all(db).await.len()` instead of `.count(db).await` | similar to GR-COUNT-005 | 0.95 |
| `SE-RAW-003` | `Statement::from_string(builder, format!(...))` | `format!` interpolation passed to `Statement::from_string` | 0.95 |

---

## CC — Cross-cutting: language detection of compile-time ORMs

Diesel, SQLx, Slick, Doobie, Quill — these **compile-time** ORMs share a common property: most categorical errors (column-name typos, type mismatches, missing JOIN keys) are caught by the compiler / macro expansion. drift's static analysis should **not** re-implement what `cargo check` / `scalac` already does.

What remains and is worth detecting:
1. **N+1 patterns** — loops that issue per-row queries. The compile-time check verifies each *single* query is correct; it does not verify the surrounding control flow.
2. **OFFSET pagination on deep pages** — semantically fine, performance pitfall.
3. **Bypass escape hatches** — `sqlx::query(format!(...))`, `Doobie.Fragment.const`, `Quill` runtime quotation — these defeat the compile-time guarantee.
4. **Cardinality misuse** — `fetchMap` on a non-unique key in jOOQ, `joinedload` on collection in SA, multi-bag fetch in Hibernate.

This is why the Rust/Scala/Doobie/Quill rule sets are deliberately small (2–4 rules each) but each rule is **high-precision** (≥0.85 confidence in most cases).

---

## DD — Path-gating across all of Part III

Same idea as Parts I and II — cheap import-based gating so unused frameworks cost nothing:

| Framework | Gate (file-level) | Cross-file gate (project-level) |
|---|---|---|
| Hibernate/JPA | `import jakarta.persistence.*` or `import javax.persistence.*` | `pom.xml` / `build.gradle` mentions `hibernate-core` or `spring-boot-starter-data-jpa` |
| Spring Data | extends `JpaRepository` or `CrudRepository` | same as JPA |
| jOOQ | `import org.jooq.*` | `pom.xml` mentions `jooq` |
| MyBatis | `@Mapper` annotation or `import org.apache.ibatis.*` | `mybatis-config.xml` exists |
| Exposed | `import org.jetbrains.exposed.*` | `build.gradle.kts` mentions `exposed-core` |
| Ktorm | `import org.ktorm.*` | `build.gradle.kts` mentions `ktorm-core` |
| Slick | `import slick.jdbc.*` | `build.sbt` mentions `slick` |
| Doobie | `import doobie.*` | `build.sbt` mentions `doobie-core` |
| Quill | `import io.getquill.*` | similar |
| GORM | `import "gorm.io/gorm"` | `go.mod` mentions `gorm.io/gorm` |
| ent | `import "entgo.io/ent"` | `go.mod` mentions `entgo.io/ent` |
| bun | `import "github.com/uptrace/bun"` | `go.mod` |
| sqlc | sqlc.yaml present at project root | — |
| Diesel | `use diesel::*` | `Cargo.toml` mentions `diesel` |
| SQLx | `use sqlx::*` | `Cargo.toml` mentions `sqlx` |
| SeaORM | `use sea_orm::*` | `Cargo.toml` mentions `sea-orm` |

**Project-level gates** introduce a new concept: scan the project's manifest file (`pom.xml`, `build.gradle*`, `go.mod`, `Cargo.toml`, `sbt`) once during walker init, build a `FrameworkSet` for the workspace. This is already partially done in [manifest.rs](../src/manifest.rs); extend it.

---

## EE — Updated effort estimate (full plan, Parts I + II + III)

| Module | Rules | Effort | Notes |
|---|---|---|---|
| **Part I — Python** | 30 | 14–18 d | Django + SQLAlchemy + Alembic |
| **Part II — TS/JS** | 34 | ~19 d | Prisma uses `psl` crate; rest tree-sitter |
| **Part III — JVM** | 38 | ~18–22 d | Shared JpaContext across Java/Kotlin/Scala saves time |
|   • Annotation captures (J/K/S × 1 d each) | — | 3 d | one-time per-language |
|   • JpaContext + EntityDef extraction | — | 3 d | shared across 3 langs |
|   • jpa.rs (12 rules) | 12 | 4 d |  |
|   • spring_data.rs (5 rules) | 5 | 2 d |  |
|   • jooq.rs (4 rules) | 4 | 1.5 d |  |
|   • mybatis.rs (3 rules) | 3 | 1 d |  |
|   • exposed.rs (4 rules) | 4 | 1.5 d |  |
|   • ktorm.rs (3 rules) | 3 | 1 d |  |
|   • slick.rs + doobie.rs + quill.rs (3+2+2) | 7 | 2.5 d |  |
| **Part III — Go** | 11 | ~7 d | GORM + ent + bun; sqlc is free via sql_lint.rs |
|   • GoOrmContext | — | 1 d |  |
|   • gorm.rs (6 rules) | 6 | 2.5 d |  |
|   • ent.rs (3 rules) | 3 | 1 d |  |
|   • bun.rs (2 rules) | 2 | 0.5 d |  |
|   • sqlc detection + SQL-lint integration | — | 0.5 d |  |
|   • Fixtures + corpus calibration | — | 1.5 d |  |
| **Part III — Rust** | 9 | ~5 d | Compile-time ORMs ⇒ small but high-precision |
|   • RustOrmContext + macro recognition | — | 1.5 d | `sqlx::query!` macro is a key new capture |
|   • diesel.rs (3 rules) | 3 | 1 d |  |
|   • sqlx.rs (3 rules) + sql_lint integration | 3 | 1 d | macro → SQL literal pipeline |
|   • seaorm.rs (3 rules) | 3 | 1 d |  |
|   • Fixtures + corpus calibration | — | 0.5 d |  |
| Cross-cutting: corpus calibration for new langs | — | 3 d | 200 findings × 5 OSS projects per language family |
| Schema bump: 8 new `FindingKind` variants | — | 0.5 d | Part II §6 strategy applies (per-framework) |
| **Grand total v1 (all parts)** | **122** | **~63–73 d (~13–15 weeks)** | One developer; assumes existing tree-sitter pipeline stays stable |

**At ~2 developer-quarters**, this is the realistic envelope for shipping a comprehensive ORM static-analysis layer covering Python + TS/JS + JVM + Go + Rust.

Recommended shipping order (highest-ROI first):

1. **Python — Django** (4–5 d, 12 rules) — largest validated user base, best prior art
2. **TS — Prisma** (3 d, 8 rules) — `psl` does heavy lifting; trending hard in 2025–2026
3. **JVM — JPA core** (10 d, 17 rules: JPA + Spring Data) — biggest enterprise footprint
4. **Go — GORM** (3.5 d, 6 rules) — dominant Go ORM
5. **Python — SQLAlchemy** (3–4 d, 10 rules)
6. **TS — Drizzle + TypeORM** (5.5 d, 15 rules)
7. **Rust — SQLx + Diesel + SeaORM** (5 d, 9 rules)
8. **JVM — jOOQ + Exposed + Ktorm + MyBatis** (6 d, 14 rules)
9. **TS — Mongoose + Sequelize** (3.5 d, 11 rules)
10. **Scala — Slick + Doobie + Quill** (2.5 d, 7 rules)
11. **Python — Alembic** (1.5–2 d, 8 rules)
12. **Go — ent + bun + sqlc integration** (2 d, 5 rules)

Each milestone is independently shippable as a drift release: `0.2 → Python+Django`, `0.3 → +Prisma`, `0.4 → +JPA`, etc.

---

## FF — Final `FindingKind` list (after all three parts)

Single closed enum with one variant per framework. Manageable at ~16 variants:

```rust
pub enum FindingKind {
    // Existing
    NPlusOne, BlockingInAsync, Recursive, SmellyLoop, NoisyLog,
    OutdatedPackage, MemoryExplosion, HotZone, ExpensiveCompute,
    MissingCaching, LogAmplification, SqlAntipattern,
    // Part I — Python
    DjangoAntipattern, SqlAlchemyAntipattern, AlembicMigration,
    // Part II — TS/JS
    PrismaAntipattern, DrizzleAntipattern, TypeOrmAntipattern,
    SequelizeAntipattern, MongooseAntipattern,
    // Part III — JVM
    JpaAntipattern, SpringDataAntipattern, JooqAntipattern,
    MyBatisAntipattern, ExposedAntipattern, KtormAntipattern,
    SlickAntipattern, DoobieAntipattern, QuillAntipattern,
    // Part III — Go
    GormAntipattern, EntAntipattern, BunAntipattern,
    // Part III — Rust
    DieselAntipattern, SqlxAntipattern, SeaOrmAntipattern,
}
```

(JPA-via-Kotlin and JPA-via-Scala both emit `JpaAntipattern` — language is in the file path, not the finding kind.)

Schema bump: add to [schema/profile.schema.json:434](../schema/profile.schema.json) `FindingKind` enum. Validator test updated.

> **Where do Part IV's SQL-IR rules attach?** They reuse the existing `FindingKind::SqlAntipattern` variant (already in [src/insights.rs:91](../src/insights.rs#L91)). Rationale: from a viewer's perspective a SQL-IR finding ("this ORM chain emits a deep-OFFSET query") and a direct-SQL finding ("this `cursor.execute(...)` literal does the same thing") are the same diagnostic class — the rule ID prefix (`SQLIR-*` vs `SQL*`) disambiguates the source in `evidence[0].call`. Fused findings (§NN) where an ORM-rule and an SQL-IR rule both fire on the same site collapse to the framework-specific kind (`DjangoAntipattern`, etc.) because that's what the user expects to filter by. So no new variant for SQL-IR; the 16-variant list above is final.

---

## GG — Cargo additions for Part III

```toml
# Part I needed no new deps.
# Part II needed `psl`.
# Part III needs zero new tree-sitter grammars (java/kotlin/scala/go/rust all in Cargo.toml already).
# Part III needs only:

[dependencies]
# Manifest parsing — already parsed loosely by manifest.rs; consider promoting
# to a typed parser if pom.xml gets messy. For now: regex extraction is fine.

# NO new tree-sitter grammars
# NO new SQL parsers (sqlparser-rs + pg_query already in tree)
```

The whole 13–15-week build adds **one** new dependency (`psl`) total. The existing pipeline carries us.

---

## HH — Part III open questions

1. **`pom.xml` / `build.gradle` parsing**: how deeply do we need to introspect Maven/Gradle to know "this project uses Hibernate"? v1: regex search for `hibernate-core`, `spring-boot-starter-data-jpa`, etc. — fragile but cheap. v2: real Maven model parser.
2. **MyBatis mapper XML**: do we add `tree-sitter-xml` to cover XML-side rules? v1: skip; XML can come in v2.
3. **Quill macro expansion**: Quill's macros run during Scala/Kotlin compile. We see the **unexpanded** source via tree-sitter. Is that enough? The N+1 pattern (nested `run`) is visible at the source level, so yes for v1.
4. **JPA across Java/Kotlin/Scala**: do we ship a single `jpa.rs` from day one, or one per host language and refactor later? Recommend day-one shared module to avoid the refactor — the cost is one extra parameter (`host_lang`) on `JpaContext`, well worth it.
5. **Build-file integration for `manifest.rs`**: who owns project-level framework detection? Currently [manifest.rs](../src/manifest.rs) does light dependency-version analysis. Either extend it or create `framework_detect.rs` next to it. Recommend: extend `manifest.rs` to emit a `FrameworkSet` consumed by walker.

---

## II — Additional sources (round 3)

### Java / JPA / Spring
- [SonarQube rule S2077 (Hibernate)](https://rules.sonarsource.com/java/tag/hibernate/rspec-2077/)
- [Vlad Mihalcea — FetchType.EAGER is a code smell](https://vladmihalcea.com/eager-fetching-is-a-code-smell/)
- [Vlad Mihalcea — Spring Data findById Anti-Pattern](https://vladmihalcea.com/spring-data-jpa-findbyid/)
- [Vlad Mihalcea — JPA Default Fetch Plan](https://vladmihalcea.com/jpa-default-fetch-plan/)
- [Hibernate fetch strategies (Vlad Mihalcea)](https://vladmihalcea.com/hibernate-facts-the-importance-of-fetch-strategy/)
- [Thorben Janssen — FetchType lazy/eager](https://thorben-janssen.com/entity-mappings-introduction-jpa-fetchtypes/)
- [Baeldung — Hibernate Lazy/Eager Loading](https://www.baeldung.com/hibernate-lazy-eager-loading)
- [Jakarta Persistence issue #409 — @ManyToOne EAGER default debate](https://github.com/jakartaee/persistence/issues/409)
- [AppMap blog — N+1 detection for Spring](https://appmap.io/blog/2021/10/04/detecting_n_plus_one_for_spring_applications/)
- [CodeWiz — 11 JPA Performance Killers](https://codewiz.info/blog/jpa-performance-anti-patterns/)
- [JPA Buddy IntelliJ plugin](https://www.jpa-buddy.com/) — commercial reference

### jOOQ
- [No More MultipleBagFetchException (jOOQ blog)](https://blog.jooq.org/no-more-multiplebagfetchexception-thanks-to-multiset-nested-collections/)
- [MULTISET value constructor manual](https://www.jooq.org/doc/latest/manual/sql-building/column-expressions/multiset-value-constructor/)
- [jOOQ MULTISET issue tracker](https://github.com/jOOQ/jOOQ/issues/12413)

### Kotlin
- [JetBrains Exposed](https://www.jetbrains.com/exposed/)
- [Exposed Get Started](https://www.jetbrains.com/help/exposed/get-started-with-exposed.html)
- [Ktorm](https://www.ktorm.org/)
- [Ktorm GitHub](https://github.com/kotlin-orm/ktorm)
- [tree-sitter-kotlin-ng (active fork — used by drift)](https://github.com/tree-sitter-grammars/tree-sitter-kotlin)

### Scala
- [Slick](https://scala-slick.org/)
- [Slick — Coming from SQL](https://scala-slick.org/doc/3.3.0/sql-to-slick.html)
- [Doobie](https://tpolecat.github.io/doobie/)
- [Quill (ZIO)](https://zio.dev/zio-quill/)
- [Quill vs Slick](https://zio.dev/zio-quill/quill-vs-slick/)
- [SoftwareMill — Scala DB libraries comparison](https://softwaremill.com/comparing-scala-relational-database-access-libraries/)
- [tree-sitter-scala](https://github.com/tree-sitter/tree-sitter-scala)

### Go
- [GORM Preloading docs](https://gorm.io/docs/preload.html)
- [GORM Performance docs](https://gorm.io/docs/performance.html)
- [ent Eager Loading](https://entgo.io/docs/eager-load/)
- [bun](https://bun.uptrace.dev/)
- [sqlc](https://sqlc.dev/)
- [Comparing Go ORMs (Glukhov 2025)](https://www.glukhov.org/post/2025/09/comparing-go-orms-gorm-ent-bun-sqlc/)
- [Staticcheck (Go linter — reference)](https://staticcheck.dev/)

### Rust
- [Diesel](https://diesel.rs/)
- [Diesel — comparison page](https://diesel.rs/compare_diesel.html)
- [SQLx](https://github.com/launchbadge/sqlx)
- [SQLx query! macro docs](https://docs.rs/sqlx/latest/sqlx/macro.query.html)
- [SeaORM](https://www.sea-ql.org/SeaORM/)
- [SeaORM vs Diesel](https://www.sea-ql.org/SeaORM/docs/0.5.x/internal-design/diesel/)
- [Rust ORMs 2026 comparison (byteiota)](https://byteiota.com/rust-orms-2026-sqlx-vs-diesel-vs-seaorm-comparison/)
- [SQLx compile-time woes (Cosmic Horror)](https://cosmichorror.dev/posts/speeding-up-sqlx-compile-times/)

### Tree-sitter grammars referenced
- [tree-sitter-java](https://github.com/tree-sitter/java-tree-sitter)
- [tree-sitter-kotlin-ng](https://github.com/tree-sitter-grammars/tree-sitter-kotlin) — fork used
- [tree-sitter-scala](https://github.com/tree-sitter/tree-sitter-scala)
- [tree-sitter-go](https://github.com/tree-sitter/tree-sitter-go)
- [tree-sitter-rust](https://github.com/tree-sitter/tree-sitter-rust)

---

# Part IV — The Unified SQL Diagnostic Engine

> The user's pivot for round 4: *"all ORMs translate to SQL — patterns suppose to be collected and diagnosed, profiled statically and understood to mitigate findings."*
>
> Parts I–III each grow a separate rule catalog per framework. That works but it duplicates effort: a Django N+1 and a Prisma N+1 are *the same SQL phenomenon* (1 SELECT then N SELECT … WHERE id = ?). Part IV introduces the unifying layer so each pattern is detected once at the SQL level, then shared across all ORMs. Parts I–III stay; Part IV adds a second rule layer that reuses them.

## JJ — Step-by-step reasoning: why SQL is the unifying surface

### JJ.1 The observation

Walk through the existing rule catalogs from Parts I–III. Group rules by *what SQL they describe*:

| Rule (Part) | SQL phenomenon | Same as… |
|---|---|---|
| `DJ-N1-001` | `for u: SELECT * FROM user; SELECT * FROM post WHERE user_id=$N` | `SA-N1-001`, `PR-N1-001`, `EX-N1-001`, `GR-N1-001`, `JPA-N1-006`, `DS-N1-001`, `SX-N1-001`, `SE-N1-001` |
| `DJ-N1-004` (`count() > 0`) | `SELECT COUNT(*)` whose return is compared to 0 | `JPA-COUNT-008`, every `*-COUNT-*` rule |
| `DJ-N1-003` (`len(qs)`) | full fetch consumed only for length | `PR-COUNT-004`, `TO-COUNT-005`, `GR-COUNT-005`, `EN-COUNT-002`, `MG-COUNT-006`, `EX-COUNT-002`, `KT-COUNT-002`, `JPA-COUNT-008` |
| `DJ-PERF-007` (`Manager.create()` in loop) | `INSERT … VALUES (?)` × N | `GR-CREATE-003`, every `*-SAVE-*` rule |
| `PR-PAG-003` (deep `skip`) | `LIMIT N OFFSET LARGE` | `EN-LIMIT-003`, `DS-PAGE-002`, `SX-PAGE-003` |
| `DJ-RAW-011`, `SA-EXEC-009`, `MB-RAW-003`, `JQ-RAW-003`, `DB-FRAG-002`, `SX-RAW-002`, `SE-RAW-003`, `GR-RAW-006`, `BU-RAW-002`, `MG-RAW-*` (~12 rules) | `EXEC("…" + userInput)` SQLi | All the same SQLi-via-interpolation pattern |

About **40 % of the rules across Parts I–III collapse to ~8 underlying SQL phenomena**. If we project ORM calls onto SQL and run rules at that layer, we deduplicate massively and gain consistency across frameworks.

### JJ.2 The reasoning chain

> *Claim 1.* Every ORM operation has a SQL projection.
> Direct: that's the whole point of an ORM. Some libraries even expose it (`Drizzle.toSQL()`, `qs.query`, `SQLAlchemy.compile()`, `prisma --print-sql`). The projection is well-defined.

> *Claim 2.* For static analysis, an *approximate* SQL projection is enough.
> We don't need byte-identical SQL. We need the **shape**: operation, target tables, WHERE expressions, JOIN cardinality, projection columns, ORDER BY presence, LIMIT/OFFSET literals, sub-statements. The shape suffices for ~95 % of rules.

> *Claim 3.* Different ORMs produce different fidelity statically.
> Drizzle has `.toSQL()` — concrete. SQLAlchemy Core builds a reified expression tree — concrete. Django builds an opaque chain — partial (we know the methods called, not always the kwargs). GORM uses strings + struct tags — usually partial. Compile-time ORMs (Diesel, SQLx, Quill) have the SQL right in the source — concrete.

> *Claim 4.* Fidelity must be a first-class concept in the IR.
> If we treat all `PredictedSql` as equal, rules either FN on partial inputs (skipping when they shouldn't) or FP on symbolic ones (firing on assumptions). The right move: `enum SqlFidelity { Concrete, Partial, Symbolic }` and rules carry fidelity-aware confidence multipliers.

> *Claim 5.* Same finding from two paths = stronger finding.
> If `DJ-N1-001` (ORM-level: loop over qs + attribute access without prefetch_related) and a SQL-level rule `SQL-N1` (projected SQL: 1 SELECT + N SELECT WHERE id IN loop var) both fire on the same call site → confidence near 1.0. If only one fires → its individual confidence. This is the *triangulation* strategy (Part V).

> *Claim 6.* Some antipatterns don't project to SQL at all.
> Hibernate `@OneToMany(EAGER)` looks fine in SQL (`SELECT user, posts FROM user JOIN post`) — the antipattern is at hydration time (row explosion → 1000× rows materialized in memory for 1000 parents × 1000 posts). Prisma fluent API `findUnique().posts()` looks fine in SQL (two clean SELECTs) — the antipattern is the round-trip count. Cache strategy issues are at cache-layer, not SQL. **These rules stay at the ORM layer.**

### JJ.3 The architecture that follows

```
Source code
   │
   ▼
[tree-sitter parse]                       ────── existing
   │
   ▼
[language tags → References/Imports]      ────── existing
   │
   ▼
[per-language OrmContext build]           ────── Parts I/II/III
   │
   ├──► [ORM-specific rules (SQL-invisible)]
   │       │
   │       └──► Findings (decorator hazards, row explosion, migration safety, …)
   │
   ▼
[CallStep chain reconstruction per ORM]   ────── Part IV
   │   uses existing structs from ORM_SQL_PREDICTION.md (CallStep, OrmKind)
   │
   ▼
[OrmDialect::predict → PredictedSql]      ────── Part IV
   │   one trait impl per ORM; each returns PredictedSql{fidelity}
   │
   ▼
[Cross-ORM SQL rule pass]                 ────── Part IV
   │   builtins: SQL001-SQL010 (existing)
   │   + SQL012-SQL025 (from SQL_IO_HEURISTICS_AND_PLUGIN_ARCH.md)
   │   + new SQLN-* family (N+1, COUNT-as-length, deep OFFSET, raw-interpolation)
   │   each rule operates on PredictedSql, fidelity-aware confidence
   │
   ▼
[Finding fusion]                          ────── Part IV
   │   for each (file, line) merge ORM-rule + SQL-rule hits
   │   triangulation: 2+ paths agreeing → confidence boost
   │
   ▼
[Existing report attach pipeline]         ────── existing
```

This is **two rule layers, one diagnostic engine**. Adding a new ORM = write one `OrmDialect` impl. Adding a new SQL anti-pattern = append one rule to the cross-ORM catalog. Both happen via the same Open/Closed seam already shipped in [sql_lint.rs:67](../src/sql_lint.rs#L67).

---

## KK — The IR: `PredictedSql` with fidelity

We reuse the existing definition from [research/ORM_SQL_PREDICTION.md](ORM_SQL_PREDICTION.md), promoting `fidelity` to a first-class field:

```rust
/// Lives in src/orm/sql_ir.rs (new module).
/// Output of OrmDialect::predict; input to all cross-ORM rules.
#[derive(Debug, Clone)]
pub struct PredictedSql<'a> {
    /// The ORM that produced this prediction. Drives framework-tagged findings.
    pub orm: OrmKind,

    /// One or more SQL statements this ORM call emits. Often 1, but:
    ///   - Django prefetch_related: 1 primary + N secondary
    ///   - Prisma include (default): 1 + 1 per relation
    ///   - SQLAlchemy joinedload: 1
    ///   - SQLAlchemy selectinload: 1 + 1 per relation
    pub statements: Vec<PredictedStatement>,

    /// How concrete each statement is. Carried at the statement level
    /// because the primary may be Concrete and the secondary Partial.
    pub fidelity: Vec<SqlFidelity>,

    /// Where this prediction came from in source — drives finding line.
    pub anchor: SourceAnchor<'a>,

    /// Tree-sitter call sites used to build this — kept for the
    /// triangulation engine (Part V) to match against ORM-rule hits.
    pub call_steps: Vec<CallStep<'a>>,

    /// ORM-specific facts a rule may consult (e.g. relationship is
    /// to-many vs to-one — visible at the ORM layer but lost in SQL).
    pub extras: SqlExtras<'a>,
}

#[derive(Debug, Clone)]
pub struct PredictedStatement {
    pub op: SqlOp,                                 // SELECT / INSERT / UPDATE / DELETE / DDL
    pub tables: Vec<TableRef>,                     // primary + joined
    pub projection: Projection,                    // Full | Partial(cols) | Aggregate(fn)
    pub where_expr: Option<WhereExpr>,             // partial AST; may carry <unknown> sentinels
    pub joins: Vec<JoinSpec>,                      // INNER / LEFT / per-table
    pub order_by: Option<OrderBy>,
    pub limit: Option<LimitValue>,                 // Literal(n) | Bound(name) | None
    pub offset: Option<LimitValue>,
    pub group_by: Vec<ColumnRef>,
    pub having: Option<WhereExpr>,
    pub distinct: bool,
    /// "This statement runs N times in a loop" — set by the chain extractor
    /// when the receiver of the call is a loop variable. The N+1 rule
    /// reads this; without it, a single SELECT looks identical to N+1.
    pub iteration_marker: Option<IterationMarker>,
    /// String form for rules that want to call sqlparser-rs on it,
    /// rendering placeholders for unknowns. Lazy — only rendered if
    /// a rule reads it.
    pub render_cache: OnceCell<String>,
}

#[derive(Debug, Clone, Copy)]
pub enum SqlFidelity {
    /// Every field of PredictedStatement is fully resolved. Concrete SQL
    /// can be rendered without `<unknown>` placeholders. Examples:
    /// Drizzle (.toSQL parity), Diesel (compile-time), SQLx macro literal.
    Concrete,
    /// Some fields carry `<unknown>` sentinels — usually WHERE columns
    /// or projection sets from dynamic kwargs. Operation, table, and
    /// JOIN cardinality are known. Examples: Django filter(**kwargs),
    /// SQLAlchemy text(f"..."), GORM Where with template.
    Partial,
    /// Only the operation kind and target table (maybe) are known.
    /// Examples: a helper function that returns a queryset and is
    /// passed through 3 callers. Rule confidence drops sharply.
    Symbolic,
}

#[derive(Debug, Clone)]
pub enum WhereExpr {
    Eq(ColumnRef, Value),
    In(ColumnRef, Vec<Value>),
    InSubquery(ColumnRef, Box<PredictedStatement>),
    And(Vec<WhereExpr>), Or(Vec<WhereExpr>), Not(Box<WhereExpr>),
    Comparison(ColumnRef, Op, Value),
    Raw(String),       // text() / DSL.field(string) — unparsed
    Unknown,           // ← key: rules treat this as "could be anything"
}

#[derive(Debug, Clone)]
pub enum Value {
    Literal(LiteralKind),
    Param(BindKind),                // $1, ?, :name, etc.
    UserInputTaint,                 // ← marker for interpolated user values; fuels SQLi rules
    Unknown,
}

#[derive(Debug, Clone)]
pub struct SqlExtras<'a> {
    pub cardinality_hint: Option<Cardinality>,    // to-one vs to-many — visible at ORM, invisible in SQL
    pub triggers_hydration_of: Vec<&'a str>,       // entity classes this populates — for row-explosion rule
    pub crosses_round_trip: bool,                  // Prisma fluent: hides a 2nd query
    pub in_transaction: bool,
    pub in_async_context: bool,
    pub framework_specific: HashMap<&'a str, &'a str>,  // arbitrary side facts
}
```

The two non-obvious parts are `iteration_marker` and `extras`.

- `iteration_marker` tells the SQL N+1 rule that this single-statement prediction is *actually* the body of a loop, so the rule should report 1 + N. Without it, every `SELECT … WHERE id = ?` would look like a candidate for the rule.
- `extras` carries ORM-level facts that **don't survive the SQL projection** but still matter — to-one vs to-many cardinality, "this hides a round-trip" (Prisma fluent), entity classes being hydrated (for row-explosion rule). It's the bridge that keeps ORM-aware rules working at the SQL layer.

---

## LL — The trait: `OrmDialect` (per ORM, ~16 implementations)

```rust
/// One impl per ORM. Existing trait already sketched in
/// [research/ORM_SQL_PREDICTION.md](ORM_SQL_PREDICTION.md);
/// final shape:
pub trait OrmDialect: Send + Sync {
    /// Identifying name surfaced in findings + telemetry.
    fn orm(&self) -> OrmKind;

    /// Is this ORM even relevant for the given file? Cheap import gate.
    fn matches(&self, ctx: &OrmContext) -> bool;

    /// Top-level entrypoint. Walks the file's references + bindings,
    /// reconstructs call chains, emits one PredictedSql per chain root.
    /// May emit zero (no matching chains) or many.
    fn predict_all(&self, ctx: &OrmContext) -> Vec<PredictedSql<'_>>;
}

/// Registry — one const slice. Open/Closed: append, don't edit.
/// inventory! crate can be used if external plugins ever happen
/// (deferred per SQL_IO_HEURISTICS_AND_PLUGIN_ARCH.md recommendation).
pub const DIALECTS: &[&dyn OrmDialect] = &[
    // Python
    &python::DjangoDialect, &python::SqlAlchemyDialect, &python::AlembicDialect,
    // TS/JS
    &ts::PrismaDialect, &ts::DrizzleDialect, &ts::TypeOrmDialect,
        &ts::SequelizeDialect, &ts::MongooseDialect,
    // JVM (one shared dialect per framework regardless of host language)
    &jvm::JpaDialect, &jvm::SpringDataDialect, &jvm::JooqDialect, &jvm::MyBatisDialect,
    &jvm::ExposedDialect, &jvm::KtormDialect,
    &jvm::SlickDialect, &jvm::DoobieDialect, &jvm::QuillDialect,
    // Go
    &go::GormDialect, &go::EntDialect, &go::BunDialect, // sqlc → handled directly by sql_lint
    // Rust
    &rs::DieselDialect, &rs::SqlxDialect, &rs::SeaOrmDialect,
];
```

### LL.1 Per-ORM fidelity table — what to expect

| ORM | Expected fidelity | Notes |
|---|---|---|
| Drizzle | Concrete | `db.query.X.findMany({with:...})` has full info statically; relations() known per-file |
| SQLAlchemy Core (`select(...)`) | Concrete | reified expression tree; all kwargs visible |
| SQLAlchemy ORM (`session.query(...)`) | Concrete-to-Partial | most chains concrete; `text(f"…")` drops to Partial |
| Diesel | Concrete | type system gives us schema; macros expose the SQL |
| SQLx | Concrete | macro body is the SQL string verbatim |
| Quill | Concrete | quote bodies are source-visible |
| Slick | Concrete-to-Partial | for-comprehension chain readable; runtime composition Partial |
| Prisma | Concrete | `psl` gives schema; client calls fully introspectable |
| Doobie | Concrete | `sql"…"` interpolator literal |
| Django | Partial | `.filter(**kwargs)` and dynamic Q-expressions degrade to Partial |
| SQLAlchemy text/raw | Partial | string with f-string holes |
| TypeORM (QB) | Partial | string-keyed joins, runtime relations |
| TypeORM (find options) | Concrete | object literal arg fully visible |
| Hibernate (JPA) | Partial-to-Symbolic | annotations give entity graph; JPQL strings need parsing |
| jOOQ | Concrete | DSL is type-safe and source-visible |
| MyBatis | Partial | XML resides outside the file; v1 reads only annotation form |
| Exposed | Concrete | DSL is source-visible |
| Ktorm | Concrete | sequence API is source-visible |
| Mongoose | n/a (Mongo, not SQL) | rules stay at the ORM layer; doesn't go through this pipeline |
| GORM | Partial | string + tag mix; many runtime decisions |
| ent | Concrete | code-generated client exposes everything |
| bun | Concrete-to-Partial | typed but accepts strings for raw |
| SeaORM | Concrete | builder is source-visible |

This table sets per-ORM rule confidence ceilings. A rule operating on a `Partial` prediction can't exceed ~0.80 confidence even if the rule itself is highly precise — *the input data is fundamentally uncertain*.

---

## MM — The new rule layer: `SqlIrRule` operating on `PredictedSql`

The existing [`SqlRule`](../src/sql_lint.rs#L67) operates on `sqlparser::Statement` (real parsed SQL strings). We add a sibling:

```rust
/// Rules over the predicted-SQL IR. Open/Closed: append literals to
/// BUILTIN_SQL_IR_RULES. Sister catalog to BUILTIN_RULES in sql_lint.rs.
pub struct SqlIrRule {
    pub id: &'static str,
    pub severity: Severity,
    pub effort: Effort,
    pub message: &'static str,
    pub remediation: &'static str,
    /// Pure predicate. Returns 0+ MatchHits; rule explains itself.
    pub matches: fn(&PredictedSql) -> Vec<IrMatchHit>,
    /// Confidence multipliers per fidelity tier — used in finding
    /// fusion (§NN below). Concrete = 1.0, Partial = ~0.6, Symbolic = ~0.3.
    pub fidelity_weight: FidelityWeight,
}
```

### MM.1 The cross-ORM SQL-IR rule catalog (v1: 14 rules)

These rules **replace ~25 framework-specific rules** from Parts I–III by covering them at the SQL level. The framework rules don't go away — they coexist for triangulation.

| ID | Rule | Catches (Parts I–III equivalents) |
|---|---|---|
| `SQLIR-N1-001` | Statement with `iteration_marker=Some(LoopRow)` + WHERE referencing the loop var | `DJ-N1-001`, `SA-N1-001`, `PR-N1-001`, `JPA-N1-006`, `GR-N1-001`, `EN-N1-001`, `BU-N1-001`, `DS-N1-001`, `SX-N1-001`, `SE-N1-001`, `EX-N1-001`, `KT-N1-001`, `SL-N1-001`, `DB-N1-001`, `QL-N1-001` (≈15 collapse here) |
| `SQLIR-N1-002` | `SELECT COUNT(*)` whose result compared to 0 — should be `EXISTS` | `DJ-N1-004` + all `*-COUNT-*` variants |
| `SQLIR-N1-003` | Full SELECT consumed only for cardinality (`.length`/`.size`/`len()`) | `DJ-N1-003`, `PR-COUNT-004`, `TO-COUNT-005`, `GR-COUNT-005`, `EN-COUNT-002`, `MG-COUNT-006`, `EX-COUNT-002`, `KT-COUNT-002`, `JPA-COUNT-008`, `SE-COUNT-002` (10 → 1) |
| `SQLIR-PAG-004` | `LIMIT N OFFSET LARGE` where `LARGE ≥ 1000` literal | `PR-PAG-003`, `EN-LIMIT-003`, `DS-PAGE-002`, `SX-PAGE-003` |
| `SQLIR-INS-005` | INSERT inside `iteration_marker` — should be batched | `DJ-PERF-007`, `GR-CREATE-003`, all `*-SAVE-*` |
| `SQLIR-UPD-006` | UPDATE inside `iteration_marker` without batching | `DJ-PERF-008`, all `*-UPD-*` |
| `SQLIR-DEL-007` | DELETE without WHERE clause | `DR-DEL-001`, `TO-QB-006` |
| `SQLIR-UPD-008` | UPDATE without WHERE clause | `DR-UPD-002` |
| `SQLIR-RAW-009` | Statement contains `Value::UserInputTaint` in any WHERE/value position | `DJ-RAW-011`, `SA-EXEC-009`, `MB-RAW-003`, `JQ-RAW-003`, `DB-FRAG-002`, `SX-RAW-002`, `SE-RAW-003`, `GR-RAW-006`, `BU-RAW-002`, `PR-RAW-008`, `DR-RAW-007`, `TO-RAW-007`, `SQ-RAW-003`, `MG-RAW-*`, `AL-SQLI-008`, `EX-RAW-004` (≈16 collapse here) |
| `SQLIR-JOIN-010` | Multiple LEFT JOINs to to-many tables (read `extras.cardinality_hint`) — cartesian | `TO-CART-002/003`, `SQ-CART-001`, `JQ-BAG-001`, partly `JPA-BAG-003` |
| `SQLIR-SCAN-011` | `SELECT … WHERE x = ?` on a column known not to be indexed (uses schema metadata when available) | new — was not in Parts I–III; gained via SQL layer |
| `SQLIR-NOOP-012` | `SELECT *` then projection of 1–2 cols downstream | partial overlap with `DJ-PROJ-010`, `JPA-PROJ-007`, `SA-DTO-006` |
| `SQLIR-EXISTS-013` | `SELECT 1 FROM … LIMIT 1` instead of `EXISTS(SELECT 1 …)` | `DJ-N1-005` (`if qs:` truthy check) |
| `SQLIR-ORDER-014` | `ORDER BY` on a column with no LIMIT — typically wasted work | new |

Plus the existing SQL001–SQL010 from [sql_lint.rs](../src/sql_lint.rs) fire automatically because `PredictedStatement.render_cache` returns the SQL string and we feed it back through the same `sqlparser` pipeline. **Free coverage**.

### MM.2 What stays as ORM-only rule (SQL-invisible)

These can't be detected by looking at SQL because the SQL is fine — the antipattern is at the ORM layer (hydration, round-trips, schema-time, decorators). Keep them in Parts I–III:

| Category | Examples |
|---|---|
| **Row explosion at hydration** | Hibernate `@OneToMany(EAGER)`, SQLAlchemy `joinedload` on to-many, `MultipleBagFetchException` shape, TypeORM `leftJoinAndSelect` multi-collection |
| **Hidden round-trip** | Prisma fluent `findUnique().posts()`, Mongoose `populate().populate()`, SQLAlchemy `lazy="dynamic"` |
| **Decorator/annotation hazards** | `@Fetch(SELECT)` w/o `@BatchSize`, `@OneToMany(eager=true)` in TypeORM, JPA `@Cache(READ_WRITE)` on hot-write |
| **Migration safety** | All Alembic rules — there's no SQL at static-analysis time; the AST *is* the artifact |
| **Cache strategy** | Hibernate L2, Doctrine result cache, TypeORM cache TTL — bypass the SQL layer entirely |
| **Schema-shape** | TypeORM type vs decorator inconsistency, Drizzle relations not declared, Mongoose `lean()` missing on JSON response |
| **Framework-specific gotchas** | Django `iterator()` after `prefetch_related`, jOOQ `fetchMap` collision, `bool(qs)` truthiness |

Roughly 35 of the 122 rules across Parts I–III fall here — the irreducible ORM-aware layer.

---

## NN — Finding fusion: triangulation for high precision

Two rule layers fire independently:
1. **ORM-level rules** (Parts I–III) on `OrmContext` — detect framework-specific shapes.
2. **SQL-IR rules** (Part IV, §MM) on `PredictedSql` — detect language-agnostic SQL shapes.

Both attach findings at `(file, line)` byte ranges. After both layers run, a **fusion pass** merges them:

```rust
/// Runs after Parts I-III ORM rules + Part IV SQL-IR rules.
/// Same site fired by ≥2 independent rules → boost confidence.
pub fn fuse_findings(findings: Vec<Finding>) -> Vec<Finding> {
    let mut by_site: HashMap<(File, ByteRange), Vec<Finding>> = HashMap::new();
    for f in findings { by_site.entry(f.site()).or_default().push(f); }

    by_site.into_iter().flat_map(|(site, group)| match group.len() {
        1 => group,
        _ => {
            // Triangulation: multiple paths agree on this site.
            // Merge into one Finding with boosted confidence, all
            // original rule IDs preserved in evidence chips.
            let merged = merge_findings(site, group);
            vec![merged]
        }
    }).collect()
}

fn merge_confidence(individual: Vec<f64>) -> f64 {
    // Multiplicative complement — Bayesian-flavored, not Bayesian.
    // c = 1 - Π(1 - ci)
    //   2 paths at 0.85 → 0.977
    //   3 paths at 0.85 → 0.997
    //   1 path  at 0.85 → 0.85
    1.0 - individual.iter().map(|c| 1.0 - c).product::<f64>()
}
```

### NN.1 Example fusion

```python
# views.py:42
for user in User.objects.all():
    print(user.posts.count())
```

What fires:

| Layer | Rule | Confidence |
|---|---|---|
| ORM (Django) | `DJ-N1-001` (loop + lazy access without prefetch_related) | 0.85 |
| SQL-IR | `SQLIR-N1-001` (statement with `iteration_marker=LoopRow` + WHERE referencing loop var) | 0.85 × Partial-weight 0.6 = 0.51 |

Fused confidence: `1 - (1 - 0.85) × (1 - 0.51) = 0.926`. Reported as **one** finding with both rule IDs in the evidence chips. The user sees "DJ-N1-001 + SQLIR-N1-001" — corroborating signals.

If only `DJ-N1-001` fires (the Django prediction had no `iteration_marker` because the chain extractor missed it) → confidence stays at 0.85. We never *lose* precision by adding the SQL layer; we only gain when both agree.

### NN.2 Conflict handling

What if rules disagree? E.g., ORM rule says "no prefetch" but SQL-IR rule sees a single SELECT with JOIN (because the chain *did* include `select_related`). The two shouldn't both fire — but if they do, fusion picks the **higher-confidence** finding and downgrades the lower. The rule with the lower confidence is logged as a *suppressed* finding (telemetry) for calibration follow-up.

This is also where **fidelity** does work: a Concrete SQL prediction that contradicts an ORM rule is more trustworthy than a Symbolic one. Rule layer order: SQL-IR Concrete > ORM-level > SQL-IR Partial > SQL-IR Symbolic.

---

## OO — Where to put the code

```
src/orm/
  mod.rs             ── shared scaffolding (OrmKind, FrameworkSet, Severity wiring)
  sql_ir.rs          ── NEW: PredictedSql, PredictedStatement, SqlFidelity, WhereExpr, Value, SqlExtras
  sql_ir_rules.rs    ── NEW: SqlIrRule + BUILTIN_SQL_IR_RULES (14 rules)
  dialect.rs         ── NEW: OrmDialect trait + DIALECTS registry
  fusion.rs          ── NEW: fuse_findings, merge_confidence, triangulation logic
  context.rs         ── NEW: shared OrmContext trait abstracting per-lang variants
  python/            ── Part I; each module impls OrmDialect for its ORM
  ts/                ── Part II; same
  jvm/               ── Part III; same
  go/                ── Part III
  rs/                ── Part III
```

The `OrmDialect` impls live next to the per-ORM rule files — same module, same Cargo unit. A new framework = one file with both: rule catalog and dialect impl.

---

# Part V — 90 %-precision strategy

## PP — Why 90 % is the right target

Precision = true-positive rate among findings shipped. Recall is secondary for a code-review tool: a missed bug is recoverable; a noisy false-positive trains developers to ignore the tool. Industry benchmarks:

- Veracode: ~1 % FP rate at the very strict tier; broader rule sets hover 10–25 %.
- Checkmarx: 36 % FP rate in independent benchmark.
- SonarQube: 1 % on the OWASP Benchmark, much higher in the wild.
- Ruff: ~0 % FP on stable rules because Ruff *only* ships rules with formal proofs of correctness on the AST.

90 % precision = 10 % FP. Above SonarQube's wild-rate, below Ruff's stable-rule rate. Achievable for ORM linting because:
1. **The patterns are well-defined** (community has cataloged them for 15 years).
2. **The triangulation engine** boosts our effective rate above any single rule.
3. **The fidelity ladder** lets us be honest about uncertainty.
4. **The corpus calibration** (below) flushes out the FP-prone rules before ship.

## QQ — Five precision-bearing mechanisms

### QQ.1 Triangulation (§NN)
Same finding from two independent paths → confidence ~0.97 from two paths at 0.85.

### QQ.2 Fidelity-aware confidence
Per-fidelity multipliers on every SQL-IR rule:

| Fidelity | Multiplier | Rationale |
|---|---|---|
| `Concrete` | 1.00 | rule's nominal confidence stands |
| `Partial` | 0.60 | unknown holes shrink trust |
| `Symbolic` | 0.30 | rule is essentially guessing |

A rule firing at 0.90 on a Concrete prediction reports 0.90. The same rule on a Partial prediction reports 0.54 — likely below the ship threshold for "informational" tier.

### QQ.3 Per-rule corpus calibration (gate before ship)

| Tier | FP-rate gate | Confidence range | What to do |
|---|---|---|---|
| **Critical** | < 5 % | ≥ 0.90 | Ship as `severity = high` |
| **Standard** | < 15 % | 0.70–0.89 | Ship as `severity = medium` |
| **Advisory** | < 30 % | 0.40–0.69 | Ship as `severity = low / informational` |
| **Reject** | ≥ 30 % | n/a | Don't ship; revisit |

A rule that doesn't clear its tier's gate gets demoted (high → medium → low) or held back. The gate is mechanical: run the rule on the OSS corpus (§QQ.5), classify each finding TP/FP by hand or via an annotated harness, compute the rate.

### QQ.4 Schema-aware sanity checks
For ORMs where we have schema (Prisma via `psl`, Drizzle via tree-sitter, SQLAlchemy via `Mapped[]` annotations, JPA via decorator scan): rules cross-check predicted SQL against the schema. A SELECT against an unknown table → suppress (likely an indirection we missed). A WHERE on an unknown column → likewise. This shaves silent FPs from chain-extractor bugs.

### QQ.5 OSS corpus

Per language, 5 large production codebases. Run the analyzer; per rule, classify the first 50 findings by hand. Gate-or-demote each rule. Repeat each minor release.

| Language | Corpus targets |
|---|---|
| Python (Django) | sentry, Saleor, pretalx, Mastodon-py, Airflow |
| Python (SQLAlchemy) | Apache Superset, Open edX, Indico, OAuthLib server, awx |
| TS/JS | Cal.com, Plane, Trigger.dev, Twenty, Documenso |
| JVM (Spring) | spring-petclinic, Eureka, JHipster sample app, BroadleafCommerce, Plaid |
| JVM (other) | Apache Cassandra (jOOQ), MyBatis-Plus examples, Exposed samples, Slick example apps |
| Go | grafana, kubernetes-controller-manager, Caddy, n8n's Go components, hashicorp/vault |
| Rust | Diesel example app, axum + sqlx demos, SeaORM examples, Helix editor (no DB but has tree-sitter integration patterns we mirror) |

Total: **~35 projects × ~200 findings each ≈ 7000 findings classified for v1**. Substantial work, but the only credible path to a precision claim.

## RR — Honest limitations we declare upfront

Things the static analyzer can't see:

1. **Indirect chains** — `qs = get_users()` where `get_users()` lives across the codebase. v1 is intra-procedural; we miss these.
2. **Reflection / dynamic attribute access** — `getattr(model, attr_name)` in Python, `Object.entries(opts).forEach(...)` in TS, reflection in Java. We give up.
3. **Conditional eager loading** — `if include_posts: qs = qs.prefetch_related('posts')`. Without branch-merging, we conservatively assume the negative branch.
4. **Runtime metadata** — JPQL strings inside `@Query("…")` may reference column names we can't fully resolve without schema metadata. Confidence: Partial.
5. **Custom managers and repository methods** — `User.objects.active()` where `active` is a custom Manager method. v1 only knows built-ins; v2 scans Manager subclasses.

These are documented in user-facing docs, not buried in code. A static analyzer that admits its limits is more trustworthy than one that doesn't.

---

# Part VI — Full step-by-step build order

This consolidates the build order from Parts I §6 (Python steps), Part II §U (TS effort), Part III §EE (JVM/Go/Rust effort), and Part IV's unified engine into one numbered sequence. Each milestone is independently shippable as a drift release.

## SS — Phase 1: Foundation (~4 weeks)

> Goal: ship Python (Django, SQLAlchemy) as the proof-of-architecture. Get the dialect/IR/fusion engine working end-to-end with one concrete user-visible deliverable.

1. **Plumbing** (3 d): Create `src/orm/{mod,sql_ir,sql_ir_rules,dialect,fusion,context}.rs` skeletons. Wire `collect_orm_findings` stub into `insights.rs:518`. Add `FindingKind` variants (eight per Part II §6 reasoning, plus eight more per Part III §FF — total 16 new). Schema bump in [profile.schema.json](../schema/profile.schema.json). Tests passing with empty rule sets.
2. **Tree walks for ORM context** (4 d): Implement `extract_tags_inner` second-pass walks (§D of plan) to build `PyOrmContext` — binding map, loop ranges, comprehension ranges, decorator sites. Test on 20+ synthetic fixtures.
3. **Django dialect + rules** (4 d): Implement `DjangoDialect::predict_all`, ship 12 ORM-level rules (§3.1). All rules fire on positive fixtures, none on 2× negative fixtures each.
4. **SQL-IR + cross-ORM rules** (3 d): Implement `PredictedSql`, `SqlFidelity`, `BUILTIN_SQL_IR_RULES` (14 rules per §MM.1). Verify they fire on Django predictions.
5. **Fusion engine** (2 d): Implement `fuse_findings`. Test triangulation: ORM-only firing → 0.85; both firing → ~0.93.
6. **Calibration on Django corpus** (3 d): Run on Sentry, Saleor, pretalx, Mastodon-py, Airflow. Per-rule FP-rate classification. Gate-or-demote.
7. **SQLAlchemy dialect + rules + recalibrate** (4 d): Same pattern, smaller surface (10 rules), reuse infrastructure.
8. **Ship drift 0.2** — Python-Django + SQLAlchemy ORM linting.

**End of Phase 1 deliverable:** 22 ORM rules + 14 SQL-IR rules. Average precision target ≥ 90 % on stable tier. ~4 weeks.

## TT — Phase 2: TS/JS coverage (~3 weeks)

> Goal: cover the two trending ORMs (Prisma, Drizzle) plus the legacy heavyweight (TypeORM).

9. **TS context + dialect scaffolding** (3 d): `TsOrmContext` (Part II §R), array-method-callback ranges, decorator captures in typescript.rs.
10. **Prisma dialect + rules + `psl` integration** (3 d): Walker loads schema.prisma via `psl::parse_schema`; client analysis uses tree-sitter. 8 rules (§M.3).
11. **Drizzle dialect + rules** (2.5 d): tree-sitter walks for `pgTable`/`relations`; 7 rules including the two ports from Drizzle's own ESLint plugin.
12. **TypeORM dialect + rules** (3 d): Decorator-driven; 8 rules.
13. **Sequelize + Mongoose dialects** (3.5 d): 5 + 6 rules; Mongoose **does not** go through `PredictedSql` (MongoDB), gets its own ORM-rule pipeline.
14. **Calibration on TS corpus** (2 d): Cal.com, Plane, Trigger.dev, Twenty, Documenso.
15. **Ship drift 0.3** — TS/JS coverage.

**End of Phase 2 deliverable:** 56 ORM rules + same 14 SQL-IR rules (now fed by 8 dialects). ~3 more weeks (cumulative 7 weeks).

## UU — Phase 3: JVM (~4 weeks)

> Goal: address the biggest enterprise footprint.

16. **JVM annotation captures + JpaContext** (3 d): Java/Kotlin/Scala annotation captures normalized via `@ann.name` / `@ann.args`. Shared `JpaContext` (Part III §Z.2).
17. **JPA dialect + rules** (4 d): 12 rules shared across Java/Kotlin/Scala.
18. **Spring Data + jOOQ + MyBatis** (4.5 d): 5 + 4 + 3 rules.
19. **Exposed + Ktorm** (2.5 d): 4 + 3 rules.
20. **Slick + Doobie + Quill** (2.5 d): 3 + 2 + 2 rules.
21. **Calibration on JVM corpus** (3 d): JHipster sample, spring-petclinic, BroadleafCommerce, Plaid Java, plus Scala/Kotlin sample apps.
22. **Ship drift 0.4** — JVM coverage. Single biggest user-base unlock.

**End of Phase 3:** +38 rules. Cumulative ~11 weeks.

## VV — Phase 4: Go + Rust (~2 weeks)

23. **Go context + GORM** (3 d): 6 rules.
24. **ent + bun + sqlc integration** (2 d).
25. **Rust context + Diesel + SQLx + SeaORM** (4 d): 9 rules; SQLx macro → `Reference.sql_literal` integration unlocks existing SQL001–SQL010 rules.
26. **Calibration** (2 d).
27. **Ship drift 0.5** — full language coverage.

**End of Phase 4:** +20 rules. Cumulative ~13 weeks.

## WW — Phase 5: Triangulation tuning + cross-file ModelGraph (~2 weeks)

28. **Triangulation tuning** (3 d): Per-rule confidence calibration based on Phase-1-4 fusion data. Re-run corpus. Demote/promote rules.
29. **Cross-file ModelGraph (Python, JVM)** (5 d): Project-wide model registry for Django + Hibernate. Promotes ~8 rules from confidence 0.65 → 0.90.
30. **SQLAlchemy 2.0 `Mapped[]` cardinality lift** (1 d): Already in Part I §E plan; full implementation here.
31. **Ship drift 1.0** — production-grade ORM linting across 7 languages, 122 rules, 90 %-precision target met.

**End of Phase 5:** No new rules; precision improvements. Cumulative ~15 weeks.

## XX — Out-of-scope for v1 (parked for v2)

- Incremental analysis via Salsa (Part I §K — ty-style)
- Inter-procedural binding propagation
- Branch-sensitive (control-flow-aware) bindings
- MyBatis XML mapper parsing (needs tree-sitter-xml)
- Quill macro expansion (we read pre-expansion source — adequate for v1)
- Mongo aggregation pipeline analysis (only basic populate detection in v1)
- Niche ORMs from [ORM_NICHE_CATALOG.md](ORM_NICHE_CATALOG.md): Piccolo, Tortoise, Peewee, Pony (Python); Ebean, Reladomo (JVM); Sutando, Eloquent variants (PHP); Krill, AvramJS (others). v2 milestone.

## YY — Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `psl` crate breaking API change | Medium | Low | Pin tightly; fallback to `@mrleebo/prisma-ast` via shell-out documented in Part II §T |
| Triangulation pushes confidence above true precision | Medium | High | Calibrate fusion weights on corpus; multiplicative-complement is well-behaved but verify per-rule |
| FP rates exceed tier gates on multiple rules | High | Medium | Demote rules to advisory tier; corpus run is gate, not aspiration |
| Tree-sitter walk perf regression on large repos | Low | Medium | Existing pipeline budget (§G) allows +2 s on 10K files; measure pre-ship |
| Per-ORM dialect bugs land partial SQL into Concrete tier | Medium | High | Conservative: when in doubt, downgrade to Partial. Better FP from low confidence than from over-trust |
| Schema bump (`FindingKind` variants) breaks downstream tools | Low | Low | Use `#[non_exhaustive]` on enum; viewer tolerates unknown variants |
| Cross-file ModelGraph build time on huge repos | Low | Medium | Cache per workspace; gate behind `--with-model-graph` flag for v1 |

---

## ZZ — Summary table

|  | Rules | Effort | Precision target |
|---|---|---|---|
| Part I — Python | 30 | 14–18 d | 90 % |
| Part II — TS/JS | 34 | 19 d | 88 % (Prisma 92 %, others 85–88 %) |
| Part III — JVM | 38 | 18–22 d | 88 % (JPA 90 %, Scala/Doobie 85 %) |
| Part III — Go | 11 | 7 d | 87 % |
| Part III — Rust | 9 | 5 d | 92 % (compile-time ORMs cleaner) |
| Part IV — SQL-IR layer | 14 | 8 d | 90 % weighted by fidelity |
| Part V — Calibration corpus | — | 3 d × 5 langs = 15 d | gate, not target |
| Part VI — Fusion + cross-file v2 | — | 8 d | reaches 90 % aggregate via triangulation |
| **Combined v1 (Phases 1-5)** | **136** | **~14–15 weeks** | **90 % stable / 95 %+ on Concrete-fidelity rules** |

This is the bulletproof shape. Six parts, three rule layers (ORM-specific + SQL-IR + fusion), one IR (`PredictedSql` with fidelity), one trait (`OrmDialect`), one corpus methodology — all hanging off the existing drift-static-profiler pipeline with `psl` as the single new dependency.

---

## Sources (Part IV–VI)

- Internal: [research/ORM_SQL_PREDICTION.md](ORM_SQL_PREDICTION.md) — the reused `PredictedSql`, `OrmDialect`, `CallStep`
- Internal: [research/ORM_TO_SQL_TRANSLATION.md](ORM_TO_SQL_TRANSLATION.md) — feasibility matrix per ORM
- Internal: [research/SQL_IO_HEURISTICS_AND_PLUGIN_ARCH.md](SQL_IO_HEURISTICS_AND_PLUGIN_ARCH.md) — SQL012–SQL025 rule specs
- Internal: [research/ORM_NICHE_CATALOG.md](ORM_NICHE_CATALOG.md) — v2 ORM expansion
- Internal: [research/OSS_BUG_CORPUS_METHODOLOGY.md](OSS_BUG_CORPUS_METHODOLOGY.md) — corpus methodology (referenced in Part V §QQ.5)
- [Petersohn et al. — "Static SQL Coverage in Real Codebases"](https://dl.acm.org/doi/10.1145/3611643.3616310) — referenced for the "80 %+ static-translatable" claim
- [Ruff — "Why we don't ship rules with false positives"](https://docs.astral.sh/ruff/linter/#stability) — precision-over-recall philosophy
- [SonarQube false-positive analysis (Mobb)](https://www.mobb.ai/blog/sast-tools-false-positive-comparison) — industry FP-rate context
- Existing [src/sql_lint.rs](../src/sql_lint.rs) — the `SqlRule` shape we extend with `SqlIrRule`

---

# Part VII — Implementer Deep Dive: Algorithms, Worked Examples, Operational Concerns

> Round 7 closes the gaps an implementer would hit when reading the plan top-to-bottom. Each section leads with the **reasoning** for why this content has to exist, then the **content**, then the **tradeoffs**. The format is deliberately uniform so a reader can skip to whichever gap they're hitting.

## AAA — Worked end-to-end example: a Django N+1 traced through the pipeline

**Reasoning.** Parts I–VI describe each stage in isolation. The implementer needs to see one example flow through every stage so they can verify their mental model. We pick the canonical Django N+1 because it triggers both rule layers and demonstrates triangulation.

### AAA.1 The source under analysis

```python
# views.py
from django.db.models import QuerySet
from .models import User

def show_users(request):
    qs = User.objects.filter(active=True)              # line 5
    for user in qs:                                     # line 6
        print(user.posts.count())                       # line 7
```

`User` has a `ForeignKey` from a `Post` model (defined elsewhere in the same project).

### AAA.2 Stage 1 — tree-sitter parse + tags extraction (existing pipeline)

`tags.rs` emits a `FileTags` with:

```
imports: [
  Import { module: "django.db.models", name: "QuerySet" },
  Import { module: ".models", name: "User" }
]
symbols: [
  Symbol { name: "show_users", kind: Function, line: 4, byte_range: 100..300 }
]
references: [
  Reference { name: "filter", receiver: "User.objects", line: 5, byte_offset: 145, in_symbol: "show_users" },
  Reference { name: "count",  receiver: "user.posts",   line: 7, byte_offset: 235, in_symbol: "show_users" }
]
```

Two reference call-sites. The `for user in qs:` loop itself isn't a `Reference` (it's not a call), so we need the second tree walk.

### AAA.3 Stage 2 — second tree walk builds PyOrmContext (Part I §D)

Per the tree-lifetime decision (Part I §D), the second walk happens before `tree.drop()`. It populates:

```rust
PyOrmContext {
    file: "views.py",
    imports: <as above>,
    bindings: {
        "qs": Binding {
            kind: DjangoQuerySet(QuerySetFacts {
                model: Some("User"),
                prefetched: [],
                select_related: [],
                only_fields: [],
                sliced: false,
            }),
            byte_range: 140..170,  // RHS of `qs = ...`
            scope: ScopeId(1),     // show_users function body
        },
        "user": Binding {
            kind: DjangoModelInst(ModelInstFacts {
                model: Some("User"),
                source_queryset: Some("qs"),  // ← critical for triangulation
            }),
            byte_range: 200..220,  // for-loop var binding
            scope: ScopeId(2),     // loop body
        }
    },
    for_loops: [
        LoopRange {
            iterable_var: "qs",
            loop_var: "user",
            body_range: 200..280,
            line_range: 6..8,
        }
    ],
    class_defs: [],  // none in this file
    references: <ref above>,
}
```

The Django-specific binding inference applies:
- `User.objects.filter(active=True)` → `DjangoQuerySet { model: "User" }` (matches `<ModelName>.objects.<method>` shape per Part I §2.2)
- The for-loop binding inherits: `bindings["user"] = DjangoModelInst { model: "User", source_queryset: "qs" }`

### AAA.4 Stage 3a — ORM-level rules fire (Part I §3.1)

`DjangoDialect`'s rule pass iterates `BUILTIN_DJANGO_RULES`:

```
DJ-N1-001 (loop iter + lazy access without prefetch_related):
  • for-loop at 6..8 iterates `qs`
  • body contains reference `user.posts.count` (where `posts` is unknown but `user` is DjangoModelInst)
  • qs.prefetched does NOT contain "posts"
  • → FIRE, line 7, confidence 0.85
```

Emits:

```rust
Finding {
    kind: FindingKind::DjangoAntipattern,
    severity: Severity::High,
    effort: Effort::Small,
    confidence: 0.85,
    line: 7,
    message: "Iterating queryset `qs` and accessing related `posts.count` without prefetch_related",
    evidence: [
        Evidence { call: "DJ-N1-001", line: 7 },
        Evidence { call: "for user in qs:", line: 6 },
        Evidence { call: "user.posts.count()", line: 7 },
    ],
    remediation: Some("Add .prefetch_related('posts') to the queryset or use .annotate(Count('posts'))"),
    fidelity: None,           // ORM-level rules don't carry fidelity
    fusion_paths: vec!["DJ-N1-001"],  // single path so far
    predicted_sql: None,
}
```

(`fidelity`, `fusion_paths`, `predicted_sql` are new `Finding` fields — see §JJJ below.)

### AAA.5 Stage 3b — Dialect predict_all builds PredictedSql

`DjangoDialect::predict_all` walks the bindings and references to assemble call chains. For this file it emits **two** predictions:

**Prediction 1 — the queryset materialization** (driven by `for user in qs:` consuming `qs`):

```rust
PredictedSql {
    orm: OrmKind::Django,
    statements: vec![
        PredictedStatement {
            op: SqlOp::Select,
            tables: vec![TableRef::name("user")],
            projection: Projection::Full,
            where_expr: Some(WhereExpr::Eq(
                ColumnRef::name("active"),
                Value::Literal(LiteralKind::Bool(true)),
            )),
            joins: vec![],
            order_by: None,
            limit: None,
            offset: None,
            iteration_marker: None,  // outer SELECT is not in a loop
            ..default()
        }
    ],
    fidelity: vec![SqlFidelity::Concrete],
    anchor: SourceAnchor { file: "views.py", byte_range: 140..170, line: 5 },
    call_steps: vec![
        CallStep { method: "objects", receiver: "User",       args: vec![] },
        CallStep { method: "filter",  receiver: "qs[partial]", args: vec![Arg::Kwarg("active", Value::Literal(Bool(true)))] },
    ],
    extras: SqlExtras {
        cardinality_hint: Some(Cardinality::Many),
        triggers_hydration_of: vec!["User"],
        crosses_round_trip: false,
        in_transaction: false,
        in_async_context: false,
        framework_specific: HashMap::new(),
    },
}
```

**Prediction 2 — the per-row count** (driven by `user.posts.count()` inside the loop):

```rust
PredictedSql {
    orm: OrmKind::Django,
    statements: vec![
        PredictedStatement {
            op: SqlOp::Select,
            tables: vec![TableRef::name("post")],
            projection: Projection::Aggregate(AggFn::Count, ColumnRef::wildcard()),
            where_expr: Some(WhereExpr::Eq(
                ColumnRef::qualified("post", "user_id"),
                Value::BoundFromLoopVar { var: "user", field: "id" },  // ← key
            )),
            joins: vec![],
            iteration_marker: Some(IterationMarker {
                kind: IterKind::ForLoop,
                loop_var: "user",
                body_range: 200..280,
            }),
            ..default()
        }
    ],
    fidelity: vec![SqlFidelity::Concrete],
    anchor: SourceAnchor { file: "views.py", byte_range: 235..255, line: 7 },
    call_steps: vec![
        CallStep { method: "posts", receiver: "user",       args: vec![] },
        CallStep { method: "count", receiver: "user.posts", args: vec![] },
    ],
    extras: SqlExtras {
        cardinality_hint: Some(Cardinality::One),
        triggers_hydration_of: vec![],
        crosses_round_trip: true,  // per-iteration round-trip — the smoking gun
        ..default()
    },
}
```

The chain extractor populates `iteration_marker` because the *receiver* of the `count()` call traces back to a loop variable.

### AAA.6 Stage 3c — SqlIrRule pass fires on the second prediction

```
SQLIR-N1-001 (statement w/ iteration_marker + WHERE references loop var):
  • Prediction 2: iteration_marker = Some(ForLoop)
  • where_expr.Eq.rhs = Value::BoundFromLoopVar { var: "user", ... }
  • → FIRE, line 7, fidelity Concrete → confidence 0.85 × 1.00 = 0.85
```

Emits:

```rust
Finding {
    kind: FindingKind::SqlAntipattern,
    severity: Severity::High,
    confidence: 0.85,
    line: 7,
    message: "SELECT in loop body references loop variable in WHERE — classic N+1 SQL shape",
    evidence: [
        Evidence { call: "SQLIR-N1-001", line: 7 },
        Evidence { call: "SELECT COUNT(*) FROM post WHERE user_id = $LOOP.user.id", line: 7 },
    ],
    fidelity: Some(SqlFidelity::Concrete),
    fusion_paths: vec!["SQLIR-N1-001"],
    predicted_sql: Some(/* the second prediction */),
    ...
}
```

### AAA.7 Stage 4 — Fusion (Part IV §NN)

Two findings on `(views.py, line 7)`. `fuse_findings` groups them:

```
group: [DJ-N1-001 @0.85, SQLIR-N1-001 @0.85]
merged_confidence = 1 - (1-0.85)(1-0.85) = 0.9775
final FindingKind: DjangoAntipattern  // framework-specific wins for UX
evidence: union of both findings' evidence rows
fusion_paths: ["DJ-N1-001", "SQLIR-N1-001"]
```

One final finding emitted:

```rust
Finding {
    kind: FindingKind::DjangoAntipattern,
    severity: Severity::High,
    confidence: 0.978,
    line: 7,
    message: "Iterating queryset `qs` and accessing related `posts.count` without prefetch_related (corroborated by SQL-shape rule)",
    evidence: [
        Evidence { call: "DJ-N1-001 + SQLIR-N1-001", line: 7 },   // chip shows both
        Evidence { call: "for user in qs:", line: 6 },
        Evidence { call: "SELECT COUNT(*) FROM post WHERE user_id = $LOOP.user.id", line: 7 },
    ],
    remediation: Some("Add .prefetch_related('posts') to the queryset or use .annotate(Count('posts'))"),
    fidelity: Some(SqlFidelity::Concrete),
    fusion_paths: vec!["DJ-N1-001", "SQLIR-N1-001"],
    predicted_sql: Some(/* prediction 2 */),
    ...
}
```

**Why this matters.** A user reading the report sees one high-confidence finding with two independent rule IDs corroborating. Confidence is ~0.98 — well above the 0.90 ship gate for high-severity rules. This is exactly the precision behavior Part V promises.

If the SQL-IR path *didn't* fire (chain extractor missed it), we still ship the ORM-level finding at 0.85. The architecture degrades gracefully.

## BBB — CallStep chain reconstruction algorithm

**Reasoning.** `tags.rs` gives us a flat list of `Reference` call sites. `OrmDialect::predict_all` needs ordered **chains**: `User.objects.filter(active=True).prefetch_related('posts')` is one chain of 3 calls. How do we go from flat references to ordered chains? The plan never said.

### BBB.1 The chain reconstruction problem

A chain like `a.b().c().d()` parses in tree-sitter as nested `call_expression` (or `call` for Python):

```
call_expression(
  function: member_expression(
    object: call_expression(
      function: member_expression(
        object: call_expression(
          function: member_expression(object: a, property: b)),
        property: c)),
    property: d))
```

Each call site is a separate `Reference` in `tags.rs` output. To reconstruct the chain we need to know **which call site is the receiver of which**.

### BBB.2 The algorithm

Run during the second tree walk (Part I §D), populating a `chains: Vec<CallChain>` field on `OrmContext`:

```rust
pub struct CallChain<'a> {
    /// In source order: chain[0] is the innermost call, chain[N-1] is outermost.
    /// For `a.b().c().d()`, chain = [b(), c(), d()].
    pub steps: Vec<CallStep<'a>>,
    /// What the chain is anchored on. `a` in the example above.
    pub root: ChainRoot<'a>,
    /// Byte range of the whole chain in source.
    pub byte_range: Range<usize>,
}

pub enum ChainRoot<'a> {
    Identifier(&'a str),       // `a.b().c()` — root is identifier `a`
    Binding(BindingId),        // `qs.filter()` — root is a tracked binding
    LoopVar(BindingId),        // `user.posts.count()` — root is a for-loop var
    ModuleAttr(&'a str, &'a str),  // `prisma.user.findMany()` — root is `prisma.user`
    Unknown,                   // chain root can't be resolved (helper function return)
}
```

**Algorithm** (walks the tree-sitter tree top-down):

```rust
fn reconstruct_chains(tree: &Tree, source: &str, ctx: &mut OrmContext) {
    let mut cursor = tree.walk();
    let mut visit_stack: Vec<NodeId> = vec![];
    visit_outer_calls(&mut cursor, source, ctx, &mut visit_stack);
}

fn visit_outer_calls(
    cursor: &mut TreeCursor,
    source: &str,
    ctx: &mut OrmContext,
    seen: &mut Vec<NodeId>,
) {
    // Only enter call_expressions whose PARENT is not a member_expression
    // whose object is THIS node. That gates "outermost call of a chain"
    // and prevents double-walking inner calls.
    let node = cursor.node();
    if node.kind() == "call_expression" && !is_inner_call_of_chain(node) {
        let chain = walk_chain_down(node, source);
        ctx.chains.push(chain);
        // Mark all inner calls as visited so we don't reprocess them
        for step_node in chain_member_nodes(node) {
            seen.push(step_node.id());
        }
    }
    // Recurse — but skip subtrees we've already processed
    if cursor.goto_first_child() {
        loop {
            if !seen.contains(&cursor.node().id()) {
                visit_outer_calls(cursor, source, ctx, seen);
            }
            if !cursor.goto_next_sibling() { break; }
        }
        cursor.goto_parent();
    }
}

fn walk_chain_down(outer: Node, source: &str) -> CallChain {
    let mut steps: Vec<CallStep> = vec![];
    let mut current = outer;
    loop {
        let method = node_method_name(current);
        let args = node_args(current);
        steps.push(CallStep { method, args, byte_range: current.byte_range() });
        // Walk down to the inner call (the receiver of this one)
        match inner_call_or_root(current) {
            Some(inner) => current = inner,
            None => {
                let root = classify_root(current, source);
                steps.reverse();  // chain is now innermost-first
                return CallChain { steps, root, byte_range: outer.byte_range() };
            }
        }
    }
}
```

The two predicates `is_inner_call_of_chain` and `inner_call_or_root` are language-specific because tree-sitter grammars differ:

- **Python**: `call.function` is an `attribute` whose `object` is the inner call.
- **JS/TS**: `call_expression.function` is a `member_expression` whose `object` is the inner call.
- **Java**: `method_invocation.object` is the inner invocation directly.
- **Go**: `call_expression.function` is a `selector_expression` whose `operand` is the inner call.
- **Rust**: `call_expression.function` is a `field_expression` whose `value` is the inner call.
- **Kotlin**: `call_expression.function` is a `navigation_expression` whose first child is the inner call.
- **Scala**: similar to Java but via `field_expression`.

Each per-language module (already present at `src/languages/<lang>.rs`) exposes a small `chain_ops::inner_call_or_root` helper. This keeps language quirks isolated.

### BBB.3 Cost and complexity

- One tree walk; O(N) in nodes.
- Memory: one `CallChain` per outermost-call. For typical Python files this is 10–100 chains; cost is negligible.
- Critical optimization: the `seen` set prevents O(N²) chain re-discovery.

### BBB.4 Edge cases

| Case | How we handle it |
|---|---|
| `f(g(x))` — `g` is inner, `f` is outer, but not the same chain | `g(x)` is its own outermost-call; produces a separate `CallChain` |
| `await foo.bar()` — `await` wraps the chain | The `call_expression` is inside `await_expression`; we walk past `await` transparently and mark the chain `extras.in_async = true` |
| `users.map(u => u.posts.count())` — the callback is a separate chain | Two chains: outer `users.map(...)` and inner `u.posts.count()`. The inner chain's root is the lambda parameter `u`, which we resolve through the parent's `array_method_callbacks` (Part II §R) |
| Chain spans lines (Drizzle is famous for this) | `byte_range` covers the whole span; `line` derived from outermost call's start line |
| Method call on `await`'d value: `(await prisma.user.findUnique(...)).posts()` | Handled as one chain with `extras.crosses_round_trip = true` — Prisma's fluent API |

## CCC — The four ORM-translation families

**Reasoning.** I have 16 dialects but the plan treats each as bespoke. In reality they fall into **four families** based on *how SQL is constructed*. Each family shares a `predict_all` skeleton; per-ORM modules customize details.

### CCC.1 Family taxonomy

| Family | Construction style | Static fidelity | Members |
|---|---|---|---|
| **F1. Reified expression tree** | ORM builds an in-memory query AST that we can mirror | Concrete | SQLAlchemy Core, Drizzle, jOOQ, Diesel, Exposed, Ktorm, ent, SeaORM, bun, Slick (compile-time only) |
| **F2. String + macros** | SQL is a string in source (sometimes inside a macro for compile-time check) | Concrete | SQLx, Doobie, raw `cursor.execute("…")`, Knex's `.raw()` |
| **F3. Opaque builder chain** | ORM defers SQL synthesis to runtime; we reconstruct from method names | Partial | Django ORM, GORM, ActiveRecord, Eloquent, Sequelize, TypeORM (QueryBuilder), Mongoose |
| **F4. Schema-DSL + client API** | Schema in a side-file (DSL or YAML); client calls reference schema objects | Concrete (schema) + Partial (client) | Prisma (`schema.prisma` + client), sqlc (`.sql` + generated client) |

The **annotation/decorator-driven** group (Hibernate/JPA, TypeORM decorators) is a hybrid: the schema lives in annotations (close to F4) but the client API is opaque chain (F3). We treat it as a fifth half-family or split it — see CCC.5.

### CCC.2 F1 algorithm — Reified expression tree

For an ORM in F1, the call chain *is* the query AST. Mapping is mechanical:

```rust
fn predict_f1<'a>(chain: &CallChain<'a>, lang: F1Lang) -> PredictedSql<'a> {
    let mut stmt = PredictedStatement::default();
    let table = lang.resolve_root_to_table(chain.root)?;
    stmt.tables.push(TableRef::name(table));

    for step in &chain.steps {
        match (lang, step.method) {
            (Drizzle, "select")    => stmt.projection = lang.parse_select_args(&step.args),
            (Drizzle, "from")      => stmt.tables = lang.parse_from_args(&step.args),
            (Drizzle, "where")     => stmt.where_expr = Some(lang.parse_where(&step.args)),
            (Drizzle, "leftJoin")  => stmt.joins.push(JoinSpec::left(lang.parse_join(&step.args))),
            (Drizzle, "limit")     => stmt.limit = Some(lang.parse_limit(&step.args)),
            (Drizzle, "offset")    => stmt.offset = Some(lang.parse_offset(&step.args)),
            (Drizzle, "orderBy")   => stmt.order_by = Some(lang.parse_order_by(&step.args)),
            // ... per ORM
            _ => {}  // unknown method — degrade to Partial if it materially affects the statement
        }
    }
    PredictedSql { orm: lang.kind(), statements: vec![stmt], fidelity: vec![Concrete], ... }
}
```

Drizzle is the textbook case — every method maps to one SQL clause. Diesel, Exposed, Ktorm work the same. Concrete fidelity throughout.

**SQLAlchemy Core caveat**: `text("…")` strings inside `select(...).where(text("col = :x"))` drop fidelity to Partial for that statement (the WHERE expr is opaque).

### CCC.3 F2 algorithm — String + macros

For SQLx-style ORMs, the SQL **is** the source. We extract the string, parse it with `sqlparser-rs`, and embed the parsed AST into `PredictedStatement`. Already partly handled by [sql_lint.rs:660](../src/sql_lint.rs#L660); we generalize.

```rust
fn predict_f2<'a>(chain: &CallChain<'a>, lang: F2Lang) -> Option<PredictedSql<'a>> {
    let sql_arg = lang.extract_sql_literal(chain)?;  // None if not a static string
    let parsed = sqlparser::parser::Parser::parse_sql(&dialect_for(lang), sql_arg.text).ok()?;
    let stmt = lower_sqlparser_to_predicted(parsed[0], &sql_arg)?;

    // Detect taint: if the string contained interpolation (f-string, template, format!), mark.
    if sql_arg.has_interpolation {
        mark_user_input_taint(&mut stmt);
    }
    PredictedSql { orm: lang.kind(), statements: vec![stmt], fidelity: vec![Concrete], ... }
}
```

The interpolation detection is per-language:

| Language | Detection |
|---|---|
| Rust | `format!` / `format_args!` macro invocation in arg position; raw `+` between strings |
| Python | `f_string` / `binary_operator(+)` / `%` formatting |
| TS/JS | `template_string` with `template_substitution` children |
| Go | `fmt.Sprintf` / `fmt.Sprint` in arg position |
| Java | `String.format` / `+` with non-literal RHS / text-block with `\{...}` |

Interpolation = `Value::UserInputTaint` populated into the predicted WHERE/VALUES, fueling `SQLIR-RAW-009`.

### CCC.4 F3 algorithm — Opaque builder chain

For F3 ORMs (Django, GORM, ActiveRecord, etc.) we have only method names + kwargs. We map them through a **per-ORM walker table** (already specified in `research/ORM_SQL_PREDICTION.md`):

```rust
// Example: Django walker table excerpt
const DJANGO_TABLE: &[(&str, fn(&mut PredictedStatement, &CallStep))] = &[
    ("filter",          apply_filter_kwargs),         // → AND of Eq's
    ("exclude",         apply_exclude_kwargs),        // → AND of Not(Eq)'s
    ("get",             apply_get_kwargs_with_limit_1),
    ("all",             noop),                        // returns same queryset
    ("select_related",  apply_inner_joins_for_args),
    ("prefetch_related", record_secondary_in_loads),  // → adds secondary statements
    ("only",            restrict_projection),
    ("defer",           remove_from_projection),
    ("annotate",        add_annotation_subqueries),
    ("values",          dict_projection),
    ("values_list",     tuple_projection),
    ("count",           replace_projection_with_count),
    ("first",           append_limit_1),
    ("order_by",        apply_order_by),
    // Unknown methods: degrade fidelity to Partial
];

fn predict_f3<'a>(chain: &CallChain<'a>, lang: F3Lang) -> PredictedSql<'a> {
    let mut stmt = PredictedStatement {
        op: SqlOp::Select,
        tables: vec![lang.resolve_root_table(chain.root)],
        projection: Projection::Full,
        ..default()
    };
    let mut secondary = vec![];
    let mut fidelity = SqlFidelity::Concrete;

    for step in &chain.steps {
        match lang.walker_table().get(step.method) {
            Some(apply) => apply(&mut stmt, step),
            None => fidelity = downgrade(fidelity),  // unknown method
        }
        // Special-case: prefetch_related emits secondary IN-loads
        if step.method == "prefetch_related" {
            secondary.extend(build_secondary_in_loads(&step.args, &stmt));
        }
    }

    let mut statements = vec![stmt];
    statements.extend(secondary);
    let fidelities = vec![fidelity; statements.len()];
    PredictedSql { orm: lang.kind(), statements, fidelity: fidelities, ... }
}
```

Per-ORM walker tables live in `orm/<lang>/<orm>.rs` (Part I/II/III §). Adding a new method to Django = one row in the table.

### CCC.5 The annotation-driven hybrid (JPA/TypeORM-decorator)

For JPA: the **schema** comes from annotations (Z.3 `JpaAnnotation` enum), the **client** is opaque method calls on `Repository` / `EntityManager`. Two-phase predict:

```rust
fn predict_jpa<'a>(chain: &CallChain<'a>, ctx: &JvmCtx<'a>) -> PredictedSql<'a> {
    // Phase A: resolve repository method to entity + return shape.
    let repo_method = chain.steps.first()?;       // e.g. `userRepo.findById`
    let entity = ctx.resolve_repo_entity(chain.root)?;
    let signature = ctx.resolve_repo_method_signature(entity, repo_method.method);
    // signature carries: query type (SELECT/UPDATE), implicit WHERE (e.g. WHERE id = ?), etc.

    // Phase B: layer chained calls (orderBy, stream, etc.).
    let mut stmt = signature.into_predicted_statement();
    for step in &chain.steps[1..] {
        ctx.jpa_walker_table().apply(step, &mut stmt);
    }
    PredictedSql { orm: OrmKind::Jpa, statements: vec![stmt], fidelity: vec![Partial], ... }
}
```

Fidelity is Partial because the *implicit* WHERE clause from method-name inference (`findByEmailAndActive` → `WHERE email = ? AND active = ?`) requires schema knowledge we have but might miss edge cases (custom `@Query` strings, Specifications, named native queries). Partial is honest.

### CCC.6 F4 algorithm — Schema-DSL + client API

Prisma: schema in `.prisma`, client calls in `.ts`. We resolve the schema once at workspace init (`psl::parse_schema`), then per-call we look up models/relations.

```rust
fn predict_prisma<'a>(chain: &CallChain<'a>, ctx: &TsCtx<'a>) -> PredictedSql<'a> {
    let schema = ctx.workspace.prisma_schema()?;
    // chain.root = prisma.user → resolve to schema's "User" model
    let model = schema.resolve_dotted_path(chain.root)?;

    let mut stmt = PredictedStatement::default();
    stmt.tables.push(TableRef::name(model.db_name()));

    for step in &chain.steps {
        match step.method {
            "findMany" | "findUnique" | "findFirst" => {
                stmt.op = SqlOp::Select;
                parse_find_options(&step.args, &mut stmt, model, schema);
                // include/select/where parsed against schema → high precision
            }
            "create" | "createMany"  => { stmt.op = SqlOp::Insert; parse_create(&step.args, &mut stmt); }
            "update" | "updateMany"  => { stmt.op = SqlOp::Update; parse_update(&step.args, &mut stmt); }
            "delete" | "deleteMany"  => { stmt.op = SqlOp::Delete; parse_delete(&step.args, &mut stmt); }
            "count"                  => { stmt.projection = Projection::Aggregate(AggFn::Count, ColumnRef::wildcard()); }
            "$queryRawUnsafe" | "$executeRawUnsafe" => return predict_f2_sql(&step.args, ctx),
            _ => {}
        }
    }
    PredictedSql { orm: OrmKind::Prisma, statements: vec![stmt], fidelity: vec![Concrete], ... }
}
```

`parse_find_options` is the deepest function; it understands Prisma's quirks (`include` vs `select`, nested `take` per-parent, `relationLoadStrategy: "join"` → switches from 2 statements to 1).

## DDD — predict_all skeletons for 4 representative ORMs

**Reasoning.** §CCC gives families. Implementers need a working skeleton per ORM they care about. Four representative ones below; the rest follow the same shape with framework-specific table entries.

### DDD.1 Django (F3) — full skeleton

```rust
pub struct DjangoDialect;

impl OrmDialect for DjangoDialect {
    fn orm(&self) -> OrmKind { OrmKind::Django }

    fn matches(&self, ctx: &OrmContext) -> bool {
        ctx.imports().has_any_starting_with("django.db.models")
            || ctx.imports().has_any_starting_with("django.contrib")
    }

    fn predict_all<'a>(&self, ctx: &'a OrmContext) -> Vec<PredictedSql<'a>> {
        let py_ctx = ctx.as_python().expect("django dialect requires PyOrmContext");
        let mut out = vec![];

        for chain in &py_ctx.chains {
            // Only chains rooted in `<Model>.objects` or a tracked queryset binding
            if !is_django_chain(chain, py_ctx) { continue; }

            let mut stmt = PredictedStatement::default();
            let mut secondary = vec![];
            let mut fidelity = SqlFidelity::Concrete;

            // Resolve root → table
            stmt.tables.push(resolve_django_root(chain.root, py_ctx));

            for step in &chain.steps {
                if let Some(handler) = DJANGO_WALKER.get(step.method.as_str()) {
                    handler(&mut stmt, &mut secondary, step, py_ctx);
                } else if is_known_noop(step.method) {
                    // chain methods that don't affect SQL
                } else {
                    fidelity = SqlFidelity::Partial;
                }
            }

            // Iteration marker — derived from chain's enclosing context
            stmt.iteration_marker = py_ctx.containing_loop(chain.byte_range.start)
                .map(|loop_range| IterationMarker {
                    kind: IterKind::ForLoop,
                    loop_var: loop_range.loop_var.into(),
                    body_range: loop_range.body_range.clone(),
                });

            let mut statements = vec![stmt];
            statements.extend(secondary);
            let fidelities = vec![fidelity; statements.len()];

            out.push(PredictedSql {
                orm: OrmKind::Django,
                statements,
                fidelity: fidelities,
                anchor: SourceAnchor::from_chain(chain),
                call_steps: chain.steps.clone(),
                extras: build_django_extras(chain, py_ctx),
            });
        }

        out
    }
}
```

Implementation footprint: ~600 LOC for `DjangoDialect` itself + ~200 LOC for the walker table (one fn per Django method). Matches the ~1100 LOC of django-check's N+1 detector noted in Part I §A.3.

### DDD.2 Drizzle (F1) — full skeleton

```rust
impl OrmDialect for DrizzleDialect {
    fn matches(&self, ctx: &OrmContext) -> bool {
        ctx.imports().has_any_starting_with("drizzle-orm")
    }

    fn predict_all<'a>(&self, ctx: &'a OrmContext) -> Vec<PredictedSql<'a>> {
        let ts_ctx = ctx.as_typescript().expect("drizzle dialect requires TsOrmContext");
        let schema = ts_ctx.drizzle_schema.as_ref();  // tables + relations
        let mut out = vec![];

        for chain in &ts_ctx.chains {
            if !is_drizzle_chain(chain, ts_ctx) { continue; }

            // Drizzle has two API surfaces:
            //   db.select().from(t).where(...).leftJoin(...).limit()
            //   db.query.tableName.findMany({ with: {...}, where: ... })
            let stmt = match drizzle_api_kind(chain) {
                DrizzleApi::Core => build_drizzle_core(chain, schema),
                DrizzleApi::Relational => build_drizzle_relational(chain, schema),
            };

            out.push(PredictedSql {
                orm: OrmKind::Drizzle,
                statements: vec![stmt],
                fidelity: vec![SqlFidelity::Concrete],
                anchor: SourceAnchor::from_chain(chain),
                call_steps: chain.steps.clone(),
                extras: build_drizzle_extras(chain, ts_ctx),
            });
        }
        out
    }
}
```

Footprint: ~300 LOC. Drizzle is famously thin because the API mirrors SQL.

### DDD.3 JPA (annotation-hybrid) — skeleton

```rust
impl OrmDialect for JpaDialect {
    fn matches(&self, ctx: &OrmContext) -> bool {
        ctx.imports().has_any_of(&["jakarta.persistence", "javax.persistence", "org.hibernate"])
    }

    fn predict_all<'a>(&self, ctx: &'a OrmContext) -> Vec<PredictedSql<'a>> {
        let jvm_ctx = ctx.as_jvm().expect("jpa dialect requires JpaContext");
        let model_graph = jvm_ctx.project_model_graph();  // built from annotations
        let mut out = vec![];

        for chain in &jvm_ctx.chains {
            // Repository.findX / EntityManager.find / @Query method
            let Some(repo_def) = jvm_ctx.repositories.get_chain_root(chain.root) else { continue; };
            let entity = repo_def.entity;

            // Phase A: derive base statement from method name (Spring Data convention)
            let method = chain.steps.first().unwrap();
            let mut stmt = if let Some(query_annotation) = repo_def.query_annotation(method.method) {
                // Explicit @Query("...") — parse JPQL string
                parse_jpql(query_annotation.jpql, model_graph)
            } else {
                // Derived query — parse method name as predicate
                derive_query_from_method_name(method.method, entity, model_graph)
            };

            // Phase B: chained methods (Pageable, Sort, JOIN FETCH from @EntityGraph)
            for step in &chain.steps[1..] {
                jpa_walker_table().apply(step, &mut stmt, model_graph);
            }

            stmt.iteration_marker = jvm_ctx.containing_loop_or_stream(chain.byte_range.start)
                .map(IterationMarker::from);

            out.push(PredictedSql {
                orm: OrmKind::Jpa,
                statements: vec![stmt],
                fidelity: vec![SqlFidelity::Partial],
                anchor: SourceAnchor::from_chain(chain),
                call_steps: chain.steps.clone(),
                extras: build_jpa_extras(chain, jvm_ctx),
            });
        }
        out
    }
}
```

Footprint: ~800 LOC including method-name parser (~200 LOC for the Spring Data "findByEmailAndActive" parser alone). The model graph build is in `JpaContext`, not here.

### DDD.4 GORM (F3) — minimal skeleton

```rust
impl OrmDialect for GormDialect {
    fn matches(&self, ctx: &OrmContext) -> bool {
        ctx.imports().has_any_starting_with("gorm.io/gorm")
    }
    fn predict_all<'a>(&self, ctx: &'a OrmContext) -> Vec<PredictedSql<'a>> {
        let go_ctx = ctx.as_go().expect("gorm dialect requires GoOrmContext");
        let mut out = vec![];
        for chain in &go_ctx.chains {
            if !is_gorm_chain(chain, go_ctx) { continue; }
            let mut stmt = PredictedStatement::default();
            let mut secondary = vec![];
            let mut fidelity = SqlFidelity::Concrete;

            // GORM root: `db.<method>()` or `db.Model(&User{}).<method>()`
            // The Model(...) call carries the table — resolved from struct tags
            stmt.tables = resolve_gorm_table_from_chain(chain, go_ctx);

            for step in &chain.steps {
                if let Some(handler) = GORM_WALKER.get(step.method.as_str()) {
                    handler(&mut stmt, &mut secondary, step, go_ctx);
                } else {
                    fidelity = SqlFidelity::Partial;
                }
            }
            stmt.iteration_marker = go_ctx.containing_loop(chain.byte_range.start).map(IterationMarker::from);
            out.push(PredictedSql {
                orm: OrmKind::Gorm,
                statements: { let mut v = vec![stmt]; v.extend(secondary); v },
                fidelity: vec![fidelity; secondary.len() + 1],
                anchor: SourceAnchor::from_chain(chain),
                call_steps: chain.steps.clone(),
                extras: build_gorm_extras(chain, go_ctx),
            });
        }
        out
    }
}
```

Footprint: ~400 LOC.

## EEE — Fusion engine: edge cases formally specified

**Reasoning.** §NN said "merge findings by site". The plan didn't handle range overlap, 3+ rule agreement, or contradiction. These are real cases on real code.

### EEE.1 Site equivalence — when do two findings "match"?

Two findings co-attach if their byte ranges *overlap by ≥80 %* OR one fully contains the other:

```rust
fn sites_match(a: &Finding, b: &Finding) -> bool {
    if a.file != b.file { return false; }
    let (a_start, a_end) = (a.byte_range.start, a.byte_range.end);
    let (b_start, b_end) = (b.byte_range.start, b.byte_range.end);
    let intersection = a_end.min(b_end).saturating_sub(a_start.max(b_start));
    let union = a_end.max(b_end) - a_start.min(b_start);
    let iou = intersection as f64 / union as f64;
    iou >= 0.80
}
```

`a.byte_range` is added as a `Finding` field in §JJJ below. This handles the common case where the ORM-rule attaches to the for-loop line (line 6) and the SQL-IR rule attaches to the SELECT call site (line 7) — both with `byte_range` covering the same statement.

### EEE.2 K-way fusion (3+ rules agreeing)

Multiplicative complement generalizes naturally:

```rust
fn merge_confidence(findings: &[Finding]) -> f64 {
    let product: f64 = findings.iter().map(|f| 1.0 - f.confidence).product();
    1.0 - product
}
//   1 path @0.85           = 0.850
//   2 paths @0.85, 0.85    = 0.9775
//   3 paths @0.85,0.85,0.85= 0.9966
//   4+ paths               ≈ 1.0
```

A 3-rule agreement caps confidence at 0.997 — strong but not absolute. Calibrated by the corpus run (§V).

### EEE.3 Contradiction handling

Two findings on the same site can *disagree*:
- Rule A says "no prefetch_related, this is N+1"
- Rule B says "SQL shows a JOIN — there's clearly a select_related"

This happens when the chain reconstruction missed a method or when a helper function inserts a `.prefetch_related(...)` we couldn't trace.

```rust
enum Outcome { Agreement, Contradiction, Unrelated }

fn classify_pair(a: &Finding, b: &Finding) -> Outcome {
    if a.diagnostic_axis() == b.diagnostic_axis() {
        match (a.signals_problem(), b.signals_problem()) {
            (true, true)  => Outcome::Agreement,
            (true, false) | (false, true) => Outcome::Contradiction,
            (false, false) => Outcome::Unrelated,
        }
    } else { Outcome::Unrelated }
}
```

`diagnostic_axis()` is a coarse-grained kind: "n+1", "raw-sql-taint", "unbounded-scan", etc. Both ORM rules and SQL-IR rules tag their axis.

On contradiction:
- Higher-fidelity input wins. SQL-IR Concrete > ORM-level > SQL-IR Partial > SQL-IR Symbolic.
- Suppress the loser; log it under `suppressed_findings` in telemetry (§III).
- Calibration: track suppression rate per (rule A, rule B) pair across the corpus. If a specific pair contradicts >5 % of the time, the lower-fidelity rule needs review.

### EEE.4 Algorithm for fusion

```rust
pub fn fuse_findings(input: Vec<Finding>) -> FuseOutput {
    let mut groups: Vec<Vec<Finding>> = vec![];
    for f in input {
        let mut placed = false;
        for g in &mut groups {
            if g.iter().any(|gf| sites_match(gf, &f)) {
                g.push(f.clone());
                placed = true; break;
            }
        }
        if !placed { groups.push(vec![f]); }
    }
    let mut out = vec![];
    let mut suppressed = vec![];
    for group in groups {
        let agreements: Vec<_> = group.iter().filter(|f| group.iter().all(|g| classify_pair(f, g) != Outcome::Contradiction)).cloned().collect();
        let contradictions: Vec<_> = group.iter().filter(|f| group.iter().any(|g| classify_pair(f, g) == Outcome::Contradiction)).cloned().collect();
        if agreements.is_empty() && !contradictions.is_empty() {
            // All contradicting; pick highest-fidelity, suppress rest
            let mut sorted = contradictions;
            sorted.sort_by_key(|f| fidelity_rank(f));
            out.push(sorted.pop().unwrap());
            suppressed.extend(sorted);
        } else {
            out.push(merge_into_one(agreements));
            suppressed.extend(contradictions);
        }
    }
    FuseOutput { findings: out, suppressed }
}
```

Complexity: O(n × g) where g is the group size; in practice g ≤ 3 so essentially O(n).

## FFF — Confidence calibration with per-rule overrides

**Reasoning.** §QQ.2 gave one set of multipliers (Concrete 1.0 / Partial 0.6 / Symbolic 0.3). Real rules vary. A "raw-SQL taint" rule on Partial data is *still* highly trustworthy (we saw interpolation; the column doesn't matter). A "deep OFFSET" rule on Partial data is unreliable (we don't know the value).

### FFF.1 Rule-specific fidelity weights

Add `fidelity_weight: FidelityWeight` to `SqlIrRule` (already proposed in §MM):

```rust
pub struct FidelityWeight {
    pub concrete: f64,
    pub partial: f64,
    pub symbolic: f64,
}
impl FidelityWeight {
    pub const DEFAULT:  Self = Self { concrete: 1.00, partial: 0.60, symbolic: 0.30 };
    pub const TAINT:    Self = Self { concrete: 1.00, partial: 0.95, symbolic: 0.70 };  // SQLi-shape: column doesn't matter
    pub const LITERAL_DEPENDENT: Self = Self { concrete: 1.00, partial: 0.30, symbolic: 0.05 };  // OFFSET / LIMIT rules
    pub const CARDINALITY: Self = Self { concrete: 1.00, partial: 0.50, symbolic: 0.10 };  // N+1, cartesian
    pub const SHAPE_ONLY: Self = Self { concrete: 1.00, partial: 0.80, symbolic: 0.50 };   // missing-WHERE, full-table-scan
}
```

Per-rule override at declaration:

```rust
SqlIrRule {
    id: "SQLIR-RAW-009",
    matches: rule_sqlir_raw_taint,
    fidelity_weight: FidelityWeight::TAINT,
    ...
},
SqlIrRule {
    id: "SQLIR-PAG-004",
    matches: rule_sqlir_deep_offset,
    fidelity_weight: FidelityWeight::LITERAL_DEPENDENT,
    ...
},
```

### FFF.2 Calibration loop

```
For each rule:
  1. Set initial fidelity_weight to nearest archetype.
  2. Run corpus, classify findings TP/FP.
  3. If FP rate > tier gate, lower the per-fidelity weight for the worst-performing tier.
  4. Re-run. Repeat until rate clears OR rule is demoted to advisory.
```

Calibration is **per rule × per fidelity tier**. The output is a calibration table shipped in `tests/calibration/fidelity_weights.toml` that drives the rule registry. Implementations can override; defaults stay sane.

## GGG — Testing strategy: fixtures, golden files, harness

**Reasoning.** Part V mentions corpus calibration (a *post-write* validation). It doesn't mention how a rule author tests their rule *during* development. Without a defined fixture format, every rule author invents one and the suite becomes inconsistent.

### GGG.1 Fixture format

One folder per rule under `tests/fixtures/orm/<lang>/<orm>/<rule_id>/`:

```
tests/fixtures/orm/python/django/DJ-N1-001/
  positive/
    01_basic_loop.py
    01_basic_loop.expected.json
    02_nested_loop.py
    02_nested_loop.expected.json
    03_drf_serializer_n1.py
    03_drf_serializer_n1.expected.json
  negative/
    01_with_prefetch.py             # has .prefetch_related — rule must not fire
    02_with_select_related.py
    03_explicit_count.py            # uses .annotate(Count(...)) — fine
```

Each `.py` fixture has a sibling `.expected.json` with the findings the harness should produce:

```json
{
  "findings": [
    {
      "kind": "django_antipattern",
      "rule": "DJ-N1-001",
      "line": 7,
      "severity": "high",
      "confidence_range": [0.80, 0.92],
      "fusion_paths_must_include": ["DJ-N1-001"],
      "predicted_sql_must_contain": ["SELECT", "FROM post", "WHERE user_id"]
    }
  ],
  "no_findings_with_rule": []
}
```

Negative fixtures use `"findings": []` and `"no_findings_with_rule": ["DJ-N1-001"]`.

### GGG.2 The harness

```rust
#[test]
fn rule_DJ_N1_001() {
    let fixture_dir = "tests/fixtures/orm/python/django/DJ-N1-001";
    for case in find_fixtures(fixture_dir) {
        let actual = analyze_file(&case.source);
        let expected = parse_expected(&case.expected_json);
        assert_findings_match(actual, expected, &case.name);
    }
}
```

Generate one such test per rule via a build script that walks `tests/fixtures/`. Each test runs in isolation; failures show diff. The harness:
- Allows confidence ranges (not exact equality — confidence varies with calibration).
- Allows extra evidence rows in `actual` (additive is OK; missing is not).
- Asserts `fusion_paths` contains the expected rule IDs.
- Optionally renders `predicted_sql` and substring-asserts.

### GGG.3 Snapshot tests for the IR itself

For the `PredictedSql` IR we use `insta` snapshots (already common in the Rust ecosystem):

```rust
#[test]
fn drizzle_predict_findMany_with_relations() {
    let ctx = build_ts_context(include_str!("drizzle/find_many_with.ts"));
    let predictions = DrizzleDialect.predict_all(&ctx);
    insta::assert_yaml_snapshot!(predictions);
}
```

Snapshot files in `tests/snapshots/` are reviewed in PRs. When a dialect's behavior intentionally changes, snapshots get updated.

### GGG.4 Corpus runs as integration tests (nightly)

```
.github/workflows/nightly-corpus.yml:
  - clone 35 OSS projects
  - run drift-static-profiler --output-json
  - classify diff vs baseline (last week)
  - flag regressions: new FPs, lost TPs
```

Not run on PRs (too slow), but blocks releases.

## HHH — Incrementality and content-hash caching

**Reasoning.** A 10K-file repo + 14-week build = lots of CI runs. The plan said v1 doesn't need Salsa (Part I §K), but it didn't say what *does* happen between v1 and v3. Per-file content-hash caching is cheap and gets us most of the way.

### HHH.1 Per-file cache

```rust
pub struct OrmCache {
    /// Disk: $XDG_CACHE_HOME/drift-static-profiler/orm/<workspace-hash>/<file-hash>.bincode
    /// Memory: LRU of N latest hits.
    entries: HashMap<FileHash, CachedAnalysis>,
}
pub struct CachedAnalysis {
    pub orm_context_hash: u64,    // hash of imports + bindings + chains
    pub findings: Vec<Finding>,
    pub predictions: Vec<PredictedSql<'static>>,  // owned form
    pub schema_version: u32,      // bump on Finding schema changes
}
```

Cache key: `(file_content_hash, plan_version, ruleset_version)`. Cache hit = skip the whole ORM pass for that file.

### HHH.2 Cross-file invalidation

Cross-file model graph (Phase 5) means a file's analysis can depend on *other* files. Rule:

```
If file F's analysis depends on schema declared in file S, cache(F) is invalidated when S's content hash changes.
```

We track this dependency explicitly: `CachedAnalysis.depends_on: Vec<FileHash>`. On cache lookup, verify every dependency is also cache-current. Stale = recompute F.

For Prisma: every file analyzed under a workspace depends on `schema.prisma`'s content hash. Single dependency, easy invalidation.

For Django/SQLAlchemy/JPA: dependencies are per-model-import. File `views.py` that imports `from .models import User` depends on `models.py`. Track via the existing import map.

### HHH.3 Workspace cache invalidation

Bump `plan_version` whenever Part I–VII semantics change in a way that invalidates predictions. Bump `ruleset_version` whenever a rule's id, matcher, or weight changes. Either bump → full workspace recompute. Cheap to do; the cache hit rate is still high on the unchanged files.

### HHH.4 Cost / benefit on the 10K-file canonical repo

| Scenario | Cold time | Warm time |
|---|---|---|
| First run (no cache) | ~20 s (Phase 1+4 pipeline) | n/a |
| Edit 1 file, no model change | ~20 s | **~0.5 s** (1 file recompute) |
| Edit 1 model file (e.g. `models.py`) | ~20 s | ~5 s (recompute all files importing it) |
| Bump rule weights only | ~20 s | ~3 s (re-run rules; predictions cached) |
| Bump `plan_version` | ~20 s | ~20 s (full invalidation) |

Per-file cache shaves ~95 % off typical IDE / pre-commit hook latency. Implementation: ~200 LOC in `orm/cache.rs`. Salsa adoption (v3) reduces "edit 1 model" further.

## III — Soft-fail policy + observability

**Reasoning.** A static analyzer that crashes on a single oddly-shaped file is a static analyzer that gets uninstalled. We need a soft-fail policy and we need to know when it kicks in.

### III.1 Failure modes

| Stage | Failure | Policy |
|---|---|---|
| tree-sitter parse | grammar error / corrupt input | Skip file; log with `parse_error` counter |
| OrmContext build | panic in second walk | Catch; emit `context_build_failed` warning; downstream stages get empty context |
| OrmDialect::predict_all | panic in dialect | Catch; emit `dialect_failed` warning with dialect kind; no predictions for this file |
| SqlIrRule::matches | panic in rule | Catch; emit `rule_failed` warning with rule id; rule skipped for this file |
| `psl::parse_schema` | schema invalid | Skip Prisma workspace; warn user once |
| sqlparser-rs on rendered SQL | parse failure | Drop that statement from predictions; existing behavior, no change |

Every catch uses `std::panic::catch_unwind` at the right boundary. Each warning carries enough info (file path, line, dialect/rule id, panic message) to file a bug report.

### III.2 Observability counters

Drift already emits a JSON report. Extend `Summary` with:

```rust
pub struct AnalyzerHealth {
    pub files_analyzed: usize,
    pub files_parse_failed: usize,
    pub orm_files_analyzed: usize,
    pub orm_context_build_failed: usize,
    pub dialect_failures: HashMap<OrmKind, usize>,
    pub rule_failures: HashMap<RuleId, usize>,
    pub fusion_contradictions: usize,
    pub fusion_agreements: usize,
    pub suppressed_findings: usize,
    pub elapsed_ms_total: u64,
    pub elapsed_ms_orm: u64,
    pub elapsed_ms_sql_ir: u64,
    pub elapsed_ms_fusion: u64,
}
```

Surfaced in the report and in CI logs. A spike in `dialect_failures[Django] == 50` on a Django project is a bug report waiting to happen.

### III.3 `--strict` mode for CI

```
drift-static-profiler analyze --strict
```

In strict mode, any soft-fail becomes a hard error. Used in drift's own CI to catch regressions; users opt in if they want maximum guarantee.

## JJJ — Finding struct extensions

**Reasoning.** §AAA's worked example needed `fidelity`, `fusion_paths`, `predicted_sql` fields that don't exist in the current [insights.rs:123](../src/insights.rs#L123) `Finding`. Spec them out.

```rust
pub struct Finding {
    // existing fields
    pub kind: FindingKind,
    pub severity: Severity,
    pub effort: Effort,
    pub confidence: f64,
    pub line: usize,
    pub message: String,
    pub evidence: Vec<Evidence>,
    pub remediation: Option<String>,

    // NEW (Part VII)
    /// Byte range of the call/statement the finding pinpoints. Used by
    /// fusion to detect site equivalence (§EEE.1). Optional for backward
    /// compatibility; older findings don't have it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub byte_range: Option<Range<usize>>,

    /// For SQL-IR findings: the fidelity of the input prediction.
    /// None for ORM-level findings. Used by the viewer to render a
    /// "based on (mostly) inferred SQL" badge.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fidelity: Option<SqlFidelity>,

    /// Rule IDs that contributed to this finding after fusion. Always
    /// has ≥1 element; >1 = triangulation occurred.
    #[serde(default)]
    pub fusion_paths: Vec<RuleId>,

    /// Optional rendered SQL the prediction produced. For SQL-IR or
    /// fused findings. Truncated to 200 chars to keep JSON small.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub predicted_sql: Option<String>,
}
```

All new fields are optional in the schema (`#[serde(default)]` + `skip_serializing_if`). Older findings without these fields deserialize cleanly. Schema migration is additive.

Viewer impact: a fused finding renders as a single card with two rule-id badges, the predicted SQL shown in a collapsible section, and a fidelity badge ("based on Concrete prediction" or "based on Partial prediction — column unknown").

## KKK — Contribution guide

**Reasoning.** With 136 rules, 16 dialects, and 8 languages, contributors need clear paths for "add a new rule", "add a new ORM", "add a new language". Without this, the codebase fragments.

### KKK.1 Add a new rule

1. Pick the layer:
   - **ORM-specific** (SQL-invisible pattern) → goes in `orm/<lang>/<orm>.rs`, appended to that ORM's rule slice.
   - **Cross-ORM** (visible in SQL shape) → goes in `orm/sql_ir_rules.rs`, appended to `BUILTIN_SQL_IR_RULES`.
2. Define the matcher function: one pure fn from context/prediction → `Vec<MatchHit>`.
3. Add 1 positive + 2 negative fixtures under `tests/fixtures/orm/<lang>/<orm>/<rule_id>/`.
4. Pick the tier (critical/standard/advisory) based on expected FP rate.
5. Run `cargo test` — the auto-generated test should pass.
6. Run corpus on at least one project from §QQ.5 (manual command); classify ≥20 findings; report rate in PR.
7. PR includes: rule, fixtures, corpus classification table.

### KKK.2 Add a new ORM (existing language)

1. New file `orm/<lang>/<new_orm>.rs`.
2. Implement `OrmDialect` (one of CCC.2/3/4/5/6 skeletons).
3. Append to `DIALECTS` registry in `orm/mod.rs`.
4. Add to path-gate detection (§S / §DD).
5. Write at least 5 rules (the ORM's most-common antipatterns).
6. Add fixtures + run corpus.
7. New `FindingKind` variant (one per framework, per §FF).

### KKK.3 Add a new language

(This is rare — JVM/Python/TS/Go/Rust covers the bulk. But e.g. Elixir + Ecto would be a future addition.)

1. Verify tree-sitter grammar exists; add to `Cargo.toml` and `src/languages/<lang>.rs`.
2. Add tags-query for symbols, calls, imports, decorators (if any).
3. New `orm/<lang>/mod.rs` defining `<Lang>OrmContext`.
4. Implement `chain_ops::inner_call_or_root` for the language.
5. Write at least one ORM dialect for the language.
6. Cargo.toml update + integration test ensuring `analyze --lang <lang>` doesn't crash.

### KKK.4 Modify shared infrastructure (`PredictedSql`, `Finding`, etc.)

This is the **rare** category — touches all dialects. Required steps:

1. Bump `plan_version` (invalidates all caches).
2. Run full corpus on all dialects to verify no rule regressions.
3. PR requires sign-off from a second reviewer because of blast radius.

## LLL — Async iteration + comprehension markers

**Reasoning.** Most ORMs now have async variants. Python has `async for`. JS has `for await`. Kotlin has `flow.collect { ... }`. Each is a "loop body" for our purposes but uses a different grammar node.

### LLL.1 `IterationMarker` extension

```rust
pub struct IterationMarker {
    pub kind: IterKind,
    pub loop_var: String,
    pub body_range: Range<usize>,
}
pub enum IterKind {
    ForLoop,
    AsyncForLoop,                  // `async for x in qs:` / `for await (const x of stream)`
    Comprehension(CompKind),       // Python `[x for x in qs]` / generator / set / dict
    ArrayMethodCallback(MethodName), // JS `.map`/`.forEach`/`.filter`/`.reduce`
    StreamChain(MethodName),       // Java `users.stream().filter(...).map(...)`
    KotlinFlowCollect,             // `flow.collect { ... }` / `forEach { ... }`
    RustIterMethod(MethodName),    // `.iter().map(|x| ...)`, `.for_each(...)`
}
```

Per-ORM context populates `iteration_markers: Vec<IterationMarker>` using language-specific captures (each already noted in Parts I–III).

### LLL.2 Tree-sitter nodes per kind

| IterKind | Python | JS/TS | Java | Kotlin | Scala | Go | Rust |
|---|---|---|---|---|---|---|---|
| ForLoop | `for_statement` | `for_in_statement` / `for_of_statement` | `enhanced_for_statement` | `for_statement` | `for_expression` | `for_statement` | `for_expression` |
| AsyncForLoop | `for_statement` w/ `async` | `for_of_statement` w/ `await` | n/a | `for` over `Flow` | n/a | n/a | n/a |
| Comprehension | `list_comprehension` / `generator_expression` / `set_comprehension` / `dict_comprehension` | n/a | n/a | n/a | for-comprehension | n/a | n/a |
| ArrayMethodCallback | n/a | `call_expression` with `arrow_function` arg | `lambda_expression` arg to `forEach`/`map`/etc. | trailing lambda | `_.map`/`_.foreach` | n/a (use `for`) | `iter().map(\|x\| …)` |
| StreamChain | n/a | n/a | `.stream().filter(...)` | similar | similar | n/a | iterator chains |
| KotlinFlowCollect | n/a | n/a | n/a | `flow.collect {…}` | n/a | n/a | n/a |

Tree-sitter handles all of these natively in the existing grammars.

### LLL.3 Implications for `SQLIR-N1-001`

The rule body becomes:

```
IF prediction.iteration_marker is Some(*) THEN
    AND prediction.where_expr references the loop_var
    THEN fire
```

— uniformly across all 7 IterKind variants. The rule doesn't care which language; the marker normalizes them.

## MMM — Summary: what Part VII added

| § | Content | Implementer value |
|---|---|---|
| AAA | Worked end-to-end example | Verifies mental model |
| BBB | Chain reconstruction algorithm | Bridges tags.rs → predict_all |
| CCC | 4-family ORM taxonomy | Predicts each new ORM's effort |
| DDD | predict_all skeletons (4 ORMs) | Copy-paste starting points |
| EEE | Fusion edge cases | Range overlap, K-way, contradiction handling |
| FFF | Per-rule fidelity weights | Removes magic-number multipliers |
| GGG | Test strategy + harness | Defines the fixture format |
| HHH | Content-hash caching | 95 % CI latency cut |
| III | Soft-fail + observability | Production hardening |
| JJJ | Finding struct extensions | New fields for fidelity/fusion |
| KKK | Contribution guide | Scaling beyond initial contributor |
| LLL | Async + comprehension markers | Modern language coverage |

## NNN — Updated effort estimate (Parts I–VII)

| Part | Effort | Cumulative |
|---|---|---|
| Parts I–VI (per §ZZ) | 14–15 weeks | 14–15 weeks |
| Part VII §AAA–LLL implementation | +2 weeks | 16–17 weeks |
| — Chain reconstruction (§BBB) | 4 d (cross-cuts all dialects) | |
| — Fusion engine (§EEE) | 3 d | |
| — Calibration tables (§FFF) | 2 d | |
| — Test harness (§GGG) | 3 d | |
| — Cache layer (§HHH) | 2 d | |
| — Soft-fail + observability (§III) | 2 d | |
| — Finding extensions + schema (§JJJ) | 1 d | |

**~16–17 weeks total** for a production-grade, 90 %-precision, 7-language, 136-rule ORM static analyzer with caching, observability, and a contribution guide. ~4 developer-months, doable solo; ~2 months with one senior + one mid-level.

---

## Part VII sources

- [tree-sitter grammar reference](https://tree-sitter.github.io/tree-sitter/) — for the per-language `inner_call_or_root` shapes
- [insta — Rust snapshot testing](https://insta.rs/) — fixture diff tooling
- [Salsa — incremental computation framework](https://salsa-rs.netlify.app/) — referenced for v3 caching evolution
- [Bincode — Rust binary serialization](https://github.com/bincode-org/bincode) — cache file format
- [std::panic::catch_unwind docs](https://doc.rust-lang.org/std/panic/fn.catch_unwind.html) — soft-fail mechanism
- Internal: existing [src/insights.rs](../src/insights.rs), [src/sql_lint.rs](../src/sql_lint.rs), [src/tags.rs](../src/tags.rs), [src/walker.rs](../src/walker.rs), [Cargo.toml](../Cargo.toml)
