// Regression tests for the input-token budget that stops the per-suggestion
// loop from 413ing ("Request body too large … Max size: 8000 tokens").
//
// Root cause it guards: the focal prompt used to embed the focal file's
// WHOLE diff, so a large or newly-added file (every line a `+`) blew the
// GitHub Models 8000-token input cap and every suggestion came back empty.
// annotateFocusedDiff windows the diff to the hunk around the focal line;
// countTokens lets the prompt builder verify the result fits before the POST.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotateDiff, annotateFocusedDiff } from '../ai/build-context.ts';
import { countTokens } from '../ai/budget.ts';

// A single addition-only hunk of `count` new lines starting at `newStart`
// (what `git diff` emits for a brand-new or fully-rewritten file).
function bigAddDiff(file: string, newStart: number, count: number): string {
  const header = `--- a/${file}\n+++ b/${file}\n@@ -${newStart},0 +${newStart},${count} @@\n`;
  const lines: string[] = [];
  for (let i = 0; i < count; i += 1) lines.push(`+const sym_${newStart + i} = ${i};`);
  return `${header}${lines.join('\n')}\n`;
}

test('countTokens: positive, and longer text costs more tokens', () => {
  assert.ok(countTokens('hello world') > 0);
  assert.ok(countTokens('a'.repeat(4000)) > countTokens('a'.repeat(40)));
});

test('annotateFocusedDiff: radius=Infinity is the full diff (== annotateDiff)', () => {
  const diff = bigAddDiff('src/big.ts', 100, 200);
  assert.equal(annotateFocusedDiff(diff, 150, Infinity), annotateDiff(diff));
});

test('annotateFocusedDiff: a finite radius windows around the focal line', () => {
  const diff = bigAddDiff('src/big.ts', 100, 200); // new-file lines 100..299
  const focal = 150;
  const windowed = annotateFocusedDiff(diff, focal, 5);

  // The focal line itself is present, prefixed with its new-file number + `+`.
  assert.match(windowed, /\b150 \+const sym_150/);
  // Lines far outside the ±5 window are gone…
  assert.doesNotMatch(windowed, /\bconst sym_100\b/);
  assert.doesNotMatch(windowed, /\bconst sym_299\b/);
  // …and the cut is explicit, never silent.
  assert.match(windowed, /line\(s\) omitted/);

  // The whole point: the window is far smaller than the full diff.
  assert.ok(
    countTokens(windowed) < countTokens(annotateDiff(diff)) / 5,
    'windowed diff should be a small fraction of the full diff',
  );
});

test('annotateFocusedDiff: shrinking the radius monotonically shrinks the output', () => {
  const diff = bigAddDiff('src/big.ts', 1, 500);
  const wide = countTokens(annotateFocusedDiff(diff, 250, 80));
  const tight = countTokens(annotateFocusedDiff(diff, 250, 8));
  assert.ok(tight < wide, `tight (${tight}) should be smaller than wide (${wide})`);
  // Even an 8-line window around the focal line is comfortably under the cap.
  assert.ok(tight < 7000, `tight window should fit the budget, got ${tight}`);
});

test('annotateFocusedDiff: never grows the output, handles empty/garbage input', () => {
  assert.equal(annotateFocusedDiff('', 10, 5), '');
  // Garbage (no parseable hunk) must not produce MORE than the raw annotator —
  // the whole purpose is to never enlarge the request body.
  const garbage = 'not a diff at all';
  assert.ok(countTokens(annotateFocusedDiff(garbage, 10, 5)) <= countTokens(annotateDiff(garbage)));
});
