// Subprocess E2E tests for the SHIPPED ai-suggest bundle (dist/ai-suggest.js).
//
// Symmetric to ai-infer-one-e2e.test.ts: the per-suggestion loop has
// thorough subprocess coverage; the POST step did not until now. The
// bundle reads the envelope, parses it, filters against the PR diff
// (the SECOND filter — see ai/diff-lines.ts), caps at
// DRIFT_MAX_AI_SUGGESTIONS, and POSTs `pulls.createReview` to the
// GitHub API endpoint Octokit is pointed at (GITHUB_API_URL).
//
// We point Octokit at a local stub HTTP server so we observe the EXACT
// REST traffic the bundle would put on the wire. Catches:
//   • A bundle out of sync with src/ai-index.ts.
//   • An env-var rename that breaks AI_SUGGESTIONS_PATH /
//     DRIFT_MAX_AI_SUGGESTIONS / DRIFT_AI_MODEL.
//   • A POST payload-shape regression that would 422 from GitHub.
//   • A regression in the path-bridge: a deeper-than-diff filename in
//     the envelope must STILL post (the smoking-gun for bug #2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  mkdtempSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const bundle = resolve(repoRoot, 'dist/ai-suggest.js');

/**
 * Stub server that proxies the routes ai-suggest.js hits:
 *   GET  /repos/{o}/{r}/pulls/{n}/files     ← fetchCommentableLines
 *   POST /repos/{o}/{r}/pulls/{n}/reviews   ← pulls.createReview
 * Each request is recorded so the test can assert payload shape.
 */
type StubServer = {
  server: Server;
  baseUrl: string;
  requests: { method: string; url: string; body: unknown }[];
  pullsFiles: Array<{ filename: string; patch?: string }>;
};

async function startStubServer(
  pullsFiles: Array<{ filename: string; patch?: string }>,
): Promise<StubServer> {
  const requests: StubServer['requests'] = [];
  const server = createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => { chunks += c; });
    req.on('end', () => {
      const url = req.url ?? '';
      const method = req.method ?? 'GET';
      const body = chunks ? safeJson(chunks) : null;
      requests.push({ method, url, body });

      if (method === 'GET' && /\/pulls\/\d+\/files/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(pullsFiles));
        return;
      }
      if (method === 'POST' && /\/pulls\/\d+\/reviews/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 12345, state: 'COMMENTED' }));
        return;
      }
      // GitHub Models discovery / unrelated probe — Octokit may emit
      // a HEAD or a meta GET; respond 200 so it doesn't fail noisily.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}`, requests, pullsFiles };
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

function stopServer(s: Server): Promise<void> {
  return new Promise((rs) => s.close(() => rs()));
}

function runBundle(env: Record<string, string>): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve_, reject) => {
    if (!existsSync(bundle)) {
      reject(new Error(`bundle missing at ${bundle} — run 'npm run build'`));
      return;
    }
    const proc = spawn(process.execPath, [bundle], {
      cwd: env.GITHUB_WORKSPACE ?? repoRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c; });
    proc.stderr.on('data', (c) => { stderr += c; });
    const killTimer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`bundle subprocess timed out — stderr: ${stderr.slice(0, 400)}`));
    }, 30_000);
    proc.on('exit', (code) => {
      clearTimeout(killTimer);
      resolve_({ code, stdout, stderr });
    });
    proc.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
  });
}

/** Build a PR event payload that satisfies resolvePrContext + context.repo. */
function writeEvent(dir: string, prNumber: number, headSha: string): string {
  const path = join(dir, 'event.json');
  writeFileSync(path, JSON.stringify({
    pull_request: {
      number: prNumber,
      head: { sha: headSha },
      base: { sha: 'base-sha-placeholder' },
    },
  }));
  return path;
}

function envelope(sugs: unknown[]): string {
  return JSON.stringify({ suggestions: sugs });
}

const sample = (file: string, line: number, after = '    fixed') => ({
  file,
  line,
  category: 'A',
  confidence: 0.9,
  why_it_matters: 'a meaningful explanation ≥ 10 chars long',
  references: [{ url: 'https://example.com/x' }],
  after_code: after,
});

test('ai-suggest E2E: happy path — envelope + diff → ONE pulls.createReview with 2 comments', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-'));
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, envelope([
    sample('svc/a.py', 3, '    fixed_a'),
    sample('svc/b.py', 7, '    fixed_b'),
  ]));
  const eventPath = writeEvent(tmp, 42, 'head-sha-123');

  // Hunk headers MUST match the body exactly (`-old_start,old_len +new_start,new_len`):
  //   svc/a.py: 2 context lines (1,2) + 1 add (3) → old=2 new=3
  //   svc/b.py: 4 context (1..4) + 3 add (5,6,7)  → old=4 new=7
  const stub = await startStubServer([
    { filename: 'svc/a.py', patch: '@@ -1,2 +1,3 @@\n ctx\n line2\n+log_added' },
    { filename: 'svc/b.py', patch: '@@ -1,4 +1,7 @@\n a\n b\n c\n d\n+e\n+f\n+g' },
  ]);

  try {
    const result = await runBundle({
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '3',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,                  // ← Octokit base
      GITHUB_REPOSITORY: 'owner-x/repo-y',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });

    assert.equal(result.code, 0, `subprocess failed:\n${result.stderr}\n${result.stdout}`);

    // The bundle hit BOTH endpoints — listFiles to learn the diff,
    // then createReview to post the suggestions.
    const list = stub.requests.find((r) => r.method === 'GET' && /pulls\/42\/files/.test(r.url));
    const post = stub.requests.find((r) => r.method === 'POST' && /pulls\/42\/reviews/.test(r.url));
    assert.ok(list, `listFiles call missing — stdout:\n${result.stdout}`);
    assert.ok(post, `createReview call missing — stdout:\n${result.stdout}`);

    // ── EXACT payload-shape assertions for createReview ──────────────
    // GitHub 422s the whole review if any field is wrong. Pinning the
    // shape here is the only way to be sure a future refactor doesn't
    // regress the contract (the unit tests use buildReviewComments
    // directly, not the live POST).
    const body = post!.body as Record<string, unknown>;
    assert.equal(body.event, 'COMMENT', 'review event must be COMMENT (not REQUEST_CHANGES)');
    assert.equal(body.commit_id, 'head-sha-123', 'review must pin commit_id to the PR head SHA');
    assert.match(String(body.body), /openai\/gpt-4o/);
    const comments = body.comments as Array<Record<string, unknown>>;
    assert.equal(comments.length, 2, 'both quality-passing suggestions must be in the review');
    for (const c of comments) {
      assert.equal(c.side, 'RIGHT', 'inline anchor must be RIGHT side (new file)');
      assert.match(String(c.body), /```suggestion/);
    }
    assert.ok(comments.find((c) => c.path === 'svc/a.py' && c.line === 3));
    assert.ok(comments.find((c) => c.path === 'svc/b.py' && c.line === 7));

    // Log surface: the line the user actually reads in CI.
    assert.match(result.stdout, /openai\/gpt-4o:.*2 candidate.*2 pass quality bar.*2 on-diff.*2 posted/);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('ai-suggest E2E: deeper-than-diff envelope path → suffix-match keeps it (bug #2 regression)', async () => {
  // GitHub's listFiles returns `svc/a.py` (the shallower path) while
  // the envelope carries `monorepo/crates/svc/a.py` (the scanner's
  // path, which the model echoed verbatim). Under the OLD filterByDiff
  // (exact-match only) the whole review silently dropped to 0 posted.
  // The fix is the suffix-match bridge in lookupCommentable — this
  // test confirms it's actually compiled into the SHIPPED bundle.
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-deep-'));
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, envelope([
    sample('monorepo/crates/svc/a.py', 3),
  ]));
  const eventPath = writeEvent(tmp, 7, 'sha-deep');

  const stub = await startStubServer([
    { filename: 'svc/a.py', patch: '@@ -1,1 +1,3 @@\n old\n+l2\n+l3' },
  ]);

  try {
    const result = await runBundle({
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '3',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(result.code, 0, `subprocess failed:\n${result.stderr}\n${result.stdout}`);

    const post = stub.requests.find((r) => r.method === 'POST' && /pulls\/7\/reviews/.test(r.url));
    assert.ok(post, `createReview missing — bundle dropped due to path mismatch?\n${result.stdout}`);
    const comments = (post!.body as { comments: Array<Record<string, unknown>> }).comments;
    assert.equal(comments.length, 1, 'suffix-match bridge MUST keep the deeper-pathed suggestion');
    // The POSTed `path` is what the model emitted (scanner's path).
    // GitHub itself does NOT do suffix-match on the path — if it 422s
    // here that's a separate concern, but the filter must not have
    // dropped it pre-emptively.
    assert.equal(comments[0].path, 'monorepo/crates/svc/a.py');
    assert.equal(comments[0].line, 3);

    // The "0 dropped" log line confirms the bridge fired.
    assert.match(result.stdout, /1 on-diff.*1 posted/);
    assert.ok(!/dropped 1/.test(result.stdout), `expected ZERO drops with the suffix-match bridge`);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('ai-suggest E2E: off-diff suggestion is DROPPED with a named per-finding reason', async () => {
  // The model could echo a `line` that isn't on the diff (stale focal
  // file, hallucination, etc.). The post layer must drop it and the
  // log must NAME why — not just "0 posted".
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-off-'));
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, envelope([
    sample('svc/a.py', 99),   // 99 is NOT on the diff
  ]));
  const eventPath = writeEvent(tmp, 1, 'sha');

  const stub = await startStubServer([
    { filename: 'svc/a.py', patch: '@@ -1,1 +1,3 @@\n a\n+b\n+c' },
  ]);

  try {
    const result = await runBundle({
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '3',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(result.code, 0);

    // No createReview should have happened (nothing to post).
    const post = stub.requests.find((r) => r.method === 'POST' && /pulls\/1\/reviews/.test(r.url));
    assert.equal(post, undefined, 'no review must be posted when nothing survives the filter');

    // The drop reason is named in the log (the load-bearing improvement).
    assert.match(result.stdout, /dropped 1 suggestion\(s\)/);
    assert.match(result.stdout, /svc\/a\.py:99.*line\(s\) 99 not on diff/);
    assert.match(result.stdout, /No AI suggestion landed on a diff line/);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('ai-suggest E2E: DRIFT_DRY_RUN=true → builds the payload but does NOT POST', async () => {
  // The dev-loop mode used by the smoke runner. Must build the EXACT
  // same payload as live mode (so the dry-run preview matches what
  // production would post), but never hit createReview.
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-dry-'));
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, envelope([sample('svc/a.py', 2)]));
  const eventPath = writeEvent(tmp, 8, 'dry-sha');

  const stub = await startStubServer([
    { filename: 'svc/a.py', patch: '@@ -1,1 +1,2 @@\n a\n+b' },
  ]);

  try {
    const result = await runBundle({
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '3',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      DRIFT_DRY_RUN: 'true',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(result.code, 0);
    // GET (listFiles) is fine — we read the diff to filter. But the
    // POST (createReview) MUST be skipped.
    const post = stub.requests.find((r) => r.method === 'POST');
    assert.equal(post, undefined, 'dry-run must NEVER POST');
    // The would-POST preview is logged so the dev sees what'd ship.
    assert.match(result.stdout, /\[dry-run\] Would POST pulls\.createReview/);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('ai-suggest E2E: empty envelope file → graceful skip + log breadcrumb', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-empty-'));
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, '');
  const eventPath = writeEvent(tmp, 1, 'sha');

  const stub = await startStubServer([]);
  try {
    const result = await runBundle({
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '3',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(result.code, 0);
    assert.equal(stub.requests.length, 0, 'empty envelope → no API calls');
    assert.match(result.stdout, /AI suggestions file is empty/);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('ai-suggest E2E: DRIFT_MAX_AI_SUGGESTIONS caps after filter (cap counts POSTABLE, not raw)', async () => {
  // Three suggestions all on-diff but cap=2 → only 2 posted. Mirrors
  // the action.yml flow where ai-max-suggestions limits the noise.
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-cap-'));
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, envelope([
    sample('svc/a.py', 1, 'a1'),
    sample('svc/b.py', 1, 'b1'),
    sample('svc/c.py', 1, 'c1'),
  ]));
  const eventPath = writeEvent(tmp, 99, 'sha-cap');

  const stub = await startStubServer([
    { filename: 'svc/a.py', patch: '@@ -0,0 +1,1 @@\n+a' },
    { filename: 'svc/b.py', patch: '@@ -0,0 +1,1 @@\n+b' },
    { filename: 'svc/c.py', patch: '@@ -0,0 +1,1 @@\n+c' },
  ]);

  try {
    const result = await runBundle({
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '2',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(result.code, 0);
    const post = stub.requests.find((r) => r.method === 'POST');
    assert.ok(post);
    const comments = (post!.body as { comments: unknown[] }).comments;
    assert.equal(comments.length, 2, `cap=2 must clip to 2 posted; got ${comments.length}`);
    assert.match(result.stdout, /3 candidate.*3 pass.*3 on-diff.*2 posted \(cap=2\)/);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});
