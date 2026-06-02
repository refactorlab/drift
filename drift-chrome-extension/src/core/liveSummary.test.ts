import { describe, it, expect } from 'vitest';
import { buildNarration, summaryLine, type LiveScanMeta } from './liveSummary';
import { emptyReport, type DriftReport, type Gauge } from './types';

const meta: LiveScanMeta = { owner: 'acme', repo: 'webapp', number: 142, title: 'Add billing retry', changedFiles: 12 };

function gauge(key: string, label: string, display: string): Gauge {
  return { key, label, display, fraction: null, tone: 'info' };
}

function fullReport(): DriftReport {
  return {
    ...emptyReport(),
    found: true,
    verdict: 'address',
    verdictLabel: 'Address before merge',
    mergeConfidence: { value: 3, outOf: 5 },
    gauges: [
      gauge('merge-confidence', 'MERGE CONFIDENCE', '3/5'),
      gauge('drift', 'DRIFT', '+5.5%'),
      gauge('risks', 'RISKS', '2'),
      gauge('suggestions', 'SUGGESTIONS', '4'),
    ],
    criticalCount: 1,
    metricCount: 18,
    sections: [
      {
        index: 1,
        title: 'LLM Complexity',
        metrics: [
          { name: 'Token footprint', level: 'critical', percent: 90, direction: 'up' },
          { name: 'Nesting depth', level: 'low', percent: 10, direction: 'down' },
        ],
      },
    ],
  };
}

describe('summaryLine', () => {
  it('joins confidence, drift, risks and changed files', () => {
    expect(summaryLine(fullReport(), meta)).toBe('3/5 confidence · +5.5% drift · 2 risks · 12 files');
  });

  it('singularizes a one-file, one-risk change', () => {
    const r = fullReport();
    r.gauges = [gauge('risks', 'RISKS', '1')];
    r.mergeConfidence = null;
    expect(summaryLine(r, { ...meta, changedFiles: 1 })).toBe('1 risk · 1 file');
  });
});

describe('buildNarration', () => {
  it('narrates the headline numbers, critical metric and verdict', () => {
    const text = buildNarration(fullReport(), meta);
    expect(text).toContain('Drift live scan of webapp, pull request 142: Add billing retry.');
    expect(text).toContain('12 files changed.');
    expect(text).toContain('Merge confidence 3 out of 5.');
    expect(text).toContain('Overall drift up 5.5%.');
    expect(text).toContain('2 risks flagged and 4 code suggestions.');
    expect(text).toContain('1 critical metric across 18 measured: Token footprint.');
    expect(text).toContain('Verdict: Address before merge.');
  });

  it('speaks a negative drift as "down"', () => {
    const r = fullReport();
    r.gauges = [gauge('drift', 'DRIFT', '−5.5%')];
    expect(buildNarration(r, meta)).toContain('Overall drift down 5.5%.');
  });

  it('omits sections a partial scan lacks (no confidence, no critical, no title)', () => {
    const r: DriftReport = {
      ...emptyReport(),
      found: true,
      verdict: 'review',
      verdictLabel: 'Reviewed',
      gauges: [gauge('risks', 'RISKS', '0'), gauge('suggestions', 'SUGGESTIONS', '0')],
    };
    const text = buildNarration(r, { ...meta, title: null, changedFiles: 1 });
    expect(text).toBe('Drift live scan of webapp, pull request 142. 1 file changed. Verdict: Reviewed.');
    expect(text).not.toContain('Merge confidence');
    expect(text).not.toContain('critical');
  });
});
