// 🔖 Legend & methodology — the self-documenting key for every symbol used
// above, plus a one-paragraph statement of how the numbers are produced. Static
// except for the tech-debt thresholds, which are filled from the report when
// present so the legend never disagrees with the findings.

import type { TechDebt } from '../../report.ts';

export function renderLegend(techDebt?: TechDebt): string {
  const cx = techDebt?.thresholds?.complexity ?? 10;
  const loc = techDebt?.thresholds?.loc ?? 80;

  const table = [
    '| Symbol | Meaning |',
    '|:--:|---|',
    '| 🔴 / 🟢 / ⚪ | Axis direction — regression / improvement / no change |',
    '| `██▋░░` | Magnitude bar — \\|Δ\\| relative to the largest axis, ⅛-block precision |',
    '| 🅐 / 🅑 / 🅒 | Finding class — 🅐 optimization · 🅑 product correctness · 🅒 framework misuse |',
    '| 🔴 / 🟡 / ⚪ | **Priority** — high (act now) / medium / low (cleanup); reflects *impact*, **not** confidence |',
    '| `low` / `medium` / `high` | Model **confidence** in the estimate (independent of priority) |',
    '| 🔴 Act before merge / 🟢 Acceptable | Risk quadrant — severity × likelihood |',
  ].join('\n');

  // Architecture-flow two-chart key. The flow diagram is rendered as TWO
  // separate mermaid charts — 🔴 BEFORE (the call graph as it existed
  // pre-PR) and 🟢 AFTER (the call graph at HEAD) — with nodes colour-coded
  // by each file's diff status. This table is the key for those colours so
  // a reviewer doesn't have to decode raw hex fills.
  const archFlow = [
    '**Architecture flow — two charts.** The flow diagram shows **🔴 BEFORE** (the code as it *was* before this PR) and **🟢 AFTER** (the code *now*) as two separate graphs. Node colours encode each file\'s diff status:',
    '',
    '| Colour | Status | Where |',
    '|:--:|---|---|',
    '| 🟩 green | **added** (new file) — also copies | AFTER only |',
    '| 🟧 amber | **modified / renamed** | AFTER (BEFORE shows renamed files under their *old* name) |',
    '| 🗑 red | **removed** (deleted file) | BEFORE only — a placeholder card |',
    '| ⚪ grey | unchanged callee, or any node in the BEFORE-state graph | BEFORE / AFTER |',
  ].join('\n');

  const methodology =
    `**Methodology.** Each axis's Δ% is computed against the merge base (formulas in the value card). ` +
    `Thresholds: complexity > ${cx}, long function > ${loc} LOC. A suggestion is surfaced only at confidence ≥ 75% ` +
    `with a supporting reference. Findings are **advisory** and never fail the check. Counts and reach come from a ` +
    `static call-graph; nodes the profiler can't name appear as \`‹anonymous@N›\`.`;

  return ['<details>', '<summary>🔖 Legend &amp; methodology</summary>', '', table, '', archFlow, '', methodology, '', '</details>'].join('\n');
}
