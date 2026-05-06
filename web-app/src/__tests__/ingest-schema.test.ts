import { test, expect } from 'bun:test';
import {
  ScanIngestSchema,
  authorizeBearer,
  computeVerdict,
} from '../ingest/schema.ts';

const validPayload = {
  repo: { owner: 'acme', name: 'shop' },
  pr: {
    number: 13,
    title: 'speed up checkout',
    branch: 'feat/checkout',
    baseBranch: 'main',
    author: 'octocat',
    url: 'https://github.com/acme/shop/pull/13',
    headSha: 'a'.repeat(40),
  },
  baselineRef: 'main',
  report: {
    p95LatencyMs: 184,
    cpuPct: 41,
    dbQueries: 23,
    dbNPlusOne: 1,
    cacheHitRate: 87,
    issues: [
      {
        severity: 'high',
        title: 'N+1',
        filePath: 'src/x.ts',
        lineNumber: 42,
        impactMs: 120,
      },
    ],
  },
};

test('ScanIngestSchema accepts a complete payload', () => {
  const r = ScanIngestSchema.safeParse(validPayload);
  expect(r.success).toBe(true);
});

test('ScanIngestSchema applies defaults when report fields are omitted', () => {
  const minimal = {
    ...validPayload,
    report: { p95LatencyMs: 200 },
  };
  const r = ScanIngestSchema.safeParse(minimal);
  expect(r.success).toBe(true);
  if (r.success) {
    expect(r.data.report.cpuPct).toBe(0);
    expect(r.data.report.issues).toEqual([]);
  }
});

test('ScanIngestSchema rejects missing PR number', () => {
  const bad = structuredClone(validPayload) as any;
  delete bad.pr.number;
  const r = ScanIngestSchema.safeParse(bad);
  expect(r.success).toBe(false);
});

test('ScanIngestSchema rejects negative p95', () => {
  const bad = structuredClone(validPayload);
  bad.report.p95LatencyMs = -1;
  const r = ScanIngestSchema.safeParse(bad);
  expect(r.success).toBe(false);
});

test('ScanIngestSchema rejects unknown severity', () => {
  const bad = structuredClone(validPayload) as any;
  bad.report.issues[0].severity = 'critical';
  const r = ScanIngestSchema.safeParse(bad);
  expect(r.success).toBe(false);
});

test('ScanIngestSchema rejects non-URL pr.url', () => {
  const bad = structuredClone(validPayload);
  bad.pr.url = 'not-a-url';
  const r = ScanIngestSchema.safeParse(bad);
  expect(r.success).toBe(false);
});

test('authorizeBearer is open when no token configured', () => {
  expect(authorizeBearer(undefined, undefined)).toBe(true);
  expect(authorizeBearer('Bearer anything', undefined)).toBe(true);
});

test('authorizeBearer requires Bearer prefix and exact match', () => {
  expect(authorizeBearer('Bearer t1', 't1')).toBe(true);
  expect(authorizeBearer('bearer t1', 't1')).toBe(true);
  expect(authorizeBearer('Bearer wrong', 't1')).toBe(false);
  expect(authorizeBearer('Token t1', 't1')).toBe(false);
  expect(authorizeBearer(undefined, 't1')).toBe(false);
});

test('computeVerdict marks p95 within 10% of baseline as pass', () => {
  expect(computeVerdict(200, 200).verdict).toBe('pass');
  expect(computeVerdict(220, 200).verdict).toBe('pass'); // exactly +10%
  expect(computeVerdict(180, 200).verdict).toBe('pass');
});

test('computeVerdict marks p95 over the threshold as regression', () => {
  expect(computeVerdict(221, 200).verdict).toBe('regression');
  expect(computeVerdict(300, 200).verdict).toBe('regression');
});

test('computeVerdict subtitle reports the delta', () => {
  const r = computeVerdict(300, 200);
  expect(r.verdictSub).toBe('p95 300ms is +100ms vs baseline');
});
