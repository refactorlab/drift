// buildDeterministicComments — the anchoring policy that turns scanner
// findings into inline review comments.
//
// The failure this guards against (PR #68 in the wild): every scanner
// finding anchors at its SYMBOL's definition line, which lives in a changed
// file but is usually NOT a line in the PR's diff hunks. A naive exact-line
// filter dropped all 10 findings → an EMPTY inline review. The fix snaps
// advisory findings (no Apply-button block) to the nearest commentable diff
// line, keeps on-diff findings exact, and only drops what genuinely can't be
// anchored (Apply-block findings off-diff, or files not in the diff at all).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeterministicComments } from '../ai-index.ts';
import type { CodeSuggestion } from '../report.ts';

function sug(over: Partial<CodeSuggestion> = {}): CodeSuggestion {
  return {
    category: 'A',
    category_label: 'Optimization — Dead code in changed file',
    kind: 'dead_code_in_changed_file',
    rule_id: 'S2:dead-code',
    file: 'src/app.ts',
    function: 'cleanup',
    line: 42,
    confidence: 1.0,
    severity: 'low',
    why_it_matters: 'reachable by zero callers but in a touched file.',
    references: [{ url: 'https://example.com', title: 'ref' }],
    // Advisory by default: no after_lines ⇒ no Apply block ⇒ snappable.
    diff: { before_lines: [{ code: 'function cleanup() {}' }], after_lines: [] },
    ...over,
  };
}

test('no commentable map → comments built verbatim (best-effort, unfiltered)', () => {
  const out = buildDeterministicComments([sug({ line: 42 })], null);
  assert.equal(out.length, 1);
  assert.equal(out[0].path, 'src/app.ts');
  assert.equal(out[0].line, 42);
});

test('exact line on the diff → kept as-is, no snap note', () => {
  const commentable = new Map([['src/app.ts', new Set([40, 41, 42, 43])]]);
  const out = buildDeterministicComments([sug({ line: 42 })], commentable);
  assert.equal(out.length, 1);
  assert.equal(out[0].line, 42);
  assert.ok(!out[0].body.includes('📍'), 'on-diff comment must not carry a snap note');
});

test('off-diff advisory finding → SNAPS to the nearest diff line with an honest note', () => {
  // Finding at line 42; diff only touches 10 and 50. 50 is closer to 42.
  const commentable = new Map([['src/app.ts', new Set([10, 50])]]);
  const out = buildDeterministicComments([sug({ line: 42 })], commentable);
  assert.equal(out.length, 1, 'must NOT be dropped — this is the bug being fixed');
  assert.equal(out[0].line, 50, 'snapped to the nearest commentable line');
  assert.match(out[0].body, /📍 Anchored to the nearest changed line/);
  assert.match(out[0].body, /src\/app\.ts:42/, 'note names the TRUE finding location');
});

test('off-diff finding WITH an Apply block → dropped (snapping would corrupt the patch)', () => {
  const withApply = sug({
    line: 42,
    category: 'B',
    diff: { after_lines: [{ code: 'const safe = sanitize(input);' }] },
  });
  const commentable = new Map([['src/app.ts', new Set([10, 50])]]);
  const out = buildDeterministicComments([withApply], commentable);
  assert.equal(out.length, 0, 'an Apply-button anchor must stay exact or drop — never snap');
});

test('on-diff finding WITH an Apply block → kept exact (Apply targets the right line)', () => {
  const withApply = sug({
    line: 42,
    diff: { after_lines: [{ code: 'fixed();' }] },
  });
  const commentable = new Map([['src/app.ts', new Set([42])]]);
  const out = buildDeterministicComments([withApply], commentable);
  assert.equal(out.length, 1);
  assert.equal(out[0].line, 42);
});

test('file absent from the PR diff → dropped (sticky-only)', () => {
  const commentable = new Map([['some/other.ts', new Set([1, 2])]]);
  const out = buildDeterministicComments([sug({ file: 'src/app.ts', line: 42 })], commentable);
  assert.equal(out.length, 0);
});

test('file present in diff but with zero commentable lines → dropped', () => {
  const commentable = new Map([['src/app.ts', new Set<number>()]]);
  const out = buildDeterministicComments([sug({ line: 42 })], commentable);
  assert.equal(out.length, 0);
});

test('suffix-tolerant file lookup → scanner deeper path still resolves and snaps', () => {
  // Scanner emits a repo-absolute path; GitHub diff is repo-relative.
  const commentable = new Map([['src/app.ts', new Set([10, 50])]]);
  const out = buildDeterministicComments(
    [sug({ file: '/home/runner/work/drift/drift/src/app.ts', line: 42 })],
    commentable,
  );
  assert.equal(out.length, 1, 'monorepo / abs-path scanner output must still anchor');
  assert.equal(out[0].line, 50);
});

test('mixed batch: on-diff kept, off-diff advisory snapped, off-diff-apply dropped', () => {
  const commentable = new Map([['src/app.ts', new Set([10, 20, 30])]]);
  const batch = [
    sug({ line: 20 }), // on-diff → kept exact
    sug({ line: 100 }), // off-diff advisory → snap to 30 (nearest)
    sug({ line: 100, diff: { after_lines: [{ code: 'x();' }] } }), // off-diff + Apply → dropped
  ];
  const out = buildDeterministicComments(batch, commentable);
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((c) => c.line),
    [20, 30],
  );
  assert.ok(!out[0].body.includes('📍'));
  assert.ok(out[1].body.includes('📍'));
});

test('suggestion with no line is skipped before anchoring', () => {
  const commentable = new Map([['src/app.ts', new Set([1, 2])]]);
  const out = buildDeterministicComments([sug({ line: undefined })], commentable);
  assert.equal(out.length, 0);
});
