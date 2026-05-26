// Suggestions & warnings — the quality-passing code_suggestions, rendered
// in the STICKY comment (not just as inline review comments).
//
// Why here too: inline review comments are posted via one atomic
// pulls.createReview call, which GitHub rejects WHOLESALE ("Path could
// not be resolved") if any single suggestion anchors to a line outside
// the PR diff. When that happens the inline suggestions vanish. Rendering
// them here — an issue comment with no line anchoring — guarantees the PR
// author always sees them.
//
// Category B (product correctness) renders inside a ⚠️ WARNING callout:
// these are the findings that used to FAIL the check. Drift is advisory
// (fail-on=never by default), so they surface as warnings, not failures.

import type { CodeSuggestion } from '../../report.ts';
import { passesQualityBar } from '../../report.ts';
import { extractAfterCode } from '../suggestion.ts';

const CATEGORY: Record<'A' | 'B' | 'C', { badge: string; label: string }> = {
  A: { badge: '🅐', label: 'Optimization' },
  B: { badge: '🅑', label: 'Product correctness' },
  C: { badge: '🅒', label: 'Framework misuse' },
};

// Product-correctness first — those are the ones that used to fail the build.
const CATEGORY_ORDER: Record<'A' | 'B' | 'C', number> = { B: 0, C: 1, A: 2 };

const MAX_SHOWN = 20;

export function renderSuggestions(suggestions: CodeSuggestion[] | undefined): string | null {
  const passing = (suggestions ?? []).filter(passesQualityBar);
  if (passing.length === 0) return null;

  const sorted = [...passing].sort(
    (a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || b.confidence - a.confidence,
  );

  const correctness = sorted.filter((s) => s.category === 'B').length;

  const lines: string[] = ['## ⚠️ Suggestions & warnings', ''];

  if (correctness > 0) {
    lines.push(
      '> [!WARNING]',
      `> Drift flagged **${correctness}** product-correctness issue${correctness === 1 ? '' : 's'} ` +
        'in this PR. They are surfaced as warnings below — they do **not** fail the check.',
      '',
    );
  }

  lines.push(
    `**${sorted.length}** suggestion${sorted.length === 1 ? '' : 's'} cleared the quality bar ` +
      '(confidence ≥ 75%, has a reference).',
    '',
  );

  for (const s of sorted.slice(0, MAX_SHOWN)) lines.push(renderOne(s));
  if (sorted.length > MAX_SHOWN) {
    lines.push('', `_…+${sorted.length - MAX_SHOWN} more suggestion(s) not shown._`);
  }

  return lines.join('\n');
}

function renderOne(s: CodeSuggestion): string {
  const cat = CATEGORY[s.category];
  const loc = typeof s.line === 'number' ? `${s.file}:${s.line}` : s.file;
  const pct = Math.round(s.confidence * 100);

  const out: string[] = [
    `<details><summary>${cat.badge} <strong>${cat.label}</strong> · <code>${loc}</code> · ${pct}% confidence</summary>`,
    '',
    s.why_it_matters,
  ];

  const ref = s.references?.[0];
  if (ref?.url) {
    out.push('', `Reference: [${ref.title ?? ref.url}](${ref.url})`);
  }

  const after = extractAfterCode(s);
  if (after) {
    out.push('', 'Suggested change:', '', '```', after, '```');
  }

  out.push('', '</details>');
  return out.join('\n');
}
