// Tracking-issue dedup + upsert shape tests. We spy on the octokit-like
// surface and assert the call payloads + dedup logic — no real API.
//
// Validated against (May 2026):
//   - https://docs.github.com/en/rest/issues/issues  (create / update / list)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertTrackingIssue, findTrackingIssue, issueMarker } from '../github/issue.ts';

type Call = { method: string; args: unknown };
type Issue = { number: number; body: string; pull_request?: object };

function makeSpyOctokit(existing: Issue[] = []) {
  const calls: Call[] = [];
  const octokit = {
    rest: {
      issues: {
        listForRepo: async (args: unknown) => {
          calls.push({ method: 'issues.listForRepo', args });
          return { data: existing };
        },
        create: async (args: unknown) => {
          calls.push({ method: 'issues.create', args });
          return { data: { number: 4242 } };
        },
        update: async (args: unknown) => {
          calls.push({ method: 'issues.update', args });
          return { data: { number: (args as { issue_number: number }).issue_number } };
        },
      },
    },
  };
  return { octokit, calls };
}

test('issueMarker is per-PR and HTML-comment shaped', () => {
  assert.equal(issueMarker(36), '<!-- drift:tracking-issue:pr-36 -->');
  assert.notEqual(issueMarker(36), issueMarker(37));
});

test('findTrackingIssue: matches the marker and drops pull requests', async () => {
  const marker = issueMarker(36);
  const existing: Issue[] = [
    { number: 10, body: 'unrelated issue' },
    { number: 11, body: `${marker}\n# old findings`, pull_request: { url: 'x' } }, // a PR — must be ignored
    { number: 12, body: `${marker}\n# the tracking issue` },
  ];
  const { octokit } = makeSpyOctokit(existing);
  const found = await findTrackingIssue(octokit as never, 'acme', 'shop', 36);
  assert.equal(found?.number, 12, 'must skip the PR (11) and find the real issue (12)');
});

test('findTrackingIssue: returns null when no marker match', async () => {
  const { octokit } = makeSpyOctokit([{ number: 10, body: 'nothing here' }]);
  assert.equal(await findTrackingIssue(octokit as never, 'acme', 'shop', 36), null);
});

test('upsertTrackingIssue: create path when none exists', async () => {
  const { octokit, calls } = makeSpyOctokit([]);
  const n = await upsertTrackingIssue({
    octokit: octokit as never,
    owner: 'acme',
    repo: 'shop',
    prNumber: 36,
    title: 'Drift findings — PR #36: cache orders',
    body: `${issueMarker(36)}\nbody`,
  });
  assert.equal(n, 4242);
  assert.equal(calls.at(-1)?.method, 'issues.create');
  const a = calls.at(-1)!.args as Record<string, unknown>;
  assert.equal(a.owner, 'acme');
  assert.equal(a.repo, 'shop');
  assert.equal(a.title, 'Drift findings — PR #36: cache orders');
  assert.ok((a.body as string).includes(issueMarker(36)));
  assert.equal(a.issue_number, undefined, 'create must not send issue_number');
});

test('upsertTrackingIssue: update path reuses the deduped issue number', async () => {
  const { octokit, calls } = makeSpyOctokit([{ number: 77, body: `${issueMarker(36)}\nold` }]);
  const n = await upsertTrackingIssue({
    octokit: octokit as never,
    owner: 'acme',
    repo: 'shop',
    prNumber: 36,
    title: 'Drift findings — PR #36',
    body: `${issueMarker(36)}\nfresh`,
  });
  assert.equal(n, 77);
  assert.equal(calls.at(-1)?.method, 'issues.update');
  const a = calls.at(-1)!.args as Record<string, unknown>;
  assert.equal(a.issue_number, 77);
  assert.ok((a.body as string).includes('fresh'));
});

test('upsertTrackingIssue: title is capped at 256 chars', async () => {
  const { octokit, calls } = makeSpyOctokit([]);
  await upsertTrackingIssue({
    octokit: octokit as never,
    owner: 'acme',
    repo: 'shop',
    prNumber: 36,
    title: 'x'.repeat(400),
    body: 'b',
  });
  const a = calls.at(-1)!.args as Record<string, unknown>;
  assert.equal((a.title as string).length, 256);
});

test('upsertTrackingIssue: existingNumber skips the lookup', async () => {
  const { octokit, calls } = makeSpyOctokit([{ number: 5, body: issueMarker(36) }]);
  await upsertTrackingIssue({
    octokit: octokit as never,
    owner: 'acme',
    repo: 'shop',
    prNumber: 36,
    title: 't',
    body: 'b',
    existingNumber: 88,
  });
  assert.ok(!calls.some((c) => c.method === 'issues.listForRepo'), 'must not list when existingNumber is given');
  assert.equal(calls.at(-1)?.method, 'issues.update');
  assert.equal((calls.at(-1)!.args as Record<string, unknown>).issue_number, 88);
});
