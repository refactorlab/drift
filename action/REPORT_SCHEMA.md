# Drift report contract

The Drift Action reads a JSON report at `$DRIFT_REPORT_PATH` and renders
it into a PR review. The shape is **owned by the scanner**
(`drift-static-profiler`), not the action.

## Canonical schemas

These live in the scanner crate and are the source of truth:

- [`drift-static-profiler/schema/scan_pr_input.openapi.yaml`](../drift-static-profiler/schema/scan_pr_input.openapi.yaml)
  — what the Action SENDS to the scanner (`ScanPrInput`).
- [`drift-static-profiler/schema/scan_pr_output.openapi.yaml`](../drift-static-profiler/schema/scan_pr_output.openapi.yaml)
  — what the Action RECEIVES (`ScanPrOutput`).
- [`drift-static-profiler/schema/profile.schema.json`](../drift-static-profiler/schema/profile.schema.json)
  — underlying compact-report shape (`summary`, `entries`, `string_table`, `frames`).

## How to invoke the scanner

```bash
git diff --name-only --diff-filter=ACMRT "$BASE_SHA" "$HEAD_SHA" \
  | drift-static-profiler scan-pr "$GITHUB_WORKSPACE" \
      --changed-files-stdin \
      --output /tmp/drift-report.json
```

This is the **CLI-minimal** form (path only). An **Action-enriched** form
also exists in the scanner's schema for when we want to pass GitHub
REST API `Diff Entry` fields (status / additions / etc.) — the wrapper
in [`src/contract/github.ts`](src/contract/github.ts) handles the
`filename → path` rename and the enrichment.

## What the scanner produces

Two blocks live above the compact-report fields:

1. **`pr_scope` (FACTUAL — always present)**
   - `changed_files`: paths the caller passed in
   - `affected_roots`: NAMES (strings) of entry-point symbols whose call
     tree transitively reaches at least one symbol in the changed files
   - `unreachable_changes`: changed files whose symbols are dead code
     (no in-graph root reaches them)

2. **`pr_review` (STATISTICAL — optional)**
   - `architecture_flow.before_mermaid` / `after_mermaid` — **scanner
     pre-renders Mermaid strings**, the Action just frames them
   - `business_logic.mermaid` + summary
   - `value_card.axes[]` (money / customer / runtime / runtime_ux)
   - `code_suggestions[]` with category A/B/C, confidence, references,
     unified diff (`before_lines` + `after_lines`)
   - `visual_summary` (risks quadrant + key-files mindmap)

The Action degrades gracefully when `pr_review` is absent — it still
posts the affected-roots overview, just without the rich visuals.

## TypeScript view

- [`src/report.ts`](src/report.ts) — `ScanPrOutput` types + loader/validator
- [`src/contract/input.ts`](src/contract/input.ts) — `ScanPrInput` types + builder
- [`src/contract/validator.ts`](src/contract/validator.ts) — ajv-backed validators
  that compile from the canonical OpenAPI files at test time
- [`src/contract/github.ts`](src/contract/github.ts) — GitHub REST/webhook types
  + `toChangedFile()` converter (`filename → path`)

## Tests

- [`src/__tests__/contract.test.ts`](src/__tests__/contract.test.ts) — T1-T6
  schema-conformance tests, the TS mirror of
  [`drift-static-profiler/tests/pr_scope_schema.rs`](../drift-static-profiler/tests/pr_scope_schema.rs).
- [`src/__tests__/github-contract.test.ts`](src/__tests__/github-contract.test.ts)
  — verifies the GitHub-canonical types match the official REST/webhook
  docs (sourced from docs.github.com on 2026-05-26).

A change to either OpenAPI file should re-run both crates' tests; the
scanner's Rust tests AND the action's TS tests must stay green.

## Quality bar for suggestions (Spec rule)

A `CodeSuggestion` is shown to the reviewer only if it passes ALL of:

- `confidence ≥ 0.75`
- `references[].url` non-empty (at least one real doc/issue link)
- `category` is one of `A` (optimization) / `B` (product correctness) / `C` (framework misuse)

If zero suggestions clear the bar, the action posts no inline review —
the spec's "silence > noise" rule. Implementation:
[`passesQualityBar()`](src/report.ts).
