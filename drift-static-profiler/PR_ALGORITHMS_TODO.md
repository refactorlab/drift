# `pr_algorithms` — implementation TODO

Source-of-truth checklist for the algorithms that produce `pr_review` /
`pr_review_ext` on `scan-pr` output. Each module exists under
`src/pr_algorithms/`; the gaps are in the **logic inside**, not in
missing files.

Verified against two real outputs:
- `tmp/scan-pr-output.json` (python-fastapi)
- `tmp/scan-pr-output-kotlin-ktor.json` (kotlin-ktor)

The spec is [`action/pr-review-spec.md`](../action/pr-review-spec.md);
the visual reference is [`action/pr36-github-ui-example.html`](../action/pr36-github-ui-example.html).

Status legend: `[ ]` not started · `[~]` partial / structure right, signal weak · `[x]` shipping.

## CURRENT STATE — verified against code on 2026-05-26

| Done | Pending |
|---|---|
| A2, A4, A5 (combined_mermaid), A7, S2, S6, T1+T2+T3, B1 (abstain), B4, V1 (subtitle), V3 (NFR→runtime), V4 (heuristic counts), M1 (multi-axis), M2 (winning-axis), VS1, VS2 (semantic grouping), C1, C2 (@path), I1 (--pr-context FILE), I2, I3 (--diff-stats), V2 (wired via I3), O1 (subtitle), O6, O7, OM1+OM2+OM3 | A1 (base-ref / I5), A3 (direction in/out), A6 (multi-hop), B2 (product-nouns), B3 (multi-node flow), S1 (broader N+1 lift), S3-S5 (AST patterns), S7 (calibration), C3 (full pr_context map), I4 (--json-input), D1+D2 (dup body similarity), O2-O5+O8 (structured schemas) |

---

## Priority ladder

| Rank | What lands | Why |
|---|---|---|
| **P0** | architecture before/kind/direction · code_suggestions populated · tech_debt high_complexity + long_functions · CLI inputs for diff stats + commits + PR body | The action posts fake content without these |
| **P1** | architecture combined_mermaid + multi-node · business_logic abstain / product nouns · value_card subtitle + real LOC inputs · merge.bottom_line synthesis · counts heuristics | Table-stakes polish — what reviewers expect |
| **P2** | visual_summary risk inference · key_files semantic grouping · summary_findings_top · OpenAPI tightening (enum + pr_review_ext) · multi-axis interpretation | Richer signal — surfaces hidden findings |

---

## [architecture_flow.rs](src/pr_algorithms/architecture_flow.rs) — Image 1

Today: `before_mermaid` placeholder, `after_mermaid` flat list, no subgraphs,
all `data_structures.kind = "touched"` (off-spec), no `direction`.

- [ ] **A1 · base-ref reconstruction** *(P0)* — accept a `base_sha` input
  (or scan twice). Without this, `before_mermaid` is permanently fake.
  - Acceptance: with `--base-sha`, `before_mermaid` contains the nodes/edges that existed before the changed-file commits; with no base, **omit `before_mermaid` entirely** (don't ship the placeholder).
- [ ] **A2 · `kind` enum mapping** *(P0)* — replace `"touched"` with one of
  `{new, modified, removed, unchanged}`:
  - `new` if symbol only in HEAD
  - `removed` if only in BASE
  - `modified` if in both with changed body/signature
  - `unchanged` otherwise
  - Acceptance: re-running on kotlin-ktor shows `OrdersService.createOrder` as `modified`, not `touched`.
- [ ] **A3 · `direction` on `DataStructureEntry`** *(P0)* — classify each
  data structure as `in` / `out` / `internal` based on whether it appears
  as parameter type, return type, or local.
  - Acceptance: `Order` shows `direction: "out"` in kotlin-ktor (returned from `findById`).
- [~] **A4 · edge dedup + same-name disambiguation** *(P1)* — kotlin-ktor
  improved (no self-loop) but still has TWO `createOrder` nodes (handler + service)
  without parent-class disambiguation. Label as `OrdersHandler.createOrder` vs
  `OrdersService.createOrder`.
  - Acceptance: kotlin-ktor's after_mermaid shows fully-qualified labels.
- [ ] **A5 · `combined_mermaid` with subgraphs** *(P1)* — emit the
  three-subgraph layout (`BEFORE` / `AFTER` / `DS`) with inter-subgraph
  arrows. This is the layout the spec/HTML actually expects.
  - Acceptance: `combined_mermaid` is non-null and contains `subgraph BEFORE`, `subgraph AFTER`, `subgraph DS`, and the `evolves to` / `uses` connectors.
- [ ] **A6 · multi-hop graph walk** *(P1)* — today's mermaid shows only direct
  neighbors of changed symbols (2-4 nodes). Walk 2-3 hops to give visual
  context for the slice.
  - Acceptance: kotlin-ktor's after graph has ≥ 6 nodes including transitive callees.
- [~] **A7 · structured payload (`after_structured`)** *(shipped)* — kotlin-ktor
  output now has `after_structured` with `direction`/`nodes`/`edges`/`class_defs`.
  Add `combined_structured` alongside `combined_mermaid` for completeness.

---

## [code_suggestions.rs](src/pr_algorithms/code_suggestions.rs) — Code suggestions

Today: `"code_suggestions": []` on both fixtures. **The spec's primary payload, totally absent.**

- [ ] **S1 · N+1 detector → Category A** *(P0)* — existing ORM analysis
  detects N+1 candidates. Lift them into `CodeSuggestion`.
  - Acceptance: a fixture with an obvious N+1 (loop calling `findById` per item) emits at least one Category-A suggestion with `confidence ≥ 0.85`.
- [ ] **S2 · dead-code-in-changed-file → Category A** *(P0)* — combine
  `summary.dead_code[]` ∩ `pr_scope.changed_files`: changed files whose
  symbols are dead are an actionable cleanup signal.
  - Acceptance: any frame in `summary.dead_code` whose file is in
    `pr_scope.changed_files` produces a "delete this" suggestion.
- [ ] **S3 · silent-except / catch-all → Category B** *(P1)* — AST pattern
  match for empty `catch`/`except` bodies. Languages: Python, Java/Kotlin,
  TS, Go (`if err != nil { /* nothing */ }`).
  - Acceptance: a fixture with `except Exception: pass` emits Category-B with `confidence ≥ 0.80` and a real doc link.
- [ ] **S4 · raw JDBC / SQL string concatenation → Category B** *(P1)* —
  kotlin-ktor's `OrdersRepository` uses `prepareStatement` + `setString` —
  that's parameterized (good). But fixtures with `"... WHERE id = $id"`
  Kotlin string-templates should fire.
  - Acceptance: a SQL-injection-shaped fixture emits Category-B with reference to OWASP A03.
- [ ] **S5 · sentinel-value-as-missing → Category B** *(P1)* — AST pattern:
  `if x != 0.0 { x } else { fallback }` for `f64`/`Option`-able types.
  Matches the HTML's `prefer_frame_f64` example.
- [ ] **S6 · quality-bar guard** *(P0)* — drop any suggestion lacking
  `references[].url` or below the confidence threshold (default 0.75).
  Spec rule.
  - Acceptance: a synthesized suggestion with `references: []` is filtered out.
- [ ] **S8 · populate `diff.before_lines` + `after_lines`** *(P0)* — verified
  empty on the current python (S2 dead-code ×3) and kotlin (S4 sql-concat ×1)
  outputs. **Without `after_lines`, GitHub's "Apply suggestion" button does
  NOT appear** — the action correctly drops the ` ```suggestion ` block when
  `after_lines` is empty, so reviewers see explanations but can't accept fixes.
  This is the spec's main user-facing payload, currently dead on both fixtures.
  - For S2 (dead code): emit `before_lines` = the actual source lines
    (`frame.file:line` + `frame.loc` lines after), `after_lines: []`
    (deletion). Empty `after_lines` IS valid — GitHub renders it as
    "delete these lines."
  - For S4 (sql concat): emit `after_lines` with the parameterized
    rewrite. The detector already locates the offending line; the rewrite
    is mechanical (concat → single literal).
  - Acceptance: running `make action-scan-demo-kotlin-exposed` produces
    a suggestion with non-empty `after_lines`; the action's rendered
    review comment contains a ` ```suggestion ` block with a working
    Apply button.

- [ ] **S7 · confidence calibration** *(P2)* — per-category calibration from
  `CALIBRATION.md`. Today, confidence is hardcoded per detector; should be
  derived from match strength + ambient code-quality signal.

---

## [tech_debt.rs](src/pr_algorithms/tech_debt.rs)

Today: `high_complexity: []`, `long_functions: []`, `summary_findings_top: []`
even though per-frame `complexity`/`loc` are populated.

- [ ] **T1 · populate `high_complexity`** *(P0)* — filter frames where
  `complexity > constants::cyclomatic_high_risk()` (=10). The threshold is
  already read; the filter is missing.
  - Acceptance: a fixture with a function of complexity 12 surfaces it in
    `high_complexity[]` with `severity` and a link to the SonarQube source.
- [ ] **T2 · populate `long_functions`** *(P0)* — same shape, filter
  `loc > constants::long_function_loc()` (=80).
  - Acceptance: a fixture with a 120-LOC function surfaces it.
- [ ] **T3 · `summary_findings_top`** *(P2)* — lift the top N findings from
  the existing `findings` rollup into the PR-scoped block.
- [~] **schema_validation.per_language_known_libraries** *(shipped)* — 56-entry registry across 8 languages. Good.

---

## [business_logic.rs](src/pr_algorithms/business_logic.rs) — Image 2

Today: `summary = "This PR touches N file(s) and reaches M entry point(s)."`
(tautology — restates `pr_scope`). `mermaid` is `User → root_0` (1-2 nodes).

- [ ] **B1 · abstain on tautology** *(P1)* — if no `pr_context.title`/`body`
  is supplied, **omit `summary` entirely** (or emit `null`). Don't restate
  `pr_scope`. "Silence > noise" rule.
  - Acceptance: kotlin-ktor run with no PR context produces `business_logic.summary = null`, not the tautology.
- [ ] **B2 · product-noun extraction** *(P1)* — mine changed file paths +
  PR title for product nouns:
  - `app/checkout/...` → "Checkout"
  - `OrdersHandler` → "Orders"
  - Use the noun as the node label, not the bare function name.
  - Acceptance: kotlin-ktor's mermaid labels `r0` as "Orders" not `createOrder`.
- [ ] **B3 · multi-node flow** *(P1)* — extend the graph to include
  `actor → entry → side-effect category` per affected root. Cap at ~8 nodes for readability.
  - Acceptance: kotlin-ktor's mermaid has ≥ 5 nodes (User, Orders entry, Service, Repo, DB icon).
- [ ] **B4 · dashed scope class on every in-scope node** *(P1)* — today the
  classDef is defined but applied to one node. Apply to all PR-scope nodes.
- [~] **structured payload** *(shipped)* — `business_logic.structured` now
  emits direction/nodes/edges/class_defs.

---

## [value_money.rs](src/pr_algorithms/value_money.rs) · [value_customer.rs](src/pr_algorithms/value_customer.rs) · [value_runtime.rs](src/pr_algorithms/value_runtime.rs) · [value_runtime_ux.rs](src/pr_algorithms/value_runtime_ux.rs) — Image 3

Today: structure right, all axes emit. But every numeric input is 0 because
diff stats + commits aren't piped in, so every number is -0.9% or 0%.

- [ ] **V1 · `ValueAxis.subtitle` field** *(P1)* — add per-axis
  subtitle ("Net infra + dev-time delta", "Wire size, memory, serialization", etc.).
  Schema needs the field too.
- [ ] **V2 · wire diff stats into `value_money`** *(P0)* — `loc_added` /
  `loc_deleted` are always 0 because the CLI doesn't accept them. Add a
  `--diff-stats FILE` input (TSV: `path<TAB>additions<TAB>deletions`) and
  populate `dev_cost_usd` from real numbers.
  - Acceptance: with diff stats piped in, `dev_cost_usd` ≠ baseline (currently 142.5 because only files_touched fires).
- [ ] **V3 · use NFR gaps in `value_runtime.confidence`** *(P2)* — a function
  in `nfr_edge_cases.reliability_gaps[]` drops runtime confidence from
  whatever it would be → `low`.
- [ ] **V4 · feature/bug detection heuristic when commits absent** *(P1)* —
  if no commit messages, infer: new public-surface functions → feature;
  modified except/catch blocks → bug fix.
- [~] **`source_link` on every axis** *(shipped)* — kotlin-ktor output adds it.
- [x] **formula + inputs + kv on every axis** — done.

---

## [merge.rs](src/pr_algorithms/merge.rs) — overall + bottom line

Today: `"Bottom line — negative on 💰 Money."` (mechanical one-liner).
`overall_drift.interpretation = "4-axis average (4 axes weighted equally)"` (also mechanical).

- [ ] **M1 · multi-axis synthesis** *(P1)* — combine the 4 axis
  directions/percents into a real paragraph. Template per pattern:
  - All up → "All four axes trend positive. Combined effect: …"
  - Mixed → "Runtime ▲ but Customer ▼ — investigate before merge"
  - All down → "Multiple regressions; consider scope split"
- [ ] **M2 · `overall_drift.interpretation`** *(P2)* — pick the WINNING
  axis name in the string ("Avg. customer + runtime ▲" not "4-axis weighted average").

---

## [visual_summary.rs](src/pr_algorithms/visual_summary.rs)

Today: 1 risk ("PR size · N files"). 1 file group (by top-level dir name).

- [ ] **VS1 · risk inference from existing signals** *(P2)* — push these
  into `risks.items[]`:
  - Each `duplication.clusters` cluster (likelihood high, severity medium)
  - Each `tests_in_graph.uncovered_roots` symbol (likelihood medium, severity per reach)
  - Each `nfr_edge_cases.reliability_gaps` symbol (severity per missing-family count)
  - Each `tech_debt.high_complexity` frame (severity ∝ complexity-threshold ratio)
  - Acceptance: kotlin-ktor produces ≥ 4 risk items (1 dup cluster + 2 uncovered roots + ≥1 reliability gap).
- [ ] **VS2 · semantic file grouping** *(P2)* — replace top-level-dir grouping
  with category grouping. Use `frame.categories_reached` to assign each file
  to a primary category (db / cache / network / queue / log / io / compute);
  group key files by that.
  - Acceptance: kotlin-ktor groups `OrdersRepository.kt` under "db", `OrdersHandler.kt` under "network".
- [~] **structured payloads** *(shipped)* — both `risks.structured` and
  `key_files.structured` (nested tree) now emit.

---

## [counts.rs](src/pr_algorithms/counts.rs)

Today: all 4 counts are always 0 because `commit_messages` isn't passed in.

- [ ] **C1 · CLI input `--commits FILE`** *(P0)* — newline-delimited commit
  subjects. Without this, every count is permanently 0.
- [ ] **C2 · CLI input `--pr-body FILE`** *(P0)* — for `Fixes #N` / `Closes #N` /
  `Resolves #N` extraction.
- [ ] **C3 · accept via `ScanPrInput.pr_context`** *(P1)* — when
  action-enriched JSON is the input, populate counts from `pr_context.title`
  + `pr_context.body` + (commit list) without separate flags.

---

## [tests_in_graph.rs](src/pr_algorithms/tests_in_graph.rs)

Today: works — kotlin-ktor correctly says `uncovered_roots: ["createOrder", "findById"]`.
No changes needed for now.

- [x] uncovered_roots detection
- [~] **`test_files` counting** — both fixtures report 0; verify behavior
  against a fixture that DOES have tests.

---

## [nfr_edge_cases.rs](src/pr_algorithms/nfr_edge_cases.rs)

Today: works — identifier-keyword scan. kotlin-ktor correctly identifies
`createOrder` has `input_safety` (via `validate`) and `findById` has nothing.

- [x] family detection
- [x] reliability_gaps
- [ ] **N1 · regex weight tuning** *(P2)* — some markers are weak (e.g.
  `\\blog\\b` matches `logger` but also `login`). Track false-positive rate
  on a labeled fixture set; tighten the weakest markers.

---

## [duplication.rs](src/pr_algorithms/duplication.rs)

Today: works — both fixtures correctly find `createOrder` × 2 / `create_order` × 2.

- [x] name-based cluster detection
- [ ] **D1 · body similarity check** *(P2)* — today it's name-only. Two
  functions named `validate` in unrelated classes are flagged. Add an AST
  body-similarity step before clustering (e.g. token-shingle Jaccard ≥ 0.85).
- [ ] **D2 · cluster severity** *(P2)* — emit a `severity` field per cluster
  so VS1 (risk inference) can rank them.

---

## Cross-cutting — CLI input plumbing

`scan-pr` accepts `--changed-files` / `--changed-files-stdin` but nothing
else. Without piping the rest of `ScanPrInput`, every PR-context-dependent
algorithm is starved.

- [ ] **I1 · `--pr-context FILE`** *(P0)* — JSON matching `PrContext`.
- [ ] **I2 · `--commits FILE`** *(P0)* — newline-delimited subjects.
- [ ] **I3 · `--diff-stats FILE`** *(P0)* — TSV `path<TAB>additions<TAB>deletions`.
- [ ] **I4 · `--json-input FILE`** *(P2)* — single JSON matching the full
  `ScanPrInput` schema. Preferred for Action callers; bundles I1-I3.
- [ ] **I5 · `--base-sha SHA`** *(P0)* — for architecture before-state
  reconstruction. See A1.

---

## OpenAPI schema patches

[scan_pr_output.openapi.yaml](schema/scan_pr_output.openapi.yaml) needs to catch up to reality.

- [ ] **O1 · add `ValueAxis.subtitle: string`** *(P1)*.
- [ ] **O2 · add `ValueCard.bars_structured`** *(P1)* — currently emitted but undefined.
- [ ] **O3 · add `ArchitectureFlow.after_structured` / `before_structured` / `combined_structured`** *(P1)* — currently emitted but undefined.
- [ ] **O4 · add `BusinessLogic.structured`** *(P1)* — currently emitted but undefined.
- [ ] **O5 · add `RisksBlock.structured` + `KeyFilesBlock.structured`** *(P1)* — currently emitted but undefined.
- [ ] **O6 · add the entire `pr_review_ext` block** *(P0)* — `tech_debt`, `duplication`, `tests_in_graph`, `nfr_edge_cases`. All emitted but the OpenAPI doesn't define them, so consumers have nothing to typecheck against.
- [ ] **O7 · tighten `DataStructureEntry.kind` enum** *(P0)* — current output emits `"touched"`, off-spec. Either add `touched` to the enum OR make A2's mapping the canonical fix.
- [ ] **O8 · `ValueAxis.source_link: string`** *(P1)* — currently emitted but undefined.

---

## Schema-conformance test gap (action side)

The TypeScript ajv validator we use in [`action/src/contract/validator.ts`](../action/src/contract/validator.ts) currently fails to enforce nested enums — `kind: "touched"` passes validation even though the OpenAPI forbids it. The Rust test [`tests/pr_scope_schema.rs`](tests/pr_scope_schema.rs) is the load-bearing one for now.

- [ ] **X1 · fix the TS validator** to actually walk nested enums (move from doc-wrap to `ajv.addSchema()` per component). Until this lands, schema drift on the action side won't get caught at test time.

---

## Acceptance — when this TODO is done

A clean run of `make action-scan-demo` against the kotlin-ktor fixture, with `--pr-context`, `--commits`, `--diff-stats`, and `--base-sha` all piped in, should produce a `ScanPrOutput` where:

- `architecture_flow.before_mermaid` is real (or omitted)
- `architecture_flow.combined_mermaid` exists with all 3 subgraphs
- Every `data_structures[].kind` is in `{new, modified, removed, unchanged}` and `direction` is populated
- `code_suggestions` has ≥ 1 entry (probably an N+1 candidate or dead code in a changed file)
- `pr_review_ext.tech_debt.high_complexity` and `long_functions` are populated from real frame data
- `business_logic.summary` is either a meaningful paragraph OR `null`
- `counts` has non-zero values
- `value_card.axes[*].subtitle` is populated and `value_money.dev_cost_usd` reflects real diff stats
- `merge.bottom_line` is a real paragraph
- `visual_summary.risks.items` has ≥ 3 items derived from real signals
- Schema validation (Rust side AND TS side) passes — and would catch `"kind": "touched"` if it ever re-appears
