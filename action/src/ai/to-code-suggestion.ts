// Convert a model-emitted AISuggestion into the renderer's CodeSuggestion
// shape, reconstructing a faithful red/green diff from the PR patch.
//
// The model reliably gives us the GREEN side (`after_code` — the full
// replacement for lines start_line..line). The RED side (the current lines
// being replaced) is NOT trusted to the model: we pull it verbatim from the
// PR's unified diff (the same `.patch` GitHub returns from pulls.listFiles),
// keyed by the new-file line numbers the model anchored to. That patch is the
// authoritative RIGHT side GitHub itself shows, and "Apply suggestion" swaps
// exactly those lines for `after_code` — so the rendered diff can never
// misrepresent what's in the PR. A few surrounding context lines are kept on
// each side so the block reads like a real review diff (CodeRabbit-style),
// not a bare replacement.
//
// Fail-soft: a missing/unparseable patch, or a range that isn't materialised
// in any hunk, degrades to an after-only (green) diff rather than throwing —
// one bad reconstruction must never sink the suggestion or the comment.

import { parsePatch } from 'diff';
import type { CodeSuggestion, DiffLine, ScanPrOutput } from '../report.ts';
import type { AISuggestion } from './schema.ts';

const CATEGORY_LABEL: Record<'A' | 'B' | 'C', string> = {
  A: 'Optimization',
  B: 'Product correctness',
  C: 'Framework misuse',
};

// Context lines kept on each side of the change in the rendered diff.
const CONTEXT_RADIUS = 3;

/**
 * Map a file extension to the scanner's language label. Best-effort — only
 * used for syntax hints in the agent prompt / fallback fences, so an unknown
 * extension simply yields `undefined`.
 */
function languageOf(file: string): string | undefined {
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
    cs: 'csharp', php: 'php', swift: 'swift', scala: 'scala', c: 'c', h: 'c',
    cpp: 'cpp', cc: 'cpp', hpp: 'cpp', m: 'objc', sql: 'sql', sh: 'bash',
  };
  return map[ext];
}

type NumberedRow = { newLine: number | null; code: string; kind: 'add' | 'ctx' | 'del' };

/**
 * Walk every hunk of a file patch into rows carrying their NEW-file line
 * number (added `+` and context ` ` lines advance the new side; deletions
 * `-` do not, so they carry `newLine: null`). Mirrors the numbering policy in
 * build-context.ts / diff-lines.ts so a reconstructed `-` line lines up with
 * the exact RIGHT-side line the model anchored to.
 */
function numberPatchRows(patch: string): NumberedRow[] {
  let files: ReturnType<typeof parsePatch>;
  try {
    files = parsePatch(patch);
  } catch {
    return [];
  }
  const rows: NumberedRow[] = [];
  for (const file of files) {
    for (const hunk of file.hunks) {
      let n = hunk.newStart;
      for (const row of hunk.lines) {
        const c = row[0];
        const code = row.slice(1);
        if (c === '+') {
          rows.push({ newLine: n, code, kind: 'add' });
          n += 1;
        } else if (c === ' ') {
          rows.push({ newLine: n, code, kind: 'ctx' });
          n += 1;
        } else if (c === '-') {
          rows.push({ newLine: null, code, kind: 'del' });
        }
        // '\' (no-newline marker) is dropped
      }
    }
  }
  return rows;
}

export type ReconstructedDiff = {
  /** Full unified diff text (context + `-` before + `+` after + context), no fence. */
  unified: string;
  /** The replaced current lines, line-numbered — feeds the agent-prompt CURRENT CODE + permalink. */
  beforeLines: DiffLine[];
  /** The replacement, split into rows — feeds the inline ```suggestion``` / fallback. */
  afterLines: DiffLine[];
};

/**
 * Reconstruct the red/green diff for a suggestion replacing new-file lines
 * `start..end` with `afterCode`, using the file's PR patch for the red side +
 * surrounding context. Returns an after-only diff when the patch can't supply
 * the red side (so the caller always gets *something* renderable).
 */
export function reconstructDiff(
  patch: string | undefined,
  start: number,
  end: number,
  afterCode: string,
): ReconstructedDiff {
  const afterLines: DiffLine[] = afterCode.split('\n').map((code) => ({ code, kind: 'add' }));
  const afterOnly = (): ReconstructedDiff => ({
    unified: afterLines.map((l) => `+ ${l.code}`).join('\n'),
    beforeLines: [],
    afterLines,
  });

  if (!patch) return afterOnly();
  const rows = numberPatchRows(patch);
  if (rows.length === 0) return afterOnly();

  const inRange = (n: number | null, lo: number, hi: number): boolean =>
    typeof n === 'number' && n >= lo && n <= hi;

  // The lines being replaced are the current new-file lines in [start, end].
  const replaced = rows.filter((r) => inRange(r.newLine, start, end));
  if (replaced.length === 0) return afterOnly();

  const ctxBefore = rows.filter((r) => inRange(r.newLine, start - CONTEXT_RADIUS, start - 1));
  const ctxAfter = rows.filter((r) => inRange(r.newLine, end + 1, end + CONTEXT_RADIUS));

  const unified = [
    ...ctxBefore.map((r) => `  ${r.code}`),
    ...replaced.map((r) => `- ${r.code}`),
    ...afterLines.map((l) => `+ ${l.code}`),
    ...ctxAfter.map((r) => `  ${r.code}`),
  ].join('\n');

  const beforeLines: DiffLine[] = replaced.map((r) => ({
    code: r.code,
    kind: 'del',
    line_number: r.newLine ?? undefined,
  }));

  return { unified, beforeLines, afterLines };
}

/**
 * Project an AISuggestion onto the renderer's CodeSuggestion, tagged
 * `source: 'ai'` and carrying the reconstructed diff. `patch` is the focal
 * file's PR patch (from pulls.listFiles); pass `undefined` to degrade to an
 * after-only diff.
 */
export function aiToCodeSuggestion(
  ai: AISuggestion,
  patch: string | undefined,
  model: string,
): CodeSuggestion {
  const start = typeof ai.start_line === 'number' ? ai.start_line : ai.line;
  const { unified, beforeLines, afterLines } = reconstructDiff(patch, start, ai.line, ai.after_code);

  const summary = ai.summary?.trim() || undefined;

  return {
    category: ai.category,
    category_label: CATEGORY_LABEL[ai.category],
    file: ai.file,
    line: ai.line,
    confidence: ai.confidence,
    why_it_matters: ai.why_it_matters,
    references: ai.references,
    diff: { unified, before_lines: beforeLines, after_lines: afterLines },
    language: languageOf(ai.file),
    source: 'ai',
    summary,
    model,
  };
}

/**
 * Look up a file's patch with the same exact-then-suffix match the diff filter
 * uses (the scanner's path can diverge from GitHub's repo-root-relative path —
 * see lookupCommentable in diff-lines.ts). Longest suffix match wins.
 */
export function lookupPatch(patches: Map<string, string>, file: string): string | undefined {
  if (patches.has(file)) return patches.get(file);
  let best: string | undefined;
  for (const k of patches.keys()) {
    if ((file.endsWith(k) || k.endsWith(file)) && (!best || k.length > best.length)) best = k;
  }
  return best ? patches.get(best) : undefined;
}

/**
 * Merge AI-postable suggestions into a COPY of the report's `code_suggestions`:
 * convert each to a CodeSuggestion (with a reconstructed red/green diff), drop
 * any deterministic entry that collides by `path:line` (AI wins — it's the one
 * rendered with the rich block), and append the AI ones. PURE — returns a new
 * report and never mutates the input. Edge cases the renderer relies on:
 *   • empty `aiPostable` → report's suggestions unchanged (deterministic-only).
 *   • `patches === null` → each AI diff degrades to after-only (no red side).
 *   • absent `pr_review` → a fresh one carrying just the AI suggestions.
 */
export function mergeAiSuggestionsIntoReport(
  report: ScanPrOutput,
  aiPostable: AISuggestion[],
  patches: Map<string, string> | null,
  model: string,
): ScanPrOutput {
  const aiCode = aiPostable.map((s) =>
    aiToCodeSuggestion(s, patches ? lookupPatch(patches, s.file) : undefined, model),
  );
  const aiKeys = new Set(aiCode.map((s) => `${s.file}:${s.line}`));
  const det = (report.pr_review?.code_suggestions ?? []).filter(
    (s) => !aiKeys.has(`${s.file}:${s.line}`),
  );
  return {
    ...report,
    pr_review: { ...(report.pr_review ?? {}), code_suggestions: [...det, ...aiCode] },
  };
}
