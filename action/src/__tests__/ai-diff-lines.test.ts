// Tests for the pure diff policy (src/ai/diff-lines.ts) and the thin
// fetch adapter (src/ai/post.ts → fetchCommentableLines).
//
// The point of this layer: only let a suggestion through if its line
// is a RIGHT-side line GitHub will accept for an inline comment, so we
// never 422 the whole review.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseCommentableLines,
  filterByDiff,
  lookupCommentable,
  nearestCommentableLine,
} from '../ai/diff-lines.ts';
import { fetchCommentableLines } from '../ai/post.ts';
import type { AISuggestion } from '../ai/schema.ts';

function sug(file: string, line: number, start_line?: number): AISuggestion {
  return {
    file,
    line,
    ...(start_line ? { start_line } : {}),
    category: 'A',
    confidence: 0.9,
    why_it_matters: 'long enough text to pass',
    references: [{ url: 'https://example.com' }],
    after_code: 'x',
  };
}

// ── parseCommentableLines ───────────────────────────────────────────────

test('parseCommentableLines: added + context lines are commentable, deletions are not', () => {
  // new file region: @@ starts new side at line 10.
  //   10 context, 11 deleted(-) [no new advance], 11 added(+), 12 added(+)
  const patch = ['@@ -10,2 +10,3 @@', ' ctx line 10', '-removed old', '+new line 11', '+new line 12'].join('\n');
  const set = parseCommentableLines(patch);
  assert.deepEqual([...set].sort((a, b) => a - b), [10, 11, 12]);
});

test('parseCommentableLines: new file — every + line from 1', () => {
  const patch = ['@@ -0,0 +1,3 @@', '+a', '+b', '+c'].join('\n');
  assert.deepEqual([...parseCommentableLines(patch)].sort((a, b) => a - b), [1, 2, 3]);
});

test('parseCommentableLines: multiple hunks accumulate', () => {
  // Valid unified diff (hunk header counts match content):
  //   hunk 1: -1,1 +1,1  → "-old"/"+first"   → new line 1
  //   hunk 2: -50,1 +60,2 → " ctx"/"+added"  → new lines 60, 61
  const patch = [
    '@@ -1,1 +1,1 @@',
    '-old',
    '+first',
    '@@ -50,1 +60,2 @@',
    ' ctx',
    '+added',
  ].join('\n');
  assert.deepEqual([...parseCommentableLines(patch)].sort((a, b) => a - b), [1, 60, 61]);
});

test('parseCommentableLines: "\\ No newline at end of file" does not advance', () => {
  const patch = ['@@ -1,1 +1,1 @@', '-old line', '+only line', '\\ No newline at end of file'].join('\n');
  assert.deepEqual([...parseCommentableLines(patch)], [1]);
});

test('parseCommentableLines: deletion-only hunk yields nothing on the right side', () => {
  const patch = ['@@ -5,2 +5,0 @@', '-gone one', '-gone two'].join('\n');
  assert.equal(parseCommentableLines(patch).size, 0);
});

test('parseCommentableLines: malformed patch fails safe (empty set, no throw)', () => {
  // jsdiff throws on a patch whose hunk counts don't match its content;
  // we swallow it and return no commentable lines for that file.
  const bad = ['@@ -1,1 +1,9 @@', '+only one line but header claims nine'].join('\n');
  assert.doesNotThrow(() => parseCommentableLines(bad));
  // Whatever it yields, it must not crash — at most the lines it could read.
  assert.ok(parseCommentableLines(bad) instanceof Set);
});

test('parseCommentableLines: REAL `git diff` output (authentic GitHub-style patch)', () => {
  // The strongest check: parse a patch git itself produced, not a
  // hand-written one (whose hunk counts are easy to get wrong).
  const root = mkdtempSync(join(tmpdir(), 'drift-diff-'));
  const git = (...a: string[]) =>
    execFileSync('git', a, { cwd: root, encoding: 'utf8' });
  try {
    git('init', '-q');
    git('config', 'user.email', 't@t.t');
    git('config', 'user.name', 't');
    writeFileSync(join(root, 'svc.py'), 'a\nb\nc\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    // change line 2 (b→B2) and append line 4 (d)
    writeFileSync(join(root, 'svc.py'), 'a\nB2\nc\nd\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'change');
    const patch = git('diff', 'HEAD~1', 'HEAD', '--', 'svc.py');

    const set = parseCommentableLines(patch);
    // new file: a(1,ctx) B2(2,+) c(3,ctx) d(4,+) → all four RIGHT-side
    assert.deepEqual([...set].sort((x, y) => x - y), [1, 2, 3, 4]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── filterByDiff ─────────────────────────────────────────────────────────

test('filterByDiff: keeps in-range, drops out-of-range, names per-reason', () => {
  const map = new Map([['a.ts', new Set([10, 11, 12])]]);
  const { kept, dropped, reasons } = filterByDiff([sug('a.ts', 11), sug('a.ts', 99)], map);
  assert.deepEqual(kept.map((s) => s.line), [11]);
  assert.deepEqual(dropped.map((s) => s.line), [99]);
  // Per-finding reason surfaces the missing line — so a 0-post run is
  // diagnosable from the log instead of just naming the count.
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /line\(s\) 99 not on diff/);
});

test('filterByDiff: unknown file is dropped + reason names the diff file list', () => {
  const map = new Map([['a.ts', new Set([1])]]);
  const { kept, dropped, reasons } = filterByDiff([sug('other.ts', 1)], map);
  assert.equal(kept.length, 0);
  assert.equal(dropped.length, 1);
  assert.match(reasons[0], /file not in PR diff.*diff has 1 file\(s\): a\.ts/);
});

test('filterByDiff: multi-line range requires EVERY line commentable', () => {
  const map = new Map([['a.ts', new Set([10, 11, 12])]]);
  // 10..12 all present → kept; 10..13 has 13 missing → dropped
  const { kept, dropped, reasons } = filterByDiff([sug('a.ts', 12, 10), sug('a.ts', 13, 10)], map);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].line, 12);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].line, 13);
  assert.match(reasons[0], /line\(s\) 13 not on diff/);
});

// ── filterByDiff: path-base mismatch bridge (the SECOND bug) ────────────

test('filterByDiff: scanner emits DEEPER path than GitHub diff → suffix-match still keeps it', () => {
  // Repro of the bug we found in the audit: the model uses the focal
  // point's file verbatim (the SCANNER's path), but `fetchCommentableLines`
  // keys the map by `pulls.listFiles[].filename` (GitHub's normalized
  // repo-root-relative path). In a monorepo or a workspace sub-crate
  // these diverge. Without suffix-match the WHOLE review silently drops.
  const map = new Map([['app/db.py', new Set([42, 43])]]);
  const suggestion = sug('drift-static-profiler/tests/fixtures/python-fastapi/app/db.py', 42);
  const { kept, dropped } = filterByDiff([suggestion], map);
  assert.equal(kept.length, 1, 'suffix-match must rescue the deeper-pathed suggestion');
  assert.equal(dropped.length, 0);
});

test('filterByDiff: GitHub emits DEEPER path than scanner (reverse suffix) → still kept', () => {
  // Symmetric case: scanner is rooted at a sub-crate, GitHub is at the
  // monorepo root. The model echoes the scanner's path. Either direction
  // of suffix match resolves it.
  const map = new Map([['monorepo/services/x.py', new Set([7])]]);
  const { kept } = filterByDiff([sug('services/x.py', 7)], map);
  assert.equal(kept.length, 1);
});

test('filterByDiff: ambiguous suffix (no exact match) → LONGEST suffix wins', () => {
  // No exact key for the suggestion file → suffix-match resolves. Two
  // candidate keys both share a tail with `crate-x/a/utils.py`; the
  // longest key is the most-specific path and must beat the shorter
  // one, otherwise the resolver would depend on Map iteration order.
  const map = new Map([
    ['utils.py', new Set([1])],
    ['monorepo/services/crate-x/a/utils.py', new Set([2])],
  ]);
  const { kept } = filterByDiff([sug('crate-x/a/utils.py', 2)], map);
  // Suggestion path is `crate-x/a/utils.py`; longest endsWith match is
  // `monorepo/services/crate-x/a/utils.py` (key endsWith file) → set
  // has line 2 → kept.
  assert.equal(kept.length, 1);
  assert.equal(kept[0].line, 2);
});

// ── lookupCommentable (exported from diff-lines now) ────────────────────

// ── nearestCommentableLine — snap an off-diff anchor to the closest ──────
//   diff line so an advisory finding still posts inline.

test('nearestCommentableLine: exact member returns itself', () => {
  assert.equal(nearestCommentableLine(new Set([10, 20, 30]), 20), 20);
});

test('nearestCommentableLine: picks the closest line above or below', () => {
  // 23 is closer to 20 than to 30.
  assert.equal(nearestCommentableLine(new Set([10, 20, 30]), 23), 20);
  // 27 is closer to 30.
  assert.equal(nearestCommentableLine(new Set([10, 20, 30]), 27), 30);
});

test('nearestCommentableLine: equidistant tie resolves to the LOWER line', () => {
  // 25 is exactly between 20 and 30 → deterministic lower wins.
  assert.equal(nearestCommentableLine(new Set([20, 30]), 25), 20);
});

test('nearestCommentableLine: target far below the diff snaps to the first line', () => {
  assert.equal(nearestCommentableLine(new Set([100, 200]), 1), 100);
});

test('nearestCommentableLine: empty set → undefined (caller drops the finding)', () => {
  assert.equal(nearestCommentableLine(new Set<number>(), 5), undefined);
});

test('lookupCommentable: exact key wins', () => {
  const map = new Map([['a.ts', new Set([1, 2, 3])]]);
  assert.deepEqual([...lookupCommentable(map, 'a.ts')!], [1, 2, 3]);
});

test('lookupCommentable: file is deeper than the key → suffix match (key endsWith reversed)', () => {
  const map = new Map([['a.ts', new Set([1, 2, 3])]]);
  // suggestion file has a deeper prefix; suffix match resolves
  assert.deepEqual([...lookupCommentable(map, 'crate/src/a.ts')!], [1, 2, 3]);
});

test('lookupCommentable: key is deeper than the file → reverse suffix match', () => {
  const map = new Map([['monorepo/services/app/db.py', new Set([42])]]);
  assert.deepEqual([...lookupCommentable(map, 'app/db.py')!], [42]);
});

test('lookupCommentable: no match → undefined', () => {
  const map = new Map([['a.ts', new Set([1])]]);
  assert.equal(lookupCommentable(map, 'totally/unrelated.go'), undefined);
});

// ── Suffix-match edge cases that could otherwise misroute ──────────────

test('lookupCommentable: same filename in different dirs → does NOT collide on bare basename', () => {
  // Two `utils.py` in different dirs. A naive basename-match would
  // resolve them to whichever iterates first. The longest-suffix rule
  // means a suggestion at `services/users/utils.py` resolves
  // unambiguously to itself when present.
  const map = new Map([
    ['services/users/utils.py', new Set([1])],
    ['services/orders/utils.py', new Set([2])],
  ]);
  // Exact match must win → set [1]
  const usersSet = lookupCommentable(map, 'services/users/utils.py');
  assert.deepEqual([...usersSet!], [1], 'exact-key path must beat suffix-match');

  // A suggestion at a DEEPER prefix of the users path still resolves
  // to the users entry (longest endsWith wins).
  const deeperUsers = lookupCommentable(map, 'monorepo/services/users/utils.py');
  assert.deepEqual([...deeperUsers!], [1]);
});

test('lookupCommentable: bare basename match is allowed when nothing else matches', () => {
  // If there's only one `utils.py` in the diff, a deeper-pathed
  // suggestion that ends with `utils.py` still resolves — the same
  // bridge the Rust side uses for `sym.file.ends_with(p)`. We accept
  // a single-segment suffix match here because that's the failure mode
  // we're guarding against (monorepo + sub-crate root divergence).
  const map = new Map([['utils.py', new Set([7])]]);
  const set = lookupCommentable(map, 'monorepo/services/utils.py');
  assert.deepEqual([...set!], [7]);
});

test('filterByDiff: same filename in two dirs → suggestions DO NOT cross-route', () => {
  // The full filter path with the same scenario as above. A suggestion
  // for users/utils.py:99 must NOT be kept because users/utils.py only
  // has line 1 — the suggestion 99 belongs to neither dir, so it drops
  // with a named reason instead of accidentally landing on orders/utils.py.
  const map = new Map([
    ['services/users/utils.py', new Set([1])],
    ['services/orders/utils.py', new Set([2])],
  ]);
  const { kept, dropped, reasons } = filterByDiff(
    [sug('services/users/utils.py', 99)],
    map,
  );
  assert.equal(kept.length, 0);
  assert.equal(dropped.length, 1);
  // The reason mentions the LINE miss, not a path miss — proves the
  // resolver picked the right file.
  assert.match(reasons[0], /line\(s\) 99 not on diff/);
});

// ── Multi-line ranges through the suffix-match bridge ──────────────────

test('filterByDiff: multi-line range + suffix-match → kept when ALL lines on diff', () => {
  // The model emits a deeper-than-diff path AND a multi-line range
  // (start_line=10, line=12). Suffix-match must resolve the file
  // first, THEN every line in the range must be commentable.
  const map = new Map([['svc/x.py', new Set([10, 11, 12])]]);
  const s = sug('monorepo/crates/svc/x.py', 12, 10);
  const { kept, dropped } = filterByDiff([s], map);
  assert.equal(kept.length, 1, 'suffix bridge + full range coverage → keep');
  assert.equal(dropped.length, 0);
});

test('filterByDiff: multi-line range + suffix-match → dropped when ONE line missing', () => {
  // Same suffix-match resolves the file, but line 11 is missing from
  // the diff → drop. GitHub would 422 the whole review on a partial
  // range, so this is a hard drop.
  const map = new Map([['svc/x.py', new Set([10, 12])]]); // 11 missing
  const s = sug('monorepo/crates/svc/x.py', 12, 10);
  const { kept, dropped, reasons } = filterByDiff([s], map);
  assert.equal(kept.length, 0);
  assert.equal(dropped.length, 1);
  assert.match(reasons[0], /line\(s\) 11 not on diff/);
});

test('filterByDiff: start_line > line is an INVALID range → dropped with named reason', () => {
  // The schema validator catches this normally, but defense-in-depth:
  // if a malformed suggestion sneaks through (older bundle, hand-edited
  // envelope), the post-filter must reject cleanly instead of looping
  // backwards over lines.
  const map = new Map([['a.py', new Set([1, 2, 3])]]);
  const { kept, dropped, reasons } = filterByDiff([sug('a.py', 1, 5)], map);
  assert.equal(kept.length, 0);
  assert.equal(dropped.length, 1);
  assert.match(reasons[0], /start_line 5 > line 1 \(invalid range\)/);
});

// ── fetchCommentableLines (thin adapter over pulls.listFiles) ────────────

test('fetchCommentableLines: maps each file patch; skips files with no patch', async () => {
  const octokit = {
    rest: {
      pulls: {
        listFiles: async () => ({
          data: [
            { filename: 'a.ts', patch: '@@ -1,0 +1,2 @@\n+one\n+two' },
            { filename: 'bin.png' }, // binary → no patch → skipped
          ],
        }),
      },
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = await fetchCommentableLines(octokit as any, 'o', 'r', 7);
  assert.deepEqual([...(map.get('a.ts') ?? [])].sort((a, b) => a - b), [1, 2]);
  assert.equal(map.has('bin.png'), false);
});
