// Multi-model compatibility matrix.
//
// The per-model token-field switch in models-client.ts:
//   • Reasoning models (gpt-5, o-series): max_completion_tokens
//   • Classic models (gpt-4o, gpt-4.1):    max_tokens
//
// A unit test pins the regex (ai-models-client.test.ts). This file
// goes end-to-end: for EACH supported model, run the action.yml bash
// + the per-suggestion loop bundle, observe the actual POST body the
// Models server received, and assert the right field is set.
//
// Why: the bash + bundle + isReasoningModel regex are three separate
// surfaces. If any drifts, a consumer could ship a model that 400s on
// the server because we sent the wrong token field. Catching that at
// CI is much cheaper than catching it on someone's PR.

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
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

function extractAiLoopBash(): string {
  const yaml = readFileSync(resolve(repoRoot, 'action.yml'), 'utf8');
  const parsed = parseYaml(yaml) as { runs: { steps: Array<{ id?: string; run?: string }> } };
  const step = parsed.runs.steps.find((s) => s.id === 'ai-loop');
  if (!step?.run) throw new Error('ai-loop step missing');
  return step.run.replace(/\$\{\{\s*github\.action_path\s*\}\}/g, repoRoot);
}

function runBash(script: string, env: Record<string, string>): Promise<{
  code: number | null; stdout: string; stderr: string;
}> {
  return new Promise((resolve_, reject) => {
    const proc = spawn('bash', ['-eu', '-c', script], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c; });
    proc.stderr.on('data', (c) => { stderr += c; });
    proc.on('exit', (code) => resolve_({ code, stdout, stderr }));
    proc.on('error', reject);
  });
}

type Capture = {
  server: Server;
  baseUrl: string;
  bodies: Array<Record<string, unknown>>;
};
async function startCaptureStub(reply: string): Promise<Capture> {
  const bodies: Array<Record<string, unknown>> = [];
  const server = createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => { chunks += c; });
    req.on('end', () => {
      try { bodies.push(JSON.parse(chunks)); } catch { /* ignore */ }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: reply } }] }));
    });
  });
  await new Promise<void>((rs) => server.listen(0, '127.0.0.1', rs));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}`, bodies };
}

function stopServer(s: Server): Promise<void> {
  return new Promise((rs) => s.close(() => rs()));
}

function makeRepo(): { root: string; baseSha: string; headSha: string; reportPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'drift-matrix-'));
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
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['app/db.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'app/db.py', line: 1, confidence: 0.9,
        why_it_matters: 'multi-model matrix finding, plenty long',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'def f():', kind: 'del' }] },
      }],
    },
  }));
  return { root, baseSha, headSha, reportPath };
}

const MATRIX: Array<{ model: string; expectedField: 'max_tokens' | 'max_completion_tokens'; classification: 'classic' | 'reasoning' }> = [
  { model: 'openai/gpt-4o',  expectedField: 'max_tokens',            classification: 'classic'   },
  { model: 'openai/gpt-4.1', expectedField: 'max_tokens',            classification: 'classic'   },
  { model: 'openai/gpt-5',   expectedField: 'max_completion_tokens', classification: 'reasoning' },
  { model: 'openai/o1',      expectedField: 'max_completion_tokens', classification: 'reasoning' },
  { model: 'openai/o3-mini', expectedField: 'max_completion_tokens', classification: 'reasoning' },
];

for (const { model, expectedField, classification } of MATRIX) {
  test(`matrix(${classification}): ${model} sends ${expectedField} field through the bundle`, async () => {
    const fix = makeRepo();
    const stub = await startCaptureStub(JSON.stringify({
      suggestions: [{
        file: 'app/db.py', line: 3, category: 'A', confidence: 0.9,
        why_it_matters: 'matrix test reply, ≥ 10 chars',
        references: [{ url: 'https://example.com/x' }],
        after_code: '    log.info("X")',
      }],
    }));
    try {
      const bash = extractAiLoopBash();
      const r = await runBash(bash, {
        AI_OUT: join(fix.root, 'env.json'),
        DRIFT_REPORT_PATH: fix.reportPath,
        AI_ENDPOINT: stub.baseUrl,
        AI_MODEL: model,
        AI_MAX: '3',
        AI_MAX_INPUT_TOKENS: '7000',
        AI_MAX_OUTPUT_TOKENS: '8000',
        AI_BASE_SHA: fix.baseSha,
        AI_HEAD_SHA: fix.headSha,
        GITHUB_TOKEN: 'test-token',
        GITHUB_WORKSPACE: fix.root,
      });
      assert.equal(r.code, 0, `bash failed for ${model}:\n${r.stderr}\n${r.stdout}`);
      assert.equal(stub.bodies.length, 1, `${model} must trigger exactly one Models call`);
      const body = stub.bodies[0];

      // The KEY assertion: the right field is set, the wrong one isn't.
      assert.equal(
        body[expectedField], 8000,
        `${model} (${classification}) must send ${expectedField}: 8000`,
      );
      const wrongField = expectedField === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens';
      assert.equal(
        body[wrongField], undefined,
        `${model} (${classification}) must NOT send ${wrongField}`,
      );

      // Sanity: model name is echoed correctly into the request body.
      assert.equal(body.model, model);

      // The action.yml bash echoes the model name in the iteration header.
      assert.match(r.stdout, new RegExp(`model: ${model.replace(/[/.]/g, '\\$&')}`));
    } finally {
      await stopServer(stub.server);
      rmSync(fix.root, { recursive: true, force: true });
    }
  });
}

test('matrix: BOTH classifications are exercised (at least 1 classic + 1 reasoning)', () => {
  // Sanity-pin the matrix shape itself — if a future edit accidentally
  // removes one classification's coverage, this test fails loud.
  const classic = MATRIX.filter((m) => m.classification === 'classic');
  const reasoning = MATRIX.filter((m) => m.classification === 'reasoning');
  assert.ok(classic.length >= 2, 'must cover ≥ 2 classic models');
  assert.ok(reasoning.length >= 2, 'must cover ≥ 2 reasoning models');
});
