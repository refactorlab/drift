// resolvePrContext is the event-agnostic bridge between two distinct
// GitHub Actions event shapes:
//
//   • pull_request event: `context.payload.pull_request` is fully
//     populated (head.sha, base.sha, number, title, body, …).
//   • issue_comment event: the payload only has `issue.pull_request.url`;
//     action.yml fetches the rest via REST and threads the values into
//     DRIFT_PR_* env vars that the bundle reads as a fallback.
//
// A regression on EITHER branch silently dis-arms the action for that
// event type. These tests pin both code paths explicitly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { context } from '@actions/github';
import { resolvePrContext } from '../pr-context.ts';

// ─── helpers ────────────────────────────────────────────────────────────

const DRIFT_KEYS = [
  'DRIFT_PR_NUMBER',
  'DRIFT_HEAD_SHA',
  'DRIFT_BASE_SHA',
  'DRIFT_BASE_REF',
  'DRIFT_HEAD_REF',
  'DRIFT_PR_TITLE',
  'DRIFT_PR_BODY',
  'DRIFT_PR_HTML_URL',
  'DRIFT_PR_AUTHOR',
] as const;

function snapshotEnv() {
  const snap: Record<string, string | undefined> = {};
  for (const k of DRIFT_KEYS) snap[k] = process.env[k];
  return snap;
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of DRIFT_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

function clearAllPrEnv() {
  for (const k of DRIFT_KEYS) delete process.env[k];
}

type PayloadShape = typeof context.payload;
function snapshotPayload(): PayloadShape {
  // Shallow clone — the tests mutate top-level keys only.
  return { ...context.payload };
}
function restorePayload(snap: PayloadShape) {
  for (const k of Object.keys(context.payload)) {
    if (!(k in snap)) {
      delete (context.payload as Record<string, unknown>)[k];
    }
  }
  Object.assign(context.payload, snap);
}

// ─── pull_request event branch ─────────────────────────────────────────

test('resolvePrContext (pull_request): reads number/SHAs/title/body from payload', () => {
  const env = snapshotEnv();
  const pl = snapshotPayload();
  clearAllPrEnv();
  try {
    (context.payload as Record<string, unknown>).pull_request = {
      number: 42,
      head: { sha: 'h'.repeat(40), ref: 'feat/x' },
      base: { sha: 'b'.repeat(40), ref: 'main' },
      title: 'Add retry-with-backoff',
      body: 'Closes #41',
      html_url: 'https://github.com/acme/shop/pull/42',
      user: { login: 'octocat' },
    };
    const r = resolvePrContext();
    assert.ok(r, 'pull_request payload must produce a context');
    assert.equal(r!.number, 42);
    assert.equal(r!.headSha, 'h'.repeat(40));
    assert.equal(r!.baseSha, 'b'.repeat(40));
    assert.equal(r!.baseRef, 'main');
    assert.equal(r!.headRef, 'feat/x');
    assert.equal(r!.title, 'Add retry-with-backoff');
    assert.equal(r!.body, 'Closes #41');
    assert.equal(r!.htmlUrl, 'https://github.com/acme/shop/pull/42');
    assert.equal(r!.author, 'octocat');
  } finally {
    restorePayload(pl);
    restoreEnv(env);
  }
});

test('resolvePrContext (pull_request): payload-first wins over env-var fallback', () => {
  // When BOTH sources are populated, the payload's values must win
  // — the DRIFT_PR_* env vars are a FALLBACK, not an override path.
  const env = snapshotEnv();
  const pl = snapshotPayload();
  try {
    (context.payload as Record<string, unknown>).pull_request = {
      number: 100,
      head: { sha: 'payload-sha' },
    };
    process.env.DRIFT_PR_NUMBER = '999';
    process.env.DRIFT_HEAD_SHA = 'env-sha';
    const r = resolvePrContext();
    assert.equal(r?.number, 100, 'payload value must win');
    assert.equal(r?.headSha, 'payload-sha');
  } finally {
    restorePayload(pl);
    restoreEnv(env);
  }
});

test('resolvePrContext: pull_request payload without head.sha → falls through to env', () => {
  // A pull_request payload that's MISSING head.sha (incomplete event,
  // never happens in production but pinned here as a contract). The
  // resolver must NOT crash on the partial object; it must fall
  // through to the env-var fallback like issue_comment does.
  const env = snapshotEnv();
  const pl = snapshotPayload();
  clearAllPrEnv();
  try {
    (context.payload as Record<string, unknown>).pull_request = {
      number: 42,
      head: {}, // no sha
    };
    process.env.DRIFT_PR_NUMBER = '7';
    process.env.DRIFT_HEAD_SHA = 'env-bridged-sha';
    const r = resolvePrContext();
    assert.ok(r, 'must fall through to env fallback');
    assert.equal(r!.number, 7);
    assert.equal(r!.headSha, 'env-bridged-sha');
  } finally {
    restorePayload(pl);
    restoreEnv(env);
  }
});

// ─── issue_comment event branch (DRIFT_PR_* env-var fallback) ──────────

test('resolvePrContext (issue_comment): all fields land from DRIFT_PR_* env vars', () => {
  const env = snapshotEnv();
  const pl = snapshotPayload();
  // Clear any pull_request payload so we exercise the env branch.
  delete (context.payload as Record<string, unknown>).pull_request;
  try {
    process.env.DRIFT_PR_NUMBER = '99';
    process.env.DRIFT_HEAD_SHA = 'h'.repeat(40);
    process.env.DRIFT_BASE_SHA = 'b'.repeat(40);
    process.env.DRIFT_BASE_REF = 'main';
    process.env.DRIFT_HEAD_REF = 'feat/y';
    process.env.DRIFT_PR_TITLE = 'Big refactor';
    process.env.DRIFT_PR_BODY = 'Multi-line\nbody';
    process.env.DRIFT_PR_HTML_URL = 'https://github.com/acme/shop/pull/99';
    process.env.DRIFT_PR_AUTHOR = 'octocat';
    const r = resolvePrContext();
    assert.ok(r);
    assert.equal(r!.number, 99);
    assert.equal(r!.headSha, 'h'.repeat(40));
    assert.equal(r!.baseSha, 'b'.repeat(40));
    assert.equal(r!.baseRef, 'main');
    assert.equal(r!.headRef, 'feat/y');
    assert.equal(r!.title, 'Big refactor');
    assert.equal(r!.body, 'Multi-line\nbody');
    assert.equal(r!.htmlUrl, 'https://github.com/acme/shop/pull/99');
    assert.equal(r!.author, 'octocat');
  } finally {
    restorePayload(pl);
    restoreEnv(env);
  }
});

test('resolvePrContext (issue_comment): missing head sha → null (caller skips)', () => {
  const env = snapshotEnv();
  const pl = snapshotPayload();
  delete (context.payload as Record<string, unknown>).pull_request;
  clearAllPrEnv();
  try {
    process.env.DRIFT_PR_NUMBER = '99';
    // DRIFT_HEAD_SHA intentionally absent.
    const r = resolvePrContext();
    assert.equal(r, null, 'no head sha → null so callers skip');
  } finally {
    restorePayload(pl);
    restoreEnv(env);
  }
});

test('resolvePrContext (issue_comment): non-numeric PR number → null', () => {
  // action.yml's REST fallback could in theory write a garbage value
  // if the GitHub API returned unexpected JSON. The resolver MUST
  // reject NaN / negative / zero PR numbers rather than treat them
  // as 0 (which would let downstream code post to PR #0).
  const env = snapshotEnv();
  const pl = snapshotPayload();
  delete (context.payload as Record<string, unknown>).pull_request;
  clearAllPrEnv();
  try {
    process.env.DRIFT_PR_NUMBER = 'not-a-number';
    process.env.DRIFT_HEAD_SHA = 'h'.repeat(40);
    assert.equal(resolvePrContext(), null);

    process.env.DRIFT_PR_NUMBER = '0';
    assert.equal(resolvePrContext(), null, 'PR #0 is not valid');

    process.env.DRIFT_PR_NUMBER = '-5';
    assert.equal(resolvePrContext(), null, 'negative PR number is not valid');
  } finally {
    restorePayload(pl);
    restoreEnv(env);
  }
});

test('resolvePrContext (issue_comment): partial env-var set → only required fields are required', () => {
  // Only DRIFT_PR_NUMBER + DRIFT_HEAD_SHA are required. The rest
  // (title, body, refs, html_url, author) are optional metadata — if
  // they're absent, the context still resolves with `undefined`
  // values for the missing fields.
  const env = snapshotEnv();
  const pl = snapshotPayload();
  delete (context.payload as Record<string, unknown>).pull_request;
  clearAllPrEnv();
  try {
    process.env.DRIFT_PR_NUMBER = '5';
    process.env.DRIFT_HEAD_SHA = 'h'.repeat(40);
    const r = resolvePrContext();
    assert.ok(r);
    assert.equal(r!.number, 5);
    assert.equal(r!.headSha, 'h'.repeat(40));
    assert.equal(r!.baseSha, undefined);
    assert.equal(r!.baseRef, undefined);
    assert.equal(r!.title, undefined);
    assert.equal(r!.body, undefined);
    assert.equal(r!.htmlUrl, undefined);
    assert.equal(r!.author, undefined);
  } finally {
    restorePayload(pl);
    restoreEnv(env);
  }
});

test('resolvePrContext (issue_comment): EMPTY env vars are treated as absent (not "")', () => {
  // GitHub Actions sometimes serializes missing values as the empty
  // string in shell-substituted env. The resolver MUST treat "" as
  // absent — otherwise the renderer would emit a zero-length title /
  // empty hyperlink that looks broken in the sticky comment.
  const env = snapshotEnv();
  const pl = snapshotPayload();
  delete (context.payload as Record<string, unknown>).pull_request;
  clearAllPrEnv();
  try {
    process.env.DRIFT_PR_NUMBER = '5';
    process.env.DRIFT_HEAD_SHA = 'h'.repeat(40);
    process.env.DRIFT_PR_TITLE = ''; // explicit empty
    process.env.DRIFT_PR_AUTHOR = '';
    const r = resolvePrContext();
    assert.ok(r);
    assert.equal(r!.title, undefined, 'empty title must be undefined, not ""');
    assert.equal(r!.author, undefined);
  } finally {
    restorePayload(pl);
    restoreEnv(env);
  }
});

// ─── neither source populated → null ───────────────────────────────────

test('resolvePrContext: neither payload nor env → null (caller short-circuits)', () => {
  const env = snapshotEnv();
  const pl = snapshotPayload();
  delete (context.payload as Record<string, unknown>).pull_request;
  clearAllPrEnv();
  try {
    assert.equal(resolvePrContext(), null);
  } finally {
    restorePayload(pl);
    restoreEnv(env);
  }
});
