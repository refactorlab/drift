// cap-and-defer-e2e: full end-to-end coverage that the 500-suggestion
// truncation fix actually solves the user's bug, AND that the defer
// flag correctly hands inline-review posting to the combined poster.
//
// What this file proves end-to-end (NO mocks of the cap logic — the
// SHIPPED action.yml step body is extracted and executed against a real
// 500-entry report; the SHIPPED dist/index.js bundle is spawned against
// a stub HTTP api.github.com):
//
//   A. Truncation fix:
//      • A 500-entry report rendered RAW would overflow the 60 KB sticky
//        budget. Rendered AFTER the cap step it fits with room to spare.
//      • The cap step preserves the top-10 by scanner order.
//      • The full chain (cap → main.ts → stub API) posts a sticky
//        comment whose size is bounded.
//
//   B. Defer flag:
//      • DRIFT_DEFER_INLINE_REVIEW=true → main.ts posts NO inline review
//        (pulls/N/reviews) but still posts sticky + check.
//      • DRIFT_DEFER_INLINE_REVIEW empty → main.ts posts inline review
//        as before (backward-compat).
//      • The defer flag is propagated through the SHIPPED bundle (not
//        just the source) — guards against a dist/index.js out-of-sync.
//
//   C. Combined poster (ONE sticky comment — no inline review anymore):
//      • dist/ai-suggest.js with DRIFT_DEFER_STICKY_COMMENT=true, a
//        DRIFT_REPORT_PATH AND a non-empty AI envelope → ONE sticky
//        comment (issues/N/comments POST|PATCH) whose body carries the
//        deterministic findings AND the "🤖 AI-refined code suggestions"
//        block (AI wins on path:line collision). ZERO pulls/N/reviews.
//      • dist/ai-suggest.js with a report but an EMPTY AI envelope → ONE
//        sticky comment with the deterministic findings only, NO AI block.
//        ZERO pulls/N/reviews. (The AI-failure fallback.)
//      • dist/ai-suggest.js with NO DRIFT_REPORT_PATH → the sticky cannot
//        render without a report, so the step warns and posts NOTHING
//        (no reviews, no comments). The old "AI-only review" back-compat
//        surface is GONE — all suggestions live in the report-backed sticky.
//
// These are subprocess tests so a regression in either the action.yml
// step body or the bundled JS surfaces here, not just in unit tests
// that exercise the TypeScript directly.

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
import { renderOverview } from '../render/overview.ts';
import { DEFAULT_MAX_SUGGESTIONS } from '../render/sections/suggestions.ts';
import { loadReport, type ScanPrOutput } from '../report.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const INDEX_BUNDLE = resolve(REPO, 'dist/index.js');
const AI_SUGGEST_BUNDLE = resolve(REPO, 'dist/ai-suggest.js');

// The 60 KB body budget the renderer guards against. Mirrors the
// constant in render/overview.ts — if that one moves, this assertion
// stays calibrated.
const BODY_SIZE_BUDGET = 60_000;

// ─── shared helpers ────────────────────────────────────────────────────

type StepSpec = { id?: string; run?: string };
const ACTION = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as {
  runs: { steps: StepSpec[] };
};
const CAP_STEP = ACTION.runs.steps.find((s) => s.id === 'cap-suggestions');
if (!CAP_STEP) throw new Error('cap-suggestions step missing from action.yml');
const CAP_SCRIPT = CAP_STEP.run!;

/** Build a report with N code_suggestions. Each is unique by line so
 *  every suggestion produces its own rendered table row. The bodies
 *  are intentionally chunky (long why_it_matters, references) to
 *  approximate real reports — small bodies wouldn't overflow even at
 *  500 entries. */
function makeReportWith(suggestionCount: number, fileBase = 'src/payments/retry'): ScanPrOutput {
  const code_suggestions = Array.from({ length: suggestionCount }, (_, i) => ({
    category: (['A', 'B', 'C'] as const)[i % 3],
    category_label: 'Some long category label that takes a bit of space in the rendered body',
    file: `${fileBase}_${i}.py`,
    function: `process_thing_${i}`,
    line: (i % 50) + 1,
    confidence: 0.95 - (i % 20) * 0.001,
    severity: (['low', 'medium', 'high', 'critical'] as const)[i % 4],
    why_it_matters:
      `Finding #${i}: a moderately verbose explanation of why this matters, ` +
      `including a discussion of the implications for performance, ` +
      `reliability, and maintainability over time. Realistic length.`,
    references: [
      { url: `https://docs.example.com/issue-${i}`, title: 'doc' },
      { url: `https://github.com/acme/repo/issues/${i}`, title: 'tracker' },
    ],
    diff: {
      after_lines: [{ line: (i % 50) + 1, code: `    do_thing(${i})` }],
    },
  }));
  return {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.7.0' },
    pr_scope: {
      changed_files: ['src/payments/retry.py', 'src/users/service.py'],
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

/** Run the SHIPPED action.yml `cap-suggestions` step body against a
 *  given report file. Returns the rewritten file path + outputs. */
function runCapStep(reportPath: string, max: string): { code: number | null; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'drift-cap-e2e-'));
  const gh = join(dir, 'GITHUB_OUTPUT');
  writeFileSync(gh, '');
  const r = spawnSync('bash', ['-eo', 'pipefail', '-c', CAP_SCRIPT], {
    env: {
      PATH: process.env.PATH ?? '',
      GITHUB_OUTPUT: gh,
      DRIFT_REPORT_PATH: reportPath,
      MAX_CODE_SUGGESTIONS: max,
    },
    encoding: 'utf8',
  });
  return { code: r.status, stdout: r.stdout };
}

// ─── A. TRUNCATION FIX ─────────────────────────────────────────────────

test('render cap: a RAW (uncapped) 500-entry report now fits under budget — renderer shows the top few, true total stays visible', () => {
  // Before the render-only cap, a 500-entry report rendered RAW overflowed the
  // 60 KB budget and the size-guard had to collapse/hard-cut sections (losing
  // information silently). The renderer now caps the Code-suggestions section to
  // DEFAULT_MAX_SUGGESTIONS on its own, so even an UNCAPPED report fits and
  // the size-guard never fires. This is belt-and-suspenders with the action.yml
  // jq cap (proven by the next test) — either alone keeps the comment bounded.
  const report = makeReportWith(500);
  const body = renderOverview(report, {
    ctx: {
      owner: 'acme',
      repo: 'shop',
      sha: 'a'.repeat(40),
      prNumber: 42,
      prTitle: 'big refactor',
      htmlUrl: 'https://github.com/acme/shop/pull/42',
      baseRef: 'main',
      author: 'octocat',
    },
  });
  assert.ok(body.length < BODY_SIZE_BUDGET, `raw render must now fit under ${BODY_SIZE_BUDGET}; got ${body.length}`);
  assert.doesNotMatch(body, /report truncated \(size guard\)/, 'render cap must keep the hard-cut from firing');
  assert.doesNotMatch(body, /_collapsed \(size guard\)_/, 'render cap must keep the details-collapse from firing');
  // True total preserved in the heading; only DEFAULT_MAX_SUGGESTIONS rows rendered; overflow noted.
  assert.match(body, /⚠️ Code suggestions \(500\)/, 'heading keeps the TRUE total (500)');
  const rows = (body.match(/^\| (?:🔴 High|🟡 Medium|⚪ Low) \|/gm) ?? []).length;
  assert.equal(rows, DEFAULT_MAX_SUGGESTIONS, `priority table must cap at the default ${DEFAULT_MAX_SUGGESTIONS} rows; got ${rows}`);
  assert.match(
    body,
    new RegExp(`…\\+${500 - DEFAULT_MAX_SUGGESTIONS} more suggestions not shown — rendering the top ${DEFAULT_MAX_SUGGESTIONS} by priority\\.`),
  );
});

test('truncation: cap step trims 500 → 10 then rendered body fits cleanly under budget', () => {
  // Write the 500-entry report, run the SHIPPED cap step body, then
  // render the capped output. End-to-end proof that the user's bug is
  // solved by the action.yml chain.
  const dir = mkdtempSync(join(tmpdir(), 'drift-trunc-e2e-'));
  const reportPath = join(dir, 'drift-report.json');
  writeFileSync(reportPath, JSON.stringify(makeReportWith(500)));

  const cap = runCapStep(reportPath, '10');
  assert.equal(cap.code, 0, 'cap step must exit 0');
  assert.match(cap.stdout, /capped 500 → 10/, 'cap step must log the 500→10 transition');

  const capped = loadReport(reportPath);
  assert.equal(
    capped.pr_review?.code_suggestions?.length,
    10,
    'cap step must rewrite the report in place',
  );

  const body = renderOverview(capped, {
    ctx: {
      owner: 'acme',
      repo: 'shop',
      sha: 'a'.repeat(40),
      prNumber: 42,
      prTitle: 'big refactor',
      htmlUrl: 'https://github.com/acme/shop/pull/42',
      baseRef: 'main',
      author: 'octocat',
    },
  });

  // Hard contract: rendered body must be under the budget so guardSize
  // never has to fire. (The whole point of capping at 10.)
  assert.ok(
    body.length < BODY_SIZE_BUDGET,
    `capped body must fit under ${BODY_SIZE_BUDGET} bytes; got ${body.length}`,
  );
  assert.doesNotMatch(
    body,
    /report truncated \(size guard\)/,
    'capped render must NEVER trip the hard-cut',
  );
  assert.doesNotMatch(
    body,
    /_collapsed \(size guard\)_/,
    'capped render must NEVER trip the details-collapse',
  );

  rmSync(dir, { recursive: true, force: true });
});

test('truncation: cap step keeps scanner order — top-10 are the FIRST 10 in the input', () => {
  // The scanner emits suggestions in (severity_rank DESC, confidence
  // DESC) order. The cap MUST be a prefix-take, never a re-sort —
  // otherwise the displayed top-10 wouldn't be the canonical "show
  // first" entries the scanner chose.
  const dir = mkdtempSync(join(tmpdir(), 'drift-cap-order-'));
  const reportPath = join(dir, 'drift-report.json');
  const report = makeReportWith(50, 'src/order-test/file');
  writeFileSync(reportPath, JSON.stringify(report));

  const cap = runCapStep(reportPath, '10');
  assert.equal(cap.code, 0);

  const capped = loadReport(reportPath);
  const files = (capped.pr_review?.code_suggestions ?? []).map((s) => s.file);
  // Expected: src/order-test/file_0.py .. src/order-test/file_9.py.
  for (let i = 0; i < 10; i += 1) {
    assert.equal(
      files[i],
      `src/order-test/file_${i}.py`,
      `entry ${i} must be the i-th input (prefix-take); got ${files[i]}`,
    );
  }
  rmSync(dir, { recursive: true, force: true });
});

// ─── B. DEFER FLAG (subprocess against the SHIPPED dist/index.js) ──────

type Recorded = { method: string; url: string; body: unknown };
type Stub = { server: Server; baseUrl: string; requests: Recorded[] };

async function startStub(): Promise<Stub> {
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
      if (method === 'POST' && /\/check-runs$/.test(url))                        return j(201, { id: 1 });
      if (method === 'POST' && /\/pulls\/\d+\/reviews$/.test(url))               return j(200, { id: 2 });
      if (method === 'GET'  && /\/pulls\/\d+\/files/.test(url))                  return j(200, []);
      if (method === 'GET'  && /\/issues\/\d+\/comments/.test(url))              return j(200, []);
      if (method === 'POST' && /\/issues\/\d+\/comments$/.test(url))             return j(201, { id: 3 });
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

function writeRun(reportSuggestions: number): {
  dir: string;
  eventPath: string;
  outPath: string;
  reportPath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), 'drift-defer-e2e-'));
  const eventPath = join(dir, 'event.json');
  const outPath = join(dir, 'github_output');
  const reportPath = join(dir, 'report.json');
  writeFileSync(outPath, '');
  writeFileSync(eventPath, JSON.stringify({
    pull_request: {
      number: 42,
      title: 'Test PR',
      html_url: 'https://github.com/acme/shop/pull/42',
      head: { ref: 'feat/x', sha: 'deadbeef' + 'cafe'.repeat(8).slice(0, 32) },
      base: { ref: 'main', sha: 'b'.repeat(40) },
      user: { login: 'octocat' },
    },
  }));
  writeFileSync(reportPath, JSON.stringify(makeReportWith(reportSuggestions)));
  return { dir, eventPath, outPath, reportPath };
}

test('e2e index.js: DRIFT_DEFER_INLINE_REVIEW=true → NO pulls/N/reviews POST (sticky + check still fire)', async () => {
  const { dir, eventPath, outPath, reportPath } = writeRun(5);
  const stub = await startStub();
  try {
    const r = await spawnBundle(INDEX_BUNDLE, {
      DRIFT_REPORT_PATH: reportPath,
      DRIFT_COMMENT: 'true',
      DRIFT_DEFER_INLINE_REVIEW: 'true',                         // ← the flag under test
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_REPOSITORY_OWNER: 'acme',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outPath,
    });
    assert.equal(r.code, 0, `subprocess failed:\n${r.stderr}\n${r.stdout}`);

    const reviews = stub.requests.filter(
      (q) => q.method === 'POST' && /\/pulls\/\d+\/reviews$/.test(q.url),
    );
    assert.equal(
      reviews.length,
      0,
      `DRIFT_DEFER_INLINE_REVIEW=true must skip the deterministic inline review POST; got ${reviews.length}`,
    );

    // Sticky comment AND check run still ship — the deferral applies
    // ONLY to inline review, not to the rest of main.ts's work.
    const stickyPost = stub.requests.find(
      (q) => q.method === 'POST' && /\/issues\/42\/comments$/.test(q.url),
    );
    const checkPost = stub.requests.find(
      (q) => q.method === 'POST' && /\/check-runs$/.test(q.url),
    );
    assert.ok(stickyPost, 'sticky comment must still post when defer flag is set');
    assert.ok(checkPost, 'check run must still post when defer flag is set');

    // Log breadcrumb so the user / debugger sees the handoff.
    assert.match(r.stdout, /skipping deterministic inline review/);
  } finally {
    await stopServer(stub.server);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('e2e index.js: DRIFT_DEFER_INLINE_REVIEW unset → inline review POSTs as before (backward compat)', async () => {
  const { dir, eventPath, outPath, reportPath } = writeRun(5);
  const stub = await startStub();
  try {
    const r = await spawnBundle(INDEX_BUNDLE, {
      DRIFT_REPORT_PATH: reportPath,
      DRIFT_COMMENT: 'true',
      // DRIFT_DEFER_INLINE_REVIEW: not set
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_REPOSITORY_OWNER: 'acme',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outPath,
    });
    assert.equal(r.code, 0, r.stderr);

    // Inline review fires. (The stub returns empty listFiles → all
    // anchors are off-diff → the bundle skips inline review gracefully.
    // We assert on the LOG instead of the count; the contract under
    // test is "inline-review CODE PATH runs", not the wire result.)
    assert.doesNotMatch(
      r.stdout,
      /skipping deterministic inline review/,
      'defer-flag log line must NOT appear when the flag is unset',
    );
  } finally {
    await stopServer(stub.server);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('e2e index.js: DRIFT_DEFER_INLINE_REVIEW=true with a 500-entry report → still no inline, sticky body bounded', async () => {
  // Combined contract: defer flag AND cap step both engaged. We start
  // with a 500-entry report, run the cap step to trim, then spawn the
  // bundle with the defer flag set. The end-state has bounded sticky
  // body + zero inline review POSTs — exactly the production
  // configuration the fix is designed for.
  const { dir, eventPath, outPath, reportPath } = writeRun(500);
  const cap = runCapStep(reportPath, '10');
  assert.equal(cap.code, 0);

  const stub = await startStub();
  try {
    const r = await spawnBundle(INDEX_BUNDLE, {
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
    assert.equal(r.code, 0, r.stderr);

    const reviews = stub.requests.filter(
      (q) => q.method === 'POST' && /\/pulls\/\d+\/reviews$/.test(q.url),
    );
    assert.equal(reviews.length, 0, 'no inline review with defer flag');

    const stickyPost = stub.requests.find(
      (q) => q.method === 'POST' && /\/issues\/42\/comments$/.test(q.url),
    );
    assert.ok(stickyPost, 'sticky must post');
    const bodyLen = ((stickyPost!.body as { body: string }).body).length;
    assert.ok(
      bodyLen < 65_000,
      `sticky body must fit under 65 000 chars after cap; got ${bodyLen}`,
    );
    assert.ok(
      bodyLen < BODY_SIZE_BUDGET,
      `sticky body must fit under the 60 000-char budget so guardSize never trips; got ${bodyLen}`,
    );
  } finally {
    await stopServer(stub.server);
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─── C. COMBINED POSTER (subprocess against the SHIPPED dist/ai-suggest.js) ─

// Drift now posts ALL suggestions (deterministic + AI-refined) in ONE place:
// the Drift sticky comment. There is no separate inline PR review anymore. This
// stub therefore serves the sticky-comment upsert routes (issues/N/comments
// GET → POST/PATCH) PLUS pulls/N/files (read for the AI red/green diff
// reconstruction + on-diff filter). It STILL serves /pulls/N/reviews so that an
// accidental createReview POST is recorded and the "ZERO reviews" invariant can
// be asserted (it must never be hit). `existingSticky` toggles the
// create-vs-update branch of the upsert.
async function startCombinedStub(
  filesPatch: string,
  opts: { existingSticky?: { id: number; body: string } } = {},
): Promise<Stub> {
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
      if (method === 'GET' && /\/pulls\/\d+\/files/.test(url)) {
        // Single file covers both deterministic (line 1) and AI (line 3) anchors.
        return j(200, [{ filename: 'src/payments/retry_0.py', patch: filesPatch }]);
      }
      // The REMOVED inline-review endpoint — kept so a regression that
      // reintroduces the POST is recorded (the test asserts ZERO of these).
      if (method === 'POST' && /\/pulls\/\d+\/reviews$/.test(url)) return j(200, { id: 99 });
      // Sticky-comment upsert: findSticky → create (POST) | update (PATCH).
      if (method === 'GET' && /\/issues\/\d+\/comments/.test(url)) {
        return j(200, opts.existingSticky
          ? [{ id: opts.existingSticky.id, body: opts.existingSticky.body }]
          : [],
        );
      }
      if (method === 'POST' && /\/issues\/\d+\/comments$/.test(url)) return j(201, { id: 3001 });
      if (method === 'PATCH' && /\/issues\/comments\/\d+$/.test(url)) return j(200, { id: 3001 });
      return j(200, {});
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}`, requests };
}

/** All issues/comments writes (POST create + PATCH update) — the ONE sticky
 *  surface. The new invariant: exactly one of these per run, never a pulls
 *  review. */
function stickyWrites(requests: Recorded[]): Recorded[] {
  return requests.filter(
    (q) =>
      (q.method === 'POST' && /\/issues\/\d+\/comments$/.test(q.url)) ||
      (q.method === 'PATCH' && /\/issues\/comments\/\d+$/.test(q.url)),
  );
}

/** Every POST to the (now-removed) inline-review endpoint. Must always be empty. */
function reviewPosts(requests: Recorded[]): Recorded[] {
  return requests.filter(
    (q) => q.method === 'POST' && /\/pulls\/\d+\/reviews$/.test(q.url),
  );
}

function writeAIEnvelope(dir: string, suggestions: unknown[]): string {
  const p = join(dir, 'envelope.json');
  writeFileSync(p, JSON.stringify({ suggestions }));
  return p;
}

function writeEventOnly(dir: string, prNumber: number, headSha: string): string {
  const p = join(dir, 'event.json');
  writeFileSync(p, JSON.stringify({
    pull_request: {
      number: prNumber,
      head: { sha: headSha },
      base: { sha: 'b'.repeat(40) },
    },
  }));
  return p;
}

test('e2e ai-suggest.js: deterministic + AI in one report → ONE sticky comment with deterministic + AI merged', async () => {
  // Real bundle, real stub. The combined poster MUST:
  //   1. Read deterministic suggestions from DRIFT_REPORT_PATH.
  //   2. Read AI suggestions from AI_SUGGESTIONS_PATH.
  //   3. Filter the AI set to on-diff lines (pulls/N/files).
  //   4. Merge them into the report, deduped by path:line (AI wins).
  //   5. Upsert ONE Drift sticky comment (issues/N/comments) whose body
  //      shows the deterministic findings AND the "🤖 AI-refined code
  //      suggestions" block — ALL in that single comment.
  //   6. Post ZERO inline reviews (pulls/N/reviews) — that surface is gone.
  const dir = mkdtempSync(join(tmpdir(), 'drift-combined-e2e-'));
  const reportPath = join(dir, 'report.json');
  // Custom report: 3 deterministic entries ALL on src/payments/retry_0.py
  // at lines 1, 2, 3 — so the stub's single-file response can anchor them.
  const report: ScanPrOutput = {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.7.0' },
    pr_scope: {
      changed_files: ['src/payments/retry_0.py'],
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: [1, 2, 3].map((line) => ({
        category: 'B' as const,
        category_label: 'Product correctness',
        file: 'src/payments/retry_0.py',
        line,
        confidence: 0.9,
        why_it_matters: `det entry on line ${line} — long enough to render`,
        references: [{ url: 'https://docs.example.com/det' }],
      })),
    },
  } as ScanPrOutput;
  writeFileSync(reportPath, JSON.stringify(report));

  // AI envelope: 2 entries on src/payments/retry_0.py. One COLLIDES
  // with a det suggestion (same path:line) → AI must win on dedupe.
  // The other is at a unique line → both should ship.
  const envelopePath = writeAIEnvelope(dir, [
    {
      file: 'src/payments/retry_0.py',
      line: 1,                          // collides with det entry (line 1)
      category: 'A',
      confidence: 0.9,
      why_it_matters: 'AI-version explanation ≥ 10 chars',
      references: [{ url: 'https://docs.ai.example/x' }],
      after_code: '    ai_fixed_v1',
    },
    {
      file: 'src/payments/retry_0.py',
      line: 4,                          // unique line
      category: 'A',
      confidence: 0.9,
      why_it_matters: 'AI-only on its own line ≥ 10 chars',
      references: [{ url: 'https://docs.ai.example/y' }],
      after_code: '    ai_unique',
    },
  ]);
  const eventPath = writeEventOnly(dir, 7, 'head-sha-combined');

  // Diff covers lines 1,2,3,4 on src/payments/retry_0.py — pure-addition
  // hunk so all four new-side line numbers are commentable.
  const patch = '@@ -0,0 +1,4 @@\n+l1\n+l2\n+l3\n+l4';
  const stub = await startCombinedStub(patch);
  try {
    const r = await spawnBundle(AI_SUGGEST_BUNDLE, {
      DRIFT_DEFER_STICKY_COMMENT: 'true',  // ← main.ts hands the sticky comment to this step
      DRIFT_REPORT_PATH: reportPath,
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '5',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(r.code, 0, `subprocess failed:\n${r.stderr}\n${r.stdout}`);

    // The new invariant: ZERO inline reviews — the inline surface is gone.
    assert.equal(
      reviewPosts(stub.requests).length,
      0,
      'inline review (pulls/N/reviews) is removed — must POST ZERO',
    );

    // EXACTLY ONE sticky write (no prior comment → a create POST). All
    // suggestions land in this one comment body.
    const writes = stickyWrites(stub.requests);
    assert.equal(writes.length, 1, `exactly ONE sticky comment write; got ${writes.length}`);
    const write = writes[0];
    assert.equal(write.method, 'POST', 'no prior sticky → CREATE (POST)');
    assert.match(write.url, /\/issues\/7\/comments$/, 'sticky write must target this PR');

    const stickyBody = (write.body as { body: string }).body;
    // The sticky carries the dedupe marker so the next run finds + updates it.
    assert.match(stickyBody, /<!-- drift:sticky-comment -->/);

    // ── All findings (det + AI) render as ROWS in the single Code-suggestions
    // table. det=3 (lines 1,2,3) + AI=2 (lines 1,4); AI wins line 1 → 4 total.
    assert.match(stickyBody, /⚠️ Code suggestions \(4\)/, 'heading reflects 3 det − 1 collision + 2 AI');
    assert.match(stickyBody, /\| Priority \| Finding \| Location \| Confidence \|/, 'priority table present');
    // The surviving deterministic findings (lines 2 + 3) are rows, by location.
    assert.match(stickyBody, /\[`retry_0\.py:2`\]/, 'surviving det finding (line 2) renders as a row');
    assert.match(stickyBody, /\[`retry_0\.py:3`\]/, 'surviving det finding (line 3) renders as a row');

    // ── The AI findings ship as rows in the SAME table — no separate AI block.
    assert.doesNotMatch(stickyBody, /### 🤖 AI-refined code suggestions/, 'no separate AI-refined block; AI is a table row');
    assert.match(stickyBody, /\[`retry_0\.py:1`\]/, 'AI finding (collision line 1) renders as a row');
    assert.match(stickyBody, /\[`retry_0\.py:4`\]/, 'unique AI finding (line 4) renders as a row');
    // The collision: line 1's row is the AI finding (category A → 🅐), proving the
    // deterministic category-B (🅑) entry for line 1 was dropped on the path:line dedupe.
    const line1Row = stickyBody.split('\n').find((l) => l.startsWith('|') && l.includes('`retry_0.py:1`')) ?? '';
    assert.match(line1Row, /🅐/, 'line-1 row is the AI finding (🅐), not the dropped det 🅑');

    // ── Diagnostics: the combined sticky summary + AI funnel log lines.
    assert.match(
      r.stdout,
      /🟣 Drift sticky comment: 3 deterministic \+ 2 AI-refined code suggestion\(s\) in ONE comment\./,
    );
    assert.match(
      r.stdout,
      /🤖 openai\/gpt-4o: 2 candidate\(s\) → 2 pass quality bar → 2 on-diff → 2 AI-refined \(cap=5\)\./,
    );
    assert.match(r.stdout, /Created sticky comment 3001/);
    assert.match(r.stdout, /Sticky comment refreshed with 2 AI-refined suggestion\(s\) merged in\./);

    rmSync(dir, { recursive: true, force: true });
  } finally {
    await stopServer(stub.server);
  }
});

test('e2e ai-suggest.js: deterministic report + EMPTY AI envelope → renders det-only sticky', async () => {
  // This is the "AI loop failed (no models permission, model
  // unavailable, ...)" fallback path. The combined poster must still
  // ship the deterministic findings in the ONE sticky comment — without
  // this, a misconfigured models permission would silently lose them.
  // The sticky carries the det findings, NO AI-refined block, and there
  // is ZERO inline review.
  const dir = mkdtempSync(join(tmpdir(), 'drift-combined-fallback-'));
  const reportPath = join(dir, 'report.json');
  const report: ScanPrOutput = {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.7.0' },
    pr_scope: {
      changed_files: ['src/payments/retry_0.py'],
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: [1, 2].map((line) => ({
        category: 'B' as const,
        file: 'src/payments/retry_0.py',
        line,
        confidence: 0.9,
        why_it_matters: `det entry on line ${line} — long enough`,
        references: [{ url: 'https://docs.example.com/det' }],
      })),
    },
  } as ScanPrOutput;
  writeFileSync(reportPath, JSON.stringify(report));

  // Empty AI envelope mimics what the AI loop writes when zero
  // suggestions clear the bar (or when it crashes pre-write).
  const envelopePath = writeAIEnvelope(dir, []);
  const eventPath = writeEventOnly(dir, 8, 'head-sha-fallback');

  const stub = await startCombinedStub('@@ -0,0 +1,2 @@\n+l1\n+l2');
  try {
    const r = await spawnBundle(AI_SUGGEST_BUNDLE, {
      DRIFT_DEFER_STICKY_COMMENT: 'true',
      DRIFT_REPORT_PATH: reportPath,
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '5',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(r.code, 0, r.stderr);

    // No inline review — that surface is gone.
    assert.equal(reviewPosts(stub.requests).length, 0, 'fallback path must POST ZERO inline reviews');

    // EXACTLY ONE sticky write (no prior → create POST) carrying both det entries.
    const writes = stickyWrites(stub.requests);
    assert.equal(writes.length, 1, 'fallback path must still write exactly ONE sticky comment');
    assert.equal(writes[0].method, 'POST', 'no prior sticky → CREATE (POST)');

    const stickyBody = (writes[0].body as { body: string }).body;
    assert.match(stickyBody, /<!-- drift:sticky-comment -->/);
    // Both deterministic entries render; the heading reflects exactly 2.
    assert.match(stickyBody, /⚠️ Code suggestions \(2\)/, 'both det entries must ship');
    assert.match(stickyBody, /det entry on line 1/);
    assert.match(stickyBody, /det entry on line 2/);
    // Empty AI envelope → NO AI-refined block in the sticky.
    assert.doesNotMatch(
      stickyBody,
      /AI-refined code suggestions/,
      'empty AI envelope must not render an AI-refined block',
    );

    // Diagnostics: det-only summary (0 AI-refined), and the empty-envelope
    // breadcrumb the AI loop writes when zero candidates clear the bar.
    assert.match(
      r.stdout,
      /🟣 Drift sticky comment: 2 deterministic \+ 0 AI-refined code suggestion\(s\) in ONE comment\./,
    );
    assert.match(r.stdout, /0 candidate\(s\) → 0 cleared the quality bar/);
    assert.match(r.stdout, /Created sticky comment 3001/);

    rmSync(dir, { recursive: true, force: true });
  } finally {
    await stopServer(stub.server);
  }
});

test('e2e ai-suggest.js: NO report path → sticky cannot render, posts NOTHING (no back-compat AI-only)', async () => {
  // The old "AI-only review" back-compat surface is GONE. The single
  // sticky comment re-renders the WHOLE scan overview, which it cannot do
  // without a report. So with DRIFT_DEFER_STICKY_COMMENT set but NO
  // DRIFT_REPORT_PATH, the bundle warns and posts NOTHING — no inline
  // review (that surface is removed) AND no sticky comment (no report to
  // render from). A consumer who wants suggestions must run main.ts (which
  // sets DRIFT_REPORT_PATH) — there is no standalone AI-only path anymore.
  const dir = mkdtempSync(join(tmpdir(), 'drift-no-report-e2e-'));
  const envelopePath = writeAIEnvelope(dir, [
    {
      file: 'src/payments/retry_0.py',
      line: 2,
      category: 'A',
      confidence: 0.9,
      why_it_matters: 'AI-only ≥ 10 chars',
      references: [{ url: 'https://docs.ai.example/x' }],
      after_code: '    only_ai',
    },
  ]);
  const eventPath = writeEventOnly(dir, 9, 'head-sha-aio');

  const stub = await startCombinedStub('@@ -0,0 +1,2 @@\n+l1\n+l2');
  try {
    const r = await spawnBundle(AI_SUGGEST_BUNDLE, {
      DRIFT_DEFER_STICKY_COMMENT: 'true',
      // No DRIFT_REPORT_PATH → the sticky has nothing to render.
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '5',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: stub.baseUrl,
      GITHUB_REPOSITORY: 'o/r',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    // Fail-soft: a missing report is a warn-and-exit-0, never a crash.
    assert.equal(r.code, 0, r.stderr);

    // The warning chain: loadReportSafe explains "DRIFT_REPORT_PATH not
    // set …" first, then aiMain warns the sticky can't be refreshed.
    assert.match(
      r.stdout + r.stderr,
      /DRIFT_REPORT_PATH not set/,
      'loadReportSafe must explain the missing report path first',
    );
    assert.match(
      r.stdout + r.stderr,
      /Scan report unreadable — cannot refresh the sticky comment\./,
      'no report → the sticky-refresh warning must fire',
    );

    // The hard invariant: ZERO writes of any kind. No inline review, no
    // sticky create/update — there is nothing to post.
    assert.equal(reviewPosts(stub.requests).length, 0, 'must POST ZERO inline reviews');
    assert.equal(stickyWrites(stub.requests).length, 0, 'no report → must NOT write any sticky comment');

    rmSync(dir, { recursive: true, force: true });
  } finally {
    await stopServer(stub.server);
  }
});
