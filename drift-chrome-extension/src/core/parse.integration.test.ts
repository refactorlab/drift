import { describe, it, expect } from 'vitest';
import { marked } from 'marked';
import { parseReport } from './parse';
// Vite inlines the fixture as a raw string at transform time.
import md from './__fixtures__/andy-comment.md?raw';

// Integration test against a REAL Andy/Drift PR comment (a verbatim copy of a
// posted comment). We render its markdown the way GitHub does, drop it into the
// jsdom document, and assert the parser recovers the full report end-to-end.
// This is the test that proves the alt-text scraper works on production output,
// not just a hand-built fixture.

describe('parseReport — real Andy comment', () => {
  it('recovers the full report from rendered GitHub markdown', async () => {
    document.body.innerHTML = await marked.parse(md);
    const r = parseReport(document);

    expect(r.found).toBe(true);
    expect(r.verdict).toBe('address');
    expect(r.verdictLabel).toMatch(/Address before merge/);
    expect(r.mergeConfidence).toEqual({ value: 0, outOf: 5 });

    // All six headline gauges, with the values from the real comment.
    const g = Object.fromEntries(r.gauges.map((x) => [x.key, x.display]));
    expect(g['merge-confidence']).toBe('0/5');
    expect(g['review-effort']).toBe('5/5');
    expect(g['risks']).toBe('7');
    expect(g['suggestions']).toBe('383');
    expect(g['new-tests']).toBe('0');
    expect(g['drift']).toMatch(/5\.5%/);

    // Summary line.
    expect(r.blastRadius).toBe(100);
    expect(r.criticalCount).toBe(4);
    expect(r.metricCount).toBe(18);

    // Six report sections, 18 metrics total.
    expect(r.sections.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6]);
    const total = r.sections.reduce((n, s) => n + s.metrics.length, 0);
    expect(total).toBe(18);

    // Spot-check a couple of known metrics.
    const all = r.sections.flatMap((s) => s.metrics);
    const blast = all.find((m) => m.name === 'Blast radius');
    expect(blast).toMatchObject({ level: 'critical', percent: 100, direction: 'up' });
    const token = all.find((m) => m.name === 'Token footprint');
    expect(token).toMatchObject({ level: 'low', percent: 2 });

    // Exactly four CRITICAL metrics, matching "4 critical" in the summary.
    expect(all.filter((m) => m.level === 'critical')).toHaveLength(4);
  });
});
