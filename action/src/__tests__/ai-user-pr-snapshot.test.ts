// THE definitive regression test for the user's PR-log bug.
//
// The user reported:
//   Run # Fresh envelope; each iteration appends one suggestion (if any).
//   🔁 3 of 3 scanner finding(s) → one inference call each (model: openai/gpt-4.1)
//   ──── inference 1/3 ────
//   focal #1: no anchorable focal point at this index — skipping.
//   ──── inference 2/3 ────
//   focal #2: no anchorable focal point at this index — skipping.
//   ──── inference 3/3 ────
//   focal #3: no anchorable focal point at this index — skipping.
//   ✅ loop done — 0 suggestion(s) cleared the bar → /home/runner/work/_temp/ai-suggestions.json
//   🤖 openai/gpt-4.1: 0 candidate(s) → 0 cleared the quality bar — silence > noise.
//
// This test reconstructs that EXACT scenario — 3 dead-code findings,
// gpt-4.1 model, same anchoring at the `def` line — runs the WHOLE
// pipeline (bash from action.yml + both dist bundles + two stub servers
// for Models and GitHub), and captures the log + the POSTed payload.
//
// SNAPSHOT THE EXPECTED OUTPUT. A future regression that brings the
// "no anchorable focal point at this index — skipping" line back, or
// that drops the cohort breadcrumb, or that drops the +1-suggestion
// line, fails THIS test with a visible diff. The user can read the
// snapshot to see EXACTLY what their CI log will say after the fix
// ships.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const actionPath = repoRoot;
const aiSuggestBundle = resolve(repoRoot, 'dist/ai-suggest.js');

// ─── helpers ───────────────────────────────────────────────────────────

function extractAiLoopBash(): string {
  const yaml = readFileSync(resolve(repoRoot, 'action.yml'), 'utf8');
  const parsed = parseYaml(yaml) as { runs: { steps: Array<{ id?: string; run?: string }> } };
  const step = parsed.runs.steps.find((s) => s.id === 'ai-loop');
  if (!step?.run) throw new Error('ai-loop step missing');
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
    proc.on('exit', (code) => resolve_({ code, stdout, stderr }));
    proc.on('error', reject);
  });
}

function runNode(bundle: string, env: Record<string, string>): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve_, reject) => {
    const proc = spawn(process.execPath, [bundle], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c; });
    proc.stderr.on('data', (c) => { stderr += c; });
    proc.on('exit', (code) => resolve_({ code, stdout, stderr }));
    proc.on('error', reject);
  });
}

type ModelsStub = { server: Server; baseUrl: string; requests: unknown[] };
async function startModelsStub(replies: string[]): Promise<ModelsStub> {
  const requests: unknown[] = [];
  const remaining = [...replies];
  const server = createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => { chunks += c; });
    req.on('end', () => {
      try { requests.push(JSON.parse(chunks)); } catch { requests.push(chunks); }
      const next = remaining.shift() ?? '{"suggestions":[]}';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: next } }] }));
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests };
}

type GitHubStub = {
  server: Server;
  baseUrl: string;
  posts: Array<{ url: string; body: unknown }>;
};
async function startGitHubStub(
  files: Array<{ filename: string; patch: string }>,
): Promise<GitHubStub> {
  const posts: GitHubStub['posts'] = [];
  const server = createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => { chunks += c; });
    req.on('end', () => {
      const url = req.url ?? '';
      if (req.method === 'GET' && /\/pulls\/\d+\/files/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(files));
        return;
      }
      if (req.method === 'POST' && /\/pulls\/\d+\/reviews/.test(url)) {
        let body: unknown = null;
        try { body = JSON.parse(chunks); } catch { body = chunks; }
        posts.push({ url, body });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 1, state: 'COMMENTED' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, posts };
}

function stopServer(s: Server): Promise<void> {
  return new Promise((rs) => s.close(() => rs()));
}

function makeRepo(
  before: Record<string, string>,
  after: Record<string, string>,
): { root: string; baseSha: string; headSha: string } {
  const root = mkdtempSync(join(tmpdir(), 'drift-user-pr-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  for (const [p, c] of Object.entries(before)) {
    const abs = join(root, p);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, c);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'base'], { cwd: root });
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  for (const [p, c] of Object.entries(after)) {
    const abs = join(root, p);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, c);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'change'], { cwd: root });
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, baseSha, headSha };
}

/**
 * Strip variable parts of a log so two runs produce byte-identical
 * output: tmp dir paths, SHAs, line counts that depend on tmp content.
 * Leaves the load-bearing diagnostic substrings intact.
 */
function normalizeLog(s: string): string {
  return s
    .replace(/\/var\/folders\/[^\s)]*/g, '/tmp/XXX')        // macOS tmp
    .replace(/\/tmp\/[^\s)]*\/drift-user-pr-[^\s)/]*/g, '/tmp/XXX')
    .replace(/[a-f0-9]{40}/g, 'SHA40')                       // git SHAs
    .replace(/\(\d+ chars,/g, '(N chars,')                   // prompt size
    .replace(/[]\[[0-9;]*m/g, '');                     // ANSI colors
}

// ─── THE TEST ─────────────────────────────────────────────────────────

test('user-PR-snapshot: the EXACT scenario from the bug report → 3 reviews POSTed (matches expected log)', async () => {
  if (!existsSync(aiSuggestBundle)) return;

  // ── Stage the user's PR: 2 files, 3 dead-code findings ─────────────
  // The user's PR had `pr_review.code_suggestions: [..., ..., ...]` —
  // findings at `def`/`<module>` lines (1, 1, 2). Reproduce exactly.
  const { root, baseSha, headSha } = makeRepo(
    {
      'app/db.py': 'def get_session():\n    yield None\n',
      'app/repos.py': 'class OrderRepository:\n    def find_by_id(self, id):\n        return None\n',
    },
    {
      'app/db.py': 'def get_session():\n    yield None\n    log.info("session created")\n',
      'app/repos.py': 'class OrderRepository:\n    def find_by_id(self, id):\n        return None\n    def find_all(self):\n        return []\n',
    },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.1' },
    pr_scope: {
      changed_files: ['app/db.py', 'app/repos.py'],
      affected_roots: [],
      unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: [
        {
          category: 'A',
          kind: 'dead_code_in_changed_file',
          rule_id: 'S2:dead-code',
          file: 'app/db.py',
          function: '<module>',
          line: 1,
          confidence: 1.0,
          severity: 'low',
          why_it_matters: '`<module>` in `app/db.py` is reachable by zero callers',
          references: [{ url: 'https://example.com/dc1' }],
          diff: { before_lines: [{ line_number: 1, code: 'def get_session():', kind: 'del' }] },
        },
        {
          category: 'A',
          kind: 'dead_code_in_changed_file',
          rule_id: 'S2:dead-code',
          file: 'app/db.py',
          function: 'get_session',
          line: 1,
          confidence: 0.95,
          severity: 'low',
          why_it_matters: '`get_session` in `app/db.py` is reachable by zero callers',
          references: [{ url: 'https://example.com/dc2' }],
          diff: { before_lines: [{ line_number: 1, code: 'def get_session():', kind: 'del' }] },
        },
        {
          category: 'A',
          kind: 'dead_code_in_changed_file',
          rule_id: 'S2:dead-code',
          file: 'app/repos.py',
          function: 'OrderRepository::find_by_id',
          line: 2,
          confidence: 0.9,
          severity: 'low',
          why_it_matters: '`OrderRepository::find_by_id` in `app/repos.py` reachable by zero callers',
          references: [{ url: 'https://example.com/dc3' }],
          diff: { before_lines: [{ line_number: 2, code: '    def find_by_id(self, id):', kind: 'del' }] },
        },
      ],
    },
  }));

  // ── Phase 1: bash from action.yml fills the envelope ──────────────
  // The Models stub returns 3 realistic suggestions anchored at the
  // `+` lines (line 3 in db.py, line 5 in repos.py).
  const modelsStub = await startModelsStub([
    JSON.stringify({
      suggestions: [{
        file: 'app/db.py', line: 3, category: 'A', confidence: 0.9,
        why_it_matters: 'Remove the unused module-level code; this dead code adds maintenance burden.',
        references: [{ url: 'https://example.com/fix-db1' }],
        after_code: '    log.info("session created")',
      }],
    }),
    JSON.stringify({
      suggestions: [{
        file: 'app/db.py', line: 3, category: 'A', confidence: 0.88,
        why_it_matters: 'get_session has no callers; either wire it up or delete it.',
        references: [{ url: 'https://example.com/fix-db2' }],
        after_code: '    log.info("session created")',
      }],
    }),
    JSON.stringify({
      suggestions: [{
        file: 'app/repos.py', line: 5, category: 'A', confidence: 0.85,
        why_it_matters: 'find_by_id is unreachable; consider exposing it via the public API.',
        references: [{ url: 'https://example.com/fix-repos' }],
        after_code: '    def find_all(self):\n        return []',
      }],
    }),
  ]);

  const outPath = join(root, 'ai-suggestions.json');
  const githubStub = await startGitHubStub([
    { filename: 'app/db.py', patch: '@@ -1,2 +1,3 @@\n def get_session():\n     yield None\n+    log.info("session created")' },
    { filename: 'app/repos.py', patch: '@@ -1,3 +1,5 @@\n class OrderRepository:\n     def find_by_id(self, id):\n         return None\n+    def find_all(self):\n+        return []' },
  ]);

  const eventPath = join(root, 'event.json');
  writeFileSync(eventPath, JSON.stringify({
    pull_request: { number: 42, head: { sha: headSha }, base: { sha: baseSha } },
  }));

  try {
    // ── Run the literal action.yml bash (the user's PR runs this) ───
    const bash = extractAiLoopBash();
    const r1 = await runBash(bash, {
      AI_OUT: outPath,
      DRIFT_REPORT_PATH: reportPath,
      AI_ENDPOINT: modelsStub.baseUrl,
      AI_MODEL: 'openai/gpt-4.1', // the user's exact model
      AI_MAX: '3',
      AI_MAX_INPUT_TOKENS: '7000',
      AI_MAX_OUTPUT_TOKENS: '8000',
      AI_BASE_SHA: baseSha,
      AI_HEAD_SHA: headSha,
      GITHUB_TOKEN: 'test-token',
      GITHUB_WORKSPACE: root,
    });
    assert.equal(r1.code, 0, `bash failed:\n${r1.stderr}\n${r1.stdout}`);

    // ── Run the post step (the user's PR runs this next) ────────────
    const r2 = await runNode(aiSuggestBundle, {
      AI_SUGGESTIONS_PATH: outPath,
      DRIFT_MAX_AI_SUGGESTIONS: '3',
      DRIFT_AI_MODEL: 'openai/gpt-4.1',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: githubStub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(r2.code, 0, `post failed:\n${r2.stderr}\n${r2.stdout}`);

    // ── EXPECTED LOG SNAPSHOT ───────────────────────────────────────
    // Every load-bearing line the user would see in their CI log,
    // post-fix. If any go missing or change wording, this snapshot
    // breaks loudly. This is the SUBSTITUTE for the user's old log.
    const normalized = normalizeLog(r1.stdout + '\n' + r2.stdout);

    // Phase-1 invariants (action.yml bash):
    assert.match(normalized, /🔁 3 of 3 scanner finding\(s\) → one inference call each \(model: openai\/gpt-4\.1\)/);
    assert.match(normalized, /──── inference 1\/3 ────/);
    assert.match(normalized, /──── inference 2\/3 ────/);
    assert.match(normalized, /──── inference 3\/3 ────/);
    // Phase-1 NEW DIAGNOSTICS (the fix):
    assert.match(normalized, /focal #1: app\/db\.py:1 <module> \[S2:dead-code\] · cohort 3\/3 anchorable · diff covers 2 file\(s\)/);
    assert.match(normalized, /focal #1: prompt built \(N chars, window=scanner\) → calling model…/);
    assert.match(normalized, /focal #1: \+1 suggestion → app\/db\.py:3/);
    assert.match(normalized, /focal #2: app\/db\.py:1 get_session \[S2:dead-code\]/);
    assert.match(normalized, /focal #3: app\/repos\.py:2 OrderRepository::find_by_id \[S2:dead-code\]/);
    assert.match(normalized, /focal #3: \+1 suggestion → app\/repos\.py:5/);
    assert.match(normalized, /✅ loop done — 3 suggestion\(s\) cleared the bar/);
    // Phase-2 (post step):
    assert.match(normalized, /🤖 openai\/gpt-4\.1: 3 candidate\(s\) → 3 pass quality bar → 3 on-diff → 3 posted \(cap=3\)/);
    assert.match(normalized, /Posted AI review with 3 inline suggestion\(s\)/);

    // ── EXPECTED OLD-LOG REGRESSION GUARDS ──────────────────────────
    // The old buggy log lines MUST NOT appear:
    assert.ok(
      !normalized.includes('no anchorable focal point at this index'),
      'REGRESSION: the old opaque diagnostic reappeared',
    );
    assert.ok(
      !normalized.match(/✅ loop done — 0 suggestion/),
      'REGRESSION: zero suggestions cleared — the user bug is back',
    );
    assert.ok(
      !normalized.match(/0 candidate\(s\) → 0 cleared the quality bar/),
      'REGRESSION: post step seeing 0 candidates — the user bug is back',
    );

    // ── EXPECTED GITHUB POST PAYLOAD ────────────────────────────────
    // The user's PR would receive ONE review with 3 inline comments.
    assert.equal(githubStub.posts.length, 1, 'EXACTLY ONE createReview POST');
    const post = githubStub.posts[0];
    const body = post.body as {
      event: string;
      commit_id: string;
      body: string;
      comments: Array<{ path: string; line: number; side: string; body: string }>;
    };
    assert.equal(body.event, 'COMMENT');
    assert.equal(body.commit_id, headSha);
    assert.match(body.body, /openai\/gpt-4\.1.*3 suggestions/);
    assert.equal(body.comments.length, 3, 'three inline suggestions');
    for (const c of body.comments) {
      assert.equal(c.side, 'RIGHT');
      assert.match(c.body, /```suggestion/);
    }
    assert.deepEqual(
      body.comments.map((c) => `${c.path}:${c.line}`).sort(),
      ['app/db.py:3', 'app/db.py:3', 'app/repos.py:5'].sort(),
    );

    // ── BEFORE/AFTER COMPARISON ────────────────────────────────────
    // Document the diff for future readers: what the user used to see
    // vs what they now see. Asserted in test code so it's part of the
    // pinned contract, not just a comment.
    const beforeLogShape = /focal #\d: no anchorable focal point at this index — skipping\./;
    const afterLogShape = /focal #\d: app\/.+\.py:\d+ .* \[S2:dead-code\] · cohort \d\/\d anchorable · diff covers \d+ file\(s\)/;
    assert.ok(
      !beforeLogShape.test(normalized),
      'BEFORE-FIX shape (opaque diagnostic) must NOT be present',
    );
    assert.match(normalized, afterLogShape, 'AFTER-FIX shape (cohort breadcrumb) MUST be present');
  } finally {
    await stopServer(modelsStub.server);
    await stopServer(githubStub.server);
    rmSync(root, { recursive: true, force: true });
  }
});

test('user-PR-snapshot: WHEN the model returns zero passing suggestions → silence, no POST', async () => {
  // Mirror behavior the user already expected ("silence > noise"):
  // even with 3 findings, if every model reply fails the quality bar,
  // the post step posts NOTHING. The diagnostic log explains why.
  if (!existsSync(aiSuggestBundle)) return;

  const { root, baseSha, headSha } = makeRepo(
    { 'app/db.py': 'def f():\n    pass\n' },
    { 'app/db.py': 'def f():\n    pass\n    log.info("X")\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['app/db.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'app/db.py', line: 1, confidence: 1.0,
        why_it_matters: 'dead-code finding triggers an inference call',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'def f():', kind: 'del' }] },
      }],
    },
  }));

  // Model returns a suggestion BELOW the 0.75 confidence bar → drop.
  const modelsStub = await startModelsStub([
    JSON.stringify({
      suggestions: [{
        file: 'app/db.py', line: 3, category: 'A', confidence: 0.5, // ← below bar
        why_it_matters: 'low-confidence reply that should be dropped',
        references: [{ url: 'https://example.com/x' }],
        after_code: '    pass',
      }],
    }),
  ]);
  const outPath = join(root, 'ai-suggestions.json');
  const githubStub = await startGitHubStub([
    { filename: 'app/db.py', patch: '@@ -1,2 +1,3 @@\n def f():\n     pass\n+    log.info("X")' },
  ]);
  const eventPath = join(root, 'event.json');
  writeFileSync(eventPath, JSON.stringify({
    pull_request: { number: 11, head: { sha: headSha }, base: { sha: baseSha } },
  }));

  try {
    const bash = extractAiLoopBash();
    const r1 = await runBash(bash, {
      AI_OUT: outPath,
      DRIFT_REPORT_PATH: reportPath,
      AI_ENDPOINT: modelsStub.baseUrl,
      AI_MODEL: 'openai/gpt-4.1',
      AI_MAX: '3', AI_MAX_INPUT_TOKENS: '7000', AI_MAX_OUTPUT_TOKENS: '8000',
      AI_BASE_SHA: baseSha, AI_HEAD_SHA: headSha,
      GITHUB_TOKEN: 'test-token', GITHUB_WORKSPACE: root,
    });
    assert.equal(r1.code, 0);
    // Inference DID happen (we don't drop pre-call when it might pass).
    // But the model's reply failed quality bar → "0 cleared the bar".
    assert.match(r1.stdout, /focal #1: 1 candidate\(s\) → 0 cleared the bar/);
    assert.match(r1.stdout, /✅ loop done — 0 suggestion/);

    // Post step.
    const r2 = await runNode(aiSuggestBundle, {
      AI_SUGGESTIONS_PATH: outPath,
      DRIFT_MAX_AI_SUGGESTIONS: '3',
      DRIFT_AI_MODEL: 'openai/gpt-4.1',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: githubStub.baseUrl,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
    });
    assert.equal(r2.code, 0);
    // ai-suggest sees 0 candidates → no POST.
    assert.match(r2.stdout, /0 candidate\(s\) → 0 cleared the quality bar/);
    assert.equal(githubStub.posts.length, 0, 'no POST on a zero-pass run');
  } finally {
    await stopServer(modelsStub.server);
    await stopServer(githubStub.server);
    rmSync(root, { recursive: true, force: true });
  }
});
