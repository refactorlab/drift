import { describe, it, expect } from 'vitest';
import { buildReviewBrief } from './reviewBrief';

// A representative scan-pr.json slice covering every reviewer-facing section.
const scan = {
  pr_review: {
    business_logic: { summary: 'Adds retry with backoff to the billing charge path.' },
    counts: {
      features: { value: 2, label: 'features' },
      bug_fixes: { value: 1, label: 'bug fixes' },
      issues_resolved: { value: 0, label: 'issues' },
      new_test_files: { value: 3, label: 'tests' },
    },
    value_card: { bottom_line: 'Reduces failed charges; small added complexity.' },
    code_suggestions: [
      { category: 'A', file: 'a.ts', confidence: 0.4, severity: 'low', why_it_matters: 'nit' },
      { category: 'A', file: 'billing/charge.ts', line: 42, confidence: 0.8, severity: 'critical', why_it_matters: 'Retry can double-charge on partial failure' },
      { category: 'A', file: 'api/users.ts', confidence: 0.6, severity: 'high', why_it_matters: 'N+1 query under load' },
    ],
    visual_summary: {
      risks: { items: [
        { label: 'Acceptable nit', likelihood: 0.9, severity: 0.9, quadrant: 'acceptable' },
        { label: 'Double-charge on retry', likelihood: 0.3, severity: 0.5, quadrant: 'act_before_merge' },
      ] },
      key_files: { groups: [
        { name: 'core', files: [{ path: 'billing/charge.ts', why: 'holds the retry logic' }, { path: 'config.ts' }] },
      ] },
    },
  },
  pr_review_ext: {
    pr_quality: { composite: { band: 'C', label: 'do not merge as-is' } },
    tests_in_graph: { uncovered_roots: ['billing/charge.ts::charge'] },
    nfr_edge_cases: { reliability_gaps: ['No timeout on the retry loop'] },
    tech_debt: { summary_findings_top: [{ node_id: '/repo/billing.ts::Charger::charge', kind: 'complex', file: 'billing.ts' }] },
    duplication: { count: 2 },
  },
  pr_scope: {
    affected_roots: ['billing', 'api'],
    unreachable_changes: ['legacy/old.ts::dead'],
  },
  pr_description: 'This PR adds exponential backoff to charge retries.\n\nFixes flaky payments.',
};

describe('buildReviewBrief', () => {
  it('extracts the reviewer-facing sections from a full scan', () => {
    const b = buildReviewBrief(scan, ['feat: add backoff\n\nbody text', 'test: cover charge']);
    expect(b.description).toContain('exponential backoff');
    expect(b.businessSummary).toContain('retry with backoff');
    expect(b.qualityBand).toBe('C — do not merge as-is');
    expect(b.counts).toEqual(['2 features', '1 bug fix', '3 new test files']); // issues_resolved=0 dropped
    expect(b.valueBottomLine).toContain('Reduces failed charges');
    expect(b.uncoveredRoots).toEqual(['billing/charge.ts::charge']);
    expect(b.reliabilityGaps).toEqual(['No timeout on the retry loop']);
    expect(b.duplication).toBe(2);
    expect(b.affectedRoots).toEqual(['billing', 'api']);
    expect(b.unreachableChanges).toEqual(['legacy/old.ts::dead']);
  });

  it('ranks risks with act_before_merge first', () => {
    const b = buildReviewBrief(scan);
    expect(b.risks?.[0]).toMatchObject({ label: 'Double-charge on retry', quadrant: 'act_before_merge' });
  });

  it('orders suggestions by severity and drops the low one below the serious ones', () => {
    const b = buildReviewBrief(scan);
    expect(b.suggestions?.[0]).toMatchObject({ file: 'billing/charge.ts', line: 42, severity: 'critical' });
    expect(b.suggestions?.[0].why).toContain('double-charge');
    expect(b.suggestions?.[1].severity).toBe('high');
  });

  it('labels key files with their reason and tech debt with its kind', () => {
    const b = buildReviewBrief(scan);
    expect(b.keyFiles?.[0]).toBe('billing/charge.ts — holds the retry logic');
    expect(b.techDebt?.[0]).toContain('charge (complex)'); // derived from node_id tail + kind
  });

  it('takes commit subjects (first line only) and caps them', () => {
    const b = buildReviewBrief(scan, ['feat: add backoff\n\nlong body', 'chore: tidy']);
    expect(b.commits).toEqual(['feat: add backoff', 'chore: tidy']);
  });

  it('carries the PR authors and keeps them even when the payload is not a scan', () => {
    expect(buildReviewBrief(scan, undefined, ['Ada Lovelace']).authors).toEqual(['Ada Lovelace']);
    expect(buildReviewBrief({ not: 'a scan' }, undefined, ['Grace Hopper'])).toEqual({ authors: ['Grace Hopper'] });
  });

  it('returns {} for a non-scan payload', () => {
    expect(buildReviewBrief({ not: 'a scan' })).toEqual({});
    expect(buildReviewBrief(null)).toEqual({});
  });

  it('omits empty sections so callers can truthiness-check', () => {
    const b = buildReviewBrief({ pr_review: {}, pr_review_ext: {}, pr_scope: {} });
    expect(b.risks).toBeUndefined();
    expect(b.suggestions).toBeUndefined();
    expect(b.counts).toBeUndefined();
    expect('duplication' in b).toBe(false);
  });
});
