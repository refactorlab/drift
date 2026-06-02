import { describe, it, expect } from 'vitest';
import { scanToReport, isScanOutput, enrichWithScan } from './scanReport';
import { emptyReport, type DriftReport } from './types';

// A synthetic ScanPrOutput matching scan_pr_output.openapi.yaml — the real
// artifact shape, NOT our derived/scraped shape.
const scan = {
  schema_version: '1.2',
  mode: 'static',
  pr_review: {
    overall_drift: { percent: -4.6, direction: 'down', confidence: 'high' },
    code_suggestions: [{ category: 'a' }, { category: 'b' }, { category: 'c' }],
    visual_summary: {
      risks: [
        { label: 'r1', quadrant: 'act_before_merge' },
        { label: 'r2', quadrant: 'monitor_closely' },
      ],
    },
  },
  pr_review_ext: {
    pr_quality: {
      composite: { score: 0.2, band: 'D', label: 'Needs work' },
      gauges: [
        { group: 'LLM Complexity', label: 'Token footprint', score: 2, level: 'low', arrow: '↑' },
        { group: 'LLM Complexity', label: 'Semantic density', score: 80, level: 'critical', arrow: '↑' },
        { group: 'Operational', label: 'Blast radius', score: 100, level: 'high', arrow: '↑' },
      ],
    },
  },
};

describe('scanToReport (real scan → dashboard)', () => {
  it('recognises a real ScanPrOutput vs our derived shape', () => {
    expect(isScanOutput(scan)).toBe(true);
    expect(isScanOutput({ schema: 'drift.pr-scan/derived-v1' })).toBe(false);
    expect(isScanOutput(null)).toBe(false);
  });

  it('maps gauges into grouped sections in the canonical order', () => {
    const r = scanToReport(scan, 'u')!;
    expect(r.sections.map((s) => s.title)).toEqual(['LLM Complexity', 'Operational']);
    expect(r.sections[0].metrics[0]).toMatchObject({
      name: 'Token footprint',
      level: 'low',
      percent: 2,
      direction: 'up',
    });
    // 'high' maps to our 'critical' band.
    expect(r.sections[1].metrics[0]).toMatchObject({ name: 'Blast radius', level: 'critical' });
  });

  it('derives headline gauges from composite/drift/risks/suggestions', () => {
    const r = scanToReport(scan, 'u')!;
    const g = Object.fromEntries(r.gauges.map((x) => [x.key, x.display]));
    expect(g['merge-confidence']).toBe('1/5'); // round(0.2*5)
    expect(g['drift']).toBe('−4.6%');
    expect(g['risks']).toBe('2');
    expect(g['suggestions']).toBe('3');
    expect(r.mergeConfidence).toEqual({ value: 1, outOf: 5 });
  });

  it('sets verdict to address when a risk is act_before_merge', () => {
    const r = scanToReport(scan, 'u')!;
    expect(r.verdict).toBe('address');
    expect(r.verdictLabel).toBe('Address before merge');
    expect(r.metricCount).toBe(3);
    expect(r.criticalCount).toBe(2); // Semantic density (critical) + Blast radius (high→critical)
  });

  it('surfaces blast radius from the Blast radius gauge', () => {
    const r = scanToReport(scan, 'u')!;
    expect(r.blastRadius).toBe(100);
  });

  it('keeps every gauge as a metric across its group (no params dropped)', () => {
    const r = scanToReport(scan, 'u')!;
    const total = r.sections.reduce((n, s) => n + s.metrics.length, 0);
    expect(total).toBe(scan.pr_review_ext.pr_quality.gauges.length);
  });

  it('returns null for non-scan input', () => {
    expect(scanToReport({ schema: 'drift.pr-scan/derived-v1' }, 'u')).toBeNull();
  });
});

describe('enrichWithScan (graft scan sections onto authoritative comment headline)', () => {
  // A comment-scraped report: authoritative headline, sparse sections.
  const scraped: DriftReport = {
    ...emptyReport(),
    found: true,
    verdictLabel: 'Address before merge',
    mergeConfidence: { value: 0, outOf: 5 },
    criticalCount: 4,
    metricCount: 18,
    blastRadius: 100,
    sections: [{ index: 1, title: 'LLM Complexity', metrics: [] }],
  };
  const fromScan = scanToReport(scan, 'u')!; // mergeConfidence 1/5, 2 critical, blast 100

  it('keeps the comment merge-confidence, NOT the scan composite-derived one', () => {
    const v = enrichWithScan(scraped, fromScan);
    expect(v.mergeConfidence).toEqual({ value: 0, outOf: 5 });
    expect(v.verdictLabel).toBe('Address before merge');
  });

  it('replaces sparse sections with the scan’s full param list', () => {
    const v = enrichWithScan(scraped, fromScan);
    expect(v.sections).toBe(fromScan.sections);
    expect(v.sections.length).toBeGreaterThan(scraped.sections.length);
  });

  it('prefers the comment’s summary counts over the scan’s', () => {
    const v = enrichWithScan(scraped, fromScan);
    expect(v.criticalCount).toBe(4); // comment value, not scan's inflated count
    expect(v.metricCount).toBe(18);
  });

  it('backfills counts the comment lacked', () => {
    const v = enrichWithScan({ ...scraped, criticalCount: null, blastRadius: null }, fromScan);
    expect(v.criticalCount).toBe(fromScan.criticalCount);
    expect(v.blastRadius).toBe(100);
  });

  it('is a no-op when there is no scan or no scan sections', () => {
    expect(enrichWithScan(scraped, null)).toBe(scraped);
    expect(enrichWithScan(scraped, { ...fromScan, sections: [] })).toBe(scraped);
  });
});
