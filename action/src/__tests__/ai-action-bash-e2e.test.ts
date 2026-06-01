// Action.yml bash-loop simulator — the most production-faithful E2E test.
//
// All the OTHER E2E tests skip the bash glue: they invoke node directly,
// or call `inferOne` from TS. This one extracts the LITERAL bash code
// from action.yml's `ai-loop` step (the `run:` block), substitutes
// ${{ github.action_path }} → our repo root, and pipes it into `bash`.
// That makes the bash run-block ITSELF a tested surface, so a future
// edit (a typo in jq, a missing `&&`, a flag rename) fails CI here
// instead of in a consumer's PR.
//
// Topology:
//
//   action.yml ai-loop bash
//      │
//      ├── reads scanner report (jq)
//      ├── runs `node dist/ai-infer-one.js $i` for i in 0..limit-1
//      │     │
//      │     └── HTTP → stubModelsServer (Models stub)
//      │
//      └── writes envelope at $AI_OUT
//
// Then we run `dist/ai-suggest.js` (the post step) against the SAME
// envelope, pointed at a stubGitHubServer that captures the sticky-comment
// upsert (issues/comments). Two stub servers, one envelope, full path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const actionPath = repoRoot; // ${{ github.action_path }} ≡ the repo for our composite action

const aiInferBundle = resolve(repoRoot, 'dist/ai-infer-one.js');
const aiSuggestBundle = resolve(repoRoot, 'dist/ai-suggest.js');

type ModelsStub = {
  server: Server;
  baseUrl: string;
  requests: Array<{ body: unknown }>;
};
async function startModelsStub(replies: string[]): Promise<ModelsStub> {
  const requests: ModelsStub['requests'] = [];
  const remaining = [...replies];
  const server = createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => { chunks += c; });
    req.on('end', () => {
      try { requests.push({ body: JSON.parse(chunks) }); } catch { requests.push({ body: chunks }); }
      const next = remaining.shift() ?? '{"suggestions":[]}';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: next } }] }));
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}`, requests };
}

type GitHubStub = {
  server: Server;
  baseUrl: string;
  requests: Array<{ method: string; url: string; body: unknown }>;
};
async function startGitHubStub(
  files: Array<{ filename: string; patch: string }>,
): Promise<GitHubStub> {
  const requests: GitHubStub['requests'] = [];
  const server = createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => { chunks += c; });
    req.on('end', () => {
      const url = req.url ?? '';
      const method = req.method ?? 'GET';
      let body: unknown = null;
      try { body = chunks ? JSON.parse(chunks) : null; } catch { body = chunks; }
      requests.push({ method, url, body });
      if (method === 'GET' && /\/pulls\/\d+\/files/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(files));
        return;
      }
      if (method === 'POST' && /\/pulls\/\d+\/reviews/.test(url)) {
        // The old inline-review surface. The sticky-only contract NEVER hits
        // this route — we keep it serving so a regression (an accidental
        // review POST) is captured, not silently 404'd.
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 1, state: 'COMMENTED' }));
        return;
      }
      // Sticky-comment upsert routes (findSticky → create/update).
      if (method === 'GET' && /\/issues\/\d+\/comments/.test(url)) {
        // No prior sticky → create path.
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
        return;
      }
      if (method === 'POST' && /\/issues\/\d+\/comments/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 9001 }));
        return;
      }
      if (method === 'PATCH' && /\/issues\/comments\/\d+/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 9001 }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}`, requests };
}

function stopServer(s: Server): Promise<void> {
  return new Promise((rs) => s.close(() => rs()));
}

/**
 * Extract the literal `run:` block of the ai-loop step from action.yml,
 * substituting ${{ github.action_path }} with the repo root. This is
 * the production bash; running it directly proves the YAML + the
 * bundle agree on env-var names, paths, and the jq pipeline.
 */
function extractAiLoopBash(): string {
  const yaml = readFileSync(resolve(repoRoot, 'action.yml'), 'utf8');
  const parsed = parseYaml(yaml) as {
    runs: { steps: Array<{ id?: string; run?: string }> };
  };
  const step = parsed.runs.steps.find((s) => s.id === 'ai-loop');
  if (!step?.run) throw new Error('ai-loop step missing from action.yml');
  return step.run.replace(/\$\{\{\s*github\.action_path\s*\}\}/g, actionPath);
}

function runBash(script: string, env: Record<string, string>): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve_, reject) => {
    const proc = spawn('bash', ['-eu', '-c', script], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c; });
    proc.stderr.on('data', (c) => { stderr += c; });
    const killTimer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`bash subprocess timed out — stderr: ${stderr.slice(0, 400)}`));
    }, 30_000);
    proc.on('exit', (code) => { clearTimeout(killTimer); resolve_({ code, stdout, stderr }); });
    proc.on('error', (err) => { clearTimeout(killTimer); reject(err); });
  });
}

function makeRepo(
  before: Record<string, string>,
  after: Record<string, string>,
): { root: string; baseSha: string; headSha: string } {
  const root = mkdtempSync(join(tmpdir(), 'drift-bash-e2e-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  for (const [p, c] of Object.entries(before)) {
    const abs = join(root, p);
    execFileSync('mkdir', ['-p', dirname(abs)]);
    writeFileSync(abs, c);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'base'], { cwd: root });
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  for (const [p, c] of Object.entries(after)) {
    const abs = join(root, p);
    execFileSync('mkdir', ['-p', dirname(abs)]);
    writeFileSync(abs, c);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'change'], { cwd: root });
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, baseSha, headSha };
}

test('bash-e2e: the LITERAL ai-loop bash from action.yml drives the bundle correctly', async () => {
  // The killer test: extract the bash block VERBATIM from action.yml,
  // run it. If the bash typo'd a path, an env var name, or a jq filter,
  // this test fails. If the bundle ever stops reading those vars, this
  // test fails. Two seams covered with one shot.
  const { root, baseSha, headSha } = makeRepo(
    { 'app/db.py': 'def f():\n    pass\n' },
    { 'app/db.py': 'def f():\n    pass\n    log.info("X")\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['app/db.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          file: 'app/db.py',
          line: 1,
          confidence: 0.95,
          why_it_matters: 'dead-code finding, anchored at def line',
          references: [{ url: 'https://example.com/dc' }],
          diff: { before_lines: [{ line_number: 1, code: 'def f():', kind: 'del' }] },
        },
      ],
    },
  }));
  const outPath = join(root, 'ai-suggestions.json');

  const stub = await startModelsStub([
    JSON.stringify({
      suggestions: [{
        file: 'app/db.py', line: 3, category: 'A', confidence: 0.9,
        why_it_matters: 'inline fix proposed by the model',
        references: [{ url: 'https://example.com/x' }],
        after_code: '    log.info("FIXED")',
      }],
    }),
  ]);

  try {
    const bash = extractAiLoopBash();
    const result = await runBash(bash, {
      AI_OUT: outPath,
      DRIFT_REPORT_PATH: reportPath,
      AI_ENDPOINT: stub.baseUrl,
      AI_MODEL: 'openai/gpt-4o',
      AI_MAX: '3',
      AI_MAX_INPUT_TOKENS: '7000',
      AI_MAX_OUTPUT_TOKENS: '8000',
      AI_BASE_SHA: baseSha,
      AI_HEAD_SHA: headSha,
      GITHUB_TOKEN: 'test-token',
      GITHUB_WORKSPACE: root,
    });
    assert.equal(result.code, 0, `bash exited non-zero:\n${result.stderr}\n${result.stdout}`);
    // The breadcrumbs from action.yml + the bundle's diagnostics are
    // both present — the YAML's `🔁` and the bundle's `cohort`.
    assert.match(result.stdout, /🔁 1 of 1 scanner finding/);
    assert.match(result.stdout, /focal #1: app\/db\.py:1.*cohort 1\/1 anchorable/);
    assert.match(result.stdout, /focal #1: \+1 suggestion → app\/db\.py:3/);
    assert.match(result.stdout, /✅ loop done — 1 suggestion/);

    // Envelope landed where ai-suggest.js expects to read it.
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 1);
    assert.equal(env.suggestions[0].file, 'app/db.py');
    assert.equal(env.suggestions[0].line, 3);

    // Exactly one HTTP call hit the Models stub — proves the bash
    // loop ran exactly `limit` iterations (1).
    assert.equal(stub.requests.length, 1);
  } finally {
    await stopServer(stub.server);
    rmSync(root, { recursive: true, force: true });
  }
});

test('bash-e2e: zero scanner findings → bash loop runs ZERO iterations (no Models calls)', async () => {
  // The user's requirement #1, simulated at the bash level: a report
  // with empty code_suggestions[] yields total=0, limit=0, the while
  // loop body never executes. We confirm this by checking the Models
  // stub got ZERO requests AND the bundle was never spawned.
  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nb\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: { code_suggestions: [] }, // ← empty
  }));
  const outPath = join(root, 'ai-suggestions.json');

  const stub = await startModelsStub([]);
  try {
    const bash = extractAiLoopBash();
    const result = await runBash(bash, {
      AI_OUT: outPath,
      DRIFT_REPORT_PATH: reportPath,
      AI_ENDPOINT: stub.baseUrl,
      AI_MODEL: 'openai/gpt-4o',
      AI_MAX: '3',
      AI_MAX_INPUT_TOKENS: '7000',
      AI_MAX_OUTPUT_TOKENS: '8000',
      AI_BASE_SHA: baseSha,
      AI_HEAD_SHA: headSha,
      GITHUB_TOKEN: 'test-token',
      GITHUB_WORKSPACE: root,
    });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /🔁 0 of 0 scanner finding/);
    assert.match(result.stdout, /✅ loop done — 0 suggestion/);
    assert.equal(stub.requests.length, 0, 'zero findings → zero Models calls');
    // The envelope file IS created (the bash echos {"suggestions":[]} > $AI_OUT
    // before the loop) — that's the documented contract so the post
    // step has a deterministic file to read.
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.deepEqual(env, { suggestions: [] });
  } finally {
    await stopServer(stub.server);
    rmSync(root, { recursive: true, force: true });
  }
});

test('bash-e2e: AI_MAX cap clips a noisy report — 5 findings, cap=2 → 2 inference calls', async () => {
  // The user said: "iterates for the top 3 code suggestion". This is
  // the cap surface — verify the bash respects AI_MAX (the action's
  // ai-max-suggestions input) even when total > AI_MAX.
  const before: Record<string, string> = {};
  const after: Record<string, string> = {};
  for (let i = 0; i < 5; i += 1) {
    before[`f${i}.py`] = 'a\n';
    after[`f${i}.py`] = `a\nADD_${i}\n`;
  }
  const { root, baseSha, headSha } = makeRepo(before, after);
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: Object.keys(after),
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: Array.from({ length: 5 }, (_, i) => ({
        category: 'A',
        file: `f${i}.py`,
        line: 1,
        confidence: 0.9 - i * 0.01,
        why_it_matters: `finding number ${i} — load-bearing message ≥ 10 chars`,
        references: [{ url: `https://example.com/r/${i}` }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      })),
    },
  }));
  const outPath = join(root, 'ai-suggestions.json');

  const stub = await startModelsStub(
    Array.from({ length: 5 }, (_, i) => JSON.stringify({
      suggestions: [{
        file: `f${i}.py`, line: 2, category: 'A', confidence: 0.9,
        why_it_matters: 'capped-test stub reply, plenty long',
        references: [{ url: 'https://example.com/x' }],
        after_code: '    ok',
      }],
    })),
  );

  try {
    const bash = extractAiLoopBash();
    const result = await runBash(bash, {
      AI_OUT: outPath,
      DRIFT_REPORT_PATH: reportPath,
      AI_ENDPOINT: stub.baseUrl,
      AI_MODEL: 'openai/gpt-4o',
      AI_MAX: '2', // ← cap
      AI_MAX_INPUT_TOKENS: '7000',
      AI_MAX_OUTPUT_TOKENS: '8000',
      AI_BASE_SHA: baseSha,
      AI_HEAD_SHA: headSha,
      GITHUB_TOKEN: 'test-token',
      GITHUB_WORKSPACE: root,
    });
    assert.equal(result.code, 0, `bash failed:\n${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /🔁 2 of 5 scanner finding/);
    assert.equal(stub.requests.length, 2, 'Models stub must see exactly AI_MAX requests');

    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 2, 'envelope capped at AI_MAX');
  } finally {
    await stopServer(stub.server);
    rmSync(root, { recursive: true, force: true });
  }
});

test('bash-e2e: 3 findings → loop produces 3 + post step posts ONE sticky comment via GitHub stub', async () => {
  // The whole chain through bash AND the post bundle. Two stub servers,
  // one envelope file. End-to-end proof that the user's PR-log scenario
  // produces a single Drift sticky comment carrying the 3 AI-refined
  // suggestions — and NEVER the old inline pulls/reviews surface.
  if (!existsSync(aiInferBundle) || !existsSync(aiSuggestBundle)) {
    return; // smoke skip if dist isn't built
  }

  const { root, baseSha, headSha } = makeRepo(
    {
      'app/db.py': 'def f():\n    pass\n',
      'app/repos.py': 'def g():\n    pass\n',
    },
    {
      // db.py adds TWO changed lines (3 and 4) so its two AI suggestions can
      // anchor on DISTINCT on-diff lines — otherwise the sticky renderer
      // dedupes same-path:line AI blocks and only one would survive.
      'app/db.py': 'def f():\n    pass\n    log.info("A")\n    log.info("A2")\n',
      'app/repos.py': 'def g():\n    pass\n    log.info("B")\n',
    },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: ['app/db.py', 'app/repos.py'],
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: [
        {
          category: 'A', file: 'app/db.py', line: 1, confidence: 0.95,
          why_it_matters: 'dead-code finding for db.py (≥10 chars)',
          references: [{ url: 'https://example.com/dc-db' }],
          diff: { before_lines: [{ line_number: 1, code: 'def f():', kind: 'del' }] },
        },
        {
          category: 'A', file: 'app/db.py', line: 1, confidence: 0.9,
          why_it_matters: 'second dead-code finding for db.py same line',
          references: [{ url: 'https://example.com/dc-db-2' }],
          diff: { before_lines: [{ line_number: 1, code: 'def f():', kind: 'del' }] },
        },
        {
          category: 'A', file: 'app/repos.py', line: 1, confidence: 0.85,
          why_it_matters: 'dead-code finding for repos.py (≥10 chars)',
          references: [{ url: 'https://example.com/dc-repos' }],
          diff: { before_lines: [{ line_number: 1, code: 'def g():', kind: 'del' }] },
        },
      ],
    },
  }));
  const outPath = join(root, 'ai-suggestions.json');

  // Models stub → ai-infer-one.js
  const modelsStub = await startModelsStub([
    JSON.stringify({
      suggestions: [{ file: 'app/db.py', line: 3, category: 'A', confidence: 0.9,
        why_it_matters: 'db.py first fix, load-bearing message',
        references: [{ url: 'https://example.com/x' }],
        after_code: '    log.info("FIXED_1")' }],
    }),
    JSON.stringify({
      suggestions: [{ file: 'app/db.py', line: 4, category: 'A', confidence: 0.88,
        why_it_matters: 'db.py second fix, load-bearing message',
        references: [{ url: 'https://example.com/x2' }],
        after_code: '    log.info("FIXED_2")' }],
    }),
    JSON.stringify({
      suggestions: [{ file: 'app/repos.py', line: 3, category: 'A', confidence: 0.85,
        why_it_matters: 'repos.py fix, load-bearing message',
        references: [{ url: 'https://example.com/x3' }],
        after_code: '    log.info("FIXED_3")' }],
    }),
  ]);

  // GitHub stub → ai-suggest.js
  const githubStub = await startGitHubStub([
    { filename: 'app/db.py', patch: '@@ -1,2 +1,4 @@\n def f():\n     pass\n+    log.info("A")\n+    log.info("A2")' },
    { filename: 'app/repos.py', patch: '@@ -1,2 +1,3 @@\n def g():\n     pass\n+    log.info("B")' },
  ]);

  const eventPath = join(root, 'event.json');
  writeFileSync(eventPath, JSON.stringify({
    pull_request: { number: 7, head: { sha: headSha }, base: { sha: baseSha } },
  }));

  try {
    // ── Phase 1: bash from action.yml → fills the envelope ─────────────
    const bash = extractAiLoopBash();
    const r1 = await runBash(bash, {
      AI_OUT: outPath,
      DRIFT_REPORT_PATH: reportPath,
      AI_ENDPOINT: modelsStub.baseUrl,
      AI_MODEL: 'openai/gpt-4o',
      AI_MAX: '3',
      AI_MAX_INPUT_TOKENS: '7000',
      AI_MAX_OUTPUT_TOKENS: '8000',
      AI_BASE_SHA: baseSha,
      AI_HEAD_SHA: headSha,
      GITHUB_TOKEN: 'test-token',
      GITHUB_WORKSPACE: root,
    });
    assert.equal(r1.code, 0, `phase-1 bash failed:\n${r1.stderr}\n${r1.stdout}`);
    assert.match(r1.stdout, /🔁 3 of 3 scanner finding/);
    assert.equal(modelsStub.requests.length, 3);

    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 3, 'phase-1 must write 3 suggestions to the envelope');

    // ── Phase 2: ai-suggest.js (post step) → upserts the sticky ────────
    // Mirrors the action.yml step `node ${{ github.action_path }}/dist/ai-suggest.js`.
    // The post step now OWNS the single Drift sticky comment: it requires
    // DRIFT_DEFER_STICKY_COMMENT + DRIFT_REPORT_PATH, merges the on-diff AI
    // suggestions into the report, and upserts ONE issues/comments body.
    const postResult = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve_, reject) => {
        const proc = spawn(process.execPath, [aiSuggestBundle], {
          env: {
            ...process.env,
            DRIFT_DEFER_STICKY_COMMENT: 'true',
            DRIFT_REPORT_PATH: reportPath,
            AI_SUGGESTIONS_PATH: outPath,
            DRIFT_MAX_AI_SUGGESTIONS: '3',
            DRIFT_AI_MODEL: 'openai/gpt-4o',
            GITHUB_TOKEN: 'test-token',
            GITHUB_API_URL: githubStub.baseUrl,
            GITHUB_REPOSITORY: 'o/r',
            GITHUB_EVENT_NAME: 'pull_request',
            GITHUB_EVENT_PATH: eventPath,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (c) => { stdout += c; });
        proc.stderr.on('data', (c) => { stderr += c; });
        proc.on('exit', (code) => resolve_({ code, stdout, stderr }));
        proc.on('error', reject);
      },
    );
    assert.equal(postResult.code, 0, `phase-2 post failed:\n${postResult.stderr}\n${postResult.stdout}`);

    // ── Final assertions: ONE sticky comment, ZERO inline reviews ─────
    // The post step still fetches the diff (to anchor + filter AI suggestions),
    // reads the sticky list (findSticky), then creates the single comment.
    const list = githubStub.requests.find((r) => r.method === 'GET' && /\/pulls\/7\/files/.test(r.url));
    assert.ok(list, 'phase-2 must fetch pulls/7/files');

    // The NEW invariant: the inline-review surface is dead. EXACTLY ZERO
    // POSTs to /pulls/{n}/reviews.
    const reviewPosts = githubStub.requests.filter(
      (r) => r.method === 'POST' && /\/pulls\/\d+\/reviews/.test(r.url),
    );
    assert.equal(reviewPosts.length, 0, 'sticky-only contract: ZERO pulls/reviews POST');

    // EXACTLY ONE sticky write — no prior sticky in the stub → a create.
    const stickyWrites = githubStub.requests.filter(
      (r) =>
        (r.method === 'POST' && /\/issues\/\d+\/comments/.test(r.url)) ||
        (r.method === 'PATCH' && /\/issues\/comments\/\d+/.test(r.url)),
    );
    assert.equal(stickyWrites.length, 1, 'all 3 suggestions land in ONE sticky comment write');
    const sticky = stickyWrites[0];
    assert.equal(sticky.method, 'POST', 'no prior sticky → create (POST)');
    assert.match(sticky.url, /\/issues\/7\/comments/, 'sticky upsert targets PR #7 issue comments');

    // The single body carries the sticky marker AND all 3 AI-refined fixes.
    // Post-redesign there is NO separate AI block and NO per-finding diff (so
    // the model's `after_code` FIXED_1/2/3 no longer renders). Every finding —
    // deterministic + AI — is ONE row in the single priority table. The 3 AI
    // findings land on distinct on-diff lines (db.py:3, db.py:4, repos.py:3),
    // merge into the report, and surface as 3 rows (2 deterministic dead-code
    // findings dedupe to db.py:1 + repos.py:1 → heading TOTAL is 5).
    const body = sticky.body as Record<string, unknown>;
    const text = String(body.body ?? '');
    assert.match(text, /<!-- drift:sticky-comment -->/, 'sticky marker present');
    assert.match(text, /Code suggestions \(5\)/, 'deterministic + all 3 AI findings counted in the single heading');
    assert.match(text, /\| Priority \| Finding \| Location \| Confidence \|/, 'the single priority table header must be present');
    // All 3 AI findings surface as priority-table rows (file:line permalinks).
    assert.match(text, /\[`db\.py:3`\]\(https:\/\/github\.com\/[^)]*app\/db\.py#L3\)/, 'AI finding db.py:3 surfaced as a row');
    assert.match(text, /\[`db\.py:4`\]\(https:\/\/github\.com\/[^)]*app\/db\.py#L4\)/, 'AI finding db.py:4 surfaced as a row');
    assert.match(text, /\[`repos\.py:3`\]\(https:\/\/github\.com\/[^)]*app\/repos\.py#L3\)/, 'AI finding repos.py:3 surfaced as a row');
    // The one batched Fix-All handoff dispatches the shown findings.
    assert.match(text, /🤖 <strong>Fix-All handoff<\/strong>/, 'the single Fix-All handoff block must be present');

    // The bundle's own breadcrumbs confirm the single-comment funnel.
    assert.match(postResult.stdout, /3 on-diff → 3 AI-refined \(cap=3\)/);
    assert.match(postResult.stdout, /in ONE comment/);
    assert.match(postResult.stdout, /Created sticky comment 9001/);
  } finally {
    await stopServer(modelsStub.server);
    await stopServer(githubStub.server);
    rmSync(root, { recursive: true, force: true });
  }
});
