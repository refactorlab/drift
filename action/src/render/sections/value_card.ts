// Image 3 — Business value report (4-axis card).
//   - counts row (features / bugs / issues / new test files)
//   - axes table (Δ% · direction · confidence)
//   - bars chart (pre-rendered xychart-beta from the scanner)
//   - bottom-line synthesis
//   - collapsible "How these numbers were computed" (per-axis formula + sources + inputs)

import type { PrCounts, ValueCard, ValueAxis } from '../../report.ts';

const DIRECTION_EMOJI: Record<ValueAxis['direction'], string> = {
  up: '🟢 ▲',
  down: '🔴 ▼',
  neutral: '— —',
};

export function renderValueCard(counts?: PrCounts, card?: ValueCard): string | null {
  if (!counts && !card) return null;

  const lines: string[] = ['## 📊 Value card', ''];

  // (a) Counts row
  if (counts) {
    const chips: string[] = [];
    if (counts.features) chips.push(formatChip('✨', counts.features.value, counts.features.label, counts.features.detail));
    if (counts.bug_fixes) chips.push(formatChip('🐛', counts.bug_fixes.value, counts.bug_fixes.label, counts.bug_fixes.detail));
    if (counts.issues_resolved) chips.push(formatChip('📋', counts.issues_resolved.value, counts.issues_resolved.label, counts.issues_resolved.detail));
    if (counts.new_test_files) chips.push(formatChip('🧪', counts.new_test_files.value, counts.new_test_files.label, counts.new_test_files.detail));
    if (chips.length) {
      lines.push(chips.join(' &nbsp;·&nbsp; '), '');
    }
  }

  // (b) Axes table
  if (card?.axes?.length) {
    lines.push('| Axis | Δ% | Direction | Confidence |');
    lines.push('|---|---:|:---:|:---:|');
    for (const a of card.axes) {
      lines.push(
        `| ${a.label} | ${formatPercent(a.delta_percent)} | ${DIRECTION_EMOJI[a.direction]} | ${a.confidence} |`,
      );
    }
    lines.push('');
  }

  // (c) Bars chart (pre-rendered xychart-beta)
  if (card?.bars_mermaid) {
    lines.push('```mermaid', card.bars_mermaid, '```', '');
  }

  // (d) Bottom-line synthesis. Strip a leading "Bottom line —" if the
  // scanner already prefixed one, so we don't render "Bottom line — Bottom line —".
  if (card?.bottom_line) {
    const text = card.bottom_line.replace(/^\s*Bottom\s+line\s*[—-]\s*/i, '');
    lines.push(`> **Bottom line —** ${text}`);
  }

  // (e) Per-axis "How computed" expander
  if (card?.axes?.length) {
    const details = renderAxisDetails(card.axes);
    if (details) {
      lines.push('', details);
    }
  }

  return lines.join('\n');
}

function formatChip(emoji: string, value: number, label: string, detail?: string): string {
  const trail = detail ? ` <sub>(${escapeHtml(detail)})</sub>` : '';
  return `${emoji} **${value}** ${label}${trail}`;
}

function renderAxisDetails(axes: ValueAxis[]): string | null {
  const blocks: string[] = [];

  for (const a of axes) {
    const parts: string[] = [];
    parts.push(`#### ${a.label} — \`${formatPercent(a.delta_percent)}\` · confidence \`${a.confidence}\``);
    if (a.subtitle) parts.push(`*${a.subtitle}*`);

    if (a.kv && a.kv.length) {
      const kvLines = a.kv.map((kv) => `- ${kv.label}: \`${kv.value}\``);
      parts.push(kvLines.join('\n'));
    }

    if (a.formula) parts.push(`**Formula:** ${a.formula}`);

    if (a.source) {
      const linked = a.source_link ? `[${a.source}](${a.source_link})` : a.source;
      parts.push(`**Source:** ${linked}`);
    }

    if (a.inputs && Object.keys(a.inputs).length) {
      const inputStr = Object.entries(a.inputs)
        .map(([k, v]) => `\`${k}=${formatInput(v)}\``)
        .join(' · ');
      parts.push(`**Inputs:** ${inputStr}`);
    }

    if (a.additional_sources && a.additional_sources.length) {
      const refs = a.additional_sources
        .map((r) => `[${r.title ?? r.url}](${r.url})`)
        .join(' · ');
      parts.push(`**More:** ${refs}`);
    }

    blocks.push(parts.join('\n\n'));
  }

  if (blocks.length === 0) return null;
  return [
    `<details><summary>How these numbers were computed (${axes.length} ax${axes.length === 1 ? 'is' : 'es'})</summary>`,
    '',
    blocks.join('\n\n---\n\n'),
    '',
    '</details>',
  ].join('\n');
}

function formatPercent(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${Math.round(n * 10) / 10}%`;
}

function formatInput(v: number | string | boolean): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
