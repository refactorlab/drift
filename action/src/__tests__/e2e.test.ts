import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';

type Captured = { method: string; url: string; headers: Record<string, string>; body: string };

function captureServer(handler: (req: Captured) => { status: number; body: string }) {
  const captured: Captured[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const cap: Captured = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v ?? '')]),
        ),
        body: Buffer.concat(chunks).toString('utf8'),
      };
      captured.push(cap);
      const out = handler(cap);
      res.statusCode = out.status;
      res.setHeader('content-type', 'application/json');
      res.end(out.body);
    });
  });
  return { server, captured };
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) resolve(addr.port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
}

type RunResult = { code: number | null; stdout: string; stderr: string };

function runAction(env: Record<string, string>): Promise<RunResult> {
  const distPath = join(import.meta.dirname, '../../../dist/index.js');
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [distPath], {
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => (stdout += c.toString('utf8')));
    proc.stderr.on('data', (c) => (stderr += c.toString('utf8')));
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
    setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`action timed out\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, 15000).unref();
  });
}

function writeProfileFixture(dir: string, report: object): string {
  const path = join(dir, 'fixture-report.json');
  writeFileSync(path, JSON.stringify(report));
  // `cp` is portable on Linux/macOS runners; copies our pre-baked report into place.
  return `cp ${JSON.stringify(path)} "$DRIFT_REPORT_PATH"`;
}

test('action runs end-to-end against fake Drift API + GitHub', async () => {
  const drift = captureServer((req) => {
    if (req.url === '/api/ingest/scans' && req.method === 'POST') {
      return {
        status: 200,
        body: JSON.stringify({
          id: 7,
          url: 'https://app.drift.dev/scans/7',
          verdict: 'regression',
          verdictSub: 'p95 +50ms vs baseline',
          p95LatencyMs: 250,
          p95BaselineMs: 200,
          cpuPct: 50,
          cpuBaselinePct: 40,
          dbQueries: 12,
          dbNPlusOne: 0,
          cacheHitRate: 90,
          issues: [
            {
              severity: 'high',
              title: 'Hot loop',
              filePath: 'src/hot.ts',
              lineNumber: 10,
              impactMs: 50,
              problem: 'O(n^2) scan',
            },
          ],
        }),
      };
    }
    return { status: 404, body: '{}' };
  });
  const driftPort = await listen(drift.server);

  const gh = captureServer((req) => {
    if (req.method === 'GET' && /\/issues\/\d+\/comments/.test(req.url)) {
      return { status: 200, body: '[]' };
    }
    if (req.method === 'POST' && req.url.endsWith('/check-runs')) {
      return { status: 201, body: '{"id":999}' };
    }
    if (req.method === 'POST' && /\/issues\/\d+\/comments$/.test(req.url)) {
      return { status: 201, body: '{"id":111}' };
    }
    return { status: 404, body: '{}' };
  });
  const ghPort = await listen(gh.server);

  const dir = mkdtempSync(join(tmpdir(), 'drift-e2e-'));
  const eventPath = join(dir, 'event.json');
  const outPath = join(dir, 'github_output');
  writeFileSync(outPath, '');
  writeFileSync(
    eventPath,
    JSON.stringify({
      pull_request: {
        number: 13,
        title: 'speed up checkout',
        html_url: 'https://github.com/acme/shop/pull/13',
        head: { ref: 'feat/checkout', sha: 'deadbeefcafe1234567890abcdef0123456789ab' },
        base: { ref: 'main' },
        user: { login: 'octocat' },
      },
    }),
  );

  // Wrapper redirects api.github.com → fake server before loading the action
  const distPath = join(import.meta.dirname, '../../../dist/index.js');
  const wrapper = join(dir, 'wrapper.cjs');
  writeFileSync(
    wrapper,
    `
const realFetch = globalThis.fetch;
globalThis.fetch = (url, init) => {
  const u = String(url).replace('https://api.github.com', 'http://127.0.0.1:${ghPort}');
  return realFetch(u, init);
};
require(${JSON.stringify(distPath)});
`,
  );

  let result: RunResult;
  try {
    result = await new Promise<RunResult>((resolve, reject) => {
      const proc = spawn('node', [wrapper], {
        env: {
          ...process.env,
          DRIFT_API_URL: `http://127.0.0.1:${driftPort}`,
          DRIFT_API_TOKEN: 'test-token',
          DRIFT_PROFILE_COMMAND: writeProfileFixture(dir, {
            p95LatencyMs: 250,
            cpuPct: 50,
            dbQueries: 12,
            dbNPlusOne: 0,
            cacheHitRate: 90,
            issues: [
              {
                severity: 'high',
                title: 'Hot loop',
                filePath: 'src/hot.ts',
                lineNumber: 10,
                impactMs: 50,
                problem: 'O(n^2) scan',
              },
            ],
          }),
          DRIFT_FAIL_ON: 'regression',
          DRIFT_COMMENT: 'true',
          GITHUB_TOKEN: 'gh-test-token',
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY: 'acme/shop',
          GITHUB_OUTPUT: outPath,
        },
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (c) => (stdout += c.toString('utf8')));
      proc.stderr.on('data', (c) => (stderr += c.toString('utf8')));
      proc.on('error', reject);
      proc.on('close', (code) => resolve({ code, stdout, stderr }));
      setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`timed out\nstdout: ${stdout}\nstderr: ${stderr}`));
      }, 15000).unref();
    });
  } finally {
    await close(drift.server);
    await close(gh.server);
  }

  assert.equal(result.code, 1, `expected exit 1\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);

  const out = readFileSync(outPath, 'utf8');
  assert.match(out, /scan-id<<__DRIFT_EOF__\n7\n/);
  assert.match(out, /verdict<<__DRIFT_EOF__\nregression\n/);

  const ingest = drift.captured.find((c) => c.url === '/api/ingest/scans');
  assert.ok(ingest, 'ingest call missing');
  assert.equal(ingest.headers['authorization'], 'Bearer test-token');
  const ingestBody = JSON.parse(ingest.body);
  assert.equal(ingestBody.pr.number, 13);
  assert.equal(ingestBody.pr.headSha, 'deadbeefcafe1234567890abcdef0123456789ab');
  assert.equal(ingestBody.repo.owner, 'acme');
  assert.equal(ingestBody.repo.name, 'shop');

  const checkCall = gh.captured.find((c) => c.url.endsWith('/check-runs'));
  assert.ok(checkCall, 'check run call missing');
  assert.equal(checkCall.headers['authorization'], 'Bearer gh-test-token');
  const checkBody = JSON.parse(checkCall.body);
  assert.equal(checkBody.conclusion, 'failure');
  assert.equal(checkBody.head_sha, 'deadbeefcafe1234567890abcdef0123456789ab');
  assert.equal(checkBody.output.annotations[0].annotation_level, 'failure');
  assert.equal(checkBody.output.annotations[0].path, 'src/hot.ts');

  const commentCall = gh.captured.find(
    (c) => c.method === 'POST' && /\/issues\/\d+\/comments$/.test(c.url),
  );
  assert.ok(commentCall, 'sticky comment POST missing');
  const cb = JSON.parse(commentCall.body);
  assert.match(cb.body, /<!-- drift:sticky-comment -->/);
  assert.match(cb.body, /REGRESSION/);
});

test('action exits 0 when verdict is pass even with fail-on=regression', async () => {
  const drift = captureServer(() => ({
    status: 200,
    body: JSON.stringify({
      id: 8,
      url: 'https://app.drift.dev/scans/8',
      verdict: 'pass',
      verdictSub: 'within tolerance',
      p95LatencyMs: 195,
      p95BaselineMs: 200,
      cpuPct: 40,
      cpuBaselinePct: 40,
      dbQueries: 12,
      dbNPlusOne: 0,
      cacheHitRate: 90,
      issues: [],
    }),
  }));
  const driftPort = await listen(drift.server);

  const dir = mkdtempSync(join(tmpdir(), 'drift-e2e-pass-'));
  const eventPath = join(dir, 'event.json');
  writeFileSync(
    eventPath,
    JSON.stringify({
      pull_request: {
        number: 1,
        title: 't',
        html_url: 'https://github.com/a/b/pull/1',
        head: { ref: 'h', sha: 'a'.repeat(40) },
        base: { ref: 'main' },
        user: { login: 'u' },
      },
    }),
  );

  let result: RunResult;
  try {
    result = await runAction({
      DRIFT_API_URL: `http://127.0.0.1:${driftPort}`,
      DRIFT_PROFILE_COMMAND: writeProfileFixture(dir, {
        p95LatencyMs: 195,
        cpuPct: 40,
        dbQueries: 12,
        dbNPlusOne: 0,
        cacheHitRate: 90,
        issues: [],
      }),
      DRIFT_FAIL_ON: 'regression',
      DRIFT_COMMENT: 'false',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'a/b',
      GITHUB_TOKEN: '',
    });
  } finally {
    await close(drift.server);
  }

  assert.equal(result.code, 0, `expected exit 0\nstderr: ${result.stderr}`);
});

test('action skips silently when event has no pull_request', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drift-e2e-skip-'));
  const eventPath = join(dir, 'event.json');
  writeFileSync(eventPath, JSON.stringify({ ref: 'refs/heads/main' }));

  const result = await runAction({
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_REPOSITORY: 'a/b',
    DRIFT_COMMENT: 'false',
    DRIFT_PROFILE_COMMAND: 'true',
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Drift only runs on pull_request/);
});
