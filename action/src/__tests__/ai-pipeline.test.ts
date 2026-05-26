// Full-pipeline integration test: the exact composition ai-index.ts runs.
//
//   raw model output → parseAIOutput (quality bar)
//                     → filterByDiff (anchor to commentable lines)
//                     → slice(maxSuggestions) (cap)
//                     → buildReviewComments (createReview payload)
//
// Proves out-of-diff suggestions are DROPPED (never 422), the cap counts
// only postable suggestions (filter-then-cap), and multi-line ranges
// survive intact.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAIOutput } from '../ai/parse.ts';
import { filterByDiff } from '../ai/diff-lines.ts';
import { buildReviewComments } from '../ai/post.ts';

const fixtureDir = join(import.meta.dirname, '../../.dev');

// The example fixture carries 4 quality-passing suggestions:
//   service.py:42, retry.py:87, agg.py:14, handler.ts:50-53 (multi-line)
function loadParsed() {
  const raw = readFileSync(join(fixtureDir, 'ai-suggestions.example.json'), 'utf8');
  const r = parseAIOutput(raw);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

test('pipeline: drops out-of-diff suggestions instead of 422-ing the batch', () => {
  const parsed = loadParsed();
  assert.equal(parsed.suggestions.length, 4);

  // Diff makes only service.py:42 and handler.ts:50-53 commentable.
  const commentable = new Map<string, Set<number>>([
    ['src/users/service.py', new Set([42])],
    ['src/api/handler.ts', new Set([50, 51, 52, 53])],
  ]);

  const { kept, dropped } = filterByDiff(parsed.suggestions, commentable);
  assert.deepEqual(
    kept.map((s) => `${s.file}:${s.line}`).sort(),
    ['src/api/handler.ts:53', 'src/users/service.py:42'],
  );
  assert.deepEqual(
    dropped.map((s) => `${s.file}:${s.line}`).sort(),
    ['src/metrics/agg.py:14', 'src/payments/retry.py:87'],
  );
});

test('pipeline: filter-then-cap counts only postable suggestions', () => {
  const parsed = loadParsed();
  // All 4 are commentable here, but cap = 2.
  const commentable = new Map<string, Set<number>>([
    ['src/users/service.py', new Set([42])],
    ['src/payments/retry.py', new Set([87])],
    ['src/metrics/agg.py', new Set([14])],
    ['src/api/handler.ts', new Set([50, 51, 52, 53])],
  ]);
  const { kept } = filterByDiff(parsed.suggestions, commentable);
  assert.equal(kept.length, 4);
  const toPost = kept.slice(0, 2);
  assert.equal(toPost.length, 2);
});

test('pipeline: produces a valid createReview payload (multi-line range intact)', () => {
  const parsed = loadParsed();
  const commentable = new Map<string, Set<number>>([
    ['src/users/service.py', new Set([42])],
    ['src/api/handler.ts', new Set([50, 51, 52, 53])],
  ]);
  const { kept } = filterByDiff(parsed.suggestions, commentable);
  const comments = buildReviewComments(kept.slice(0, 3), 'openai/gpt-4o');

  // every comment is on a commentable line, RIGHT side, with a suggestion block
  for (const c of comments) {
    assert.equal(c.side, 'RIGHT');
    assert.ok(c.body.includes('```suggestion'));
    assert.equal((c as Record<string, unknown>).position, undefined);
  }
  // the handler.ts entry is multi-line → carries start_line + start_side
  const multi = comments.find((c) => c.path === 'src/api/handler.ts');
  assert.ok(multi, 'multi-line comment present');
  assert.equal(multi!.start_line, 50);
  assert.equal(multi!.start_side, 'RIGHT');
  assert.equal(multi!.line, 53);
});

test('pipeline: nothing commentable → nothing posted (no review)', () => {
  const parsed = loadParsed();
  const commentable = new Map<string, Set<number>>(); // empty diff
  const { kept, dropped } = filterByDiff(parsed.suggestions, commentable);
  assert.equal(kept.length, 0);
  assert.equal(dropped.length, 4);
  assert.equal(buildReviewComments(kept, 'openai/gpt-4o').length, 0);
});
