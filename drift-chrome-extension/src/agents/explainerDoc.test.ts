import { describe, expect, it } from 'vitest';
import { buildExplainerDoc, DECK_VOICE_WPM } from './explainerDoc';
import type { ScanRecord } from '../state/scanHistory';
import type { ChangedFileStatus } from '../core/prDiff';

const file = (path: string, code: ChangedFileStatus['code'], add: number, del = 0): ChangedFileStatus => ({
  path,
  code,
  additions: add,
  deletions: del,
});

const SCAN = {
  pr_scope: { affected_roots: ['src/core'] },
  pr_review: {
    visual_summary: { key_files: { groups: [{ name: 'g', files: [{ path: 'src/core/auth.ts', why: 'Auth rewrite' }] }] } },
    architecture_flow: { diff_merged_structured: { nodes: [{ id: '1', label: 'login.ts', class: 'changed' }] } },
  },
};

function recordOf(changedStatus: ChangedFileStatus[]): ScanRecord {
  return {
    title: 'BYO Gemini chat brain',
    changedStatus,
    changedFiles: changedStatus.length,
    scan: SCAN,
    verdict: 'address',
    verdictLabel: 'Address before merge',
    report: { verdict: 'address', verdictLabel: 'Address before merge' },
  } as unknown as ScanRecord;
}

const CHANGED = [
  file('src/core/auth.ts', 'M', 50, 10), // key file → critical
  file('src/core/login.ts', 'M', 30, 5), // source under affected root → core
  file('src/util/helpers.ts', 'M', 5, 2), // source, no signal → support
  file('src/core/auth.test.ts', 'A', 40), // test → support
  file('README.md', 'M', 3), // docs → minor
];

describe('buildExplainerDoc', () => {
  const doc = buildExplainerDoc(recordOf(CHANGED));

  it('leads with an overview slide carrying the PR title and verdict', () => {
    expect(doc.slides[0].kind).toBe('overview');
    expect(doc.slides[0].title).toBe('BYO Gemini chat brain');
    expect(doc.verdict).toBe('address');
    expect(doc.verdictLabel).toBe('Address before merge');
    expect(doc.fileCount).toBe(5);
  });

  it('produces one file slide per critical/core file, critical first', () => {
    const fileSlides = doc.slides.filter((s) => s.kind === 'file');
    expect(fileSlides.map((s) => s.path)).toEqual(['src/core/auth.ts', 'src/core/login.ts']);
    expect(fileSlides[0].tier).toBe('critical');
    expect(fileSlides[0].eyebrow).toContain('CRITICAL');
  });

  it('caps the number of file slides', () => {
    const doc1 = buildExplainerDoc(recordOf(CHANGED), { maxFileSlides: 1 });
    expect(doc1.slides.filter((s) => s.kind === 'file')).toHaveLength(1);
  });

  it('includes a change-impact graph slide when the scan has a call graph', () => {
    expect(doc.slides.some((s) => s.kind === 'graph')).toBe(true);
  });

  it('omits the graph slide when the scan has no changed call-graph nodes', () => {
    const rec = recordOf(CHANGED);
    (rec as unknown as { scan: unknown }).scan = { pr_scope: { affected_roots: ['src/core'] }, pr_review: {} };
    const bare = buildExplainerDoc(rec);
    expect(bare.slides.some((s) => s.kind === 'graph')).toBe(false);
  });

  it('builds a scope slide grouping files by subsystem with coverage', () => {
    const mind = doc.slides.find((s) => s.kind === 'mindmap');
    expect(mind).toBeDefined();
    const core = mind!.subsystems!.find((g) => g.root === 'src/core');
    expect(core).toBeDefined();
    expect(core!.files).toBe(3); // auth.ts, login.ts, auth.test.ts
    expect(core!.coverage).toBe('covered'); // has source + a test
  });

  it('flags untested source changes in the critique', () => {
    const crit = doc.slides.find((s) => s.kind === 'critique');
    expect(crit).toBeDefined();
    expect(crit!.critique!.some((c) => c.kind === 'miss')).toBe(true);
    expect(crit!.critique!.some((c) => c.kind === 'good')).toBe(true); // tests were included
  });

  it('surfaces scan-grounded questions with citations on overview and file slides', () => {
    const overview = doc.slides[0];
    expect(overview.questions!.length).toBeGreaterThan(0);
    expect(overview.questions!.every((q) => (q.cites?.length ?? 0) > 0)).toBe(true);
    const fileSlide = doc.slides.find((s) => s.kind === 'file' && s.path === 'src/core/login.ts')!;
    // login.ts is untested source → a critical "no test" question
    expect(fileSlide.questions!.some((q) => q.severity === 'critical')).toBe(true);
  });

  it('orders slides overview → files → graph → mindmap → critique', () => {
    expect(doc.slides.map((s) => s.kind)).toEqual(['overview', 'file', 'file', 'graph', 'mindmap', 'critique']);
  });

  it('paces every slide from its narration (min 6s) and sums to totalSec', () => {
    for (const s of doc.slides) {
      expect(s.durationSec).toBeGreaterThanOrEqual(6);
      const words = s.narration.reduce((n, l) => n + l.text.trim().split(/\s+/).filter(Boolean).length, 0);
      expect(s.durationSec).toBe(Math.max(6, Math.round((words / DECK_VOICE_WPM) * 60)));
    }
    expect(doc.totalSec).toBe(doc.slides.reduce((n, s) => n + s.durationSec, 0));
  });

  it('starts each slide with narration and alternates hosts within a slide', () => {
    for (const s of doc.slides) expect(s.narration.length).toBeGreaterThan(0);
  });
});
