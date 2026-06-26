import { describe, it, expect } from 'vitest';
import { buildRiskBrief, formatRiskBrief } from './riskBrief';
import sample from '../app/__fixtures__/sampleScan.json';

describe('buildRiskBrief — grounded in the REAL scan artifact', () => {
  const brief = buildRiskBrief(sample)!;

  it('returns a brief for a real scan', () => {
    expect(brief).not.toBeNull();
  });

  it('derives the "address" verdict from the act-before-merge quadrant (the bug: this was always "review")', () => {
    expect(brief.verdict).toBe('address');
    expect(brief.verdictLabel).toBe('Address before merge');
    expect(brief.actBefore.length).toBeGreaterThan(0);
  });

  it('matches the transcript merge confidence (2/5, from composite 0.34)', () => {
    expect(brief.mergeConfidence).toBe(2);
    expect(brief.band).toBe('E');
  });

  it('ranks act-before risks by severity×likelihood — wide blast radius leads', () => {
    expect(brief.actBefore[0].label).toMatch(/blast radius/i);
    // sorted descending by weight
    const weights = brief.actBefore.map((r) => (r.severity ?? 0) * (r.likelihood ?? 0));
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it('surfaces the critical metrics from the transcript (Blast radius 100, Review fatigue 100)', () => {
    const labels = brief.criticalGauges.map((g) => g.label);
    expect(labels).toContain('Blast radius');
    expect(labels).toContain('Review fatigue risk');
    expect(brief.criticalGauges.find((g) => g.label === 'Blast radius')?.score).toBe(100);
  });

  it('carries the human finding messages (e.g. the XSS sink), not invented prose', () => {
    const messages = brief.findings.map((f) => f.message).join(' ');
    expect(messages).toMatch(/dangerouslySetInnerHTML|XSS/i);
    expect(brief.findings[0].where).toBeTruthy();
  });

  it('caps each list so the brief stays inside the context window', () => {
    expect(brief.actBefore.length).toBeLessThanOrEqual(6);
    expect(brief.criticalGauges.length).toBeLessThanOrEqual(6);
    expect(brief.findings.length).toBeLessThanOrEqual(5);
  });

  it('returns null for non-scan input', () => {
    expect(buildRiskBrief({ schema: 'derived' })).toBeNull();
    expect(buildRiskBrief(null)).toBeNull();
  });
});

describe('formatRiskBrief — faithful, never "no risks" when there are risks', () => {
  const { content, spoken } = formatRiskBrief(buildRiskBrief(sample)!);

  it('states the real verdict and confidence', () => {
    expect(content).toContain('Risk verdict: Address before merge (merge confidence 2/5).');
  });

  it('lists the act-before-merge risks with the blast-radius item', () => {
    expect(content).toContain('Act on before merge');
    expect(content).toMatch(/blast radius/i);
  });

  it('includes the critical metrics and the concrete finding', () => {
    expect(content).toContain('Critical metrics:');
    expect(content).toContain('Blast radius 100');
    expect(content).toMatch(/dangerouslySetInnerHTML|XSS/i);
  });

  it('NEVER claims the PR is clean when it is not (the regression we are fixing)', () => {
    expect(content.toLowerCase()).not.toContain('no risks were flagged to act on before merge');
    expect(content).toContain('clear the act-before-merge items above before merging');
  });

  it('the spoken variant is short, grounded, and names a top risk', () => {
    expect(spoken.toLowerCase()).toContain('address before merge');
    expect(spoken.toLowerCase()).toContain('confidence 2 out of 5');
    expect(spoken).toMatch(/blast radius/i);
    expect(spoken.length).toBeLessThan(400);
  });
});

describe('buildRiskBrief / formatRiskBrief — a LOW-risk PR is reported honestly too', () => {
  const clean = {
    pr_review: {
      overall_drift: { percent: 0.4, direction: 'up', interpretation: 'Avg. quality ▲' },
      code_suggestions: [],
      visual_summary: { risks: { items: [{ label: 'PR size · 3 files', likelihood: 0.1, severity: 0.2, quadrant: 'acceptable' }] } },
    },
    pr_review_ext: {
      pr_quality: { composite: { score: 0.9, band: 'A', label: 'ship with confidence' }, gauges: [] },
      tech_debt: { pr_findings_top: [] },
    },
  };

  it('reports "review" with no act-before blockers (does not pretend there is a problem)', () => {
    const brief = buildRiskBrief(clean)!;
    expect(brief.verdict).toBe('review');
    expect(brief.verdictLabel).toBe('ship with confidence');
    expect(brief.mergeConfidence).toBe(5);
    expect(brief.actBefore).toHaveLength(0);

    const { content, spoken } = formatRiskBrief(brief);
    expect(content).toContain('No risks were flagged to act on before merge.');
    expect(content).toContain('no act-before-merge blockers');
    expect(spoken.toLowerCase()).toContain('no act-before-merge blockers');
  });
});
