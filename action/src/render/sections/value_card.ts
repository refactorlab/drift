// 📊 Value card — the HTML-table dashboard (the heart of the comment).
//
//   row 1: composite verdict (mean of the axes) + magnitude bar + one-liner
//   row 2: per-axis headers (💰 / 👥 / ⚙️ / 🎨)
//   row 3: per-axis Δ% + direction word
//   row 4: per-axis ⅛-block magnitude bar (relative to the largest |Δ|)
//   row 5: per-axis model confidence
// then: since-last-review delta · bottom line · highlights ·
//       "how each axis was computed" (nested <details>) · bar-chart view.
//
// Built from a raw <table> (not a markdown table) so the multi-row dashboard
// layout survives — GitHub renders the HTML, and we keep markdown OUT of the
// cells (bars go in <code>, not backticks).

import type { PrCounts, ValueCard, ValueAxis } from '../../report.ts';
import type { DriftState } from '../state.ts';
import { sinceLastReview } from '../state.ts';
import { magnitudeBar } from '../lib/bars.ts';
import { compositeStatus, maxAbsDelta, directionEmoji, directionWord } from '../lib/severity.ts';
import { signedPercent, magnitudePercent, escapeHtml, fencedBlock } from '../lib/format.ts';

export type ValueCardInput = {
  counts?: PrCounts;
  card?: ValueCard;
  /** overall_drift.percent — the composite. Falls back to the axis mean. */
  overallPercent?: number;
  /** This run's snapshot + the prior run's, for the since-last-review line. */
  currentState: DriftState;
  priorState?: DriftState | null;
};

const AXIS_SHORT: Record<ValueAxis['name'], string> = {
  money: 'money',
  customer: 'customer',
  runtime: 'runtime',
  runtime_ux: 'runtime UX',
};

export function renderValueCard(input: ValueCardInput): string | null {
  const { counts, card } = input;
  const axes = card?.axes ?? [];
  if (axes.length === 0 && !counts) return null;

  const lines: string[] = ['## 📊 Value card', ''];

  if (axes.length > 0) {
    lines.push(dashboardTable(axes, input.overallPercent), '');
    lines.push(barsCaption(axes), '');
    lines.push(sinceLastReviewLine(input.priorState ?? null, input.currentState), '');
  }

  if (card?.bottom_line) {
    const text = card.bottom_line.replace(/^\s*Bottom\s+line\s*[—-]\s*/i, '');
    lines.push(`> **Bottom line —** ${text}`, '');
  }

  const highlights = highlightsLine(counts);
  if (highlights) lines.push(highlights, '');

  if (axes.length > 0) {
    lines.push(howComputed(axes));
  }

  if (card?.bars_mermaid) {
    lines.push(
      '',
      '<details>',
      '<summary>📈 Bar-chart view</summary>',
      '',
      '```mermaid',
      card.bars_mermaid,
      '```',
      '',
      '</details>',
    );
  }

  return lines.join('\n').trimEnd();
}

// ── the dashboard <table> ────────────────────────────────────────────────────

function dashboardTable(axes: ValueAxis[], overallPercent?: number): string {
  const max = maxAbsDelta(axes);
  const composite = compositeStatus(axes);
  const compositePct = typeof overallPercent === 'number' ? overallPercent : mean(axes.map((a) => a.delta_percent));
  const width = Math.round(100 / axes.length);

  const headerCells = axes.map((a) => `<th align="center" width="${width}%" scope="col">${escapeHtml(a.label)}</th>`);
  const valueCells = axes.map(
    (a) => `<td align="center"><strong>${directionEmoji(a.direction)} ${signedPercent(a.delta_percent)}</strong><br><sub>${directionWord(a.direction)}</sub></td>`,
  );
  const barCells = axes.map((a) => `<td align="center"><code>${magnitudeBar(a.delta_percent, max)}</code></td>`);
  const confCells = axes.map((a) => `<td align="center"><sub>confidence&nbsp;·&nbsp;<code>${a.confidence}</code></sub></td>`);

  return [
    '<table>',
    '<caption>PR value drift — composite &amp; per-axis (Δ% vs. base)</caption>',
    '<tr>',
    `<td colspan="${axes.length}" align="center"><strong>Composite&nbsp; ${composite.emoji} ${signedPercent(compositePct)}</strong> &nbsp;<code>${magnitudeBar(compositePct, max)}</code>&nbsp; <sub>${compositeNote(axes, composite.mixed, composite.label)}</sub></td>`,
    '</tr>',
    `<tr>${headerCells.join('')}</tr>`,
    `<tr>${valueCells.join('')}</tr>`,
    `<tr>${barCells.join('')}</tr>`,
    `<tr>${confCells.join('')}</tr>`,
    '</table>',
  ].join('\n');
}

function compositeNote(axes: ValueAxis[], mixed: boolean, label: string): string {
  const base = `mean of the ${axes.length === 1 ? 'axis' : `${axes.length} axes`}`;
  if (mixed) {
    const up = axes.filter((a) => a.direction === 'up').reduce(pickMaxAbs, undefined as ValueAxis | undefined);
    const down = axes.filter((a) => a.direction === 'down').reduce(pickMaxAbs, undefined as ValueAxis | undefined);
    if (up && down) {
      return `${base} — <strong>mixed</strong>: a ${signedPercent(up.delta_percent)} ${AXIS_SHORT[up.name]} gain masks a ${signedPercent(down.delta_percent)} ${AXIS_SHORT[down.name]} regression`;
    }
    return `${base} — <strong>mixed</strong>`;
  }
  return `${base} — <strong>${label}</strong>`;
}

// ── captions / lines below the table ─────────────────────────────────────────

function barsCaption(axes: ValueAxis[]): string {
  const top = axes.reduce(pickMaxAbs, undefined as ValueAxis | undefined);
  const ref = top ? ` (${AXIS_SHORT[top.name]}, ${magnitudePercent(top.delta_percent)})` : '';
  return `<sub>Bars show |Δ| relative to the largest axis${ref}, ⅛-block precision. 🔴 regression · 🟢 improvement · ⚪ flat.</sub>`;
}

function sinceLastReviewLine(prior: DriftState | null, current: DriftState): string {
  const deltas = sinceLastReview(prior, current);
  if (deltas) {
    return `> 🔁 **Since last review** &nbsp; ${deltas} <sub>(percentage points vs. the previous push)</sub>`;
  }
  return '> 🔁 **Since last review** &nbsp; _First run on this PR — no prior snapshot to diff. Each later push re-renders this sticky comment and fills this line with per-axis deltas (e.g. 💰 ▲ +2.1pp · ⚙️ ▼ −1.0pp)._';
}

function highlightsLine(counts?: PrCounts): string | null {
  if (!counts) return null;
  const f = counts.features?.value ?? 0;
  const b = counts.bug_fixes?.value ?? 0;
  const i = counts.issues_resolved?.value ?? 0;
  const t = counts.new_test_files?.value ?? 0;
  return `**Highlights:** ✨ **${f}** new features &nbsp;·&nbsp; 🐛 **${b}** bug fixes &nbsp;·&nbsp; 📋 **${i}** issues resolved &nbsp;·&nbsp; 🧪 **${t}** new test files`;
}

// ── "how each axis was computed" (nested <details>) ──────────────────────────

function howComputed(axes: ValueAxis[]): string {
  const inner = axes.map(renderAxisDetail).join('\n\n');
  return [
    '<details>',
    '<summary>📐 How each axis was computed — expand an axis</summary>',
    '',
    inner,
    '',
    '</details>',
  ].join('\n');
}

function renderAxisDetail(a: ValueAxis): string {
  const parts: string[] = [
    '<details>',
    `<summary>${escapeHtml(a.label)} · <code>${signedPercent(a.delta_percent)}</code> · confidence <code>${a.confidence}</code></summary>`,
    '',
  ];
  if (a.subtitle) parts.push(`*${a.subtitle}*`, '');
  if (a.formula) parts.push(fencedBlock(a.formula), '');

  if (a.kv && a.kv.length) {
    parts.push(a.kv.map((kv) => `- ${kv.label}: **${kv.value}**`).join('\n'), '');
  }

  if (a.source) {
    const linked = a.source_link ? `[${a.source}](${a.source_link})` : a.source;
    parts.push(`**Source:** ${linked}`, '');
  }

  if (a.inputs && Object.keys(a.inputs).length) {
    const inputStr = Object.entries(a.inputs)
      .map(([k, v]) => `\`${k}=${formatInput(v)}\``)
      .join(' · ');
    parts.push(`**Key inputs:** ${inputStr}`, '');
  }

  if (a.additional_sources && a.additional_sources.length) {
    const refs = a.additional_sources.map((r) => `[${r.title ?? r.url}](${r.url})`).join(' · ');
    parts.push(`**More:** ${refs}`, '');
  }

  parts.push('</details>');
  return parts.join('\n');
}

// ── small helpers ────────────────────────────────────────────────────────────

function pickMaxAbs(best: ValueAxis | undefined, a: ValueAxis): ValueAxis {
  return !best || Math.abs(a.delta_percent) > Math.abs(best.delta_percent) ? a : best;
}

function mean(ns: number[]): number {
  return ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0;
}

function formatInput(v: number | string | boolean): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}
