// Mock-octokit shape tests — verify every GitHub REST API call we make
// against the documented request-body schema for each endpoint.
//
// Validated against (May 2026):
//   - https://docs.github.com/en/rest/issues/comments
//   - https://docs.github.com/en/rest/pulls/reviews
//   - https://docs.github.com/en/rest/checks/runs
//
// We don't hit the real API; we spy on the octokit-like surface and assert
// the call payloads match what GitHub's docs require.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadReport } from '../report.ts';
import { upsertStickyComment } from '../github/comment.ts';
import { postReview } from '../github/review.ts';
import { createCheckRun } from '../github/check.ts';
import { renderOverview } from '../render/overview.ts';

// Fixtures live next to .dev/report.json so they're tracked in git and
// available on CI — `tmp/` is gitignored.
const fixtureDir = join(import.meta.dirname, '../../.dev');
const fixturePath = join(fixtureDir, 'scan-pr-output.json');

type Call = { method: string; args: unknown };

function makeSpyOctokit(opts: { existingComments?: Array<{ id: number; body: string }> } = {}) {
  const calls: Call[] = [];
  const existing = opts.existingComments ?? [];
  const octokit = {
    rest: {
      issues: {
        listComments: async (args: unknown) => {
          calls.push({ method: 'issues.listComments', args });
          return { data: existing };
        },
        createComment: async (args: unknown) => {
          calls.push({ method: 'issues.createComment', args });
          return { data: { id: 999 } };
        },
        updateComment: async (args: unknown) => {
          calls.push({ method: 'issues.updateComment', args });
          return { data: { id: (args as { comment_id: number }).comment_id } };
        },
      },
      pulls: {
        createReview: async (args: unknown) => {
          calls.push({ method: 'pulls.createReview', args });
          return { data: { id: 1 } };
        },
      },
      checks: {
        create: async (args: unknown) => {
          calls.push({ method: 'checks.create', args });
          return { data: { id: 1 } };
        },
      },
    },
  };
  return { octokit, calls };
}

// ── issues.createComment shape ──────────────────────────────────────────
test('upsertStickyComment: create path sends documented fields only', async () => {
  const { octokit, calls } = makeSpyOctokit({ existingComments: [] });
  const report = loadReport(fixturePath);
  await upsertStickyComment({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokit: octokit as any,
    owner: 'acme',
    repo: 'shop',
    prNumber: 42,
    body: renderOverview(report),
  });

  assert.equal(calls.length, 2, 'should list then create');
  assert.equal(calls[0].method, 'issues.listComments');
  assert.deepEqual(calls[0].args, { owner: 'acme', repo: 'shop', issue_number: 42, per_page: 100 });

  assert.equal(calls[1].method, 'issues.createComment');
  const a = calls[1].args as Record<string, unknown>;
  assert.equal(a.owner, 'acme');
  assert.equal(a.repo, 'shop');
  assert.equal(a.issue_number, 42);
  assert.equal(typeof a.body, 'string');
  assert.ok((a.body as string).length > 0, 'body must be non-empty');
  assert.ok((a.body as string).startsWith('<!-- drift:sticky-comment -->'));
});

// ── issues.updateComment shape ──────────────────────────────────────────
test('upsertStickyComment: update path uses comment_id when marker matches', async () => {
  const existing = [
    { id: 111, body: 'unrelated comment' },
    { id: 222, body: '<!-- drift:sticky-comment -->\n## previous body' },
  ];
  const { octokit, calls } = makeSpyOctokit({ existingComments: existing });
  await upsertStickyComment({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokit: octokit as any,
    owner: 'acme',
    repo: 'shop',
    prNumber: 42,
    body: '<!-- drift:sticky-comment -->\nfresh body',
  });

  assert.equal(calls[1].method, 'issues.updateComment');
  const a = calls[1].args as Record<string, unknown>;
  assert.equal(a.comment_id, 222);
  assert.equal(a.owner, 'acme');
  assert.equal(a.repo, 'shop');
  assert.equal(typeof a.body, 'string');
});

// ── pulls.createReview shape ────────────────────────────────────────────
test('postReview: review payload matches documented schema', async () => {
  const { octokit, calls } = makeSpyOctokit();
  const report = loadReport(fixturePath);
  await postReview({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokit: octokit as any,
    owner: 'acme',
    repo: 'shop',
    prNumber: 42,
    headSha: 'deadbeefcafe1234567890abcdef0123456789ab',
    suggestions: report.pr_review?.code_suggestions ?? [],
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'pulls.createReview');
  const a = calls[0].args as Record<string, unknown>;
  assert.equal(a.owner, 'acme');
  assert.equal(a.repo, 'shop');
  assert.equal(a.pull_number, 42);
  assert.equal(a.commit_id, 'deadbeefcafe1234567890abcdef0123456789ab');
  assert.equal(a.event, 'COMMENT', 'event must be COMMENT/APPROVE/REQUEST_CHANGES');
  assert.equal(typeof a.body, 'string', 'body required when event=COMMENT');
  assert.ok((a.body as string).length > 0);

  const comments = a.comments as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(comments) && comments.length > 0);
  for (const c of comments) {
    assert.equal(typeof c.path, 'string', 'comment.path required');
    assert.equal(typeof c.body, 'string', 'comment.body required');
    assert.equal(typeof c.line, 'number', 'comment.line should be a number');
    assert.ok((c.line as number) >= 1, 'comment.line is 1-based');
    assert.equal(c.side, 'RIGHT', 'we only ever suggest on the head side');
    // Mutex check: never send both `position` and `line` — docs warn against it.
    assert.equal(c.position, undefined, 'position must not be set when line is used');
  }
});

// ── checks.create shape ─────────────────────────────────────────────────
test('createCheckRun: payload matches documented schema', async () => {
  const { octokit, calls } = makeSpyOctokit();
  const report = loadReport(fixturePath);
  await createCheckRun({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokit: octokit as any,
    owner: 'acme',
    repo: 'shop',
    headSha: 'deadbeefcafe1234567890abcdef0123456789ab',
    report,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'checks.create');
  const a = calls[0].args as Record<string, unknown>;
  assert.equal(a.owner, 'acme');
  assert.equal(a.repo, 'shop');
  assert.equal(typeof a.name, 'string');
  assert.equal(a.head_sha, 'deadbeefcafe1234567890abcdef0123456789ab');
  assert.equal(a.status, 'completed', 'conclusion only valid when status=completed');
  // Conclusion allow-list per docs.
  assert.ok(
    ['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required'].includes(
      a.conclusion as string,
    ),
    `unexpected conclusion: ${a.conclusion}`,
  );
  const out = a.output as Record<string, unknown>;
  assert.equal(typeof out.title, 'string');
  assert.equal(typeof out.summary, 'string', 'output.summary required when output is set');
  assert.ok((out.summary as string).length > 0);
});

// ── kotlin-ktor fixture sanity-check ────────────────────────────────────
test('upsertStickyComment: kotlin-ktor fixture renders + posts cleanly', async () => {
  const { octokit, calls } = makeSpyOctokit();
  const report = loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json'));
  await upsertStickyComment({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokit: octokit as any,
    owner: 'acme',
    repo: 'shop',
    prNumber: 99,
    body: renderOverview(report),
  });
  const create = calls.find((c) => c.method === 'issues.createComment')!;
  const body = (create.args as { body: string }).body;
  assert.ok(body.includes('## 🏗 Architecture flow'));
  assert.ok(body.length < 60_000, `body too large: ${body.length}`);
});
