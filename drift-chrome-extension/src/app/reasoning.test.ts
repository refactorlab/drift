import { describe, it, expect } from 'vitest';
import { buildReasoning } from './reasoning';
import { SAMPLE_REPORT } from './__fixtures__/sampleReport';
import type { PrContext } from '../core/types';

const ctx: PrContext = {
  pr: { owner: 'refactorlab', repo: 'andy', number: 36, title: 'Refactor renderer', url: 'u' },
  report: SAMPLE_REPORT,
  artifacts: [
    { name: 'pr-scan.json', url: 'a', kind: 'scan-report' },
    { name: 'pr-scan-context.json', url: 'b', kind: 'scan-context' },
  ],
  detectedAt: 0,
};

describe('buildReasoning', () => {
  const steps = buildReasoning(ctx);
  const texts = steps.map((s) => s.text);
  const blob = texts.join('\n');

  it('opens by naming the PR it recognised', () => {
    expect(texts[0]).toContain('andy#36');
  });

  it('grounds the verdict and merge confidence in the report', () => {
    expect(blob).toMatch(/Verdict: Address before merge — merge confidence 0\/5/);
  });

  it('surfaces the real critical metrics (4 in the sample report)', () => {
    // SAMPLE_REPORT has 4 critical metrics; the headline names the count.
    expect(blob).toMatch(/4 critical metrics/);
    // Top critical by percent is Blast radius / Review fatigue (both 100%).
    expect(blob).toMatch(/Blast radius|Review fatigue risk/);
  });

  it('reports blast radius and flags missing tests from real values', () => {
    expect(blob).toMatch(/Blast radius 100 — wide/);
    expect(blob).toMatch(/No new tests/);
  });

  it('lists the downloadable artifacts without a sign-in prompt', () => {
    expect(blob).toMatch(/pr-scan\.json, pr-scan-context\.json/);
    expect(blob).not.toMatch(/Sign in to GitHub/);
    expect(blob).toMatch(/your GitHub session/);
  });

  it('ends with an actionable focus', () => {
    expect(texts[texts.length - 1]).toMatch(/Suggested focus|Ask me anything/);
  });

  it('invents no numbers — every percent shown exists in the report', () => {
    const reportPercents = new Set(
      SAMPLE_REPORT.sections.flatMap((s) => s.metrics.map((m) => m.percent)),
    );
    const shown = blob.match(/(\d+)%/g)?.map((p) => Number(p.replace('%', ''))) ?? [];
    for (const p of shown) expect(reportPercents.has(p)).toBe(true);
  });
});
