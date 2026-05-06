import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  annotationLevel,
  annotationsFor,
  checkConclusion,
  checkSummary,
  checkTitle,
  commentBody,
  shouldFail,
  STICKY_MARKER,
} from '../render.ts';
import type { ScanResponse } from '../api.ts';

const sampleScan: ScanResponse = {
  id: 42,
  url: 'https://app.drift.dev/scans/42',
  verdict: 'regression',
  verdictSub: 'p95 +120ms vs baseline',
  p95LatencyMs: 320,
  p95BaselineMs: 200,
  cpuPct: 55,
  cpuBaselinePct: 40,
  dbQueries: 23,
  dbNPlusOne: 1,
  cacheHitRate: 87,
  issues: [
    {
      severity: 'high',
      title: 'N+1 in /api/orders',
      filePath: 'src/routes/orders.ts',
      lineNumber: 42,
      impactMs: 120,
      problem: 'Sequential SELECT for each order line',
    },
    {
      severity: 'medium',
      title: 'Slow regex',
      filePath: 'src/util/parse.ts',
      lineNumber: 17,
      impactMs: 18,
    },
  ],
};

test('annotationLevel maps severity to GitHub level', () => {
  assert.equal(annotationLevel('high'), 'failure');
  assert.equal(annotationLevel('medium'), 'warning');
  assert.equal(annotationLevel('low'), 'notice');
});

test('checkConclusion maps verdict to GitHub conclusion', () => {
  assert.equal(checkConclusion('pass'), 'success');
  assert.equal(checkConclusion('regression'), 'failure');
  assert.equal(checkConclusion('error'), 'neutral');
});

test('shouldFail respects fail-on policy', () => {
  assert.equal(shouldFail('pass', 'never'), false);
  assert.equal(shouldFail('regression', 'never'), false);
  assert.equal(shouldFail('error', 'never'), false);

  assert.equal(shouldFail('pass', 'regression'), false);
  assert.equal(shouldFail('regression', 'regression'), true);
  assert.equal(shouldFail('error', 'regression'), false);

  assert.equal(shouldFail('pass', 'any'), false);
  assert.equal(shouldFail('regression', 'any'), true);
  assert.equal(shouldFail('error', 'any'), true);
});

test('checkTitle for regression includes delta', () => {
  assert.equal(
    checkTitle(sampleScan),
    'Regression · p95 +120ms vs baseline',
  );
  assert.equal(
    checkTitle({ ...sampleScan, verdict: 'pass' }),
    'OK · p95 320ms',
  );
  assert.equal(
    checkTitle({ ...sampleScan, verdict: 'error' }),
    'Drift could not complete',
  );
});

test('checkSummary contains metrics and top issues', () => {
  const md = checkSummary(sampleScan);
  assert.match(md, /p95 latency \| 320ms \| 200ms/);
  assert.match(md, /N\+1 in \/api\/orders/);
  assert.match(md, /\(\+120ms\)/);
  assert.match(md, /\[Open full report →\]\(https:\/\/app\.drift\.dev\/scans\/42\)/);
});

test('checkSummary omits "Top issues" header when no issues', () => {
  const md = checkSummary({ ...sampleScan, issues: [] });
  assert.doesNotMatch(md, /Top issues/);
});

test('commentBody starts with the sticky marker', () => {
  const md = commentBody(sampleScan);
  assert.ok(md.startsWith(STICKY_MARKER), 'must start with sticky marker for upsert lookup');
});

test('commentBody renders delta with sign', () => {
  const md = commentBody(sampleScan);
  assert.match(md, /\| 320ms \| 200ms \| \+120ms \|/);

  const faster = commentBody({ ...sampleScan, p95LatencyMs: 150 });
  assert.match(faster, /\| 150ms \| 200ms \| -50ms \|/);
});

test('commentBody picks emoji by verdict', () => {
  assert.match(commentBody({ ...sampleScan, verdict: 'pass' }), /🟢/);
  assert.match(commentBody({ ...sampleScan, verdict: 'regression' }), /🔴/);
  assert.match(commentBody({ ...sampleScan, verdict: 'error' }), /⚪/);
});

test('annotationsFor caps at 50 issues (Checks API per-request limit)', () => {
  const many = Array.from({ length: 75 }, (_, i) => ({
    severity: 'low' as const,
    title: `Issue ${i}`,
    filePath: `src/file-${i}.ts`,
    lineNumber: i + 1,
    impactMs: 1,
  }));
  const out = annotationsFor({ ...sampleScan, issues: many });
  assert.equal(out.length, 50);
});

test('annotationsFor falls back to line 1 when no lineNumber', () => {
  const [a] = annotationsFor({
    ...sampleScan,
    issues: [
      { severity: 'low', title: 't', filePath: 'p.ts', impactMs: 0 },
    ],
  });
  assert.equal(a.start_line, 1);
  assert.equal(a.end_line, 1);
});
