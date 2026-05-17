# drift-static-profiler — Rule calibration (v0.2 → v0.5)

- **v0.2** (Phase 1): Python ORM — Django + SQLAlchemy. 22 ORM rules + 14 cross-ORM SQL-IR rules.
- **v0.3** (Phase 2): TypeScript/JavaScript ORM — Prisma + Drizzle + TypeORM. +11 ORM rules.
- **v0.4** (Phase 3 + 4 + parallel tracks): JVM (JPA/Hibernate), Go (GORM), Rust (SQLx), plus LLM and Auth/Crypto perf antipatterns. +18 rules.
- **v0.5** (Phase 5 + Phase 2.1): Cross-file ModelGraph (Django/SQLAlchemy/JPA) lifts `DJ-PROJ-010` 0.55→0.90 and `SA-N1-002` 0.70→0.92; +8 ORM rules across Sequelize (4) and Mongoose (4).

Cumulative: **59 ORM-dialect rules + 14 cross-ORM SQL-IR rules + 7 parallel-track rules = 80 rules** across 11 dialects and 5 languages.

This document records the per-rule precision/recall calibration that gates each rule's tier (stable / beta / advisory) per the master plan's §H.

Tier policy (Wilson 95% lower bound on observed precision):
- **Stable** — ≥0.90 — ship at full confidence
- **Beta** — 0.75–0.90 — ship with confidence capped at 0.80
- **Advisory** — <0.75 — demote to confidence ≤0.55 OR pull from the default ruleset

## Phase 1 calibration (fixture-only, smoke validation)

Full corpus calibration on 5 OSS Django + 5 SQLAlchemy projects is deferred to a Phase 1.1 follow-up. The numbers below are from the smoke fixtures shipped in `tests/fixtures/python-django/` and `tests/fixtures/python-sqlalchemy/` plus the unit-test corpus. They establish the tier table; the next pass refines with real-world data.

### Django rules (`src/orm/python/django.rs`)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `DJ-N1-001` | qs iter + lazy related access | 0.85 | TP (show_users) / negative passes | Stable |
| `DJ-N1-002` | count() then re-use | 0.70 | Skipped (needs intra-fn flow) | Parked |
| `DJ-N1-003` | `len(qs)` | 0.95 | TP / 1 borderline (list(raw())) | Stable* |
| `DJ-N1-004` | `qs.count()` as existence check | 0.95 | TP | Beta |
| `DJ-N1-005` | `bool(qs)` / `if qs:` | 0.80 | Smoke OK | Beta |
| `DJ-PERF-006` | `obj.save()` in loop | 0.85 | Smoke OK | Beta |
| `DJ-PERF-007` | `Manager.create()` in loop | 0.90 | TP (create_users) | Stable |
| `DJ-PERF-008` | per-row update vs `qs.update()` | 0.65 | Skipped (overlaps PERF-006) | Parked |
| `DJ-EAGER-009` | `.iterator()` after `prefetch_related` | 0.85 | Smoke OK | Beta |
| `DJ-PROJ-010` | `.values('m2m_field')` | 0.55 | Skipped (needs ModelGraph) | Advisory / Parked |
| `DJ-RAW-011` | f-string in `.raw()` | 0.95 | TP (raw_with_fstring) | Stable |
| `DJ-PAG-012` | unbounded Paginator page | 0.40 | Advisory only | Advisory |

\* DJ-N1-003 has a known FP shape: `rows = list(qs.raw(...))` causes `rows` to be tracked as a queryset binding. Lift to Stable after the LHS-of-`list(...)` carve-out lands in Phase 1.1.

### SQLAlchemy rules (`src/orm/python/sqlalchemy.rs`)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `SA-N1-001` | iter + lazy access without joinedload | 0.80 | Restricted to loop-var attr-access chains | Beta |
| `SA-N1-002` | `joinedload(rel)` on *-to-many | 0.70 | Skipped (needs ModelGraph) | Parked |
| `SA-N1-003` | `yield_per` + `joinedload`/`subqueryload` | 0.95 | TP (yield_per_with_joinedload) | Stable |
| `SA-PERF-004` | `with_entities(...).all()` + `len(...)` | 0.85 | Skipped (needs inter-stmt flow) | Parked |
| `SA-PERF-005` | `select(X).where(X.id == loop_var)` in loop | 0.85 | Smoke OK | Beta |
| `SA-DTO-006` | full-entity select for 1–2 cols | 0.55 | Skipped (Phase 5) | Parked |
| `SA-SESS-007` | `session.add` in loop | 0.65 | TP (batch_create) | Beta |
| `SA-LAZY-008` | `relationship(lazy="dynamic")` | 0.85 | TP (models.py) | Stable |
| `SA-EXEC-009` | f-string in `text(...)` | 0.95 | TP (lookup_by_id_unsafe) / negative passes | Stable |
| `SA-AUTO-010` | autoflush in hot loop | 0.55 | Skipped (Phase 1) | Parked |

### Cross-ORM SQL-IR rules (`src/orm/sql_ir_rules.rs`)

Each rule's effective confidence is `base × FidelityWeight.at(fidelity_of_input_prediction)`. The fidelity weight archetype (master plan §FFF.1) is shown.

| ID | Rule | Base | Weight | Effective on Concrete | Tier |
|---|---|---|---|---|---|
| `SQLIR-001` | `SELECT *` | 0.85 | SHAPE_ONLY | 0.85 | Beta |
| `SQLIR-002` | UPDATE/DELETE without WHERE | 0.95 | SHAPE_ONLY | 0.95 | Stable |
| `SQLIR-003` | implicit INSERT cols | 0.80 | SHAPE_ONLY | 0.80 | Beta |
| `SQLIR-004` | leading-wildcard LIKE | 0.95 | LITERAL_DEPENDENT | 0.95 | Stable |
| `SQLIR-005` | LIMIT without ORDER BY | 0.85 | SHAPE_ONLY | 0.85 | Beta |
| `SQLIR-006` | OR chain | 0.65 | DEFAULT | 0.65 | Advisory |
| `SQLIR-007` | function on indexed col | 0.70 | DEFAULT | 0.70 | Beta |
| `SQLIR-008` | deep WHERE nesting | 0.75 | SHAPE_ONLY | 0.75 | Beta |
| `SQLIR-009` | cartesian join risk | 0.95 | SHAPE_ONLY | 0.95 | Stable |
| `SQLIR-010` | UPDATE without LIMIT | 0.80 | SHAPE_ONLY | 0.80 | Beta |
| `SQLIR-011` | correlated subquery (SQL-side N+1) | 0.85 | CARDINALITY | 0.85 | Beta |
| `SQLIR-012` | unbounded SELECT | 0.85 | SHAPE_ONLY | 0.85 | Beta |
| `SQLIR-013` | OFFSET ≥1000 | 0.95 | LITERAL_DEPENDENT | 0.95 | Stable |
| `SQLIR-014` | JOIN without equality | 0.95 | SHAPE_ONLY | 0.95 | Stable |

### TypeScript / JavaScript dialects (v0.3, Phase 2)

#### Prisma (`src/orm/ts/prisma.rs`)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `PRI-INC-001` | deep `include` nesting (>=3 levels) | 0.70 | TP (deepInclude) | Beta |
| `PRI-N1-002` | `findUnique` / `findFirst` in loop | 0.90 | TP (nPlusOneByIds) / negative passes | Stable |
| `PRI-RAW-003` | template interpolation in `$queryRawUnsafe` | 0.95 | TP (rawUnsafe) | Stable |
| `PRI-PAG-004` | `skip` ≥ 1000 | 0.95 | TP (deepPagination) | Stable |

#### Drizzle (`src/orm/ts/drizzle.rs`)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `DRZ-LMT-001` | `.limit()` without `.orderBy()` | 0.90 | TP (listTop10) / clean passes | Stable |
| `DRZ-N1-002` | `db.select().where(...)` in loop | 0.85 | TP (lookupByIds) / clean passes | Beta |
| `DRZ-CTR-003` | full select for count | 0.55 | Parked (needs LHS analysis) | Advisory |

#### TypeORM (`src/orm/ts/typeorm.rs`)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `TO-N1-001` | `repo.findOne(...)` in loop | 0.90 | TP (nPlusOne via `this.userRepo.findOne`) | Stable |
| `TO-EAGER-002` | `@OneToMany`/`@ManyToMany` with `eager: true` | 0.85 | TP (User.posts) | Stable |
| `TO-QB-003` | template interpolation in `.where(\`…${x}…\`)` | 0.95 | TP (unsafeSearch) | Stable |
| `TO-SYNC-004` | `DataSource` with `synchronize: true` | 0.95 | TP (dataSource) | Stable |

### JVM (Java/Kotlin) — JPA / Hibernate / Spring Data (v0.4, Phase 3)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `JPA-N1-001` | `repo.findById(...)` in for-each | 0.90 | TP (loadAll) | Stable |
| `JPA-QRY-002` | string concat inside `@Query("…" + var + "…")` | 0.95 | TP (findByNameUnsafe annotation) | Stable |
| `JPA-EAGER-003` | `@ManyToOne(fetch = FetchType.EAGER)` | 0.85 | TP (User.org field) | Stable |
| `JPA-SAVE-004` | `repo.save(entity)` inside loop | 0.90 | TP (saveAll) | Stable |

### Go — GORM (v0.4, Phase 4)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `GORM-N1-001` | `db.First(&x, id)` in for-range | 0.90 | TP (NPlusOne) | Stable |
| `GORM-RAW-002` | `db.Raw(fmt.Sprintf(...))` | 0.95 | TP (RawUnsafe) | Stable |
| `GORM-AUTO-003` | `db.AutoMigrate(...)` at boot | 0.95 | TP (main) | Stable |
| `GORM-SAVE-004` | `db.Create(&x)` in for-range | 0.90 | TP (SaveLoop) | Stable |

### Rust — SQLx (v0.4, Phase 4)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `SQLX-RAW-001` | `sqlx::query(&format!(...))` | 0.95 | TP (lookup_unsafe) | Stable |
| `SQLX-N1-002` | `sqlx::query!(...)` in for-loop | 0.85 | TP (n_plus_one) | Beta |
| `SQLX-FETCH-003` | `.fetch_all(...)` without LIMIT | 0.75 | Smoke OK | Beta |

### Parallel track — LLM / AI workload (v0.4)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `LLM-CLI-001` | OpenAI/Anthropic client constructed in loop | 0.90 | TP (client_per_request) | Stable |
| `LLM-LOOP-002` | completion call inside loop | 0.85 | TP (loop_completions) | Stable |
| `LLM-SYNC-003` | sync client inside async handler | 0.80 | Parked (needs async-fn context) | Beta |
| `LLM-CACHE-004` | Anthropic `messages.create(system=...)` without `cache_control` | 0.75 | TP (no_cache_control) | Beta |

### Sequelize (v0.5, Phase 2.1)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `SEQ-N1-001` | `Model.findByPk(...)` / `findOne(...)` in loop | 0.90 | TP (nPlusOne) | Stable |
| `SEQ-RAW-002` | template interpolation in `sequelize.query(...)` | 0.95 | TP (rawUnsafe) | Stable |
| `SEQ-SAVE-003` | `instance.save()/.update()/.destroy()` in loop | 0.85 | TP (saveLoop) | Beta |
| `SEQ-SYNC-004` | `sequelize.sync({ force: true })` | 0.95 | TP | Stable |

### Mongoose (v0.5, Phase 2.1 — NoSQL, no SQL-IR)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `MNG-POP-001` | ≥3 chained `.populate(...)` | 0.80 | TP (deepPopulate) | Beta |
| `MNG-N1-002` | `Model.findById(...)` in loop | 0.90 | TP (nPlusOne) | Stable |
| `MNG-LEAN-003` | iterate without `.lean()` + `.toObject()` per row | 0.70 | TP (leanMissing) | Beta |
| `MNG-RAW-004` | template interpolation in `$where` predicate (JS injection) | 0.95 | TP (whereInjection) | Stable |

### Cross-file ModelGraph (v0.5, Phase 5) — confidence lifts

| Rule | v0.4 confidence | v0.5 confidence | Reason |
|---|---|---|---|
| `DJ-PROJ-010` (Django `.values('m2m')`) | 0.55 (advisory) | 0.90 (Stable) | Workspace registry confirms field is `ManyToManyField` before firing |
| `SA-N1-002` (SQLAlchemy `joinedload(*-to-many)`) | 0.70 (Beta) | 0.92 (Stable) | Registry confirms relation is `uselist=True` / `Mapped[List[...]]` |

### Parallel track — Auth / Crypto (v0.4)

| ID | Rule | Confidence | Smoke result | Tier |
|---|---|---|---|---|
| `AC-BCRYPT-001` | `bcrypt.hashpw` in loop | 0.90 | TP (rotate_passwords) | Stable |
| `AC-RSA-002` | RSA private-key generation in handler/loop | 0.85 | TP (fresh_keypair) | Stable |
| `AC-JWKS-003` | JWKS endpoint fetched per request | 0.85 | TP (verify_jwt) | Stable |

## Methodology

Phase 1.1 will run drift v0.2 against:
- **Django corpus** — getsentry/sentry, saleor/saleor, pretalx/pretalx, mastodon/mastodon-py, apache/airflow
- **SQLAlchemy corpus** — fastapi/fastapi tests, sqlalchemy/sqlalchemy tests, encode/databases, dispatch (PagerDuty), apache/airflow

For each rule: manually audit the first 50 findings, classify TP/FP, compute Wilson 95% lower bound on precision, and gate-or-demote.

## Triangulation (fusion engine)

When an ORM-level rule and an SQL-IR rule fire at overlapping byte ranges, the fusion engine in `src/orm/fusion.rs` combines them with multiplicative-complement confidence: `c_combined = 1 − (1−c_orm)(1−c_sql_ir)`.

Example end-to-end (Django N+1):
- `DJ-N1-001` fires at line 11 with confidence 0.85
- `SQLIR-011` fires on the predicted `SELECT COUNT(*) FROM post WHERE user_id = ?` at the same byte range with effective confidence 0.85 × 0.50 = 0.425 (Partial fidelity × CARDINALITY archetype)
- Fused: 1 − (1−0.85)(1−0.425) = **0.914**

Triangulation lifts moderate-confidence rules into the Stable tier when independent evidence agrees.

## Out-of-scope for v0.3

- Sequelize + Mongoose dialects — Phase 2.1
- Cross-file ModelGraph (Django ForeignKey / SQLAlchemy relationship resolution) — Phase 5
- Migrations safety rules (alembic Python-level + tree-sitter-sequel) — Phase 5+
- JVM coverage (Hibernate/JPA, Spring Data, jOOQ, MyBatis) — Phase 3
- Go/Rust ORMs (GORM, Diesel, SQLx, SeaORM) — Phase 4
- OSS corpus mining (BigQuery + pydriller) for empirical rule validation — Phase 1.1 / 2.1
- Prisma schema (`schema.prisma`) parsing via `psl` crate for type-aware relation graphing — Phase 2.2 (lifts `PRI-INC-001` confidence from 0.70 → 0.92)
