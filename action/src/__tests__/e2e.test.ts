import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type RunResult = { code: number | null; stdout: string; stderr: string };

const distPath = join(import.meta.dirname, '../../../dist/index.js');
const fixtureReport = join(import.meta.dirname, '../../.dev/report.json');

function runAction(env: Record<string, string>): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [distPath], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => (stdout += c.toString('utf8')));
    proc.stderr.on('data', (c) => (stderr += c.toString('utf8')));
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
    setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`action timed out\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, 10000).unref();
  });
}

function setupRun(opts: { withReport?: boolean; eventPayload?: object }): {
  env: Record<string, string>;
  dir: string;
  outPath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), 'drift-e2e-'));
  const eventPath = join(dir, 'event.json');
  const outPath = join(dir, 'github_output');
  const reportPath = join(dir, 'report.json');

  writeFileSync(outPath, '');
  writeFileSync(
    eventPath,
    JSON.stringify(
      opts.eventPayload ?? {
        pull_request: {
          number: 36,
          title: 'Speed up checkout',
          html_url: 'https://github.com/acme/shop/pull/36',
          head: { ref: 'feat/checkout', sha: 'deadbeefcafe1234567890abcdef0123456789ab' },
          base: { ref: 'main' },
          user: { login: 'octocat' },
        },
      },
    ),
  );
  if (opts.withReport) {
    copyFileSync(fixtureReport, reportPath);
  }

  return {
    dir,
    outPath,
    env: {
      DRIFT_REPORT_PATH: reportPath,
      DRIFT_FAIL_ON: 'regression',
      DRIFT_COMMENT: 'true',
      // Empty token → action skips GitHub API entirely. Phase 6 (smoke) is what
      // exercises the real GitHub integration.
      GITHUB_TOKEN: '',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'acme/shop',
      GITHUB_OUTPUT: outPath,
    },
  };
}

test('action loads the report and emits outputs', async () => {
  const { env, outPath } = setupRun({ withReport: true });
  const result = await runAction(env);
  // With no GITHUB_TOKEN, action exits before calling fail-on logic.
  assert.equal(result.code, 0, `expected exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

  const out = readFileSync(outPath, 'utf8');
  // Python-fastapi fixture (post-OM1/OM2 reshape):
  //   pr_scope.changed_files = 3
  //   pr_scope.affected_roots = ["create_order"] → 1
  //   pr_scope.unreachable_changes = ["app/db.py"] → 1
  //   pr_review.code_suggestions = 3 dead-code-in-changed-file (all Category A, confidence 1.0, all pass).
  assert.match(out, /changed-files<<[^\n]+\n3\n/);
  assert.match(out, /affected-roots<<[^\n]+\n1\n/);
  assert.match(out, /unreachable-changes<<[^\n]+\n1\n/);
  assert.match(out, /suggestions-shown<<[^\n]+\n3\n/);
  assert.match(result.stdout, /No GITHUB_TOKEN provided/);
});

test('action skips silently when event has no pull_request', async () => {
  const { env } = setupRun({
    withReport: false,
    eventPayload: { ref: 'refs/heads/main' },
  });
  const result = await runAction(env);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Drift only runs on pull_request/);
});

test('action fails when DRIFT_REPORT_PATH is missing', async () => {
  const { env } = setupRun({ withReport: false });
  delete env.DRIFT_REPORT_PATH;
  const result = await runAction(env);
  assert.notEqual(result.code, 0);
  // @actions/core writes ::error::… to stdout, not stderr.
  assert.match(result.stdout, /DRIFT_REPORT_PATH is not set/);
});

test('action fails on schema version mismatch', async () => {
  const { env, dir } = setupRun({ withReport: false });
  const badReport = join(dir, 'report.json');
  writeFileSync(badReport, JSON.stringify({ schema_version: 99 }));
  env.DRIFT_REPORT_PATH = badReport;

  const result = await runAction(env);
  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Unsupported schema_version/);
});
