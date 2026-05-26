// Pure diff policy — no I/O, no Octokit. Answers one question:
// "which RIGHT-side (new-file) line numbers are commentable in a PR
// diff?" GitHub rejects an inline review comment whose line is not in
// the diff (HTTP 422), so we filter AI suggestions against this set
// BEFORE posting.
//
// Parsing the unified diff is delegated to jsdiff (`diff`, BSD-3-Clause)
// — the most-downloaded, battle-tested diff library in the JS ecosystem
// — via its `parsePatch`. It handles GitHub's header-less per-file
// `.patch` as well as full patches (verified). We only own the tiny
// policy of walking hunk lines to collect new-side line numbers.

import { parsePatch } from 'diff';
import type { AISuggestion } from './schema.ts';

/**
 * Parse a single file's unified-diff patch (the `.patch` field GitHub
 * returns from pulls.listFiles) into the set of new-file line numbers
 * that can carry a RIGHT-side review comment — i.e. added (`+`) and
 * context (` `) lines. Deletions (`-`) and the "\ No newline" marker
 * are LEFT-side / non-advancing and never commentable.
 */
export function parseCommentableLines(patch: string): Set<number> {
  const lines = new Set<number>();
  // jsdiff throws on a malformed patch; a single bad file's patch must
  // not sink the whole review, so fail-safe to "no commentable lines"
  // (its suggestions get dropped rather than 422'd).
  let files: ReturnType<typeof parsePatch>;
  try {
    files = parsePatch(patch);
  } catch {
    return lines;
  }
  for (const file of files) {
    for (const hunk of file.hunks) {
      let newLine = hunk.newStart;
      for (const row of hunk.lines) {
        const c = row[0];
        if (c === '+' || c === ' ') {
          lines.add(newLine);
          newLine += 1;
        }
        // '-' (deletion) and '\' (no-newline marker) don't advance the new side
      }
    }
  }
  return lines;
}

export type FilterResult = {
  kept: AISuggestion[];
  dropped: AISuggestion[];
};

/**
 * Keep only suggestions whose anchor lines are all commentable in the
 * diff. For a multi-line suggestion (start_line..line) every line in
 * the range must be commentable, or GitHub 422s the whole review.
 */
export function filterByDiff(
  suggestions: AISuggestion[],
  commentableByFile: Map<string, Set<number>>,
): FilterResult {
  const kept: AISuggestion[] = [];
  const dropped: AISuggestion[] = [];
  for (const s of suggestions) {
    const set = commentableByFile.get(s.file);
    const start = typeof s.start_line === 'number' ? s.start_line : s.line;
    let ok = set !== undefined && start <= s.line;
    for (let l = start; ok && l <= s.line; l += 1) {
      if (!set!.has(l)) ok = false;
    }
    (ok ? kept : dropped).push(s);
  }
  return { kept, dropped };
}
