# PR-Quality Metrics — Implementation Plan

> **Round-2 refinements live in [PR_QUALITY_RESEARCH.md](PR_QUALITY_RESEARCH.md).**
> Where this plan and the research doc disagree, the research doc wins (see its §7).
> Key supersessions: token estimator = **bytes/2.8** (not chars/3.5); compute **true
> cognitive complexity** in the core (not the `complexity+nesting` surrogate);
> normalize heavy-tail counts with **log1p saturation**; correctness_confidence
> aggregates by **geometric mean**, operational_risk by **max + 0.80 floor**; add the
> validation/oracle layer (lizard/scc/tiktoken-rs) + constants regression guards.

New `pr_review_ext.pr_quality` block: six research-grounded quality dimensions
computed from the **already-populated** call-graph + `PrSignals`, plus a small
amount of changed-file source/diff text. Every threshold/weight is citation-anchored
in `schema/pr_algorithms_constants.json` (the `every_value_has_a_citation` test in
[constants.rs](src/pr_algorithms/constants.rs) enforces it).

Status legend: `[ ]` not started · `[~]` partial · `[x]` shipping.

> Source of truth for the research behind every formula/constant: the six deep-research
> briefs (Comprehensibility, Longevity, Correctness-confidence, Operational, Team/process,
> LLM-complexity). Key citations are inlined per-constant below.

---

## 0. Design principles (inherited, non-negotiable)

- **Pure deterministic functions, no I/O** at the algorithm layer — except a single,
  defensive changed-file *source reader* (opt-in via `repo_root`, path-escape guarded),
  exactly like [code_suggestions.rs](src/pr_algorithms/code_suggestions.rs)'s `read_around`.
- **No per-language Rust in shared modules.** Comment/string/literal delimiters that
  differ by language live as a **data table in the constants JSON** (the precedent:
  `test_filename_patterns`, `nfr_edge_cases` FAMILIES). Shared code loops over the table.
- **Single source of truth for findings** = [`pr_signals`](src/pr_algorithms/pr_signals.rs).
  Every "what did this PR introduce?" question reads `PrSignals`, never re-walks `findings`.
- **Reuse the node, don't recompute the graph.** `complexity, loc, nesting_depth,
  parameter_count, is_async, call_site_count (fan-in), callees_count (fan-out),
  callers_count, subtree_size, pagerank, percent_total, categories_reached,
  external_calls{category,in_loop,in_await,sql_literal}, findings` are all on every
  `CallTreeNode` already.
- **Scope to changed code** via `in_pr_changed_files` (clean-as-you-code): pre-existing
  debt in unchanged transitive callees is not this PR's problem.
- **Honesty**: every sub-score carries a `confidence` and `notes`; weak proxies say so.
  Constants that are tuning knobs (not citable facts) get `"citation": "calibration — …"`
  with a CALIBRATION.md follow-up, never a fake URL.

---

## 1. Output shape

One grouped block under the existing `PrReviewExt` envelope (its documented home for
"fields without a stable OpenAPI slot yet"), so the renderer gets all six dimensions in
one place — badge-forward per the PR-comment design memory.

```
PrReviewExt {
  ...existing (tech_debt, duplication, tests_in_graph, nfr_edge_cases),
  pr_quality: PrQuality
}

PrQuality {
  comprehensibility:      QualityDimension,  // 0..1, higher = easier to understand
  longevity:              QualityDimension,  // 0..1, higher = ages well   (+ net_debt_usd signed)
  correctness_confidence: QualityDimension,  // 0..1, higher = more confidence
  operational_risk:       QualityDimension,  // 0..1, higher = RISKIER (inverted semantics flagged)
  team_process:           TeamProcess,       // review_fatigue + knowledge_concentration
  llm_complexity:         LlmComplexity,     // token footprint, context band, reviewability, density, inversion
  overall:                QualityRollup,     // optional weighted synthesis + headline
}

QualityDimension {
  score: f64,                       // 0..1
  direction: Direction,             // reuse existing enum
  confidence: Confidence,           // reuse existing enum
  components: Vec<QualityComponent>,// {key, value 0..1, weight, detail}
  formula: String,
  inputs: BTreeMap<String, InputValue>,   // reuse existing InputValue
  kv: Vec<ValueKv>,                 // reuse — badge chips
  sources: Vec<SourceCitation>,     // reuse existing SourceCitation
}
```

`QualityComponent`, `TeamProcess`, `LlmComplexity`, `QualityRollup` are new structs in
[types.rs](src/pr_algorithms/types.rs). Everything else (`Direction`, `Confidence`,
`InputValue`, `ValueKv`, `SourceCitation`, `ReferenceLink`) is reused.

---

## 2. Constants — new `pr_quality` block in `pr_algorithms_constants.json`

Mirror the `tech_debt_economics` shape. Reuse, don't re-add: `cyclomatic_high_risk=10`
already exists (NIST/Sonar) — every "complexity cutoff" references it. Grouped by family:

| key | value | citation (verified) |
|---|---|---|
| **comprehensibility** | | |
| `cognitive_complexity_limit` | 15 | Campbell, *Cognitive Complexity* whitepaper — sonarsource.com/resources/cognitive-complexity (S3776 default) |
| `comment_density_target` | 0.20 | SonarQube `comment_lines_density` metric def |
| `comment_density_high` | 0.40 | SonarQube (over-commenting / commented-out code) |
| `identifier_min_word_len` | 3 | Lawrie et al., *What's in a Name?* ICPC 2006 |
| `magic_number_exempt_set` | [-1,0,1] | SonarSource S109 |
| `magic_ratio_budget` | 0.10 | calibration — derived from S109 intent |
| `pr_body_min_chars` | 200 | Bacchelli & Bird, ICSE 2013 (rationale need) |
| `comprehensibility_weights` | {explain 0.45, transparency 0.30, context 0.25} | Bacchelli & Bird (understanding = #1 review challenge) |
| **longevity** | | |
| `coupling_sat` | 10 | Shatnawi 2010 (CBO≈9 fault-risk) + McCabe-10 convention |
| `todo_density_sat` | 0.013 | KL-SATD study (arXiv:2008.05159) ~1.26 SATD/KLOC |
| `hardcode_density_sat` | 0.05 | calibration — code-smell prevalence (arXiv:2409.03957) |
| `sqale_cost_per_loc_min` | 30 | SonarQube metric def (debt ratio denominator) |
| `sqale_rating_grid` | A≤.05,B<.10,C<.20,D<.50,E≥.50 | SonarQube maintainability rating |
| `instability_unstable_band` | ≥0.7 unstable / ≤0.3 stable | Martin, *Agile SW Dev* (I=Ce/(Ca+Ce)) |
| `longevity_weights` | {fragility 0.45, debt 0.35, burden 0.20} | calibration — relative empirical strength (CK/Henry-Kafura > textual) |
| **correctness_confidence** | | |
| `diff_coverage_gate` | 0.80 | SonarQube "Coverage on New Code" / Google 80% |
| `diff_coverage_min_lines` | 20 | SonarQube quality-gate fudge |
| `params_free_allowance` | 2 | Clean Code (dyadic OK) |
| `params_too_many` | 7 | SonarQube S107 default |
| `complexity_saturation` | 15 | NIST relaxed bound / SonarQube S3776 |
| `idempotency_marker_relief` | 0.5 | AWS idempotent-APIs; ISO 25010 reliability |
| `correctness_weights` | {coverage 0.45, repeatability 0.30, edge 0.25} | held <0.5 on a proxy (Teamscale: reachability≠coverage) |
| **operational** | | |
| `rollback_destructive_ddl_weight` | 0.95 | strong_migrations (irreversible/table-rewrite) |
| `rollback_blocking_ddl_weight` | 0.70 | squawk (blocking but reversible) |
| `rollback_breaking_api_weight` | 0.60 | SemVer 2.0.0 |
| `rollback_removed_renamed_weight` | 0.45 | Fowler, Parallel Change |
| `rollback_db_write_no_ddl_weight` | 0.30 | DORA four-keys |
| `operational_blast_wide_roots` | 5 | Google SRE — gradual rollout 1–10% per cohort (re-cites the existing `visual_summary_blast_radius_min_roots=5`) |
| `observability_blindspot_full` | 1.0 | OpenTelemetry observability primer |
| `observability_pure_compute_discount` | 0.5 | SRE change-management (only I/O paths are blind spots) |
| `operational_weights` | {rollback 0.45, blast 0.35, observability 0.20} | DORA + SRE 3 tenets; destructive-DDL floor 0.80 |
| **team_process** | | |
| `review_ideal_loc` | 200 | SmartBear/Cisco study |
| `review_max_loc` | 400 | SmartBear ("overwhelms reviewers") |
| `review_normal_files` | 10 | Rigby & Bird 2013 (90% of reviews <10 files) |
| `review_too_many_files` | 50 | Google eng-practices ("200 lines across 50 files… too large") |
| `bus_factor_threshold` | 0.50 | CHAOSS Contributor-Absence (Bus) Factor |
| **llm_complexity** *(round-2 values)* | | |
| `bytes_per_token_code` | 2.8 | calibration — bracketed by cl100k Python 4.2 & Claude-4.7 TS 2.69; byte-basis, O(1), multibyte-safe |
| `bpe_tokens_per_word_token` | 2.1 | calibration — cross-check via `token_shingles` splitter |
| `tokens_per_loc_fallback` | 13 | derived (35 chars/line ÷ 2.8) — LOC-only fallback |
| `minified_chars_per_token` | 2.5 | OpenAI dev-community (minified JS) — failure-mode floor |
| `context_window_flagship` | 1000000 | Claude Opus 4.8 / Sonnet 4.6 / GPT-4.1 / Gemini 2.5–3 Pro (2026) |
| `context_usable_fraction_1m` | 0.30 | NoLiMa ICML 2025 + Chroma context-rot (~300–400K knee on 1M) |
| `context_degrade_knee` | 32000 | NoLiMa / Chroma context-rot |
| `context_band_green_max` / `context_band_yellow_max` | 45000 / 110000 | calibration — derived from knee + 25K overhead |
| `prompt_overhead_tokens` | 25000 | calibration — system + tools + read files + output headroom |
| `semantic_density_dense_max` | 200 | calibration (McCabe denominator) |
| `semantic_density_boilerplate_min` | 800 | calibration |
| `llm_reviewability_weights` | {tokens .45, coupling .25, files .20, dispersion .10} | Liu 2024 lost-in-middle; GitHub Copilot large-PR; ripple lit |
| `inversion_small_diff_tokens` | 4000 | derived ("small" by construction) |
| `inversion_centrality_hub_mult` | 3.0 | calibration — PageRank-as-centrality (×uniform baseline) |
| `inversion_fanin_hub` | 20 | calibration — change-impact ripple fan-in |

Add an axis-source list `axis_sources.pr_quality` (ISO 25010, SonarQube, CHAOSS, Google
SRE, OpenTelemetry, Anthropic/OpenAI context docs) so each dimension can emit
`additional_sources` like the value axes do.

---

## 3. Shared infrastructure (build first)

### [ ] Q0 · `pr_quality/source_scan.rs` — changed-file text scanner
Reuse `code_suggestions`' path-safety + `fs::read_to_string` pattern. For each changed
file (read at HEAD via `repo_root`), produce a `FileTextStats`:
- `comment_lines`, `code_lines`, `blank_lines` (SonarQube `comment_lines_density`).
- `magic_literals`, `numeric_literals` (S109; exclude {-1,0,1}, const/let/static/final/val RHS).
- `todo_markers` (`\b(TODO|FIXME|HACK|XXX)\b`).
- `chars`, `loc` (for token estimate).
Language detection by extension (reuse `tech_debt::language_of`); comment/string
delimiters from the **constants data table** `comment_syntax[]` (NEW). String literals
are stripped before literal/comment scan to cut false positives.
Degrades gracefully: no `repo_root` → empty stats → the dependent sub-scores drop to
`Confidence::Low` and lean on graph-only signals.

### [ ] Q1 · `pr_quality/tokens.rs` — deterministic token estimator
`estimate_tokens(chars) = ceil(chars / chars_per_token_code)`, with the LOC fallback
`changed_loc * tokens_per_code_line` when source text is unavailable. Cross-check against
`duplication::token_shingles` word-token count (`* 1.4`) for a confidence band (±20%).
Reused by `llm_complexity` and `team_process`.

---

## 4. Per-family modules (`src/pr_algorithms/pr_quality/`)

### [ ] Q2 · `comprehensibility.rs` → `QualityDimension` (higher = easier)
Per changed node, loc-weighted mean over the changed-files-scoped walk:
- **explainability** (0.45): `cog = complexity + nesting_depth` → flow score
  `1 - clamp((cog-1)/(cognitive_complexity_limit-1))`; comment-density score vs
  `comment_density_target` band; naming score = fraction of identifiers (node.name +
  external_call names) with ≥1 token ≥ `identifier_min_word_len`. Mix 0.45/0.30/0.25.
- **decision_transparency** (0.30): `magic_score = 1 - clamp(magic_ratio/magic_ratio_budget)`;
  `+` rationale comments / PR-body length ≥ `pr_body_min_chars` / Conventional-Commit type
  present (reuse `value_runtime_ux` commit parsing); `−` TODO penalty.
- **context_dependency** (0.25, inverted to "ease"): pagerank (normalized within PR) +
  fan-in `call_site_count` + fan-out `callees_count+subtree_size` + `categories_reached.len()/7`.
Reuse: extend `nfr_edge_cases` scanner idiom; route display via `symbol_label`.

### [ ] Q3 · `longevity.rs` → `QualityDimension` + signed `net_debt_usd`
- **fragility** (0.45): max + pagerank-weighted-mean over nodes of
  `0.55*max(blast,centrality) + 0.25*exposure + 0.20*instability`, where blast=
  `log1p(callers_count+call_site_count)/log1p(coupling_sat)`, instability=
  `callees_count/(callers_count+callees_count)`. Strongest, graph-native.
- **debt_delta** (0.35): SQALE-style PR debt ratio from the **existing** value_money
  arithmetic — surface `net_debt_h = (bug_hours+maintenance_hours) − (fix_savings+cleanup+refactor)`
  as first-class; rating via `sqale_rating_grid`.
- **maintenance_burden** (0.20): TODO density + hardcoded-value density (from `source_scan`);
  coupling lives in fragility to avoid double-count (v1: burden = textual only).
Reuse: refactor `value_money.rs` to expose `net_debt_*`; add `refactor:` paydown.

### [ ] Q4 · `correctness_confidence.rs` → `QualityDimension`
- **coverage** (0.45): static reachability proxy = `(affected_roots − uncovered_roots)/affected_roots`
  blended with `test_functions_added/changed_functions`; small-diff relief < `diff_coverage_min_lines`.
  **Cap dimension confidence at Medium** when coverage is proxy-only and any root is uncovered.
- **repeatability** (0.30): determinism/idempotency from `categories_reached ∩ {db,network,io,cache,queue}`,
  write-shaped `external_calls` (esp. `in_loop`), halved by a reliability-`idempot` marker.
- **edge_case_surface** (0.25): `param_surface` (`params_free_allowance`→`params_too_many`)
  + `branch_surface` (`cyclomatic_high_risk`→`complexity_saturation`), discounted by an
  `input_safety` marker.
Reuse: extend `tests_in_graph` to return covered/affected counts + `changed_functions`;
reuse `nfr_edge_cases` input_safety/idempot per-root hits (no new regex).
Optional input hook: `Option<f64>` external diff-coverage % → replaces the proxy + lifts the cap.

### [ ] Q5 · `operational.rs` → `QualityDimension` (higher = RISKIER — flag in label)
- **rollback** (0.45): `max(` destructive-DDL .95, blocking-DDL .70, breaking-API .60,
  removed/renamed .45, db-write-no-DDL .30 `)`. Destructive classified by `MIG_*` rule_id.
- **blast_radius** (0.35): `0.45*min(roots/operational_blast_wide_roots,1) + 0.30*centrality
  + 0.15*max percent_total + 0.10*fan-in`.
- **observability** (0.20): blind-spot ratio = roots with no observability marker AND no
  Log-category external call; ×0.5 for pure-compute PRs.
- Floor: destructive DDL → `operational_risk = max(score, 0.80)`.
Reuse: `PrSignals` MigrationSafety findings + `rule_id`; add `sql_lint::migration_severity_class(rule_id)`;
add symmetric `observability_gaps` to `NfrCoverage`; reuse `affected_root_names`,
`visual_summary` BREAKING-CHANGE commit scan. **Re-cite** `visual_summary_blast_radius_min_roots`
to the Google-SRE basis (value 5 unchanged).

### [ ] Q6 · `team_process.rs` → `TeamProcess`
- **review_fatigue** (0..1, static): `max(smoothstep(loc, 200, 400), smoothstep(files, 10, 50))`
  with a small token nudge. Replaces/upgrades `visual_summary`'s PR-size risk (whose
  `files/100` knee is past Google's 50-file limit and whose `+0.3` severity floor is wrong).
- **knowledge_concentration** (0..1): ship a **clearly-labeled static "specialization /
  single-owner shape"** approximation (Herfindahl churn-concentration over per-file
  additions+deletions + rare-category + migration/infra path share). **Not** called "bus
  factor" (would overclaim). Design an optional git-author input hook (`Option<&[FileAuthors]>`)
  for the faithful CHAOSS 50%-sweep, deferred to v2; provenance tagged `source: static-approx`.

### [ ] Q7 · `llm_complexity.rs` → `LlmComplexity` (FLAGSHIP)
- **token_footprint**: `estimate_tokens` over diff size (additions+deletions → chars, or
  read changed-file text), with ±20% band.
- **context_pressure**: `load = (tokens + prompt_overhead_tokens)/(W*context_usable_fraction)`,
  default `W=200k`; GREEN ≤0.5 / YELLOW ≤1.0 / RED >1.0.
- **reviewability** (0..1): `1 − (0.45*p_tokens + 0.25*p_coupling + 0.20*p_files + 0.10*p_dispersion)`.
- **semantic_density**: `tokens / (Σcomplexity + changed_fns + findings + categories)`,
  banded dense<200 / boilerplate>800.
- **INVERSION flag**: `small_diff (tokens<4000, files≤3) AND central (pagerank·N ≥ 3 OR
  call_site_count ≥ 20 OR subtree_size ≥ 50)` → "small diff, foundational blast radius;
  budget extra review depth." The signal that says *the diff size lies*.
Reuse: `tokens.rs`; reuse money-axis token constants only in value_money (not here).

### [ ] Q8 · `pr_quality/mod.rs` — orchestrator
`compute(QualityInputs) -> PrQuality`: runs Q2–Q7 once over the scoped walk, assembles the
struct, computes `overall` rollup. One `QualityInputs` carrying `entries, changed_files,
signals, commit_messages, pr_context, repo_root, tests_in_graph, nfr, affected_roots`.

---

## 5. Wiring

- [ ] [types.rs](src/pr_algorithms/types.rs): add `PrQuality` + sub-structs; add
  `pr_quality: PrQuality` to `PrReviewExt`.
- [ ] [constants.rs](src/pr_algorithms/constants.rs): `PrQualityConstants` struct + typed
  accessors; extend `$consumers` list in the JSON.
- [ ] [mod.rs](src/pr_algorithms/mod.rs): `pub mod pr_quality;`.
- [ ] [merge.rs](src/pr_algorithms/merge.rs): after `nfr`/`tig`/`signals` are built, call
  `pr_quality::compute(...)` and place the result in `PrReviewExt`. Reuses every input
  already computed there — no new CLI plumbing for v1.
- [ ] OpenAPI: append `pr_quality` to the `pr_review_ext` schema (O6 follow-up).

---

## 6. Build order (step by step)

1. Constants JSON block + `constants.rs` accessors + `comment_syntax[]` table. (Tests: parse + citations.)
2. `source_scan.rs` + `tokens.rs` shared infra. (Unit tests on fixtures.)
3. `types.rs` structs + `PrReviewExt` field.
4. `llm_complexity.rs` (flagship; least dependent on source-scan — works off LOC). 
5. `operational.rs` (mostly `PrSignals`/graph — high signal, low new surface).
6. `correctness_confidence.rs` (extend `tests_in_graph` first).
7. `longevity.rs` (refactor `value_money` net-debt first).
8. `comprehensibility.rs` (most source-scan dependent).
9. `team_process.rs` (+ re-cite/upgrade `visual_summary` PR-size risk).
10. `pr_quality/mod.rs` orchestrator + `merge.rs` wiring + `overall` rollup.
11. End-to-end: run against the python-fastapi + kotlin-ktor fixtures; verify shape + sane values.

Each step: module + `#[cfg(test)]` unit tests in the same file (the repo convention),
`cargo test -p drift-static-profiler`, `cargo clippy`.

---

## 7. Honesty flags (must surface in `notes`/`confidence`)

- Static reachability ≠ real coverage (over/under-approximates) — Teamscale. Cap confidence; accept external % to lift.
- Keyword markers (idempot/validate/observability) are lexical evidence, not proof.
- Knowledge-concentration is a **specialization** approximation, not CHAOSS bus factor, without git authorship.
- Token footprint is a tokenizer-free estimate (±20%); context bands use a 50% usable fraction by design.
- Magic-number / comment scans have ~5% lexical noise (regex/strings); string-literal stripping mitigates.
- Calibration constants (`magic_ratio_budget`, density cutoffs, hub multipliers) are tuning knobs → CALIBRATION.md.
