// Build the prompt for ONE scanner finding (one focal point) — the unit
// of the per-suggestion inference loop. Each model call sees exactly one
// finding plus the numbered diff of its file.
//
// The diff is BUDGETED to the GitHub Models input cap (8000 tokens on the
// Free/low tier). A single file's full diff can blow that cap on its own —
// a newly-added or heavily-changed file is the whole file as `+` lines —
// which 413'd ("Request body too large … Max size: 8000 tokens") and made
// every suggestion come back empty. We now count tokens before the POST
// and shrink the diff to the hunk around the focal line until it fits.
//
// Technique mirrors qodo PR-Agent: present the new hunk with each line
// prefixed by its NEW-FILE number and anchor only to `+` lines. Output
// maps 1:1 to a GitHub committable ```suggestion``` (after_code = the
// full replacement for the anchored range) — the CodeRabbit / GitHub-
// native model, NOT Aider's local SEARCH/REPLACE.

import type { ScanPrOutput } from '../report.ts';
import {
  pickFocalSuggestions,
  renderFocalPoint,
  getPrDiff,
  annotateFocusedDiff,
} from './build-context.ts';
import { countTokens, inputCeiling } from './budget.ts';

export const FOCAL_SYSTEM_PROMPT = [
  'You are an expert senior code reviewer. Turn ONE scanner-flagged finding into',
  'at most ONE high-value PR code suggestion.',
  '',
  'The user message gives you the focal point (file:line, function, category, why',
  'it matters, scanner references, a code window) and the PR diff for that file —',
  'each line prefixed with its new-file line number; `+` lines are new code.',
  '',
  'Reply with ONE JSON object, no prose or fences: {"suggestions": [ /* 0 or 1 */ ]}',
  'Each item:',
  '  file           — the focal file, verbatim',
  '  line           — a `+` line number from the diff (end of the range)',
  '  start_line     — optional first line of a multi-line range (<= line)',
  '  category       — "A" optimization | "B" product correctness | "C" framework misuse',
  '  confidence     — 0..1',
  '  summary        — one imperative sentence on WHAT the change does (no code, < 25 words)',
  '  why_it_matters — the WHY',
  '  references     — [{ "url", "title" }] (you may reuse the scanner references)',
  '  after_code     — the complete replacement for lines start_line..line: code',
  '                   only, no +/- prefixes, no fence, keep the original indentation',
  '',
  'Rules: anchor only to a `+` line shown in the diff; replace whole lines, never',
  'fragments; require confidence >= 0.75 and a real reference. If nothing clears',
  'the bar, return {"suggestions": []} — silence beats noise.',
].join('\n');

export type FocalPromptCtx = {
  workspaceRoot: string;
  baseSha: string;
  headSha: string;
};

/**
 * Build the user prompt for the idx-th focal point (0-based, ordered by
 * descending scanner confidence — same ordering pickFocalSuggestions
 * uses). Returns null when there is no focal point at that index, so the
 * caller can skip/stop.
 */
export function buildFocalUserPrompt(
  report: ScanPrOutput | null,
  idx: number,
  ctx: FocalPromptCtx,
  commentable?: Map<string, Set<number>>,
): string | null {
  const focal = pickFocalSuggestions(report, idx + 1, commentable)[idx];
  if (!focal) return null;

  const head = [
    '=== Focal point (1 scanner-flagged location) ===',
    renderFocalPoint(focal, 1, ctx.workspaceRoot),
  ].join('\n');

  const diff = getPrDiff(
    ctx.workspaceRoot,
    ctx.baseSha,
    ctx.headSha,
    1, // just this file
    new Set([focal.file]),
  );
  if (!diff.text) {
    return `${head}\n\n=== PR diff for ${focal.file} ===\n(no diff available)`;
  }

  const diffHeader =
    `=== PR diff for ${focal.file} ` +
    '(each line prefixed with its new-file line number) ===';

  // Keep the WHOLE request (system + this user prompt) under the GitHub
  // Models input cap. The per-file diff alone can exceed it — that is what
  // 413'd the old build, which sent every hunk of the focal file. Try the
  // full file diff first (best context); when it's over budget, fall back
  // to the hunk around the focal line and shrink the window until it fits.
  // The first window that fits wins; if even the tightest is over (huge
  // head or pathological long lines) we send it anyway — a fail-soft
  // over-attempt beats silently dropping the finding.
  const userBudget = Math.max(600, inputCeiling() - countTokens(FOCAL_SYSTEM_PROMPT));
  let body = '';
  for (const radius of [Infinity, 80, 48, 28, 16, 8]) {
    body = annotateFocusedDiff(diff.text, focal.line, radius);
    const user = `${head}\n\n${diffHeader}\n${body}`;
    if (countTokens(user) <= userBudget) return user;
  }
  return `${head}\n\n${diffHeader}\n${body}`;
}

/** How many focal points the report offers — the loop's upper bound. */
export function focalCount(report: ScanPrOutput | null): number {
  return pickFocalSuggestions(report, Number.MAX_SAFE_INTEGER).length;
}
