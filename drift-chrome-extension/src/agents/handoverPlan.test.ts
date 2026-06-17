import { describe, expect, it } from 'vitest';
import { buildHandoverPlan, formatHandoverPlan, HANDOVER_STEP_CAP } from './handoverPlan';
import type { ScanRecord } from '../state/scanHistory';
import type { ChangedFileStatus } from '../core/prDiff';

const file = (path: string, code: ChangedFileStatus['code'], add: number, del = 0): ChangedFileStatus => ({
  path,
  code,
  additions: add,
  deletions: del,
});

function recordOf(changedStatus: ChangedFileStatus[], scan?: unknown): ScanRecord {
  return { changedStatus, scan, changedFiles: changedStatus.length } as unknown as ScanRecord;
}

const SCAN = {
  pr_scope: { affected_roots: ['src/core'] },
  pr_review: {
    visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/core/auth.ts', why: 'Auth rewrite' }] }] } },
    architecture_flow: { diff_merged_structured: { nodes: [{ id: '1', label: 'login.ts', class: 'changed' }] } },
  },
};

describe('buildHandoverPlan', () => {
  const steps = buildHandoverPlan(
    recordOf(
      [
        file('src/core/auth.ts', 'M', 50, 10), // key file → critical
        file('src/core/login.ts', 'M', 30, 5), // source under affected root → core
        file('src/util/helpers.ts', 'M', 5, 2), // source, no signal → support
        file('src/core/auth.test.ts', 'A', 40), // test → support
        file('package-lock.json', 'M', 200, 100), // dep manifest → minor (largest, but stays minor)
        file('README.md', 'M', 3), // docs → minor
      ],
      SCAN,
    ),
  );

  it('puts the scan key file first as critical, with its `why` as rationale', () => {
    expect(steps[0].path).toBe('src/core/auth.ts');
    expect(steps[0].tier).toBe('critical');
    expect(steps[0].rationale).toBe('Auth rewrite');
  });

  it('orders by tier (critical→minor), not raw change size', () => {
    expect(steps.map((s) => s.path)).toEqual([
      'src/core/auth.ts', // critical
      'src/core/login.ts', // core (under affected root)
      'src/core/auth.test.ts', // support (size 40, before helpers)
      'src/util/helpers.ts', // support (size 7)
      'package-lock.json', // minor (size 300, but tier wins)
      'README.md', // minor (size 3)
    ]);
  });

  it('tiers + rationales reflect file role', () => {
    const byPath = Object.fromEntries(steps.map((s) => [s.path, s]));
    expect(byPath['src/core/login.ts'].tier).toBe('core');
    expect(byPath['src/core/login.ts'].rationale).toContain('src/core');
    expect(byPath['package-lock.json'].tier).toBe('minor');
    expect(byPath['package-lock.json'].rationale).toMatch(/dependency/i);
    expect(byPath['src/core/auth.test.ts'].tier).toBe('support');
  });

  it('treats source as core when the scan has no architectural signals', () => {
    const s = buildHandoverPlan(recordOf([file('a.ts', 'M', 10), file('a.test.ts', 'A', 5)]));
    expect(s.find((x) => x.path === 'a.ts')?.tier).toBe('core'); // fallback
    expect(s.find((x) => x.path === 'a.test.ts')?.tier).toBe('support');
  });

  it('caps the number of steps (keeping the top tiers)', () => {
    const many = Array.from({ length: HANDOVER_STEP_CAP + 10 }, (_, i) => file(`f${i}.ts`, 'M', 1));
    expect(buildHandoverPlan(recordOf(many)).length).toBe(HANDOVER_STEP_CAP);
    expect(buildHandoverPlan(recordOf(many), 3).length).toBe(3);
  });
});

describe('formatHandoverPlan', () => {
  it('groups by tier with headers and notes omitted files', () => {
    const steps = buildHandoverPlan(recordOf([file('src/core/auth.ts', 'M', 9), file('package.json', 'M', 1)], SCAN));
    const out = formatHandoverPlan(steps, 4);
    expect(out).toMatch(/Critical:/);
    expect(out).toMatch(/Minor:/);
    expect(out).toMatch(/\+4 more/);
  });
});
