# PR-Quality Metrics — Deep Research (implementation-grade)

Companion to [PR_QUALITY_METRICS_PLAN.md](PR_QUALITY_METRICS_PLAN.md). This doc is the
*reasoning + reference-implementation + verified-constant* layer: the "how do we
actually calculate this, and how do we know it's right" record a principal engineer
would defend in review. Two rounds of web research (methodology, then mechanics)
condensed to decisions. Every constant is tagged **[CITED]** (verified external fact)
or **[CALIBRATION]** (tuning knob, re-derivable from a corpus — never a fake URL).

Verified against the live code: `CallTreeNode`/`ExternalCall`/`Category` fields,
`pagerank` mass = 1.0 (`src/pagerank.rs`), `complexity = 1 + decision_points`
(`src/metrics.rs`), `pr_signals` SSOT, the `finite_or_zero` NaN guard
(`merge.rs:41`), and the `every_value_has_a_citation` constants test.

---

## 1. Token calculation — how to estimate LLM tokens for a diff (FLAGSHIP)

**Step-by-step reasoning.**

1. **Why not just chars/4?** OpenAI's "~4 chars/token" is a *prose* constant. Code
   tokenizes denser because byte-level BPE pre-tokenization (the tiktoken `pat_str`
   regex) puts hard boundaries at every punctuation run, indentation run, and
   camelCase transition — `arr.push(x);` is ~6–7 tokens for 12 chars (~1.8 chars/tok
   on that line). So code lands well below 4. [CITED: OpenAI tokenizer help; fast.ai
   BPE walkthrough]

2. **Which tokenizer to target?** The decisive correction from round 2: tokenizers are
   **not static and are getting denser**. Measured chars/token:
   - cl100k_base (GPT-4): Python **4.2**, minified JS **2.5** [CITED: OpenAI dev forum]
   - Claude 4.6: TypeScript **3.66**; **Claude 4.7+: TypeScript 2.69** (~1.36× more
     tokens than 4.6; Python ~1.29×) [CITED: claudecodecamp 2026]
   - Anthropic docs: Sonnet 4.6 ≈ 3.4 chars/tok mixed; Opus 4.8 ≈ 2.5 chars/tok mixed
   A safety-biased estimator must target the **harsh** end (newest Claude), not the
   friendly cl100k — under-budgeting context is the dangerous error.

3. **Primary estimator = bytes / 2.8.** BPE operates on UTF-8 bytes, so bytes/token is
   the fundamental quantity; `s.len()` is O(1) with no decode, and it **auto-corrects
   for multibyte** (more bytes → more tokens, the right direction). 2.8 ≈ the
   newest-Claude code floor; it over-counts cl100k (~+50%, safely over-budget) and is
   within ~5% of Claude-4.7 code. **[CALIBRATION: 2.8 bytes/token]** bracketed by the
   cited 4.2 / 2.69 / 2.5 measurements.

4. **Cross-check = word_tokens × 2.1.** Reuse `duplication::token_shingles`' splitter
   (splits on `!alnum && !'_'`) as a near-free word-token count; BPE/word ratio for
   code ≈ 2.1 (derived: the punctuation the splitter discards is exactly what BPE
   charges for). It fails on *orthogonal* inputs to the byte path (minification), so
   divergence between the two is a useful "this file is weird" flag. Report
   `est = round(0.5·bytes/2.8 + 0.5·words·2.1)`; use `max(...)` for budget gating.

5. **What to feed it.** Best: **changed-file bytes at HEAD** (we have `repo_root`),
   optionally scaled by churn fraction. Fallback when unreadable:
   `tokens ≈ (additions+deletions) × 13` — derived from 35 chars/line (1.78T-LOC study)
   ÷ 2.8; cross-checks the community "1000 LOC ≈ 10k+ tokens" rule. **[CALIBRATION: 13
   tokens/line]**

6. **Report a band, not a point.** ±20% (`lo=est·0.8, hi=est·1.2`); the validation
   oracle (tiktoken-rs, §6) must show the band brackets truth ≥80% of files or we
   narrow it.

**Context-window math (verified 2026).** Windows: Opus 4.8 / Sonnet 4.6 / GPT-4.1 /
Gemini 2.5–3 Pro = **1M**; Haiku 4.5 / Sonnet 4.5 / o3 / Gemini 3 Flash = **200K**;
GPT-4o = 128K. [CITED: Anthropic models overview; OpenAI; Google]. The diff is only
*part* of the prompt → derive:
- `PROMPT_OVERHEAD ≈ 25_000` (system + tools + read files + output headroom)
  **[CALIBRATION]**
- `USABLE_FRACTION = 0.30` for 1M models — justified by long-context degradation, not
  the marketing window: NoLiMa (ICML 2025) "effective length" ≥85%-of-baseline and
  Chroma context-rot show 1M models degrade by ~300–400K; 200K-class by ~32–50K.
  **[CITED basis: NoLiMa arXiv 2502.05167; Chroma context-rot]**
- Bands (diff tokens, default 1M target): **GREEN < 45K · YELLOW 45–110K · RED > 110K**.
  GREEN fits every model's reliable zone; RED nears the degradation knee once overhead
  + read-files are added → recommend splitting the PR.

**Do NOT vendor tiktoken** in the hot path (also it can't model Claude's tokenizer).
Use `tiktoken-rs` only as a `[dev-dependencies]` oracle (§6).

`token_estimation` constants (→ JSON): `bytes_per_token_code 2.8`,
`bpe_tokens_per_word_token 2.1`, `tokens_per_loc_fallback 13`,
`minified_chars_per_token 2.5`, `prompt_overhead_tokens 25000`,
`context_window_flagship 1000000`, `context_usable_fraction_1m 0.30`,
`context_band_green_max 45000`, `context_band_yellow_max 110000`,
`context_degrade_knee 32000`.

---

## 2. Complexity prediction — cognitive vs cyclomatic (FLAGSHIP)

**Step-by-step reasoning.**

1. **We already have cyclomatic** (`complexity = 1 + decision_points`, McCabe) and
   `nesting_depth` from the tree-sitter walk in `metrics.rs`. The comprehensibility
   metric wants *understandability*, which is **Cognitive Complexity** (Campbell),
   not cyclomatic.

2. **Why cyclomatic lies, both ways.** A flat 20-case `switch` is cyclomatic ~21 but
   cognitive ~1 (one lookup table — trivially readable). Three nested `if`s are
   cyclomatic 4 but cognitive 6 (nesting compounds). McCabe punishes branch *count*;
   cognitive tracks *reading difficulty*. [CITED: Campbell whitepaper]

3. **Is the cheap surrogate `complexity + nesting_depth` good enough? No.** Worked
   against the canonical examples it is **unbounded and upward-biased exactly where
   cognitive should stay low**:
   - `sumOfPrimes` (nested for/for/if): true cognitive 7, surrogate 7 (lucky ✓)
   - `getWords` (flat switch): true cognitive **1**, surrogate **5** (+4 ✗)
   - 20-case switch: true cognitive ~1, surrogate **22** (+21 ✗ — would flag readable code)
   So the surrogate fails on dispatch tables, the most common false-alarm shape.

4. **Decision: compute TRUE cognitive complexity** via a dedicated tree-sitter walk,
   mirroring **rust-code-analysis `cognitive.rs`** (the gold reference — computes both
   cyclomatic and cognitive across languages; Go from **gocognit**). This is a
   `metrics.rs` change: add `cognitive_complexity: usize` to `SymbolMetrics` +
   `CallTreeNode`, computed in the existing walk. Per the clean-architecture memory
   rule, the per-language increment node-kind tables live in `src/languages/<lang>.rs`
   (the profiles), shared code loops over them — exactly how decision-points already work.

5. **The exact Campbell algorithm** (B1/B2/B3 bucket model):
   - **B2** (`+1 + nesting`, recurse `nesting+1`): `if`, ternary, `while`, `for`,
     `do`, `catch`, `switch` *once* (NOT per case), language loop/match expressions.
   - **B1** (`+1` flat, no nesting penalty): `else`/`else if`/`elif` (also raise
     nesting → B3), **labeled** `break`/`continue`/`goto`, recursion.
   - **B3** (raise nesting, +0): nested function/lambda/closure (outermost analyzed fn
     does NOT raise nesting).
   - **Boolean runs**: `+1 per contiguous run of the same operator` (`a&&b&&c` = +1;
     `a&&b||c` = +2), NOT per operator — the one place this differs from the existing
     McCabe decision-point counter (which counts each `&&`/`||`).
   - **Free**: method declaration, plain blocks, `try`/`finally`, unlabeled jumps,
     non-recursive calls, every `case`/`match arm`.
   - Keep cognitive and McCabe as **separate tables** (switch/boolean differ).

6. **PR-level aggregation.** Rank PRs by **sum of cognitive** over changed functions
   (comprehension cost is additive across functions a reviewer/LLM must hold), report
   **max** (the landmine) and **p90** alongside. Sum is the LLM/review-load proxy;
   max gates the "one function nobody will fully understand" flag.

7. **Skip Halstead/MI for v1.** MI needs Halstead Volume (we lack it) and an
   operator/operand lexicon per language; cognitive gives the comprehensibility signal
   more directly. Revisit only for VS-comparable MI later.

Constants: `cognitive_complexity_limit 15` [CITED: SonarQube S3776], cyclomatic
`10`/`15`/`20` [CITED: NIST SP 500-235] (10 already in JSON).

> **Scope note for implementation:** adding `cognitive_complexity` to the core analyzer
> (metrics.rs + 8 language profiles + CallTreeNode) is the *correct* move and what this
> research recommends. If, during the build, the core change proves too invasive to land
> in the same pass, the fallback is the documented surrogate **with its error flagged and
> confidence-capped** — but true cognitive is the target. Decide at step "Implement
> comprehensibility" in the plan's build order.

---

## 3. Source-text scanning — the shared `source_scan.rs` infra

**Reasoning.** Comment-density, magic-numbers, TODO, naming all need to read changed
files. The naive regex approach (cloc) **breaks on `//` inside a string literal** — so
mirror **scc/tokei's byte-level state machine** instead. The single highest-leverage
correctness move: **run the magic-number / TODO regexes ONLY over bytes the state
machine classified as code / comment respectively** — this eliminates the
"number-in-string", "number-in-comment", "TODO-in-code" false-positive classes for free.

**State machine** (9 states, scc model): `S_BLANK, S_CODE, S_COMMENT, S_COMMENT_CODE,
S_MULTICOMMENT, S_MULTICOMMENT_CODE, S_MULTICOMMENT_BLANK, S_STRING, S_DOCSTRING`.
Load-bearing rules: code-then-comment = **code**; blank line inside a block comment =
**comment**; strings suppress comment tokens (escape parity: even backslashes ⇒ live
terminator); nested block comments via a stack (Rust/Scala/Kotlin); **match
longest-delimiter-first** (`r##"` before `r#"` before `"`; `"""` before `"`).

**`comment_syntax[]` table for 8 languages** — sourced from tokei `languages.json`,
**with tokei's gaps fixed**: Java/Kotlin text blocks `"""`, Go raw backtick strings
(no escapes), Scala triple-quotes + nested comments. Per language:
`{line_comment[], block_comment[(open,close)], strings[(open,close,raw?)],
doc_strings[], nested_block}`. Lives in the JSON; per the clean-architecture rule the
canonical owner is each `src/languages/<lang>.rs` profile (a `SourceTextProfile` trait
method), JSON is the serialized form the scanner loops over.

**Comment density** (SonarQube): `comment_lines / (ncloc + comment_lines)`; healthy
band 15–30% (`comment_density_target 0.20`, `comment_density_high 0.40`);
non-significant comment lines (only `*`/punctuation) count **+0**; commented-out code
counts **+1**.

**Magic numbers** (S109 + ESLint): exempt `{-1,0,1}`; scan only `S_CODE`;
anti-identifier boundary regex (`(?<![\w.$]) … (?![\w.$])`) kills `utf8`/`sha256`/`md5sum`
FPs; handle hex/octal/binary/scientific/underscored/BigInt; skip const/`final`/`val`
RHS, array indexes, default params. `magic_ratio_budget 0.10` **[CALIBRATION]**.

**TODO/SATD**: density terms `{TODO,FIXME,HACK,XXX}` (exclude `NOTE` — informational);
`\b(TODO|FIXME|HACK|XXX)\b` over comment bytes only; normalize per-KLOC
(`todo_density_sat 0.013` ≈ 1.26 SATD/KLOC [CITED: KL-SATD arXiv:2008.05159]) + emit
the raw added-TODO delta.

**Identifier naming**: mirror the **`heck` crate** boundary algorithm
(`XMLHttpRequest → XML|Http|Request`) + a small atomic-token allowlist
(`utf8,sha256,ipv4,oauth2,…`) — no wordlist needed for splitting. Score: single-letter
penalty except `{i,j,k,n,x,y,z,_}`; min word len 3; real-word heuristic = len≥3 ∧ has
a vowel ∧ not in abbrev-list. [CITED: Lawrie ICPC 2006 — full words ~19% better
comprehension]. Case-convention table per language.

**Scoping** (mirror GitHub Linguist): skip minified (avg line >110 chars), generated
(`@generated`/`DO NOT EDIT` in first 40 lines), vendored (`node_modules/`, lockfiles),
and **exclude test files from magic-number + naming** (magic numbers expected in
tests) but include them in comment/TODO density. **Classify the FULL HEAD file**
(state machine needs full context), then **intersect with the added-line set** for
PR-attribution; never run regexes on bare diff `+` lines.

---

## 4. Coupling / fragility / centrality — and normalization (the crux)

**Reasoning.** The classical metrics (CK CBO, Martin instability, Henry-Kafura) are
**class/package-level**; our graph is **function-level**. Transfer the *directional
intuition* (afferent = blast radius; efferent = own fragility) but **do not quote
class-level thresholds as function law** — carry them as priors tagged "CLASS-level".

**Fragility(node) ∈ 0..1, afferent-dominant** (what breaks if this changes is governed
by who depends on it — NDepend/coupling.dev):
```
fragility = 0.45·fan_in_s + 0.30·centrality_s + 0.15·hk_s + 0.10·fan_out_s
```
- `fan_in_s = log1p(call_site_count)/log1p(FANIN_SAT)` (1-hop blast)
- `centrality_s = log1p(pagerank·N)/log1p(CENT_SAT)` — **centrality_multiple = pagerank
  × N** is "how many× the uniform 1/N baseline"; N-invariant, scale-free. **NEVER
  threshold raw pagerank with a constant** (it shrinks with N).
- `hk_s = log1p(loc·(fan_in·fan_out)²)/log1p(HK_SAT)` (Henry-Kafura, log-compressed —
  the quartic must be tamed)
- `fan_out_s = log1p(callees_count)/log1p(FANOUT_SAT)`

**Normalization recipe (the crux): `log1p(x)/log1p(SAT)`** is the winner — it's the only
transform that is **stateless** (works on a single-node PR, no full-repo distribution
needed), **bounded**, **monotone**, and **matched to the power-law** shape of call-graph
degree (compresses the long tail, expands the dense 0–10 region where most functions
live). Reject `x/max_over_changed_nodes` as primary (single-node PR → everything 1.0)
and z-score (unbounded). **Seed each SAT at ~p90–p99 of a reference scan** so only true
outliers peg (the one place an offline distribution helps; stateless at runtime after).

Worked spread for `log1p(x)/log1p(50)`: fan-in 0→**0.00**, 5→**0.46**, 20→**0.77**,
100→**1.00** (good resolution in the live band, graceful saturation).

**PR aggregation: pagerank-weighted mean** `Σ(f_i·pr_i)/Σ(pr_i)` (the hub dominates by
construction) + report `max_i` as the headline "most fragile touched symbol".

Constants (all SAT/weights **[CALIBRATION]**, priors **[CITED]**): `coupling_sat 10`
(Shatnawi CBO≈9 prior), `fanin_sat 50`, `fanout_sat 25`, `centrality_sat 50`,
`subtree_sat 200`, `hk_ifc_sat 2.2e7`, `instability_unstable_band ≥0.7 / ≤0.3`
(Martin), fragility weights `0.45/0.30/0.15/0.10`. Reference: NDepend (Rank=PageRank,
zone-of-pain), Structure101 (Fat×Tangle — `is_recursive`/SCC as a tangle multiplier),
CodeScene (hotspots).

---

## 5. Debt · coverage · repeatability · edge-surface

**A. SQALE net-debt.** `sqale_debt_ratio = debt / (cost_per_loc × LOC)`,
`cost_per_loc = 30 min` [CITED: SonarQube], grid **A≤0.05·B<0.10·C<0.20·D<0.50·E≥0.50**
[CITED]. Reuse the existing `value_money` engine: `debt_introduced_min = 60×(bug_hours +
findings·maint_per_finding + LOC_added·maint_per_loc)`;
`debt_resolved_min = 60×(fix_refactor_commits·bug_hours_important + max(0,
LOC_del−LOC_add)·maint_per_loc)` — **add `refactor:` alongside `fix:`** as paydown.
`net_debt_min = introduced − resolved`; signed `net_debt_usd`; sub-score =
`clamp(net_debt_min / (30 × max(LOC_added,1)), 0, 1)`. Worked: 120 add / 40 del / {1
crit, 2 imp} / 1 fix → net +1002 min → ratio 0.278 → **C-band**.

**B. Coverage (proxy).** No runtime data → `static_coverage_proxy = (affected_roots −
uncovered_roots)/affected_roots × test_presence_factor` (0.6 if no new tests). Static
reachability ≠ executed coverage (over- AND under-approximates; static call graphs miss
~12% of dynamic edges [CITED: Alves & Visser]). **Cap confidence at Medium** when
proxy-only and any root uncovered; `Low` when `affected_roots < 3`. `Option<f64>` hook
for a real Codecov/Sonar patch-% (≥80% gate, 20-line waiver [CITED]) → overrides proxy,
lifts cap. Validate as a **rank** predictor only (Spearman ρ ≥ 0.5).

**C. Repeatability (idempotency/determinism).** Penalty model per node:
write-non-idempotent (INSERT/POST/send) **0.80**, idempotent write (UPSERT/MERGE/PUT)
**0.25**, read-effectful **0.15**; `+0.20` if write `in_loop` (AWS double-EBS retry
hazard [CITED]); `+0.05` `in_await`; `+0.50` non-determinism (now/random/uuid tokens,
Fowler [CITED]). Idempotency-marker relief ×: `0.30` strong (`idempot|dedup|client_token`)
/ `0.70` weak (`retry|circuit`). `repeatability = 1 − raw_penalty × relief`. Worked:
pure compute → 1.0; loop INSERT no marker → 0.0; loop INSERT + idempotency token → 0.70.
Reuse `nfr_edge_cases` reliability markers + `categories_reached` + `external_calls`
write-shape (`sql_literal` keyword / write-verb name). RFC 9110 method table is the
basis.

**D. Edge-case surface.** Noisy-OR of two surfaces:
`path_surface = clamp((complexity−1)/(10−1))` (McCabe = upper bound on edge cases
[CITED]) and `arg_surface = clamp((parameter_count−2)/(7−2))` (Clean Code dyadic≤2
free; S107 max 7 [CITED]); `raw = 1−(1−path)(1−arg)`; × `input_safety_discount 0.70`
when a `validate|sanitize|schema` marker is present. Worked: `add(a,b)` → 0.0;
complexity-10 handler → 1.0; 7-param builder → 1.0; + validation → ×0.70.

All four roll up to PR level via the same **pagerank-weighted mean** over in-scope
effectful/changed nodes.

---

## 6. Validation, calibration & bulletproofing

**Oracles (run in `cargo test`):** complexity vs **lizard** (CCN; all 8 langs) +
**rust-code-analysis** (cognitive); comment density vs **scc**/**cloc**; tokens vs
**tiktoken-rs** (`o200k_base`, dev-dependency); SQALE vs **SonarQube**; magic numbers
vs **S109**; rollback vs **squawk/strong_migrations**; review-size vs SmartBear/Google
anchors. Estimators → error band (**sMAPE ≤ 20%**, not MAPE — asymmetric/blows up on
tiny diffs); judgment metrics → **Spearman ρ** (rank, not Pearson). Two distinct
questions: "measures the primitive?" (error band) vs "predicts the outcome?" (ρ) — never
conflate.

**Avoid the saturation/peg trap (the #1 composite-score failure):** set each SAT at
≈p90 of the observed input; **dead-score detector** in CI — flag any sub-score with
`p90−p10 < 0.05` (never moves) or `>50%` pegged at 0/1; composite spread gate
`stdev ≥ 0.12`. Use a vendored real-PR calibration corpus (`tests/fixtures/calibration_corpus/`)
for the percentiles (deterministic/offline). Heavy-tail inputs (tokens, fan-in, LOC) →
`log1p`; bounded ratios → linear; thresholded (review size, bands) → `smoothstep`.

**Aggregation per metric (the operator encodes a belief):**
- comprehensibility → **weighted arithmetic mean** (compensatory)
- longevity → weighted mean, **fragility uses max() internally**
- correctness_confidence → **geometric mean** (weakest-link: great branch coverage
  can't paper over zero reachability)
- operational_risk → **max / floor** (one destructive migration dominates; `max(score,
  0.80)` floor)
- team_process → **two independent scores** (don't fuse fatigue + concentration)
- llm reviewability → **additive weighted penalty** (pressures trade off)

**Property/golden tests (all six):** bounds ∈[0,1]; determinism + order-independence;
**NaN/Inf guards** (route every ratio/log through `finite_or_zero`; mirror
`extreme_loc_does_not_produce_nan`); empty-input neutrality; monotonicity (more findings
⇒ lower correctness; bigger diff ⇒ higher fatigue; more fan-in ⇒ higher fragility;
destructive DDL ⇒ ≥0.80; small-diff+high-centrality ⇒ inversion fires).

**Governance:** extend `every_value_has_a_citation` to the `pr_quality` block; add
`weights_sum_to_one` test; add `pr_quality_constants_match_calibrated_values` regression
guard (mirrors `json_values_match_previous_hardcoded_constants`) so no constant drifts
silently; record cited-vs-knob provenance + corpus percentiles in `CALIBRATION.md`.

---

## 7. Net corrections to PR_QUALITY_METRICS_PLAN.md (round-2 deltas)

1. **Tokens:** primary estimator is **bytes/2.8** (not chars/3.5) + word×2.1 cross-check;
   context default 1M with **0.30 usable fraction**; bands 45K/110K. (Tokenizers got
   denser — target the harsh end.)
2. **Complexity:** compute **TRUE cognitive complexity** in the core (metrics.rs +
   language profiles + a new `cognitive_complexity` field), NOT the
   `complexity + nesting_depth` surrogate (unbounded error). Aggregate PR-level by sum;
   report max + p90.
3. **Source scan:** **state machine** (scc/tokei), not regex; scan regexes only over
   classified bytes; full-HEAD-classify + added-line intersect.
4. **Normalization:** **log1p saturation** everywhere for heavy-tail counts;
   `centrality_multiple = pagerank·N`; SAT seeded at corpus p90.
5. **Aggregation:** correctness_confidence = **geometric mean**; operational_risk =
   **max + 0.80 floor**; not all weighted-mean.
6. **Validation:** add the oracle harness (lizard/scc/tiktoken-rs) + dead-score detector
   + `weights_sum_to_one` + constants regression guard. Add `tiktoken-rs`, (optionally
   `lizard`/`scc` via subprocess) as dev-only.
7. **value_money:** add `refactor:` to debt paydown; surface signed `net_debt_*`.
8. **Confidence discipline:** proxy-only ⇒ cap Medium; missing source text ⇒ drop a
   level; tiny PR ⇒ lower; knowledge-concentration labeled `static-approx` (never "bus
   factor").
