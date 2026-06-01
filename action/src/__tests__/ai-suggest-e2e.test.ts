// Subprocess E2E tests for the SHIPPED ai-suggest bundle (dist/ai-suggest.js).
//
// Drift now posts ALL code suggestions in ONE surface — the Drift sticky
// comment. The separate inline PR review (pulls.createReview) has been REMOVED.
// dist/ai-suggest.js (source: src/ai-index.ts) reads the scan report
// (DRIFT_REPORT_PATH) for the deterministic findings AND the AI envelope
// (AI_SUGGESTIONS_PATH) for the model's suggestions, filters the AI half
// against the PR diff (the SECOND filter — see ai/diff-lines.ts), caps at
// DRIFT_MAX_AI_SUGGESTIONS, MERGES the survivors into the report as
// source:'ai' code_suggestions, and UPSERTS the single sticky comment.
//
// The step only runs when DRIFT_DEFER_STICKY_COMMENT='true' (main.ts owns the
// sticky on the AI-off path); without it the step no-ops with zero HTTP calls.
//
// We point Octokit at a local stub HTTP server so we observe the EXACT REST
// traffic the bundle would put on the wire. The invariant these tests guard:
//   • EXACTLY ZERO POST to /pulls/{n}/reviews (no inline review anymore).
//   • Both the deterministic findings AND the AI-refined suggestions land in
//     the ONE sticky comment body (POST or PATCH to issues/comments).
// Catches:
//   • A bundle out of sync with src/ai-index.ts.
//   • An env-var rename that breaks AI_SUGGESTIONS_PATH / DRIFT_REPORT_PATH /
//     DRIFT_MAX_AI_SUGGESTIONS / DRIFT_AI_MODEL / DRIFT_DEFER_STICKY_COMMENT.
//   • A regression in the path-bridge: a deeper-than-diff filename in the
//     envelope must STILL merge into the sticky (the smoking-gun for bug #2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  mkdtempSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const bundle = resolve(repoRoot, 'dist/ai-suggest.js');

// A complete, valid scan report (3 code_suggestions) used as DRIFT_REPORT_PATH.
// Copied to a tmp file per test so the bundle re-renders the whole overview.
const reportFixture = resolve(here, '..', '..', '.dev', 'report.json');

/**
 * Stub server that proxies the routes ai-suggest.js hits on the sticky path:
 *   GET   /repos/{o}/{r}/pulls/{n}/files       ← fetchPrFiles (diff patches +
 *                                                 on-diff line filter)
 *   GET   /repos/{o}/{r}/issues/{n}/comments   ← findSticky (locate prior sticky)
 *   POST  /repos/{o}/{r}/issues/{n}/comments   ← create sticky (no prior)
 *   PATCH /repos/{o}/{r}/issues/comments/{id}  ← update sticky (prior exists)
 * The pulls/{n}/reviews route is intentionally still served so a regression
 * that POSTs an inline review is OBSERVED (and asserted against), not silently
 * dropped. Each request is recorded so the test can assert traffic + payload.
 */
type StubServer = {
  server: Server;
  baseUrl: string;
  requests: { method: string; url: string; body: unknown }[];
  pullsFiles: Array<{ filename: string; patch?: string }>;
  /** Prior sticky comments returned by GET issues/comments (default: none). */
  priorComments: Array<{ id: number; body: string }>;
};

async function startStubServer(
  pullsFiles: Array<{ filename: string; patch?: string }>,
  priorComments: Array<{ id: number; body: string }> = [],
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
      // findSticky: list issue comments; return the prior sticky (with marker)
      // when one is configured, else an empty list.
      if (method === 'GET' && /\/issues\/\d+\/comments/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(priorComments));
        return;
      }
      // create sticky (no prior).
      if (method === 'POST' && /\/issues\/\d+\/comments/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 9001 }));
        return;
      }
      // update sticky (prior exists).
      if (method === 'PATCH' && /\/issues\/comments\/\d+/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 9001 }));
        return;
      }
      // The REMOVED inline-review endpoint. Served so a regression is caught.
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
  return { server, baseUrl: `http://127.0.0.1:${addr.port}`, requests, pullsFiles, priorComments };
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

/** Copy the fixture report into `dir` and return its path (DRIFT_REPORT_PATH). */
function writeReport(dir: string): string {
  const path = join(dir, 'report.json');
  copyFileSync(reportFixture, path);
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

/** Env that drives the deferred-sticky path. The caller supplies the per-test
 *  paths + the stub base URL; everything else is the shared shape. */
function stickyEnv(args: {
  envelopePath: string;
  reportPath: string;
  eventPath: string;
  baseUrl: string;
  maxAi?: string;
  extra?: Record<string, string>;
}): Record<string, string> {
  return {
    AI_SUGGESTIONS_PATH: args.envelopePath,
    DRIFT_REPORT_PATH: args.reportPath,
    DRIFT_DEFER_STICKY_COMMENT: 'true',          // ← REQUIRED, else the step no-ops
    DRIFT_MAX_AI_SUGGESTIONS: args.maxAi ?? '3',
    DRIFT_AI_MODEL: 'openai/gpt-4o',
    GITHUB_TOKEN: 'test-token',
    GITHUB_API_URL: args.baseUrl,                // ← Octokit base
    GITHUB_REPOSITORY: 'owner-x/repo-y',
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_EVENT_PATH: args.eventPath,
    ...(args.extra ?? {}),
  };
}

/** The sticky never POSTs an inline review. Assert it across every test. */
function assertNoReview(stub: StubServer, prNumber: number, stdout: string): void {
  const review = stub.requests.find(
    (r) => r.method === 'POST' && new RegExp(`/pulls/${prNumber}/reviews`).test(r.url),
  );
  assert.equal(review, undefined, `pulls.createReview must NEVER be POSTed — stdout:\n${stdout}`);
}

test('ai-suggest E2E: envelope + diff + report + deferSticky → ONE sticky comment carries BOTH deterministic + AI-refined suggestions', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-'));
  // The AI suggestion anchors on a CHANGED line of a file we also return in
  // pulls/files (db.py:8 added in the patch), so it survives the diff filter
  // and merges into the report's code_suggestions as source:'ai'.
  const aiFile = 'drift-static-profiler/tests/fixtures/python-fastapi/app/db.py';
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, envelope([sample(aiFile, 8, '    fixed_a')]));
  const reportPath = writeReport(tmp);
  const eventPath = writeEvent(tmp, 42, 'head-sha-123');

  // Hunk: 7 context lines (1..7) + 1 add (line 8) → old=7 new=8, so line 8 is
  // commentable on the RIGHT side and the suggestion lands on-diff.
  const stub = await startStubServer([
    { filename: aiFile, patch: '@@ -1,7 +1,8 @@\n a\n b\n c\n d\n e\n f\n g\n+h' },
  ]);

  try {
    const result = await runBundle(stickyEnv({
      envelopePath, reportPath, eventPath, baseUrl: stub.baseUrl,
    }));

    assert.equal(result.code, 0, `subprocess failed:\n${result.stderr}\n${result.stdout}`);

    // It read the diff (to filter the AI half + reconstruct red/green), then
    // upserted the ONE sticky comment via POST issues/comments (no prior).
    const list = stub.requests.find((r) => r.method === 'GET' && /pulls\/42\/files/.test(r.url));
    const findPrior = stub.requests.find((r) => r.method === 'GET' && /issues\/42\/comments/.test(r.url));
    const post = stub.requests.find((r) => r.method === 'POST' && /issues\/42\/comments/.test(r.url));
    assert.ok(list, `listFiles call missing — stdout:\n${result.stdout}`);
    assert.ok(findPrior, `findSticky (list comments) call missing — stdout:\n${result.stdout}`);
    assert.ok(post, `sticky create (POST issues/comments) missing — stdout:\n${result.stdout}`);

    // ── The single surface carries BOTH halves ──────────────────────────────
    // Post-redesign there is NO separate "AI-refined code suggestions" block:
    // every finding (deterministic + AI) renders as ONE row in the single
    // priority table. The AI suggestion on db.py:8 merges into the report (AI
    // wins the path:line collision with the deterministic db.py:8), so the
    // heading TOTAL stays 3 and the AI finding surfaces as the db.py:8 row.
    const body = String((post!.body as Record<string, unknown>).body);
    assert.match(body, /<!-- drift:sticky-comment -->/, 'must carry the sticky marker');
    // Deterministic + AI findings share ONE "Code suggestions" section (3 total).
    assert.match(body, /Code suggestions \(3\)/, 'all findings counted in the single heading');
    // The single priority table is present …
    assert.match(body, /\| Priority \| Finding \| Location \| Confidence \|/, 'the single priority table header must be present');
    // … and the AI finding appears as a ROW: its on-diff file:line permalink at
    // its confidence (90%). fileLink renders the location as `basename:line`
    // with the full path in the permalink URL.
    assert.match(body, new RegExp(`\\[\`db\\.py:8\`\\]\\(https://github\\.com/[^)]*${aiFile.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}#L8\\)`), 'the AI finding must surface as a priority-table row with its file:line permalink');
    assert.match(body, /\[`db\.py:8`\][^|]*\| 90% \|/, 'the AI finding row carries its 90% confidence');
    // The one batched Fix-All handoff dispatches the shown findings.
    assert.match(body, /🤖 <strong>Fix-All handoff<\/strong>/, 'the single Fix-All handoff block must be present');

    // The invariant: no inline review, ever.
    assertNoReview(stub, 42, result.stdout);

    // Log surface: the AI funnel + the single-comment breadcrumb.
    assert.match(result.stdout, /openai\/gpt-4o:.*1 candidate.*1 pass quality bar.*1 on-diff.*1 AI-refined \(cap=3\)/);
    assert.match(result.stdout, /Drift sticky comment: 3 deterministic \+ 1 AI-refined/);
    assert.match(result.stdout, /Created sticky comment 9001/);
    assert.match(result.stdout, /Sticky comment refreshed with 1 AI-refined suggestion\(s\) merged in\./);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('ai-suggest E2E: deeper-than-diff envelope path → suffix-match keeps it (bug #2 regression)', async () => {
  // GitHub's listFiles returns `svc/a.py` (the shallower path) while
  // the envelope carries `monorepo/crates/svc/a.py` (the scanner's
  // path, which the model echoed verbatim). Under the OLD filterByDiff
  // (exact-match only) the AI half silently dropped to 0 on-diff. The
  // fix is the suffix-match bridge in lookupCommentable — this test
  // confirms it's actually compiled into the SHIPPED bundle, by asserting
  // the deeper-pathed suggestion still merges into the sticky.
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-deep-'));
  const deepFile = 'monorepo/crates/svc/a.py';
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, envelope([sample(deepFile, 3)]));
  const reportPath = writeReport(tmp);
  const eventPath = writeEvent(tmp, 7, 'sha-deep');

  const stub = await startStubServer([
    { filename: 'svc/a.py', patch: '@@ -1,1 +1,3 @@\n old\n+l2\n+l3' },
  ]);

  try {
    const result = await runBundle(stickyEnv({
      envelopePath, reportPath, eventPath, baseUrl: stub.baseUrl,
    }));
    assert.equal(result.code, 0, `subprocess failed:\n${result.stderr}\n${result.stdout}`);

    const post = stub.requests.find((r) => r.method === 'POST' && /issues\/7\/comments/.test(r.url));
    assert.ok(post, `sticky create missing — bundle dropped due to path mismatch?\n${result.stdout}`);
    const body = String((post!.body as Record<string, unknown>).body);

    // The suffix-match bridge MUST keep the deeper-pathed suggestion, so it
    // merges into the single priority table (no separate AI block anymore) and
    // surfaces as a ROW — carrying the model's deeper path in its permalink.
    assert.match(body, /\| Priority \| Finding \| Location \| Confidence \|/, 'the single priority table header must be present');
    assert.match(body, new RegExp(`\\[\`a\\.py:3\`\\]\\(https://github\\.com/[^)]*${deepFile.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}#L3\\)`), 'suffix-match bridge MUST keep the deeper-pathed suggestion as a priority-table row with its deeper path');

    // The "1 on-diff" log (and ZERO drops) confirms the bridge fired.
    assert.match(result.stdout, /1 on-diff.*1 AI-refined/);
    assert.ok(!/dropped 1/.test(result.stdout), `expected ZERO drops with the suffix-match bridge`);

    assertNoReview(stub, 7, result.stdout);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('ai-suggest E2E: off-diff suggestion is DROPPED with a named per-finding reason (sticky still posts)', async () => {
  // The model could echo a `line` that isn't on the diff (stale focal
  // file, hallucination, etc.). The AI half must drop it and the log must
  // NAME why — not just "0 on-diff". The sticky STILL posts the
  // deterministic findings (the AI-refined block just doesn't appear).
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-off-'));
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, envelope([
    sample('svc/a.py', 99),   // 99 is NOT on the diff
  ]));
  const reportPath = writeReport(tmp);
  const eventPath = writeEvent(tmp, 1, 'sha');

  const stub = await startStubServer([
    { filename: 'svc/a.py', patch: '@@ -1,1 +1,3 @@\n a\n+b\n+c' },
  ]);

  try {
    const result = await runBundle(stickyEnv({
      envelopePath, reportPath, eventPath, baseUrl: stub.baseUrl,
    }));
    assert.equal(result.code, 0, `subprocess failed:\n${result.stderr}\n${result.stdout}`);

    // The sticky STILL posts — deterministic-only — but with NO AI-refined block.
    const post = stub.requests.find((r) => r.method === 'POST' && /issues\/1\/comments/.test(r.url));
    assert.ok(post, `sticky create missing — deterministic findings must still post:\n${result.stdout}`);
    const body = String((post!.body as Record<string, unknown>).body);
    assert.match(body, /Code suggestions \(3\)/, 'deterministic findings must still render');
    assert.ok(!/AI-refined code suggestions/.test(body), 'no AI-refined block when nothing survives the filter');

    // The drop reason is NAMED in the log (the load-bearing improvement).
    assert.match(result.stdout, /dropped 1 suggestion\(s\)/);
    assert.match(result.stdout, /svc\/a\.py:99.*line\(s\) 99 not on diff/);
    assert.match(result.stdout, /0 on-diff.*0 AI-refined/);

    assertNoReview(stub, 1, result.stdout);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('ai-suggest E2E: DRIFT_DRY_RUN=true → builds the sticky body but does NOT POST/PATCH', async () => {
  // The dev-loop mode used by the smoke runner. Must render the EXACT same
  // sticky body as live mode (so the dry-run preview matches what production
  // would post), but never write it: NO POST/PATCH to issues/comments. The
  // GET probes (listFiles + findSticky) are fine — they're reads.
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-dry-'));
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, envelope([sample('svc/a.py', 2)]));
  const reportPath = writeReport(tmp);
  const eventPath = writeEvent(tmp, 8, 'dry-sha');

  const stub = await startStubServer([
    { filename: 'svc/a.py', patch: '@@ -1,1 +1,2 @@\n a\n+b' },
  ]);

  try {
    const result = await runBundle(stickyEnv({
      envelopePath, reportPath, eventPath, baseUrl: stub.baseUrl,
      extra: { DRIFT_DRY_RUN: 'true' },
    }));
    assert.equal(result.code, 0, `subprocess failed:\n${result.stderr}\n${result.stdout}`);

    // GET (listFiles + findSticky) is fine. But the WRITE — create (POST) or
    // update (PATCH) of the sticky — MUST be skipped.
    const write = stub.requests.find(
      (r) =>
        (r.method === 'POST' && /issues\/\d+\/comments/.test(r.url)) ||
        (r.method === 'PATCH' && /issues\/comments\/\d+/.test(r.url)),
    );
    assert.equal(write, undefined, 'dry-run must NEVER write the sticky comment');
    // The would-write preview is logged so the dev sees what'd ship.
    assert.match(result.stdout, /\[dry-run\] would upsert sticky comment/);

    assertNoReview(stub, 8, result.stdout);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('ai-suggest E2E: empty envelope file → deterministic-only sticky + log breadcrumb', async () => {
  // An empty AI envelope (the inference loop produced nothing) must NOT sink
  // the step: the sticky still posts the deterministic findings, just with no
  // AI-refined block, and the "empty" breadcrumb is logged.
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-empty-'));
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, '');
  const reportPath = writeReport(tmp);
  const eventPath = writeEvent(tmp, 1, 'sha');

  const stub = await startStubServer([]);
  try {
    const result = await runBundle(stickyEnv({
      envelopePath, reportPath, eventPath, baseUrl: stub.baseUrl,
    }));
    assert.equal(result.code, 0, `subprocess failed:\n${result.stderr}\n${result.stdout}`);

    // The "empty envelope" breadcrumb fires, and no AI block is rendered…
    assert.match(result.stdout, /AI suggestions file is empty/);
    // …but the sticky STILL posts the deterministic findings.
    const post = stub.requests.find((r) => r.method === 'POST' && /issues\/1\/comments/.test(r.url));
    assert.ok(post, `deterministic-only sticky must still post:\n${result.stdout}`);
    const body = String((post!.body as Record<string, unknown>).body);
    assert.match(body, /Code suggestions \(3\)/);
    assert.ok(!/AI-refined code suggestions/.test(body), 'no AI-refined block for an empty envelope');

    assertNoReview(stub, 1, result.stdout);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('ai-suggest E2E: DRIFT_MAX_AI_SUGGESTIONS caps the AI-refined block after the diff filter', async () => {
  // Three suggestions all on-diff but cap=2 → the AI-refined section shows 2.
  // Mirrors the action.yml flow where ai-max-suggestions limits the noise; the
  // cap counts POSTABLE (on-diff) entries, not raw.
  const tmp = mkdtempSync(join(tmpdir(), 'drift-suggest-e2e-cap-'));
  const envelopePath = join(tmp, 'envelope.json');
  writeFileSync(envelopePath, envelope([
    sample('svc/a.py', 1, 'a1'),
    sample('svc/b.py', 1, 'b1'),
    sample('svc/c.py', 1, 'c1'),
  ]));
  const reportPath = writeReport(tmp);
  const eventPath = writeEvent(tmp, 99, 'sha-cap');

  const stub = await startStubServer([
    { filename: 'svc/a.py', patch: '@@ -0,0 +1,1 @@\n+a' },
    { filename: 'svc/b.py', patch: '@@ -0,0 +1,1 @@\n+b' },
    { filename: 'svc/c.py', patch: '@@ -0,0 +1,1 @@\n+c' },
  ]);

  try {
    const result = await runBundle(stickyEnv({
      envelopePath, reportPath, eventPath, baseUrl: stub.baseUrl,
      maxAi: '2',
    }));
    assert.equal(result.code, 0, `subprocess failed:\n${result.stderr}\n${result.stdout}`);

    const post = stub.requests.find((r) => r.method === 'POST' && /issues\/99\/comments/.test(r.url));
    assert.ok(post, `sticky create missing — stdout:\n${result.stdout}`);
    const body = String((post!.body as Record<string, unknown>).body);
    // cap=2 clips the AI half BEFORE merge → only 2 of the 3 AI findings merge
    // into the single priority table. With 3 deterministic fixture findings the
    // heading TOTAL is 5 (3 det + 2 AI), and the table carries the 2 survivors
    // (a.py:1, b.py:1) as rows but NOT the capped third (c.py:1).
    assert.match(body, /Code suggestions \(5\)/, 'cap=2 → 3 deterministic + 2 AI merged = 5 in the single heading');
    assert.match(body, /\[`a\.py:1`\]\(https:\/\/github\.com\/[^)]*svc\/a\.py#L1\)/, 'first AI survivor renders as a priority-table row');
    assert.match(body, /\[`b\.py:1`\]\(https:\/\/github\.com\/[^)]*svc\/b\.py#L1\)/, 'second AI survivor renders as a priority-table row');
    assert.ok(!/svc\/c\.py#L1/.test(body), 'the capped third AI finding (c.py:1) must NOT render');
    // The funnel log: 3 candidates pass + are on-diff, but only 2 survive the cap.
    assert.match(result.stdout, /3 candidate.*3 pass.*3 on-diff.*2 AI-refined \(cap=2\)/);

    assertNoReview(stub, 99, result.stdout);
  } finally {
    await stopServer(stub.server);
    rmSync(tmp, { recursive: true, force: true });
  }
});
