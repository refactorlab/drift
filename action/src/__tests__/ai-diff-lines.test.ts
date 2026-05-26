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
import { parseCommentableLines, filterByDiff } from '../ai/diff-lines.ts';
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

test('filterByDiff: keeps in-range, drops out-of-range', () => {
  const map = new Map([['a.ts', new Set([10, 11, 12])]]);
  const { kept, dropped } = filterByDiff([sug('a.ts', 11), sug('a.ts', 99)], map);
  assert.deepEqual(kept.map((s) => s.line), [11]);
  assert.deepEqual(dropped.map((s) => s.line), [99]);
});

test('filterByDiff: unknown file is dropped', () => {
  const map = new Map([['a.ts', new Set([1])]]);
  const { kept, dropped } = filterByDiff([sug('other.ts', 1)], map);
  assert.equal(kept.length, 0);
  assert.equal(dropped.length, 1);
});

test('filterByDiff: multi-line range requires EVERY line commentable', () => {
  const map = new Map([['a.ts', new Set([10, 11, 12])]]);
  // 10..12 all present → kept; 10..13 has 13 missing → dropped
  const { kept, dropped } = filterByDiff([sug('a.ts', 12, 10), sug('a.ts', 13, 10)], map);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].line, 12);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].line, 13);
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
