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
      // fail-threshold unset → never fail (advisory default).
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

// Fail-soft contract: Drift is advisory, so its OWN errors (missing report,
// bad schema, …) become ::warning:: annotations and the PR stays green
// (exit 0). Only a deliberate fail-threshold breach exits non-zero.
test('action warns (does NOT fail) when DRIFT_REPORT_PATH is missing', async () => {
  const { env } = setupRun({ withReport: false });
  delete env.DRIFT_REPORT_PATH;
  const result = await runAction(env);
  assert.equal(result.code, 0, `expected fail-soft exit 0\nstdout: ${result.stdout}`);
  // @actions/core writes ::warning::… to stdout.
  assert.match(result.stdout, /::warning::/);
  assert.match(result.stdout, /DRIFT_REPORT_PATH is not set/);
});

test('action warns (does NOT fail) on schema version mismatch', async () => {
  const { env, dir } = setupRun({ withReport: false });
  const badReport = join(dir, 'report.json');
  writeFileSync(badReport, JSON.stringify({ schema_version: 99 }));
  env.DRIFT_REPORT_PATH = badReport;

  const result = await runAction(env);
  assert.equal(result.code, 0, `expected fail-soft exit 0\nstdout: ${result.stdout}`);
  assert.match(result.stdout, /::warning::/);
  assert.match(result.stdout, /Unsupported schema_version/);
});

// The headline behaviour: a numeric fail-threshold is the ONLY path to a
// non-zero exit. The kotlin-ktor fixture carries 1 product-correctness
// (category B) issue that clears the quality bar. We point the GitHub API
// at a dead port so the network tasks fail-soft (warnings) and we isolate
// the threshold decision running on the real bundle.
test('action fails ONLY when product-correctness count exceeds fail-threshold', async () => {
  const kotlinFixture = join(import.meta.dirname, '../../.dev/scan-pr-output-kotlin-ktor.json');

  async function run(threshold: string | undefined): Promise<RunResult> {
    const { env } = setupRun({ withReport: false });
    copyFileSync(kotlinFixture, env.DRIFT_REPORT_PATH);
    env.GITHUB_TOKEN = 'dummy'; // past the no-token early return
    env.GITHUB_API_URL = 'http://127.0.0.1:9'; // dead → tasks fail-soft
    if (threshold !== undefined) env.DRIFT_FAIL_THRESHOLD = threshold;
    return runAction(env);
  }

  const unset = await run(undefined);
  assert.equal(unset.code, 0, `unset → never fail\nstdout: ${unset.stdout}`);

  const zero = await run('0');
  assert.notEqual(zero.code, 0, 'threshold 0 → fail on any (1 > 0)');
  assert.match(zero.stdout, /exceeding the configured fail-threshold of 0/);

  const one = await run('1');
  assert.equal(one.code, 0, 'threshold 1 → 1 is not > 1, stays green');

  const bad = await run('abc');
  assert.equal(bad.code, 0, 'non-numeric → ignored, never fails');
  assert.match(bad.stdout, /Ignoring invalid fail-threshold/);
});
