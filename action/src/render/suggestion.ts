// Inline review-comment body for a single CodeSuggestion. The
// `suggestion` block at the bottom is what gives GitHub the Apply
// button — it MUST be inside a review comment, not an issue comment.

import type { CodeSuggestion } from '../report.ts';
import { suggestionBlock } from '../suggestion-fence.ts';

const CATEGORY_BADGE: Record<'A' | 'B' | 'C', string> = {
  A: '🅐 Optimization',
  B: '🅑 Product correctness',
  C: '🅒 Framework misuse',
};

export function renderSuggestionBody(s: CodeSuggestion): string {
  const confidencePct = Math.round(s.confidence * 100);
  const lines: string[] = [
    `**${CATEGORY_BADGE[s.category]}${s.category_label ? ` — ${s.category_label}` : ''}** · confidence ${confidencePct}%`,
    '',
    s.why_it_matters,
  ];

  if (s.references && s.references.length) {
    const ref = s.references[0];
    lines.push('', `Reference: [${ref.title ?? shortenUrl(ref.url)}](${ref.url})`);
  }

  const after = extractAfterCode(s);
  if (after) {
    // Dynamic fence: scale past any backticks inside the replacement code so
    // GitHub doesn't close the suggestion block early (see suggestion-fence).
    lines.push('', suggestionBlock(after));
  }

  if (s.notes) {
    lines.push('', `> ${s.notes}`);
  }

  return lines.join('\n');
}

/**
 * Extract the "code as it should be" lines from a CodeSuggestion.diff
 * — either from `after_lines` (line objects) or by splitting `unified`.
 * Returns the bare code (no `+ ` prefixes) suitable for a
 * ```suggestion``` block.
 */
export function extractAfterCode(s: CodeSuggestion): string | null {
  if (s.diff?.after_lines && s.diff.after_lines.length) {
    return s.diff.after_lines.map((l) => l.code).join('\n');
  }
  if (s.diff?.unified) {
    return s.diff.unified
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1))
      .join('\n');
  }
  return null;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}
