// Verifies the data structures we build for the action match the
// official GitHub REST / webhook payloads — independent of the
// scanner's OpenAPI.
//
// Why this matters: the scanner's ScanPrInput.ChangedFile renames
// GitHub's `filename` to `path`. If the field names ever drift the
// Action wrapper would silently break; this test pins the conversion.
//
// API surface sourced from:
//   GET /pulls/{n}/files → "Diff Entry"
//   POST /pulls/{n}/reviews → comments[] shape
//   github.event.pull_request webhook payload
// All looked up on docs.github.com on 2026-05-26.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toChangedFile, type GitHubDiffEntry, type ReviewComment, type WebhookPullRequest } from '../contract/github.ts';
import { inputValidator } from '../contract/validator.ts';
import { buildScanPrInput } from '../contract/input.ts';

// ─── A canonical GitHub "Diff Entry" matching the API response shape ───
const sampleGitHubDiffEntry: GitHubDiffEntry = {
  sha: 'bbcd1234567890abcdef1234567890abcdef1234',
  filename: 'src/db.py',
  status: 'modified',
  additions: 12,
  deletions: 4,
  changes: 16,
  blob_url: 'https://github.com/acme/shop/blob/abc/src/db.py',
  raw_url: 'https://github.com/acme/shop/raw/abc/src/db.py',
  contents_url: 'https://api.github.com/repos/acme/shop/contents/src/db.py?ref=abc',
  patch: '@@ -42,3 +42,7 @@\n-users = session.query(User).all()',
};

test('GitHubDiffEntry → ChangedFile maps filename → path (the rename gotcha)', () => {
  const cf = toChangedFile(sampleGitHubDiffEntry);
  assert.ok(cf, 'modified file must convert');
  assert.equal(cf.path, 'src/db.py', 'filename → path rename must apply');
  assert.equal(cf.status, 'modified');
  assert.equal(cf.additions, 12);
  assert.equal(cf.sha, 'bbcd1234567890abcdef1234567890abcdef1234');
  assert.equal(cf.blob_url, sampleGitHubDiffEntry.blob_url);
});

test('GitHubDiffEntry status=removed converts to null (no AST to walk)', () => {
  const removed = { ...sampleGitHubDiffEntry, status: 'removed' as const };
  assert.equal(toChangedFile(removed), null);
});

test('Converted ChangedFile validates inside a ScanPrInput', () => {
  // Sanity loop: take a real GitHub Diff Entry, convert it, build a
  // ScanPrInput around it, and run the scanner's input validator.
  const cf = toChangedFile(sampleGitHubDiffEntry);
  assert.ok(cf);
  const input = buildScanPrInput({
    projectRoot: '/runner/work/x/y',
    changedPaths: [cf.path],
  });
  // Replace the bare path entry with the enriched one (mimicking the
  // Action's "enriched mode" wrapper code we'll write later).
  input.changed_files = [cf];

  const v = inputValidator();
  const result = v(input);
  assert.equal(
    result.ok,
    true,
    `enriched ChangedFile must validate. Errors:\n${'errors' in result ? result.errors.join('\n') : ''}`,
  );
});

// ─── Webhook pull_request payload — sanity that our type compiles ──────
test('WebhookPullRequest type matches a representative webhook payload', () => {
  // Representative payload mirroring github.event.pull_request as it
  // arrives in GITHUB_EVENT_PATH for an opened/synchronize event.
  const pr: WebhookPullRequest = {
    number: 36,
    title: 'Cache user orders',
    body: 'Closes #4421',
    html_url: 'https://github.com/acme/shop/pull/36',
    state: 'open',
    draft: false,
    user: { login: 'octocat', id: 583231 },
    head: { ref: 'feat/cache', sha: 'cafebabe0000000000000000000000000000000' },
    base: { ref: 'main', sha: 'deadbeef0000000000000000000000000000000' },
    labels: [{ name: 'perf' }],
    milestone: null,
    commits: 5,
    additions: 130,
    deletions: 22,
    changed_files: 4,
  };
  assert.equal(pr.head.sha.length, 39);  // sample-only — real SHAs are 40 chars
  assert.equal(pr.user.login, 'octocat');
  assert.equal(pr.labels?.[0].name, 'perf');
});

// ─── Review comment shape — used by github/review.ts ────────────────────
test('ReviewComment type accepts both single-line and multi-line shapes', () => {
  const singleLine: ReviewComment = {
    path: 'src/db.py',
    body: 'fix this',
    line: 42,
    side: 'RIGHT',
  };
  const multiLine: ReviewComment = {
    path: 'src/db.py',
    body: 'fix this range',
    start_line: 40,
    start_side: 'RIGHT',
    line: 45,
    side: 'RIGHT',
  };
  // Type-check only — the test passes as long as it compiles.
  assert.equal(singleLine.path, 'src/db.py');
  assert.equal(multiLine.start_line, 40);
  assert.equal(multiLine.line, 45);
});
