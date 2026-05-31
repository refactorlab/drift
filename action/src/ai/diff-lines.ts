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

/**
 * Pick the commentable line CLOSEST to `target` from a non-empty set of
 * diff lines. Used to RE-ANCHOR a deterministic finding whose exact line
 * (a symbol's definition line) falls outside the PR's diff hunks: rather
 * than dropping the finding to the sticky comment only, we snap its inline
 * anchor to the nearest changed line in the same file. Ties resolve to the
 * LOWER line number (earlier in the file) for deterministic output.
 *
 * Returns `undefined` for an empty set — the caller treats that as
 * "file not in the diff at all" and drops the finding.
 */
export function nearestCommentableLine(set: Set<number>, target: number): number | undefined {
  let best: number | undefined;
  let bestDist = Infinity;
  for (const n of set) {
    const dist = Math.abs(n - target);
    if (dist < bestDist || (dist === bestDist && (best === undefined || n < best))) {
      best = n;
      bestDist = dist;
    }
  }
  return best;
}

export type FilterResult = {
  kept: AISuggestion[];
  dropped: AISuggestion[];
  /**
   * Per-dropped diagnostic: why this suggestion got dropped. Surfaced
   * by the caller into the log so a path-base mismatch (the OTHER
   * common failure mode) is named explicitly instead of leaving the
   * user with a silent "0 posted". 1:1 with `dropped`.
   */
  reasons: string[];
};

/**
 * Look up the commentable-lines set for a file, with a suffix-match
 * fallback. The model emits `file` taken VERBATIM from the focal
 * point (the scanner's path), but GitHub's pulls.listFiles returns
 * the repo-root-relative path — which may diverge in a monorepo or
 * any other setup where the scanner was rooted differently. Without
 * suffix matching, the WHOLE review silently 0-posts even when every
 * suggestion was on a real `+` line. Mirrors the `lookupCommentable`
 * in build-context.ts (kept identical so the two filter layers can't
 * drift) — same Rust convention as `sym.file.ends_with(p)` in
 * `dead_code_suggestions`.
 *
 * Algorithm: exact key first; else the LONGEST key for which either
 * direction's suffix match holds (longest wins so the more-specific
 * path is preferred when several files share a tail). Returns
 * `undefined` when nothing matches — caller distinguishes "file not
 * in diff at all" from "file in diff but line out of range".
 */
export function lookupCommentable(
  map: Map<string, Set<number>>,
  file: string,
): Set<number> | undefined {
  if (map.has(file)) return map.get(file);
  let best: string | undefined;
  for (const k of map.keys()) {
    if (file.endsWith(k) || k.endsWith(file)) {
      if (!best || k.length > best.length) best = k;
    }
  }
  return best ? map.get(best) : undefined;
}

/**
 * Keep only suggestions whose anchor lines are all commentable in the
 * diff. For a multi-line suggestion (start_line..line) every line in
 * the range must be commentable, or GitHub 422s the whole review.
 *
 * File lookup uses `lookupCommentable` (suffix-match), NOT exact key
 * equality — see that function's doc for why. Each dropped suggestion
 * carries a diagnostic reason so the caller can log WHY each one was
 * rejected (path miss vs. line miss vs. range partial) instead of just
 * naming the count.
 */
export function filterByDiff(
  suggestions: AISuggestion[],
  commentableByFile: Map<string, Set<number>>,
): FilterResult {
  const kept: AISuggestion[] = [];
  const dropped: AISuggestion[] = [];
  const reasons: string[] = [];
  for (const s of suggestions) {
    const set = lookupCommentable(commentableByFile, s.file);
    const start = typeof s.start_line === 'number' ? s.start_line : s.line;
    if (set === undefined) {
      dropped.push(s);
      const sample = [...commentableByFile.keys()].slice(0, 3).join(', ');
      const more = commentableByFile.size > 3 ? ` (+${commentableByFile.size - 3} more)` : '';
      reasons.push(
        `file not in PR diff (no exact or suffix match; diff has ${commentableByFile.size} file(s): ${sample || '(empty)'}${more})`,
      );
      continue;
    }
    if (start > s.line) {
      dropped.push(s);
      reasons.push(`start_line ${start} > line ${s.line} (invalid range)`);
      continue;
    }
    const missing: number[] = [];
    for (let l = start; l <= s.line; l += 1) {
      if (!set.has(l)) missing.push(l);
    }
    if (missing.length === 0) {
      kept.push(s);
    } else {
      dropped.push(s);
      const preview = missing.slice(0, 4).join(', ');
      const tail = missing.length > 4 ? ` (+${missing.length - 4} more)` : '';
      reasons.push(`line(s) ${preview}${tail} not on diff (file has ${set.size} commentable line(s))`);
    }
  }
  return { kept, dropped, reasons };
}
