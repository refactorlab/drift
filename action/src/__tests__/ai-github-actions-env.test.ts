// GitHub Actions runtime fidelity.
//
// The bundle is sensitive to the host environment in three ways:
//   • @actions/core emits "##[group]"/"##[endgroup]" + "::warning::"
//     log commands when GITHUB_ACTIONS=true. Without that env we get
//     plain text; with it we get GA log commands. Either is fine — we
//     pin BOTH paths so a future bundle change doesn't break either.
//   • @actions/github reads context from GITHUB_EVENT_PATH +
//     GITHUB_REPOSITORY. The post step uses this for `context.repo`.
//   • The runner sets GITHUB_WORKSPACE — the bundle reads it as the
//     fallback for the workspace root (where `git diff` runs).
//
// These tests put the bundle in BOTH environments (GA-simulated and
// non-GA) and assert the right behavior in each.

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

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const aiInferBundle = resolve(repoRoot, 'dist/ai-infer-one.js');
const aiSuggestBundle = resolve(repoRoot, 'dist/ai-suggest.js');

function runBundle(
  bundle: string,
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve_, reject) => {
    const proc = spawn(process.execPath, [bundle, ...args], {
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

async function startModelsStub(reply: string): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => { chunks += c; });
    req.on('end', () => {
      void chunks;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: reply } }] }));
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

function stopServer(s: Server): Promise<void> {
  return new Promise((rs) => s.close(() => rs()));
}

function makeRepo(): { root: string; baseSha: string; headSha: string } {
  const root = mkdtempSync(join(tmpdir(), 'drift-ga-env-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  mkdirSync(join(root, 'app'));
  writeFileSync(join(root, 'app/db.py'), 'def f():\n    pass\n');
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'base'], { cwd: root });
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  writeFileSync(join(root, 'app/db.py'), 'def f():\n    pass\n    log.info("X")\n');
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'change'], { cwd: root });
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, baseSha, headSha };
}

function writeReport(root: string): string {
  const p = join(root, 'report.json');
  writeFileSync(p, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['app/db.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'app/db.py', line: 1, confidence: 0.9,
        why_it_matters: 'GA-env-fidelity test finding',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'def f():', kind: 'del' }] },
      }],
    },
  }));
  return p;
}

const REPLY = JSON.stringify({
  suggestions: [{
    file: 'app/db.py', line: 3, category: 'A', confidence: 0.9,
    why_it_matters: 'GA-env reply, ≥ 10 chars',
    references: [{ url: 'https://example.com/x' }],
    after_code: '    log.info("FIXED")',
  }],
});

// ─── ai-infer-one.js — runs inside both envs ──────────────────────────

test('GA-env: ai-infer-one.js with GITHUB_ACTIONS=true emits ::group::/::endgroup:: + ::warning:: log commands when failing', async () => {
  if (!existsSync(aiInferBundle)) return;
  const { root, baseSha, headSha } = makeRepo();
  const reportPath = writeReport(root);
  const stub = await startModelsStub('not-valid-json'); // forces output rejection → group log

  try {
    const result = await runBundle(aiInferBundle, ['0'], {
      AI_OUT: join(root, 'env.json'),
      DRIFT_REPORT_PATH: reportPath,
      AI_ENDPOINT: stub.baseUrl,
      AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_WORKSPACE: root,
      AI_BASE_SHA: baseSha,
      AI_HEAD_SHA: headSha,
      // The KEY env: makes @actions/core emit GA log commands.
      GITHUB_ACTIONS: 'true',
      // RUNNER_TEMP / RUNNER_OS are read by @actions/core for some
      // commands; set them to plausible values to mimic the runner.
      RUNNER_TEMP: tmpdir(),
      RUNNER_OS: 'Linux',
      CI: 'true',
    });
    assert.equal(result.code, 0);
    // ::group::/::endgroup:: are emitted by core.startGroup/core.endGroup.
    // The "rejected exchange" branch wraps its dump in a group.
    assert.match(result.stdout, /::group::focal #1: model exchange \(rejected\)/);
    assert.match(result.stdout, /::endgroup::/);
    // core.warning emits the ::warning:: command.
    assert.match(result.stdout, /::warning::focal #1: output rejected/);
  } finally {
    await stopServer(stub.server);
    rmSync(root, { recursive: true, force: true });
  }
});

test('GA-env: ai-infer-one.js WITHOUT GITHUB_ACTIONS — plain text logs (no ::commands::)', async () => {
  if (!existsSync(aiInferBundle)) return;
  const { root, baseSha, headSha } = makeRepo();
  const reportPath = writeReport(root);
  const stub = await startModelsStub(REPLY);

  try {
    const result = await runBundle(aiInferBundle, ['0'], {
      AI_OUT: join(root, 'env.json'),
      DRIFT_REPORT_PATH: reportPath,
      AI_ENDPOINT: stub.baseUrl,
      AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_WORKSPACE: root,
      AI_BASE_SHA: baseSha,
      AI_HEAD_SHA: headSha,
      // GITHUB_ACTIONS NOT set — should fall back to plain text.
      GITHUB_ACTIONS: '',
      CI: '',
    });
    assert.equal(result.code, 0);
    // The same diagnostic lines appear, but WITHOUT ::commands::.
    assert.match(result.stdout, /focal #1: app\/db\.py:1.*cohort 1\/1 anchorable/);
    assert.match(result.stdout, /focal #1: \+1 suggestion → app\/db\.py:3/);
    // CRITICAL: no GA log commands leaked into a non-GA environment.
    // (A regression that hardcoded "::warning::" would break local
    // dev runs and the smoke script's output.)
    assert.ok(!/^::warning::/m.test(result.stdout), 'no ::warning:: in non-GA env');
    assert.ok(!/^::group::/m.test(result.stdout), 'no ::group:: in non-GA env');
  } finally {
    await stopServer(stub.server);
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── ai-suggest.js — context.repo from GITHUB_REPOSITORY + EVENT_PATH ─

test('GA-env: ai-suggest.js parses GITHUB_REPOSITORY into context.repo (owner/name split)', async () => {
  if (!existsSync(aiSuggestBundle)) return;
  const tmp = mkdtempSync(join(tmpdir(), 'drift-ga-suggest-'));
  const envelopePath = join(tmp, 'env.json');
  writeFileSync(envelopePath, JSON.stringify({
    suggestions: [{
      file: 'app/db.py', line: 3, category: 'A', confidence: 0.9,
      why_it_matters: 'GA-env post-step test ≥ 10 chars',
      references: [{ url: 'https://example.com/x' }],
      after_code: '    fixed',
    }],
  }));
  // The sticky path needs a readable scan report (it re-renders the
  // whole overview). makeRepo()/writeReport() build a valid one.
  const { root } = makeRepo();
  const reportPath = writeReport(root);
  const eventPath = join(tmp, 'event.json');
  writeFileSync(eventPath, JSON.stringify({
    pull_request: { number: 77, head: { sha: 'ga-sha' }, base: { sha: 'base' } },
  }));

  // Capture the GitHub stub URL request paths — they should include
  // the owner/name parsed from GITHUB_REPOSITORY. The new contract posts
  // ALL suggestions in the ONE sticky comment (issues/comments), and NEVER
  // posts a separate inline review (pulls/reviews).
  const seen: string[] = [];
  let reviewSeen = false;
  let stickyWrite = false;
  const server = createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => { chunks += c; });
    req.on('end', () => {
      const url = req.url ?? '';
      seen.push(url);
      // The removed surface: an inline PR review must NEVER be posted.
      if (req.method === 'POST' && /\/pulls\/77\/reviews/.test(url)) {
        reviewSeen = true;
      }
      if (req.method === 'GET' && /\/pulls\/77\/files/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ filename: 'app/db.py', patch: '@@ -1,2 +1,3 @@\n a\n b\n+c' }]));
        return;
      }
      // findSticky → no prior comment (empty list) → triggers a create POST.
      if (req.method === 'GET' && /\/issues\/77\/comments/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
        return;
      }
      // The single surface: the sticky comment is created (no prior) here.
      if (req.method === 'POST' && /\/issues\/77\/comments/.test(url)) {
        stickyWrite = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 4242 }));
        return;
      }
      // A prior-sticky update path, served for completeness.
      if (req.method === 'PATCH' && /\/issues\/comments\/\d+/.test(url)) {
        stickyWrite = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 4242 }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const result = await runBundle(aiSuggestBundle, [], {
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '3',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: baseUrl,
      // The KEY env: owner-x/repo-y → context.repo.{owner,repo}.
      GITHUB_REPOSITORY: 'octo-org/my-repo',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_ACTIONS: 'true',
      // Drive the sticky-comment path: this step OWNS the one comment.
      DRIFT_DEFER_STICKY_COMMENT: 'true',
      DRIFT_REPORT_PATH: reportPath,
    });
    assert.equal(result.code, 0);
    // The URL paths Octokit hits include the owner/name parsed from
    // GITHUB_REPOSITORY — proven by listFiles hitting the correct route.
    const listFilesCall = seen.find((u) => /\/repos\/octo-org\/my-repo\/pulls\/77\/files/.test(u));
    assert.ok(listFilesCall, `listFiles call must use repo from GITHUB_REPOSITORY; saw: ${seen.join(', ')}`);
    // The sticky upsert ALSO proves the owner/name split — it hits the
    // /repos/{owner}/{repo}/issues/77/comments route.
    const stickyCall = seen.find((u) => /\/repos\/octo-org\/my-repo\/issues\/77\/comments/.test(u));
    assert.ok(stickyCall, `sticky comment call must use repo from GITHUB_REPOSITORY; saw: ${seen.join(', ')}`);
    assert.ok(stickyWrite, 'suggestions must be posted to the ONE sticky comment (issues/comments)');
    // The new invariant: EXACTLY ZERO inline PR review.
    assert.ok(!reviewSeen, 'must NOT post a separate inline review (pulls/reviews removed)');
  } finally {
    await new Promise<void>((rs) => server.close(() => rs()));
    rmSync(tmp, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── ai-suggest.js — DRIFT_PR_* env fallback when no event payload ────

test('GA-env: ai-suggest.js with NO event payload but DRIFT_PR_* set → still resolves PR + posts', async () => {
  // Simulates the comment-mode flow where action.yml has resolved the
  // PR via REST and threaded DRIFT_PR_* env vars instead of providing
  // a github.event.pull_request payload.
  if (!existsSync(aiSuggestBundle)) return;
  const tmp = mkdtempSync(join(tmpdir(), 'drift-ga-comment-'));
  const envelopePath = join(tmp, 'env.json');
  writeFileSync(envelopePath, JSON.stringify({
    suggestions: [{
      file: 'app/db.py', line: 3, category: 'A', confidence: 0.9,
      why_it_matters: 'comment-mode env-fallback test ≥ 10 chars',
      references: [{ url: 'https://example.com/x' }],
      after_code: '    fixed',
    }],
  }));
  // Empty event payload (issue_comment event has no pull_request)
  const eventPath = join(tmp, 'event.json');
  writeFileSync(eventPath, JSON.stringify({ issue: { pull_request: { url: '…' } } }));
  // The sticky path needs a readable scan report (it re-renders the overview).
  const { root } = makeRepo();
  const reportPath = writeReport(root);

  let reviewSeen = false;
  let stickyWrite = false;
  const seen: string[] = [];
  const server = createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => { chunks += c; });
    req.on('end', () => {
      void chunks;
      const url = req.url ?? '';
      seen.push(url);
      // The removed surface: an inline PR review must NEVER be posted.
      if (req.method === 'POST' && /\/pulls\/55\/reviews/.test(url)) {
        reviewSeen = true;
      }
      if (req.method === 'GET' && /\/pulls\/55\/files/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ filename: 'app/db.py', patch: '@@ -1,2 +1,3 @@\n a\n b\n+c' }]));
        return;
      }
      // findSticky → no prior comment → create POST. Proves PR #55 was
      // resolved via the DRIFT_PR_* env fallback (no payload PR object).
      if (req.method === 'GET' && /\/issues\/55\/comments/.test(url)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
        return;
      }
      if (req.method === 'POST' && /\/issues\/55\/comments/.test(url)) {
        stickyWrite = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 5555 }));
        return;
      }
      if (req.method === 'PATCH' && /\/issues\/comments\/\d+/.test(url)) {
        stickyWrite = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 5555 }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const result = await runBundle(aiSuggestBundle, [], {
      AI_SUGGESTIONS_PATH: envelopePath,
      DRIFT_MAX_AI_SUGGESTIONS: '3',
      DRIFT_AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: baseUrl,
      GITHUB_REPOSITORY: 'octo-org/my-repo',
      GITHUB_EVENT_NAME: 'issue_comment',
      GITHUB_EVENT_PATH: eventPath,
      // DRIFT_PR_* fallback — populated by action.yml's pr-ctx step.
      DRIFT_PR_NUMBER: '55',
      DRIFT_HEAD_SHA: 'comment-mode-head-sha',
      GITHUB_ACTIONS: 'true',
      // Drive the sticky-comment path: this step OWNS the one comment.
      DRIFT_DEFER_STICKY_COMMENT: 'true',
      DRIFT_REPORT_PATH: reportPath,
    });
    assert.equal(result.code, 0);
    // The PR was resolved via DRIFT_PR_* env fallback and the suggestions
    // were upserted into the ONE sticky comment (issues/55/comments).
    assert.ok(stickyWrite, 'post step must resolve PR via DRIFT_PR_* env fallback and upsert the sticky comment');
    const stickyCall = seen.find((u) => /\/repos\/octo-org\/my-repo\/issues\/55\/comments/.test(u));
    assert.ok(stickyCall, `sticky upsert must hit issues/55/comments; saw: ${seen.join(', ')}`);
    // The new invariant: EXACTLY ZERO inline PR review.
    assert.ok(!reviewSeen, 'must NOT post a separate inline review (pulls/reviews removed)');
  } finally {
    await new Promise<void>((rs) => server.close(() => rs()));
    rmSync(tmp, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── ai-infer-one.js — GITHUB_WORKSPACE fallback ──────────────────────

test('GA-env: ai-infer-one.js reads GITHUB_WORKSPACE for the workspace root', async () => {
  if (!existsSync(aiInferBundle)) return;
  const { root, baseSha, headSha } = makeRepo();
  const reportPath = writeReport(root);
  const stub = await startModelsStub(REPLY);
  try {
    // Set GITHUB_WORKSPACE to the test repo. The bundle should use
    // THAT path (not process.cwd()) for git diff.
    const result = await runBundle(aiInferBundle, ['0'], {
      AI_OUT: join(root, 'env.json'),
      DRIFT_REPORT_PATH: reportPath,
      AI_ENDPOINT: stub.baseUrl,
      AI_MODEL: 'openai/gpt-4o',
      GITHUB_TOKEN: 'test-token',
      GITHUB_WORKSPACE: root,   // ← THE workspace
      AI_BASE_SHA: baseSha,
      AI_HEAD_SHA: headSha,
      GITHUB_ACTIONS: 'true',
    });
    assert.equal(result.code, 0);
    // Envelope was written → bundle successfully read the workspace,
    // ran git diff, built a prompt, and got a reply.
    const env = JSON.parse(readFileSync(join(root, 'env.json'), 'utf8'));
    assert.equal(env.suggestions.length, 1);
  } finally {
    await stopServer(stub.server);
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── Sanity: bundle exits cleanly with a hostile env ──────────────────

test('GA-env: ai-infer-one.js tolerates HOSTILE / EMPTY env vars without crashing', async () => {
  // What happens if a malicious or misconfigured workflow nukes the
  // PATH or sets weird quoted values? The bundle should still exit 0
  // (fail-soft), warning rather than crashing the whole action.
  if (!existsSync(aiInferBundle)) return;
  const result = await runBundle(aiInferBundle, ['0'], {
    AI_OUT: '',
    DRIFT_REPORT_PATH: '',
    AI_ENDPOINT: '',
    AI_MODEL: '',
    GITHUB_TOKEN: '',
    GITHUB_WORKSPACE: '',
    AI_BASE_SHA: '',
    AI_HEAD_SHA: '',
    GITHUB_ACTIONS: 'true',
  });
  // Exit 0 is the contract — the consumer's PR must NOT fail because
  // their action.yml mis-threaded env vars.
  assert.equal(result.code, 0, `bundle must exit 0 even with hostile env; got code ${result.code}, stderr:\n${result.stderr}`);
  // A diagnostic warning IS emitted naming the missing inputs.
  assert.match(result.stdout, /::warning::ai-infer-one: missing AI_OUT|missing AI_OUT/);
});
