// Fix-with-AI handoff prompts — Drift's answer to Qodo 2.0's "remediation
// prompt" and CodeRabbit's "Prompt for AI Agents", but assembled deterministically
// from the static-analysis fields the scanner already emits (no LLM call, no
// external service). Each prompt is a self-contained task a developer pastes
// straight into Claude Code / Cursor / Copilot:
//
//   FILE + LINES (re-stated in the text — never assume the agent sees the PR)
//   PROBLEM      (why_it_matters)
//   DO THIS      (remediation_hint → llm_prompt_hint → category_label)
//   CURRENT CODE (the before-lines, when present)
//   CONSTRAINTS  (category-keyed, conservative defaults)
//   ACCEPTANCE   (how to know it's fixed)
//   + a confidence-keyed STOP guardrail for sub-0.85 findings, which directly
//     counters the documented agent failure mode of mutating correct code just
//     to make a checker go green.
//
// The whole prompt is wrapped in a ```text fence by the caller, so GitHub shows
// a one-click copy button and any backticks/pipes in paths stay inert.

import type { CodeSuggestion, DiffLine } from '../../report.ts';
import type { PrContext } from '../context.ts';
import { permalinkUrl } from '../context.ts';
import { confidencePercent } from './format.ts';

// Below this confidence we append an explicit "if this is actually correct,
// STOP" guardrail — the finding is a strong hint, not a certainty.
const CONFIDENCE_GUARDRAIL = 0.85;
const MAX_CODE_LINES = 30;

// Conservative, category-keyed defaults. A = optimization (e.g. dead code),
// B = product correctness, C = framework misuse.
const CATEGORY_CONSTRAINTS: Record<'A' | 'B' | 'C', string[]> = {
  A: [
    'If the symbol is genuinely unused, delete it and any now-dead imports; otherwise wire it to a real caller.',
    'Touch only this file and its direct imports — do not refactor unrelated code.',
  ],
  B: [
    'Preserve the public signature and the observable behaviour for valid inputs.',
    'Do not add new dependencies, and do not modify existing tests.',
  ],
  C: [
    "Use the framework's idiomatic API; keep the public signature unchanged.",
    'Do not add new dependencies, and do not modify existing tests.',
  ],
};

const CATEGORY_ACCEPTANCE: Record<'A' | 'B' | 'C', string> = {
  A: 'The symbol is removed (or reached by a real entry point) and the project still builds.',
  B: 'Valid inputs behave exactly as before, and the flagged failure mode can no longer occur.',
  C: 'The framework API is used correctly and existing behaviour is preserved.',
};

/** A single, self-contained fix prompt for one finding (no surrounding fence). */
export function buildAgentPrompt(s: CodeSuggestion, ctx?: PrContext): string {
  const loc = locLabel(s);
  const lines: string[] = [
    'You are fixing ONE finding from a static-analysis PR review. Work only in the file below.',
    '',
    `FILE: ${loc}`,
  ];

  const permalink = filePermalink(s, ctx);
  if (permalink) lines.push(permalink);

  lines.push('', 'PROBLEM:', s.why_it_matters.trim());

  const doThis = s.remediation_hint?.trim() || s.llm_prompt_hint?.trim() || s.category_label?.trim();
  if (doThis) lines.push('', 'DO THIS:', doThis);

  const code = currentCode(s.diff?.before_lines);
  if (code) lines.push('', 'CURRENT CODE:', code);

  lines.push('', 'CONSTRAINTS:', ...CATEGORY_CONSTRAINTS[s.category].map((c) => `- ${c}`), '- Keep the diff minimal; do not reformat untouched code.');

  lines.push('', 'ACCEPTANCE:', `- ${CATEGORY_ACCEPTANCE[s.category]}`, '- Re-run the build/linter; this finding should no longer trigger.');

  if (s.confidence < CONFIDENCE_GUARDRAIL) {
    lines.push(
      '',
      `NOTE: Drift is ~${confidencePercent(s.confidence)} confident in this finding. If the code is actually correct, STOP and explain why instead of changing it.`,
    );
  }

  return lines.join('\n');
}

/**
 * One batched "Fix-All" tasklist that dispatches every shown finding in one
 * copy — CodeRabbit's "Fix all issues" equivalent. A concise numbered list
 * (file:line + the one-line ask), not the full per-finding blocks, so it stays
 * paste-able. Returns null with fewer than two findings (a batch of one is just
 * the per-finding prompt).
 */
export function buildFixAllPrompt(sorted: CodeSuggestion[], ctx?: PrContext): string | null {
  if (sorted.length < 2) return null;

  const items = sorted.map((s, i) => {
    const tag = labelTag(s);
    const ask = (s.remediation_hint?.trim() || s.llm_prompt_hint?.trim() || s.why_it_matters.trim()).replace(/\s+/g, ' ');
    const lowConf = s.confidence < CONFIDENCE_GUARDRAIL ? ` (~${confidencePercent(s.confidence)} confident — verify before changing)` : '';
    return `${i + 1}. [${tag}] ${locLabel(s)} — ${truncate(ask, 200)}${lowConf}`;
  });

  return [
    `You are resolving the ${sorted.length} findings from a Drift PR review. Fix them in the order listed, one minimal commit each, then run the build and the test suite.`,
    '',
    ...items,
    '',
    'GLOBAL CONSTRAINTS:',
    '- Minimal diffs; do not reformat untouched code. No new dependencies. Do not modify existing tests unless a test encodes the bug.',
    '- After each fix, re-run the build/linter and the tests before moving on.',
    '- If you believe any finding is a false positive, STOP and report it rather than changing code you think is correct.',
  ].join('\n');
}

// ── helpers ──────────────────────────────────────────────────────────────────

function locLabel(s: CodeSuggestion): string {
  const range = lineRange(s.diff?.before_lines ?? s.diff?.after_lines);
  if (range && range[0] !== range[1]) return `${s.file} (lines ${range[0]}–${range[1]})`;
  if (typeof s.line === 'number') return `${s.file}:${s.line}`;
  if (range) return `${s.file}:${range[0]}`;
  return s.file;
}

function filePermalink(s: CodeSuggestion, ctx?: PrContext): string | null {
  const range = lineRange(s.diff?.before_lines ?? s.diff?.after_lines);
  const start = range ? range[0] : s.line;
  const end = range ? range[1] : s.line;
  if (typeof start !== 'number') return null;
  return permalinkUrl(ctx, s.file, start, typeof end === 'number' ? end : start);
}

function currentCode(before?: DiffLine[]): string | null {
  if (!before?.length) return null;
  const code = before
    .map((l) => l.code)
    .slice(0, MAX_CODE_LINES)
    .join('\n')
    .trimEnd();
  return code || null;
}

function labelTag(s: CodeSuggestion): string {
  const label = s.category_label?.split('—').pop()?.trim();
  if (label) return label;
  return s.category === 'B' ? 'Product correctness' : s.category === 'C' ? 'Framework misuse' : 'Optimization';
}

function lineRange(lines?: DiffLine[]): [number, number] | null {
  const nums = (lines ?? []).map((l) => l.line_number).filter((n): n is number => typeof n === 'number');
  if (nums.length === 0) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
