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

  const methodology =
    `**Methodology.** Each axis's Δ% is computed against the merge base (formulas in the value card). ` +
    `Thresholds: complexity > ${cx}, long function > ${loc} LOC. A suggestion is surfaced only at confidence ≥ 75% ` +
    `with a supporting reference. Findings are **advisory** and never fail the check. Counts and reach come from a ` +
    `static call-graph; nodes the profiler can't name appear as \`‹lambda@N›\`.`;

  return ['<details>', '<summary>🔖 Legend &amp; methodology</summary>', '', table, '', methodology, '', '</details>'].join('\n');
}
