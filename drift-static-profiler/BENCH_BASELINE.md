# Bench baseline — Phase 0 (pre-resolver, pre-containment)

Snapshot of `cargo bench --bench scan_pipeline` against the per-language
fixtures in `tests/fixtures/bench/<slug>/`. Recorded on the
`LanguageProfile` refactor (Stage A) before any behavioral change so
later phases (C: constructor resolution, E: containment, etc.) can
gate against these numbers.

Run again with `cargo bench --bench scan_pipeline -- --save-baseline phaseN`
to compare; criterion will tell you per-bench `% change vs. previous`.

## `analyze` (full pipeline, per-language tiny fixture)

| Language    | time (median) | n samples |
|-------------|---------------|-----------|
| python      | ~2.4 ms       | 10        |
| java        | ~2.4 ms       | 10        |
| typescript  | ~2.5 ms       | 10        |
| javascript  | ~2.5 ms       | 10        |
| go          | ~2.5 ms       | 10        |
| rust        | ~2.5 ms       | 10        |
| scala       | ~2.4 ms       | 10        |
| kotlin      | ~2.4 ms       | 10        |

(Quick-mode numbers from `--warm-up-time 1 --measurement-time 1
--sample-size 10`. For a real baseline, run without overrides to get
criterion's default 100-sample statistical run.)

## Perf gates for later phases

| Phase | What | Gate vs. this baseline |
|-------|------|------------------------|
| C (constructor resolution)        | `analyze/lang/*`        | ≤ +5%                  |
| D (lambda / anon-class capture)   | `analyze/lang/*` + `tags_extract/lang/*` | ≤ +8% per language |
| E (ContainmentGraph)              | `analyze/lang/*`        | ≤ +5%                  |
| F (receiver-type bindings)        | `analyze/lang/*`        | ≤ +5%                  |

A regression past the gate blocks the phase landing. The HTML report at
`target/criterion/report/index.html` shows the distribution per bench.
