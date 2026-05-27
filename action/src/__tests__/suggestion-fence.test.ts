// Tests for the committable-suggestion fence helper. The whole point is that
// a suggestion's Apply button must survive backticks INSIDE the replacement
// code — so the fence length has to scale past the longest inner run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestionBlock, unwrapFence } from '../suggestion-fence.ts';

/** Length of the opening fence (count leading backticks of the first line). */
function fenceLen(block: string): number {
  return (block.match(/^`+/)?.[0].length) ?? 0;
}

test('suggestionBlock: plain code uses a 3-backtick fence', () => {
  const b = suggestionBlock('const x = 1;');
  assert.equal(fenceLen(b), 3);
  assert.equal(b, '```suggestion\nconst x = 1;\n```');
});

test('suggestionBlock: code containing ``` uses a 4-backtick fence', () => {
  const code = 'doc = """\n```py\nprint(1)\n```\n"""';
  const b = suggestionBlock(code);
  assert.equal(fenceLen(b), 4, 'fence must exceed the inner triple backtick');
  // Inner content survives intact, and the block closes on the longer fence.
  assert.ok(b.startsWith('````suggestion\n'));
  assert.ok(b.endsWith('\n````'));
  assert.ok(b.includes('```py'), 'inner fence preserved verbatim');
});

test('suggestionBlock: fence is always longest-run + 1', () => {
  assert.equal(fenceLen(suggestionBlock('a ```` b')), 5);   // run of 4 → 5
  assert.equal(fenceLen(suggestionBlock('`single`')), 3);   // run of 1 → floor 3
  assert.equal(fenceLen(suggestionBlock('')), 3);           // empty → floor 3
});

test('unwrapFence: removes a model-added wrapping fence', () => {
  assert.equal(unwrapFence('```ts\nconst x = 1;\n```'), 'const x = 1;');
  assert.equal(unwrapFence('```\nfoo\nbar\n```'), 'foo\nbar');
});

test('unwrapFence: leaves bare code untouched', () => {
  assert.equal(unwrapFence('const x = 1;'), 'const x = 1;');
  assert.equal(unwrapFence('a\nb\nc'), 'a\nb\nc');
});

test('end-to-end: model wraps in ``` then we re-fence — no broken block', () => {
  // Model returned after_code wrapped in its own fence (against instructions).
  const fromModel = '```js\nreturn a ?? b;\n```';
  const block = suggestionBlock(unwrapFence(fromModel));
  assert.equal(block, '```suggestion\nreturn a ?? b;\n```');
});
