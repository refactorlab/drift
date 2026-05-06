import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runProfile } from '../profile.ts';

test('runProfile reads JSON written to $DRIFT_REPORT_PATH', async () => {
  const cmd = `node -e "
    const fs = require('node:fs');
    fs.writeFileSync(process.env.DRIFT_REPORT_PATH, JSON.stringify({
      p95LatencyMs: 184,
      cpuPct: 41,
      dbQueries: 23,
      dbNPlusOne: 1,
      cacheHitRate: 87,
      issues: [{ severity: 'high', title: 't', filePath: 'a.ts', impactMs: 5 }]
    }));
  "`;
  const report = await runProfile(cmd);
  assert.equal(report.p95LatencyMs, 184);
  assert.equal(report.cpuPct, 41);
  assert.equal(report.issues.length, 1);
});

test('runProfile rejects when command exits non-zero', async () => {
  await assert.rejects(
    () => runProfile('exit 2'),
    /exited with status 2/,
  );
});

test('runProfile rejects when report missing required field', async () => {
  const cmd = `node -e "require('node:fs').writeFileSync(process.env.DRIFT_REPORT_PATH, '{}')"`;
  await assert.rejects(
    () => runProfile(cmd),
    /missing required field "p95LatencyMs"/,
  );
});
