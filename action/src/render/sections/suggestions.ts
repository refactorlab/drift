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

// Default render cap on the suggestions surfaced in the sticky comment. The
// scanner can emit hundreds of findings; rendering them all blows past GitHub's
// 65 536-byte comment cap and the size-guard then collapses every section into
// "_collapsed (size guard)_" stubs. So we render only the top-N (highest
// priority first) and keep the TRUE total visible in the heading + an overflow
// note ("…+M more not shown"). Override per-render via the `max` opt
// (render-comment.ts: `--max-suggestions=N` / `DRIFT_MAX_SUGGESTIONS`).
// RENDER-ONLY: this never mutates the report, so the inline review and the AI
// focal-point picker still read the full `code_suggestions` array.
export const DEFAULT_MAX_SUGGESTIONS = 10;

// Hard ceiling on the expensive per-finding <details> blocks, independent of the
// table cap. With the default cap (10) this never binds; it only matters when
// `max` is overridden above it, keeping detail blocks bounded while the table
// can still list every kept row.
const MAX_SHOWN = 20;

type Priority = { emoji: string; label: 'High' | 'Medium' | 'Low'; rank: number };

/** Resolve the render cap to a positive integer, defaulting to DEFAULT_MAX_SUGGESTIONS. */
function resolveMax(max: number | undefined): number {
  if (max === undefined || !Number.isFinite(max) || max < 1) return DEFAULT_MAX_SUGGESTIONS;
  return Math.floor(max);
}

export function renderSuggestions(
  suggestions: CodeSuggestion[] | undefined,
  ctx?: PrContext,
  opts: { max?: number } = {},
): string | null {
  const passing = (suggestions ?? []).filter(passesQualityBar);
  if (passing.length === 0) return null;

  // Two render paths share this section. AI-refined suggestions (source: 'ai')
  // get their own expanded "code suggestion" blocks — a plain-language
  // narrative + a red/green diff with surrounding context — while deterministic
  // findings stay in the priority table. Partition up front so each renders
  // independently and the AI blocks are never capped out of view.
  const aiSugg = passing.filter((s) => s.source === 'ai');
  const detSugg = passing.filter((s) => s.source !== 'ai');

  const sorted = [...detSugg].sort((a, b) => priority(a).rank - priority(b).rank || b.confidence - a.confidence);
  const detTotal = sorted.length;
  // Headline count spans BOTH paths; the cap below only governs the table rows.
  const total = passing.length;
  // Render cap: how many of the highest-priority deterministic suggestions reach
  // the table. The heading + overflow note keep the TRUE totals visible.
  const kept = sorted.slice(0, resolveMax(opts.max));
  // Counts reflect the WHOLE PR (true totals), not just the rendered slice — the
  // heading and the CAUTION callout would understate the problem otherwise.
  const correctness = passing.filter((s) => s.category === 'B').length;

  const lines: string[] = [`## ⚠️ Code suggestions (${total})`, ''];

  if (correctness > 0) {
    lines.push(
      '> [!CAUTION]',
      `> **${correctness} product-correctness ${plural(correctness, 'issue')}** ${correctness === 1 ? 'was' : 'were'} flagged. ` +
        `${correctness === 1 ? "It's" : "They're"} surfaced as ${plural(correctness, 'a warning', 'warnings')} and ` +
        `${correctness === 1 ? 'does' : 'do'} **not** fail the check — but ${correctness === 1 ? 'it' : 'they'} should be resolved before merge.`,
      '',
    );
  }

  // Deterministic findings → priority table + per-finding detail blocks. Gated
  // on there being any, so an AI-only section skips straight to the AI blocks.
  const shown = kept.slice(0, MAX_SHOWN);
  if (kept.length > 0) {
    lines.push(
      '<sub>**Priority reflects impact, not certainty** — a 100%-confident dead-code removal is still low-priority cleanup; ' +
        'a product-correctness finding matters more.</sub>',
      '',
    );

    // priority table — capped to the top `kept` rows (highest priority first)
    lines.push('| Priority | Finding | Location | Confidence |', '|:--:|---|---|---:|');
    for (const s of kept) {
      const p = priority(s);
      lines.push(`| ${p.emoji} ${p.label} | ${cell(findingLabel(s))} | ${fileLink(ctx, s.file, s.line)} | ${confidencePercent(s.confidence)} |`);
    }
    lines.push('');
    // Overflow note: the deterministic total minus what we rendered. Keeps the
    // reviewer honest about scale even though only the top slice is shown.
    if (detTotal > kept.length) {
      const more = detTotal - kept.length;
      lines.push(`_…+${more} more ${plural(more, 'suggestion')} not shown — rendering the top ${kept.length} by priority._`, '');
    }

    // detail blocks — over the kept slice, bounded by the detail ceiling.
    for (const s of shown) lines.push(renderDetail(s, ctx), '');
  }

  // AI-refined suggestions → expanded "code suggestion" blocks. Always rendered
  // (never capped by the deterministic table cap); their count is bounded
  // upstream by ai-max-suggestions.
  if (aiSugg.length > 0) {
    lines.push(
      `### 🤖 AI-refined code suggestions (${aiSugg.length})`,
      '',
      '<sub>Model-generated patches grounded in the scanner findings — each carries an **Apply** button on its matching inline review comment.</sub>',
      '',
    );
    for (const s of aiSugg) lines.push(renderAIDetail(s, ctx), '');
  }

  // 🤖 One batched "Fix-All" handoff — dispatch every shown finding (deterministic
  // + AI) in a single copy-paste to an AI agent. Omitted for a lone finding.
  const fixAllItems = [...shown, ...aiSugg];
  const fixAll = buildFixAllPrompt(fixAllItems, ctx);
  if (fixAll) {
    lines.push(
      '<details>',
      `<summary>🤖 <strong>Fix-All handoff</strong> — one prompt that dispatches all ${fixAllItems.length} findings</summary>`,
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
 * One AI-refined suggestion as an expanded "code suggestion" disclosure — the
 * CodeRabbit/Sourcery shape, rebuilt from our own data: a plain-language WHAT
 * narrative, the WHY, then a red/green diff with surrounding context (the `-`
 * side reconstructed from the PR patch, the `+` side the model's replacement —
 * see ai/to-code-suggestion.ts). Defaults to OPEN because there are few of them
 * and each is the headline a reviewer wants to see, not hunt for. The trailing
 * agent-prompt handoff mirrors the deterministic block so a reviewer can pass
 * the fix straight to their AI agent.
 */
function renderAIDetail(s: CodeSuggestion, ctx?: PrContext): string {
  const loc = typeof s.line === 'number' ? `${s.file}:${s.line}` : s.file;
  const pct = confidencePercent(s.confidence);
  // `loc` is PR-controlled (file paths may contain `<`/`>` on Linux/macOS) and
  // `model` is env-influenced — escape both before embedding in the <summary>.
  const modelTag = s.model ? ` · <code>${escapeHtml(s.model)}</code>` : '';
  const out: string[] = [
    '<details open>',
    `<summary>🤖 <strong>code suggestion</strong> · <code>${escapeHtml(loc)}</code> · ${pct}${modelTag}</summary>`,
    '',
  ];

  // WHAT (model narrative) then WHY (impact). The narrative is the lead line a
  // reviewer reads; it's omitted cleanly when the model didn't supply one.
  if (s.summary) out.push(`**What** — ${s.summary}`, '');
  out.push(`**Why it matters** — ${s.why_it_matters}`, '');

  // Red/green diff. Prefer the reconstructed unified view (context + `-`/`+`);
  // degrade to an after-only block when reconstruction had no patch to anchor.
  const unified = s.diff?.unified;
  if (unified) {
    out.push('**Suggested change:**', '', fencedBlock(unified, 'diff'), '');
  } else {
    const after = s.diff?.after_lines ?? [];
    if (after.length) {
      out.push('**Suggested change:**', '', fencedBlock(after.map((l) => `+ ${l.code}`).join('\n'), 'diff'), '');
    }
  }

  const ref = s.references?.[0];
  if (ref?.url) out.push(`**Reference:** [${ref.title ?? ref.url}](${ref.url})`, '');

  // 🤖 One-click handoff — same copy-paste agent prompt as the deterministic
  // blocks. Nested <details> needs surrounding blank lines so GitHub parses it.
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
