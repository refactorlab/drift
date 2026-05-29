// full-chain-e2e: simulates the ENTIRE action.yml flow end-to-end as a
// real GitHub run would execute it, against a single PR.
//
// Steps reproduced in order (using the SHIPPED action.yml bodies + the
// SHIPPED dist/* bundles):
//
//   1. Scanner output → write a 500-entry report.json (simulates a heavy
//      refactor PR that previously caused the truncation bug).
//   2. action.yml "Cap code suggestions" step body → caps to 10 in place.
//   3. dist/index.js (main.ts) with DRIFT_DEFER_INLINE_REVIEW=true →
//      posts sticky + check; SKIPS deterministic inline review.
//   4. dist/ai-suggest.js (combined poster) with the same report + an AI
//      envelope → posts ONE combined review with both sets of comments.
//
// What the test asserts at the FINISH line:
//   • Exactly ONE pulls.createReview POST (proves "same comment" — not
//     two review threads in the PR conversation).
//   • That single review contains merged + deduped comments.
//   • Exactly ONE sticky comment POST (idempotent marker — proves no
//     duplicate sticky from multiple runs).
//   • Exactly ONE check-runs POST.
//   • Sticky body under the 60 KB budget (proves "no truncation").
//
// This is the test that proves THE TWO USER-REPORTED BUGS are both
// solved simultaneously, on a single PR run, with the shipped bundles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { ScanPrOutput } from '../report.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const INDEX_BUNDLE = resolve(REPO, 'dist/index.js');
const AI_SUGGEST_BUNDLE = resolve(REPO, 'dist/ai-suggest.js');
const BODY_SIZE_BUDGET = 60_000;

// Cap step body — pulled from action.yml so the test never drifts from
// the shipped step.
type StepSpec = { id?: string; run?: string };
const ACTION = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as {
  runs: { steps: StepSpec[] };
};
const CAP_SCRIPT = ACTION.runs.steps.find((s) => s.id === 'cap-suggestions')!.run!;

// ─── Big-report builder. 500 entries all anchored to ONE file so the
//     diff-stub can cover them all. The first 10 land on lines 1..10,
//     the next 490 spill over with `line = 1 + (i % 10)` (collisions
//     among themselves but not with the AI envelope). After the cap,
//     only the first 10 survive — exactly what we want to ship.
function bigReport(): ScanPrOutput {
  const code_suggestions = Array.from({ length: 500 }, (_, i) => ({
    category: (['A', 'B', 'C'] as const)[i % 3],
    category_label: 'A reasonably long category label for body bulk',
    file: 'src/big_pr/refactor.py',
    line: i < 10 ? i + 1 : 1 + (i % 10),
    confidence: 0.95 - (i % 20) * 0.001,
    severity: (['low', 'medium', 'high', 'critical'] as const)[i % 4],
    why_it_matters:
      `Finding #${i}: A moderately verbose explanation of the issue, ` +
      `including impact discussion that takes meaningful body bytes.`,
    references: [
      { url: `https://docs.example.com/issue-${i}`, title: 'docs' },
      { url: `https://github.com/acme/repo/issues/${i}`, title: 'issue' },
    ],
    diff: { after_lines: [{ line: i < 10 ? i + 1 : 1 + (i % 10), code: `    do_thing(${i})` }] },
  }));
  return {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.7.0' },
    pr_scope: {
      changed_files: ['src/big_pr/refactor.py'],
      affected_roots: ['process_payment'],
      unreachable_changes: [],
    },
    pr_review: {
      counts: { features: { value: 1, label: 'features' } },
      overall_drift: { percent: 12, direction: 'up', confidence: 'medium' },
      code_suggestions,
    },
  } as ScanPrOutput;
}

// ─── Stub api.github.com that records EVERY request. Acts as
//     authoritative diff source so the bundles can anchor inline
//     comments and as a sink for sticky/check/review POSTs.
type Recorded = { method: string; url: string; body: unknown };
type Stub = { server: Server; baseUrl: string; requests: Recorded[] };

async function startStub(filesPatch: string): Promise<Stub> {
  const requests: Recorded[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let buf = '';
    req.on('data', (c) => { buf += c; });
    req.on('end', () => {
      const url = req.url ?? '';
      const method = req.method ?? '';
      const body = buf ? safeJson(buf) : null;
      requests.push({ method, url, body });
      const j = (status: number, obj: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (method === 'POST' && /\/check-runs$/.test(url))                  return j(201, { id: 1 });
      if (method === 'POST' && /\/pulls\/\d+\/reviews$/.test(url))         return j(200, { id: 2 });
      if (method === 'GET'  && /\/pulls\/\d+\/files/.test(url)) {
        return j(200, [{ filename: 'src/big_pr/refactor.py', patch: filesPatch }]);
      }
      if (method === 'GET'  && /\/issues\/\d+\/comments/.test(url))        return j(200, []);
      if (method === 'POST' && /\/issues\/\d+\/comments$/.test(url))       return j(201, { id: 3 });
      return j(200, {});
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}`, requests };
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

function stopServer(s: Server): Promise<void> {
  return new Promise((rs) => s.close(() => rs()));
}

function spawnBundle(bundle: string, env: Record<string, string>): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((res, rej) => {
    if (!existsSync(bundle)) {
      rej(new Error(`bundle missing at ${bundle} — run 'npm run build'`));
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
    const killer = setTimeout(() => {
      proc.kill('SIGKILL');
      rej(new Error(`subprocess timed out — stderr: ${stderr.slice(0, 400)}`));
    }, 30_000);
    proc.on('exit', (c) => { clearTimeout(killer); res({ code: c, stdout, stderr }); });
    proc.on('error', (e) => { clearTimeout(killer); rej(e); });
  });
}

// ─── THE END-TO-END TEST ───────────────────────────────────────────────

test('full chain: scan(500) → cap(10) → main.ts(defer) → ai-suggest(combined) → ONE review, ONE sticky, bounded body', async () => {
  // SETUP — fresh tmp dir per run; everything lives here so we can assert
  // on the on-disk artifacts the steps produce.
  const dir = mkdtempSync(join(tmpdir(), 'drift-full-chain-'));
  const reportPath = join(dir, 'drift-report.json');
  const envelopePath = join(dir, 'ai-suggestions.json');
  const eventPath = join(dir, 'event.json');
  const outPath = join(dir, 'github_output');
  writeFileSync(outPath, '');
  writeFileSync(eventPath, JSON.stringify({
    pull_request: {
      number: 1234,
      title: 'Big refactor: clean up the payments module',
      html_url: 'https://github.com/acme/shop/pull/1234',
      head: { ref: 'feat/big-refactor', sha: 'cafe' + 'beef'.repeat(8).slice(0, 36) },
      base: { ref: 'main', sha: 'b'.repeat(40) },
      user: { login: 'octocat' },
    },
  }));

  // Step 1: scanner produces a 500-entry report.
  writeFileSync(reportPath, JSON.stringify(bigReport()));
  const sizeBeforeCap = readFileSync(reportPath, 'utf8').length;
  assert.ok(sizeBeforeCap > 100_000, `500-entry report should be large; got ${sizeBeforeCap}`);

  // Step 2: action.yml cap step trims to 10 (using the default).
  const ghOut = join(dir, 'github_output_cap');
  writeFileSync(ghOut, '');
  const cap = spawnSync('bash', ['-eo', 'pipefail', '-c', CAP_SCRIPT], {
    env: {
      PATH: process.env.PATH ?? '',
      GITHUB_OUTPUT: ghOut,
      DRIFT_REPORT_PATH: reportPath,
      MAX_CODE_SUGGESTIONS: '10',
    },
    encoding: 'utf8',
  });
  assert.equal(cap.status, 0, `cap step failed:\n${cap.stderr}`);
  assert.match(cap.stdout, /capped 500 → 10/);
  const cappedReport = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(cappedReport.pr_review.code_suggestions.length, 10);

  // Step 3: AI inference loop "writes" an envelope (we simulate this —
  // the loop itself is covered by ai-infer-one-e2e.test.ts; here we
  // just need a realistic envelope as the input to the combined poster).
  // 3 AI suggestions: one collides with a det entry (line 1), two land
  // on unique lines (lines 8, 9) that also live in the cap-survivor set
  // (which is lines 1..10 from the bigReport builder).
  writeFileSync(envelopePath, JSON.stringify({
    suggestions: [
      {
        file: 'src/big_pr/refactor.py',
        line: 1, // collides with det entry on line 1 → AI must win.
        category: 'A',
        confidence: 0.9,
        why_it_matters: 'AI patch for line 1 — meaningful and long enough',
        references: [{ url: 'https://docs.ai.example/line1' }],
        after_code: '    ai_replaces_line_1()',
      },
      {
        file: 'src/big_pr/refactor.py',
        line: 8, // unique line — both det and AI ship.
        category: 'A',
        confidence: 0.9,
        why_it_matters: 'AI patch for line 8 — meaningful and long enough',
        references: [{ url: 'https://docs.ai.example/line8' }],
        after_code: '    ai_replaces_line_8()',
      },
      {
        file: 'src/big_pr/refactor.py',
        line: 9, // unique line.
        category: 'A',
        confidence: 0.9,
        why_it_matters: 'AI patch for line 9 — meaningful and long enough',
        references: [{ url: 'https://docs.ai.example/line9' }],
        after_code: '    ai_replaces_line_9()',
      },
    ],
  }));

  // The stub's diff covers lines 1..10 — every cap-survivor anchor is
  // commentable, and every AI line is too.
  const patch =
    '@@ -0,0 +1,10 @@\n' +
    Array.from({ length: 10 }, (_, i) => `+l${i + 1}`).join('\n');
  const stub = await startStub(patch);

  try {
    // ── Step 4a: dist/index.js with DRIFT_DEFER_INLINE_REVIEW=true ──
    const mainResult = await spawnBundle(INDEX_BUNDLE, {
      DRIFT_REPORT_PATH: reportPath,
      DRIFT_COMMENT: 'true',
      DRIFT_DEFER_INLINE_REVIEW: 'true',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_REPOSITORY_OWNER: 'acme',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outPath,
    });
    assert.equal(
      mainResult.code,
      0,
      `main.ts subprocess failed:\n${mainResult.stderr}\n${mainResult.stdout}`,
    );
    // Defer flag took effect.
    assert.match(mainResult.stdout, /skipping deterministic inline review/);

    // ── Step 4b: dist/ai-suggest.js (combined poster) ──
    const aiResult = await spawnBundle(AI_SUGGEST_BUNDLE, {
      DRIFT_REPORT_PATH: reportPath,
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '5',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(
      aiResult.code,
      0,
      `ai-suggest subprocess failed:\n${aiResult.stderr}\n${aiResult.stdout}`,
    );

    // ───────────────────────────────────────────────────────────────────
    // ASSERT FINAL STATE — what a GitHub user would see on the PR.
    // ───────────────────────────────────────────────────────────────────

    // 1) EXACTLY ONE PR review (the user's bug #2: "same comment, not
    //    in other comments"). Two reviews = the bug regression.
    const reviewPosts = stub.requests.filter(
      (q) => q.method === 'POST' && /\/pulls\/\d+\/reviews$/.test(q.url),
    );
    assert.equal(
      reviewPosts.length,
      1,
      `expected exactly ONE pulls.createReview POST end-to-end; got ${reviewPosts.length} — ` +
        `defer-flag wiring or combined-poster guard regressed`,
    );

    // The single review contains BOTH deterministic and AI comments,
    // deduped on path:line (AI wins on the collision).
    const reviewBody = reviewPosts[0].body as {
      event: string;
      commit_id: string;
      body: string;
      comments: Array<{ path: string; line: number; body: string }>;
    };
    assert.equal(reviewBody.event, 'COMMENT');

    // Comments arithmetic:
    //   det = 10 cap-survivors all on src/big_pr/refactor.py.
    //         BUT the bigReport builder placed them at lines 1..10 only
    //         for the first 10 entries (which are the cap-survivors),
    //         so all 10 anchor on-diff.
    //   AI  = 3 entries (lines 1, 8, 9) — all on-diff.
    //   Dedupe: AI wins on line 1, line 8, line 9 (collisions on each).
    //         det keeps lines 2..7 + 10 = 7 entries.
    //   Total = 7 det + 3 AI = 10.
    assert.equal(
      reviewBody.comments.length,
      10,
      `expected 10 comments after dedupe (7 det + 3 AI); got ${reviewBody.comments.length}`,
    );

    // The collision lines carry AI bodies, not det.
    for (const aiLine of [1, 8, 9]) {
      const c = reviewBody.comments.find(
        (x) => x.path === 'src/big_pr/refactor.py' && x.line === aiLine,
      );
      assert.ok(c, `line ${aiLine} must be present in the merged review`);
      assert.match(c!.body, new RegExp(`AI patch for line ${aiLine}`), `AI wins on line ${aiLine}`);
    }
    // The non-colliding det lines carry det bodies.
    for (const detLine of [2, 3, 4, 5, 6, 7, 10]) {
      const c = reviewBody.comments.find(
        (x) => x.path === 'src/big_pr/refactor.py' && x.line === detLine,
      );
      assert.ok(c, `det line ${detLine} must survive dedupe`);
      assert.match(c!.body, /Finding #/, `det body at line ${detLine}`);
    }
    // Body wording reflects combined mode.
    assert.match(reviewBody.body, /Drift.*\+.*openai\/gpt-4o.*added/);

    // 2) EXACTLY ONE sticky comment POST (the user's bug #1: "report was
    //    truncated"). And the sticky body fits under the 60 KB budget.
    const stickyPosts = stub.requests.filter(
      (q) => q.method === 'POST' && /\/issues\/\d+\/comments$/.test(q.url),
    );
    assert.equal(stickyPosts.length, 1, `expected exactly ONE sticky comment POST; got ${stickyPosts.length}`);
    const stickyLen = (stickyPosts[0].body as { body: string }).body.length;
    assert.ok(
      stickyLen < BODY_SIZE_BUDGET,
      `sticky body must fit under ${BODY_SIZE_BUDGET} bytes after cap; got ${stickyLen}`,
    );
    const stickyText = (stickyPosts[0].body as { body: string }).body;
    assert.doesNotMatch(stickyText, /report truncated/, 'sticky must NOT carry the size-guard footer');
    assert.doesNotMatch(stickyText, /_collapsed \(size guard\)_/, 'sticky must NOT collapse details');

    // 3) EXACTLY ONE check-runs POST.
    const checkPosts = stub.requests.filter(
      (q) => q.method === 'POST' && /\/check-runs$/.test(q.url),
    );
    assert.equal(checkPosts.length, 1, `expected exactly ONE check-runs POST; got ${checkPosts.length}`);

    // 4) Log surface — combined-summary line is present and accurate.
    assert.match(
      aiResult.stdout,
      /combined review: 10 deterministic \+ 3 AI → 10 comment\(s\)/,
    );
  } finally {
    await stopServer(stub.server);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('full chain: ai-suggestions=false equivalent (no defer, no combined) → main.ts posts inline review itself', async () => {
  // Mirror of the happy path for the OTHER consumer config: AI off. The
  // action.yml flow then doesn't set DRIFT_DEFER_INLINE_REVIEW and step
  // 12 is skipped. Only main.ts ships everything.
  const dir = mkdtempSync(join(tmpdir(), 'drift-full-chain-ai-off-'));
  const reportPath = join(dir, 'drift-report.json');
  const eventPath = join(dir, 'event.json');
  const outPath = join(dir, 'github_output');
  writeFileSync(outPath, '');
  writeFileSync(eventPath, JSON.stringify({
    pull_request: {
      number: 555,
      title: 'Small refactor',
      html_url: 'https://github.com/acme/shop/pull/555',
      head: { ref: 'feat/small', sha: 'dead' + 'beef'.repeat(8).slice(0, 36) },
      base: { ref: 'main', sha: 'b'.repeat(40) },
      user: { login: 'octocat' },
    },
  }));
  writeFileSync(reportPath, JSON.stringify(bigReport()));

  // Cap to 10.
  const cap = spawnSync('bash', ['-eo', 'pipefail', '-c', CAP_SCRIPT], {
    env: {
      PATH: process.env.PATH ?? '',
      GITHUB_OUTPUT: join(dir, 'gh'),
      DRIFT_REPORT_PATH: reportPath,
      MAX_CODE_SUGGESTIONS: '10',
    },
    encoding: 'utf8',
  });
  assert.equal(cap.status, 0);

  const patch =
    '@@ -0,0 +1,10 @@\n' +
    Array.from({ length: 10 }, (_, i) => `+l${i + 1}`).join('\n');
  const stub = await startStub(patch);

  try {
    // main.ts WITHOUT DRIFT_DEFER_INLINE_REVIEW. ai-suggest.js is NOT
    // run — action.yml would gate it on ai-suggestions=true.
    const mainResult = await spawnBundle(INDEX_BUNDLE, {
      DRIFT_REPORT_PATH: reportPath,
      DRIFT_COMMENT: 'true',
      // No DRIFT_DEFER_INLINE_REVIEW.
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_REPOSITORY_OWNER: 'acme',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outPath,
    });
    assert.equal(mainResult.code, 0, mainResult.stderr);

    // main.ts posted its OWN inline review (the AI-off backward-compat
    // path). Still exactly one review on the PR.
    const reviewPosts = stub.requests.filter(
      (q) => q.method === 'POST' && /\/pulls\/\d+\/reviews$/.test(q.url),
    );
    assert.equal(reviewPosts.length, 1, 'AI-off: main.ts must post exactly ONE review');

    // The body shape is the deterministic-only form.
    const body = (reviewPosts[0].body as { body: string }).body;
    assert.match(body, /Drift/, 'AI-off review body carries the Drift heading');
    assert.doesNotMatch(body, /openai\//, 'AI-off review must NOT mention an AI model');

    // Sticky is bounded.
    const stickyPosts = stub.requests.filter(
      (q) => q.method === 'POST' && /\/issues\/\d+\/comments$/.test(q.url),
    );
    assert.equal(stickyPosts.length, 1);
    const stickyLen = (stickyPosts[0].body as { body: string }).body.length;
    assert.ok(stickyLen < BODY_SIZE_BUDGET, `sticky body bounded; got ${stickyLen}`);
  } finally {
    await stopServer(stub.server);
    rmSync(dir, { recursive: true, force: true });
  }
});
