// Mock-octokit shape test for the AI post step. Mirrors
// octokit-shape.test.ts — verifies our pulls.createReview call
// matches the documented schema:
//
//   POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
//   https://docs.github.com/en/rest/pulls/reviews?apiVersion=2022-11-28

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAIOutput } from '../ai/parse.ts';
import { buildReviewComments, postAIReview } from '../ai/post.ts';
import { renderAISuggestionBody } from '../ai/render.ts';

const fixtureDir = join(import.meta.dirname, '../../.dev');
const fixturePath = join(fixtureDir, 'ai-suggestions.example.json');

type Call = { method: string; args: unknown };

function makeSpyOctokit() {
  const calls: Call[] = [];
  const octokit = {
    rest: {
      pulls: {
        createReview: async (args: unknown) => {
          calls.push({ method: 'pulls.createReview', args });
          return { data: { id: 1 } };
        },
      },
    },
  };
  return { octokit, calls };
}

function loadSuggestions(max = 10) {
  const raw = readFileSync(fixturePath, 'utf8');
  const r = parseAIOutput(raw, { maxSuggestions: max });
  if (!r.ok) throw new Error(`fixture parse failed: ${r.reason}`);
  return r.suggestions;
}

test('renderAISuggestionBody: ends with a ```suggestion block', () => {
  const [s] = loadSuggestions(1);
  const body = renderAISuggestionBody(s, 'openai/gpt-5');
  const lines = body.split('\n');
  // last three lines should be the suggestion fence + content + close fence
  assert.equal(lines[lines.length - 1], '```', 'last line must be closing fence');
  assert.ok(
    body.includes('\n```suggestion\n'),
    'body must contain an opening ```suggestion fence',
  );
  assert.ok(body.includes('openai/gpt-5'));
  assert.ok(body.includes('confidence'));
  assert.ok(body.includes('Reference: ['));
});

test('buildReviewComments: each comment matches REST schema (path, body, line, side)', () => {
  const suggestions = loadSuggestions(10);
  const comments = buildReviewComments(suggestions, 'openai/gpt-5');
  assert.equal(comments.length, suggestions.length);
  for (const c of comments) {
    assert.equal(typeof c.path, 'string');
    assert.ok(c.path.length > 0);
    assert.equal(typeof c.body, 'string');
    assert.ok(c.body.length > 0);
    assert.equal(typeof c.line, 'number');
    assert.ok((c.line as number) >= 1);
    assert.equal(c.side, 'RIGHT');
    // Mutex: never send the deprecated `position` alongside `line`.
    assert.equal((c as Record<string, unknown>).position, undefined);
  }
});

test('buildReviewComments: multi-line suggestion emits start_line + start_side', () => {
  const suggestions = loadSuggestions(10);
  const multi = suggestions.find((s) => typeof s.start_line === 'number');
  assert.ok(multi, 'fixture must contain a multi-line example');
  const [c] = buildReviewComments([multi!], 'openai/gpt-5');
  assert.equal(c.start_line, multi!.start_line);
  assert.equal(c.start_side, 'RIGHT');
  assert.equal(c.line, multi!.line);
});

test('postAIReview: payload matches documented schema (event=COMMENT, required body, commit_id)', async () => {
  const { octokit, calls } = makeSpyOctokit();
  const suggestions = loadSuggestions(3);
  const result = await postAIReview({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokit: octokit as any,
    owner: 'acme',
    repo: 'shop',
    prNumber: 42,
    headSha: 'deadbeefcafe1234567890abcdef0123456789ab',
    suggestions,
    model: 'openai/gpt-5',
  });

  assert.equal(result.posted, true);
  assert.equal(result.commentCount, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'pulls.createReview');

  const a = calls[0].args as Record<string, unknown>;
  assert.equal(a.owner, 'acme');
  assert.equal(a.repo, 'shop');
  assert.equal(a.pull_number, 42);
  assert.equal(a.commit_id, 'deadbeefcafe1234567890abcdef0123456789ab');
  assert.equal(a.event, 'COMMENT', 'event must be COMMENT/APPROVE/REQUEST_CHANGES');
  assert.equal(typeof a.body, 'string');
  assert.ok((a.body as string).length > 0, 'body required when event=COMMENT');
  assert.ok((a.body as string).includes('openai/gpt-5'));

  const comments = a.comments as Array<Record<string, unknown>>;
  assert.equal(comments.length, 3);
  for (const c of comments) {
    assert.equal(typeof c.path, 'string');
    assert.equal(typeof c.body, 'string');
    assert.equal(typeof c.line, 'number');
    assert.equal(c.side, 'RIGHT');
  }
});

test('postAIReview: dry-run does NOT call createReview', async () => {
  const { octokit, calls } = makeSpyOctokit();
  const suggestions = loadSuggestions(3);
  const result = await postAIReview({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokit: octokit as any,
    owner: 'acme',
    repo: 'shop',
    prNumber: 42,
    headSha: 'deadbeef',
    suggestions,
    model: 'openai/gpt-5',
    dryRun: true,
  });

  assert.equal(result.posted, false);
  assert.equal(result.commentCount, 3);
  assert.equal(calls.length, 0, 'dry-run must NOT hit octokit');
  // payload still well-formed for inspection
  assert.equal(result.payload.event, 'COMMENT');
  assert.equal(result.payload.comments.length, 3);
});

test('postAIReview: empty suggestion list skips silently', async () => {
  const { octokit, calls } = makeSpyOctokit();
  const result = await postAIReview({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokit: octokit as any,
    owner: 'acme',
    repo: 'shop',
    prNumber: 42,
    headSha: 'deadbeef',
    suggestions: [],
    model: 'openai/gpt-5',
  });

  assert.equal(result.posted, false);
  assert.equal(result.commentCount, 0);
  assert.equal(calls.length, 0);
});
