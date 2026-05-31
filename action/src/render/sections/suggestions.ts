// ⚠️ Code suggestions — the quality-passing code findings, as a priority table plus
// one expandable detail block each.
//
// Mirrored HERE (a plain issue-comment section) as well as inline review
// comments because GitHub rejects the WHOLE atomic createReview if any single
// suggestion anchors off-diff — so the author would otherwise see nothing.
//
// PRIORITY ≠ CONFIDENCE: a 100%-confident dead-code removal is still low-impact
// cleanup; a 75% product-correctness finding matters more. The table is ordered
// by impact (priority), then confidence.

import type { CodeSuggestion, DiffLine } from '../../report.ts';
import { passesQualityBar } from '../../report.ts';
import type { PrContext } from '../context.ts';
import { fileLink, snippetPermalink } from '../context.ts';
import { confidencePercent, plural, fencedBlock, escapeHtml } from '../lib/format.ts';
import { buildAgentPrompt, buildFixAllPrompt } from '../lib/agent_prompt.ts';

const CATEGORY: Record<'A' | 'B' | 'C', { badge: string; name: string }> = {
  A: { badge: '🅐', name: 'Optimization' },
  B: { badge: '🅑', name: 'Product correctness' },
  C: { badge: '🅒', name: 'Framework misuse' },
};

const MAX_SHOWN = 20;

type Priority = { emoji: string; label: 'High' | 'Medium' | 'Low'; rank: number };

export function renderSuggestions(suggestions: CodeSuggestion[] | undefined, ctx?: PrContext): string | null {
  const passing = (suggestions ?? []).filter(passesQualityBar);
  if (passing.length === 0) return null;

  const sorted = [...passing].sort((a, b) => priority(a).rank - priority(b).rank || b.confidence - a.confidence);
  const correctness = sorted.filter((s) => s.category === 'B').length;

  const lines: string[] = [`## ⚠️ Code suggestions (${sorted.length})`, ''];

  if (correctness > 0) {
    lines.push(
      '> [!CAUTION]',
      `> **${correctness} product-correctness ${plural(correctness, 'issue')}** ${correctness === 1 ? 'was' : 'were'} flagged. ` +
        `${correctness === 1 ? "It's" : "They're"} surfaced as ${plural(correctness, 'a warning', 'warnings')} and ` +
        `${correctness === 1 ? 'does' : 'do'} **not** fail the check — but ${correctness === 1 ? 'it' : 'they'} should be resolved before merge.`,
      '',
    );
  }

  lines.push(
    '<sub>**Priority reflects impact, not certainty** — a 100%-confident dead-code removal is still low-priority cleanup; ' +
      'a product-correctness finding matters more.</sub>',
    '',
  );

  // priority table
  lines.push('| Priority | Finding | Location | Confidence |', '|:--:|---|---|---:|');
  for (const s of sorted) {
    const p = priority(s);
    lines.push(`| ${p.emoji} ${p.label} | ${cell(findingLabel(s))} | ${fileLink(ctx, s.file, s.line)} | ${confidencePercent(s.confidence)} |`);
  }
  lines.push('');

  // detail blocks
  const shown = sorted.slice(0, MAX_SHOWN);
  for (const s of shown) lines.push(renderDetail(s, ctx), '');
  if (sorted.length > MAX_SHOWN) {
    lines.push(`_…+${sorted.length - MAX_SHOWN} more ${plural(sorted.length - MAX_SHOWN, 'suggestion')} not shown._`, '');
  }

  // 🤖 One batched "Fix-All" handoff — dispatch every shown finding in a single
  // copy-paste to an AI agent. Omitted for a lone finding (use its own prompt).
  const fixAll = buildFixAllPrompt(shown, ctx);
  if (fixAll) {
    lines.push(
      '<details>',
      `<summary>🤖 <strong>Fix-All handoff</strong> — one prompt that dispatches all ${shown.length} findings</summary>`,
      '',
      fencedBlock(fixAll, 'text'),
      '',
      '</details>',
    );
  }

  return lines.join('\n').trimEnd();
}

// ── priority + labels ────────────────────────────────────────────────────────

function priority(s: CodeSuggestion): Priority {
  const sev = (s.severity ?? '').toLowerCase();
  if (sev === 'critical' || sev === 'high') return { emoji: '🔴', label: 'High', rank: 0 };
  if (s.category === 'B' || s.category === 'C') return { emoji: '🟡', label: 'Medium', rank: 1 };
  return { emoji: '⚪', label: 'Low', rank: 2 };
}

/** Table "Finding" cell: category badge + the concise label after the em-dash. */
function findingLabel(s: CodeSuggestion): string {
  const cat = CATEGORY[s.category];
  const suffix = labelSuffix(s.category_label);
  return suffix ? `${cat.badge} ${suffix}` : `${cat.badge} ${cat.name}`;
}

function labelSuffix(label?: string): string | null {
  if (!label) return null;
  const idx = label.indexOf('—');
  const suffix = (idx >= 0 ? label.slice(idx + 1) : '').trim();
  return suffix || null;
}

// ── one detail block ─────────────────────────────────────────────────────────

function renderDetail(s: CodeSuggestion, ctx?: PrContext): string {
  const cat = CATEGORY[s.category];
  const suffix = labelSuffix(s.category_label);
  const title = suffix && suffix.toLowerCase() !== cat.name.toLowerCase() ? `${cat.name} · ${suffix.toLowerCase()}` : cat.name;
  const loc = typeof s.line === 'number' ? `${s.file}:${s.line}` : s.file;
  const pct = confidencePercent(s.confidence);

  const out: string[] = [
    '<details>',
    // `title` (from category_label) and `loc` (file:line) are PR-controlled —
    // file paths can legally contain `<`/`>` on Linux/macOS, so a path like
    // `src/</summary><details>evil.ts` would otherwise close the <summary>
    // early and inject a phantom <details>, breaking the disclosure and
    // unbalancing the comment's tags. Escape both before embedding in the
    // structural <summary>/<code>. (`cat.badge` and `pct` are static/computed.)
    `<summary>${cat.badge} <strong>${escapeHtml(title)}</strong> · <code>${escapeHtml(loc)}</code> · ${pct}</summary>`,
    '',
    s.why_it_matters,
    '',
  ];

  out.push(...codeContext(s, ctx));

  if (s.remediation_hint && !s.diff?.after_lines?.length) {
    out.push(`**Fix:** ${s.remediation_hint}`, '');
  }

  const ref = s.references?.[0];
  if (ref?.url) out.push(`**Reference:** [${ref.title ?? ref.url}](${ref.url})`, '');

  // 🤖 One-click handoff: a copy-paste prompt for the reviewer's AI agent.
  // Nested <details> needs surrounding blank lines so GitHub parses it.
  if (s.file) {
    out.push(
      '<details>',
      '<summary>🤖 Copy this prompt for your AI agent <sub>(Claude Code · Cursor · Copilot)</sub></summary>',
      '',
      fencedBlock(buildAgentPrompt(s, ctx), 'text'),
      '',
      '</details>',
      '',
    );
  }

  out.push('</details>');
  return out.join('\n');
}

/**
 * Render the code view. When the scanner supplies an `after`, show a red/green
 * `diff`. When it supplies only the current `before` lines, prefer a bare
 * commit-pinned permalink (GitHub auto-expands it into an inline snippet); fall
 * back to a fenced code block when there's no PR context to pin to.
 */
function codeContext(s: CodeSuggestion, ctx?: PrContext): string[] {
  const before = s.diff?.before_lines ?? [];
  const after = s.diff?.after_lines ?? [];

  if (after.length > 0) {
    const body = [
      ...before.filter((l) => l.kind !== 'add').map(prefix),
      ...after.map((l) => `+ ${l.code}`),
    ].join('\n');
    return ['**Suggested fix:**', '', fencedBlock(body, 'diff'), ''];
  }

  if (before.length > 0) {
    const range = lineRange(before);
    const url = range ? snippetPermalink(ctx, s.file, range[0], range[1]) : null;
    if (url) {
      return [
        '**Current code** — a bare commit-pinned permalink auto-expands into an inline, syntax-highlighted snippet in the PR (shown as a link until then):',
        '',
        url,
        '',
      ];
    }
    return ['**Current code:**', '', fencedBlock(before.map((l) => l.code).join('\n'), s.language ?? ''), ''];
  }

  return [];
}

function prefix(l: DiffLine): string {
  if (l.kind === 'del') return `- ${l.code}`;
  return `  ${l.code}`; // context line
}

function lineRange(lines: DiffLine[]): [number, number] | null {
  const nums = lines.map((l) => l.line_number).filter((n): n is number => typeof n === 'number');
  if (nums.length === 0) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

// Escape a `|` so a finding label can't break the markdown table.
function cell(s: string): string {
  return s.replace(/\|/g, '\\|');
}
