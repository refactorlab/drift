import { describe, expect, it } from 'vitest';
import { asScanOutput, groupGauges, GROUP_ORDER, type QualityGauge } from './scanOutput';
import sample from '../app/__fixtures__/sampleScan.json';

describe('asScanOutput', () => {
  it('accepts a payload with PR markers', () => {
    expect(asScanOutput({ pr_review: {} })).not.toBeNull();
    expect(asScanOutput({ pr_scope: {} })).not.toBeNull();
  });
  it('rejects non-scan payloads', () => {
    expect(asScanOutput(null)).toBeNull();
    expect(asScanOutput({ foo: 1 })).toBeNull();
    expect(asScanOutput('x')).toBeNull();
  });
  it('recognizes the real scan fixture', () => {
    const s = asScanOutput(sample);
    expect(s).not.toBeNull();
    expect(s!.pr_review_ext?.pr_quality?.gauges).toHaveLength(18);
    expect(s!.pr_review_ext?.pr_quality?.composite?.label).toBe('do not merge as-is');
  });
});

describe('groupGauges', () => {
  const gauges = (asScanOutput(sample)!.pr_review_ext!.pr_quality!.gauges ?? []) as QualityGauge[];

  it('produces the 6 canonical groups in order', () => {
    const groups = groupGauges(gauges).map((g) => g.group);
    // Every group present is from the known set, and ordered per GROUP_ORDER.
    const expectedOrder = GROUP_ORDER.filter((g) => groups.includes(g));
    expect(groups).toEqual([...expectedOrder]);
  });

  it('keeps all 18 gauges across the groups', () => {
    const total = groupGauges(gauges).reduce((n, g) => n + g.gauges.length, 0);
    expect(total).toBe(18);
  });

  it('sorts unknown groups last without dropping them', () => {
    const odd: QualityGauge[] = [
      { id: 'x', group: 'Zzz', label: 'X', score: 1, higher_is_better: true, level: 'low', arrow: '', description: '' },
      { id: 'y', group: 'LLM Complexity', label: 'Y', score: 1, higher_is_better: true, level: 'low', arrow: '', description: '' },
    ];
    const groups = groupGauges(odd).map((g) => g.group);
    expect(groups).toEqual(['LLM Complexity', 'Zzz']);
  });
});
