// Build the prompt for ONE scanner finding (one focal point) — the unit
// of the per-suggestion inference loop. Each model call sees exactly one
// finding plus the numbered diff of its file, so the request stays tiny
// and well under the GitHub Models input cap regardless of PR size.
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
  annotateDiff,
} from './build-context.ts';

export const FOCAL_SYSTEM_PROMPT = [
  'You are an expert senior reviewer. Refine ONE scanner-flagged finding',
  'into a SINGLE committable GitHub PR code suggestion.',
  '',
  'The user message contains:',
  '  1. The focal point — file:line, function, category, why_it_matters,',
  '     the scanner references, and a code window read from HEAD.',
  '  2. The PR diff for that one file. EACH line is prefixed with its',
  '     NEW-FILE line number; `+` lines are new code. You may ONLY anchor',
  '     a suggestion to a `+` line — GitHub rejects comments on any other',
  '     line and drops the whole review.',
  '',
  'Output ONE JSON object — no prose, no code fence:',
  '  { "suggestions": [ /* zero or ONE item */ ] }',
  'Item shape:',
  '  {',
  '    "file":           string,   // the focal file, verbatim',
  '    "line":           int,      // a `+` line number from the diff (end of range)',
  '    "start_line":     int,      // optional; first line of a multi-line range (<= line)',
  '    "category":       "A" | "B" | "C",',
  '    "confidence":     number,   // 0..1',
  '    "why_it_matters": string,',
  '    "references":     [ { "url": string, "title": string } ],',
  '    "after_code":     string    // COMPLETE replacement for lines start_line..line',
  '  }',
  '',
  'Rules:',
  '  - after_code is the WHOLE new content of the anchored line(s), ready to',
  '    commit verbatim — GitHub "Apply suggestion" swaps those exact lines for',
  '    it. No diff prefixes (+/-), no surrounding fence, no line numbers.',
  '  - Replace whole lines, never sub-line fragments.',
  '  - Anchor ONLY to `+` lines actually shown in the diff. Never invent a line.',
  '  - Quality bar: confidence >= 0.75; a REAL reference URL (you MAY reuse the',
  '    scanner references verbatim); category in {A, B, C}.',
  '  - If nothing clears the bar, output {"suggestions": []}. Silence > noise.',
  '',
  'Categories: A = optimization, B = product correctness, C = framework misuse.',
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

  const parts: string[] = [];
  parts.push('=== Focal point (1 scanner-flagged location) ===');
  parts.push(renderFocalPoint(focal, 1, ctx.workspaceRoot));
  parts.push('');

  const diff = getPrDiff(
    ctx.workspaceRoot,
    ctx.baseSha,
    ctx.headSha,
    1, // just this file
    new Set([focal.file]),
  );
  if (diff.text) {
    parts.push(
      `=== PR diff for ${focal.file} ` +
        '(each line prefixed with its new-file line number) ===',
    );
    parts.push(annotateDiff(diff.text));
  } else {
    parts.push(`=== PR diff for ${focal.file} ===`);
    parts.push('(no diff available)');
  }
  return parts.join('\n');
}

/** How many focal points the report offers — the loop's upper bound. */
export function focalCount(report: ScanPrOutput | null): number {
  return pickFocalSuggestions(report, Number.MAX_SAFE_INTEGER).length;
}
