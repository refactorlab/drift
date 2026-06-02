// A realistic sample report, transcribed from a real Andy comment, used as a
// fixture by the reasoning unit tests. Test-only — never imported by runtime
// code (it lives under __fixtures__ for exactly that reason).

import type { DriftReport } from '../../core/types';

export const SAMPLE_REPORT: DriftReport = {
  found: true,
  verdict: 'address',
  verdictLabel: 'Address before merge',
  effortLabel: 'High risk · 60 min+ review',
  mergeConfidence: { value: 0, outOf: 5 },
  gauges: [
    { key: 'merge-confidence', label: 'MERGE CONFIDENCE', display: '0/5', fraction: 0, tone: 'bad' },
    { key: 'review-effort', label: 'REVIEW EFFORT', display: '5/5', fraction: 1, tone: 'warn' },
    { key: 'risks', label: 'RISKS', display: '7', fraction: null, tone: 'bad' },
    { key: 'drift', label: 'DRIFT', display: '−5.5%', fraction: 0.055, tone: 'info' },
    { key: 'suggestions', label: 'SUGGESTIONS', display: '383', fraction: null, tone: 'info' },
    { key: 'new-tests', label: 'NEW TESTS', display: '0', fraction: null, tone: 'warn' },
  ],
  blastRadius: 100,
  criticalCount: 4,
  metricCount: 18,
  sections: [
    {
      index: 1,
      title: 'LLM Complexity',
      metrics: [
        { name: 'Token footprint', level: 'low', percent: 2, direction: 'up' },
        { name: 'Context window pressure', level: 'low', percent: 11, direction: 'up' },
        { name: 'Agent reviewability', level: 'low', percent: 70, direction: 'down' },
        { name: 'Semantic density', level: 'low', percent: 25, direction: 'up' },
      ],
    },
    {
      index: 2,
      title: 'Comprehensibility',
      metrics: [
        { name: 'Explainability score', level: 'low', percent: 86, direction: 'down' },
        { name: 'Context dependency', level: 'low', percent: 32, direction: 'up' },
        { name: 'Decision transparency', level: 'critical', percent: 20, direction: 'down' },
      ],
    },
    {
      index: 3,
      title: 'Longevity',
      metrics: [
        { name: 'Maintenance burden', level: 'low', percent: 30, direction: 'up' },
        { name: 'Debt introduced vs. resolved', level: 'low', percent: 16, direction: 'up' },
        { name: 'Fragility index', level: 'critical', percent: 81, direction: 'up' },
      ],
    },
    {
      index: 4,
      title: 'Correctness Confidence',
      metrics: [
        { name: 'Test coverage (changed lines)', level: 'moderate', percent: 60, direction: 'down' },
        { name: 'Repeatability', level: 'low', percent: 100, direction: 'down' },
        { name: 'Edge case surface', level: 'moderate', percent: 46, direction: 'up' },
      ],
    },
    {
      index: 5,
      title: 'Operational',
      metrics: [
        { name: 'Rollback complexity', level: 'low', percent: 30, direction: 'up' },
        { name: 'Observability', level: 'low', percent: 97, direction: 'down' },
        { name: 'Blast radius', level: 'critical', percent: 100, direction: 'up' },
      ],
    },
    {
      index: 6,
      title: 'Team & Process',
      metrics: [
        { name: 'Knowledge concentration', level: 'low', percent: 27, direction: 'up' },
        { name: 'Review fatigue risk', level: 'critical', percent: 100, direction: 'up' },
      ],
    },
  ],
  prUrl: 'https://github.com/refactorlab/andy/pull/36',
  scrapedAt: 0,
};
