// Subprocess E2E for the deterministic-review bundle (`dist/index.js`).
//
// The existing e2e.test.ts spawns this bundle with an EMPTY token, so
// the GitHub-API code path never executes. This file points Octokit at
// a local stub via GITHUB_API_URL and asserts the EXACT HTTP traffic
// the bundle issues when a token IS provided:
//
//   POST /repos/{o}/{r}/check-runs                        (createCheckRun)
//   POST /repos/{o}/{r}/pulls/{n}/reviews                 (postReview)
//   GET  /repos/{o}/{r}/issues/{n}/comments               (findSticky)
//   POST /repos/{o}/{r}/issues/{n}/comments               (sticky upsert — first run)
//   PATCH /repos/{o}/{r}/issues/comments/{id}             (sticky upsert — subsequent)
//
// This is the LAST shipped bundle without a subprocess E2E test. It's
// also the MOST USED — the deterministic review runs on every PR run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const bundle = resolve(repoRoot, 'dist/index.js');
const fixtureReport = resolve(repoRoot, 'action/.dev/report.json');

type Recorded = { method: string; url: string; body: unknown };

type StubGitHub = {
  server: Server;
  baseUrl: string;
  requests: Recorded[];
};

/**
 * Tiny stub for api.github.com. Routes the bundle's endpoints; any
 * unmatched call → 200 {} so an Octokit auto-discovery probe doesn't
 * fail noisily. Captures every request for assertion. `existingSticky`
 * controls whether findSticky finds a prior comment (so the second
 * branch — updateComment — can be exercised).
 */
async function startStub(opts: { existingSticky?: { id: number; body: string } } = {}): Promise<StubGitHub> {
  const requests: Recorded[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let buf = '';
    req.on('data', (c) => { buf += c; });
    req.on('end', () => {
      const url = req.url ?? '';
      const method = req.method ?? '';
      const body = buf ? safeJson(buf) : null;
      requests.push({ method, url, body });

      // POST /repos/{o}/{r}/check-runs
      if (method === 'POST' && /\/repos\/[^/]+\/[^/]+\/check-runs$/.test(url)) {
        json(res, 201, { id: 1001, status: 'completed' });
        return;
      }
      // POST /repos/{o}/{r}/pulls/{n}/reviews
      if (method === 'POST' && /\/repos\/[^/]+\/[^/]+\/pulls\/\d+\/reviews$/.test(url)) {
        json(res, 200, { id: 2001, state: 'COMMENTED' });
        return;
      }
      // GET /repos/{o}/{r}/issues/{n}/comments  (sticky search)
      if (method === 'GET' && /\/repos\/[^/]+\/[^/]+\/issues\/\d+\/comments/.test(url)) {
        json(res, 200, opts.existingSticky
          ? [{ id: opts.existingSticky.id, body: opts.existingSticky.body }]
          : [],
        );
        return;
      }
      // POST /repos/{o}/{r}/issues/{n}/comments (sticky create)
      if (method === 'POST' && /\/repos\/[^/]+\/[^/]+\/issues\/\d+\/comments$/.test(url)) {
        json(res, 201, { id: 3001 });
        return;
      }
      // PATCH /repos/{o}/{r}/issues/comments/{id} (sticky update)
      if (method === 'PATCH' && /\/repos\/[^/]+\/[^/]+\/issues\/comments\/\d+$/.test(url)) {
        json(res, 200, { id: 3001 });
        return;
      }
      // Catch-all for unmatched routes (Octokit's meta probe etc).
      json(res, 200, {});
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}`, requests };
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

function stopServer(s: Server): Promise<void> {
  return new Promise((rs) => s.close(() => rs()));
}

/** Spawn dist/index.js with the env action.yml would set. */
function runBundle(env: Record<string, string>): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve_, reject) => {
    if (!existsSync(bundle)) {
      reject(new Error(`bundle missing at ${bundle} — run 'npm run build'`));
      return;
    }
    const proc = spawn(process.execPath, [bundle], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c; });
    proc.stderr.on('data', (c) => { stderr += c; });
    const killTimer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`subprocess timed out — stderr: ${stderr.slice(0, 400)}`));
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

/** Setup directory with event payload + GITHUB_OUTPUT file + report. */
function setupRun(): {
  dir: string;
  eventPath: string;
  outPath: string;
  reportPath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), 'drift-idx-e2e-'));
  const eventPath = join(dir, 'event.json');
  const outPath = join(dir, 'github_output');
  const reportPath = join(dir, 'report.json');
  writeFileSync(outPath, '');
  writeFileSync(eventPath, JSON.stringify({
    pull_request: {
      number: 42,
      title: 'Speed up checkout',
      html_url: 'https://github.com/acme/shop/pull/42',
      head: { ref: 'feat/checkout', sha: 'deadbeefcafe1234567890abcdef0123456789ab' },
      base: { ref: 'main', sha: 'b'.repeat(40) },
      user: { login: 'octocat' },
    },
  }));
  copyFileSync(fixtureReport, reportPath);
  return { dir, eventPath, outPath, reportPath };
}

// ─── Tests ─────────────────────────────────────────────────────────────

test('e2e index.js: with a token + stub api → creates check, posts review, posts NEW sticky', async () => {
  const { dir, eventPath, outPath, reportPath } = setupRun();
  const stub = await startStub({}); // no existing sticky → POST createComment branch

  try {
    const result = await runBundle({
      DRIFT_REPORT_PATH: reportPath,
      DRIFT_COMMENT: 'true',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_REPOSITORY_OWNER: 'acme',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outPath,
    });
    assert.equal(result.code, 0, `subprocess failed:\n${result.stderr}\n${result.stdout}`);

    // The deterministic-review bundle must hit ALL THREE branches:
    //   • check-runs (advisory check)
    //   • pulls/N/reviews (inline scanner review)
    //   • issues/N/comments (sticky comment upsert — first-run POST)
    const verbs = stub.requests.map((r) => `${r.method} ${r.url}`);
    const checkRun = stub.requests.find((r) => r.method === 'POST' && /\/check-runs$/.test(r.url));
    const review = stub.requests.find((r) => r.method === 'POST' && /\/pulls\/42\/reviews$/.test(r.url));
    const stickyList = stub.requests.find((r) => r.method === 'GET' && /\/issues\/42\/comments/.test(r.url));
    const stickyCreate = stub.requests.find((r) => r.method === 'POST' && /\/issues\/42\/comments$/.test(r.url));

    assert.ok(checkRun, `check-runs POST missing in:\n${verbs.join('\n')}`);
    assert.ok(review, `pulls/42/reviews POST missing in:\n${verbs.join('\n')}`);
    assert.ok(stickyList, `issues/42/comments GET missing in:\n${verbs.join('\n')}`);
    assert.ok(stickyCreate, `issues/42/comments POST missing in:\n${verbs.join('\n')}`);

    // No PATCH on the first run (no existing sticky to update).
    const patches = stub.requests.filter((r) => r.method === 'PATCH');
    assert.equal(patches.length, 0, `unexpected PATCH on first run: ${patches.length}`);

    // Check-run payload shape (per GitHub REST docs).
    const checkBody = checkRun!.body as Record<string, unknown>;
    assert.equal(checkBody.head_sha, 'deadbeefcafe1234567890abcdef0123456789ab');
    assert.equal(typeof checkBody.name, 'string');
    // Advisory mode → conclusion must NOT be `failure` (DRIFT_FAILS_PR is false).
    assert.notEqual(checkBody.conclusion, 'failure', 'advisory mode must never conclude failure');

    // Sticky-comment body carries the dedupe marker so subsequent
    // runs find + update it.
    const stickyBody = stickyCreate!.body as Record<string, unknown>;
    assert.match(stickyBody.body as string, /<!-- drift:sticky-comment -->/);
    // And the drift:state blob is appended (for since-last-review deltas).
    assert.match(stickyBody.body as string, /drift:state/);
  } finally {
    await stopServer(stub.server);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('e2e index.js: prior sticky on the PR → bundle PATCHES (no duplicate comment)', async () => {
  // findSticky discovers a prior comment with the marker and the
  // bundle takes the updateComment branch. A regression here would
  // produce one sticky comment per run — a noisy, hard-to-undo UX
  // disaster on long-lived PRs.
  const { dir, eventPath, outPath, reportPath } = setupRun();
  const existingId = 555_000_001;
  const stub = await startStub({
    existingSticky: {
      id: existingId,
      // Marker MUST be present so findSticky's `.includes()` matches.
      body: '<!-- drift:sticky-comment -->\n## old body\n\n<!-- drift:state {"v":1,"overall":2.5} -->',
    },
  });

  try {
    const result = await runBundle({
      DRIFT_REPORT_PATH: reportPath,
      DRIFT_COMMENT: 'true',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outPath,
    });
    assert.equal(result.code, 0, `subprocess failed:\n${result.stderr}\n${result.stdout}`);

    // EXACTLY ONE PATCH (the sticky update). EXACTLY ZERO POSTs to
    // /issues/N/comments (which would create a second sticky).
    const patches = stub.requests.filter((r) => r.method === 'PATCH' && /\/issues\/comments\//.test(r.url));
    const stickyPosts = stub.requests.filter(
      (r) => r.method === 'POST' && /\/issues\/42\/comments$/.test(r.url),
    );
    assert.equal(patches.length, 1, `expected 1 sticky PATCH; got ${patches.length}`);
    assert.equal(stickyPosts.length, 0, `prior sticky present → MUST NOT POST a new comment`);

    // The PATCHed body carries the marker (so the next run also finds it).
    const patched = patches[0].body as Record<string, unknown>;
    assert.match(patched.body as string, /<!-- drift:sticky-comment -->/);
    // And the URL targets the existing comment id.
    assert.match(
      patches[0].url,
      new RegExp(`/issues/comments/${existingId}$`),
      'PATCH must target the prior comment id (not a hard-coded value)',
    );
  } finally {
    await stopServer(stub.server);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('e2e index.js: DRIFT_COMMENT=false → no sticky-comment HTTP traffic', async () => {
  // The consumer opt-out: when DRIFT_COMMENT=false, the bundle still
  // posts the check run + the inline review, but MUST NOT touch the
  // sticky-comment endpoints.
  const { dir, eventPath, outPath, reportPath } = setupRun();
  const stub = await startStub({});

  try {
    const result = await runBundle({
      DRIFT_REPORT_PATH: reportPath,
      DRIFT_COMMENT: 'false', // ← opt-out
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outPath,
    });
    assert.equal(result.code, 0);

    // check-runs + reviews still fire.
    assert.ok(stub.requests.find((r) => r.method === 'POST' && /check-runs/.test(r.url)));
    assert.ok(stub.requests.find((r) => r.method === 'POST' && /pulls\/42\/reviews/.test(r.url)));
    // Comments endpoints are UNTOUCHED.
    const commentTraffic = stub.requests.filter((r) => /\/issues\/(?:42\/comments|comments\/)/.test(r.url));
    assert.equal(
      commentTraffic.length,
      0,
      `DRIFT_COMMENT=false MUST skip the sticky endpoints; saw ${commentTraffic.length} call(s)`,
    );
  } finally {
    await stopServer(stub.server);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('e2e index.js: GitHub API 4xx on EVERY endpoint → exits 0 (fail-soft contract)', async () => {
  // Drift is ADVISORY. Every Octokit call is wrapped in a try/catch
  // that downgrades errors to ::warning::. If any endpoint starts
  // throwing the bundle still exits 0. Verify by making the stub
  // 403 every request.
  const { dir, eventPath, outPath, reportPath } = setupRun();
  const stub = await startStub({});
  // Replace the route handler with one that always 403s.
  stub.server.removeAllListeners('request');
  stub.server.on('request', (req: IncomingMessage, res: ServerResponse) => {
    let buf = '';
    req.on('data', (c) => { buf += c; });
    req.on('end', () => {
      stub.requests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        body: buf ? safeJson(buf) : null,
      });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Resource not accessible by integration' }));
    });
  });

  try {
    const result = await runBundle({
      DRIFT_REPORT_PATH: reportPath,
      DRIFT_COMMENT: 'true',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outPath,
    });
    // Exit 0 is the load-bearing assertion — `permissions` typos
    // produce exactly this 403 in production, and Drift must NEVER
    // sink the consumer's check on its own error.
    assert.equal(result.code, 0, `403 on every endpoint must still exit 0 — got ${result.code}:\n${result.stderr}\n${result.stdout}`);
    // The bundle tried the endpoints (then logged warnings on each).
    assert.ok(stub.requests.length > 0, 'bundle must attempt the API calls');
  } finally {
    await stopServer(stub.server);
    rmSync(dir, { recursive: true, force: true });
  }
});
