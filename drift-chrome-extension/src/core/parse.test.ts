import { describe, it, expect, beforeEach } from 'vitest';
import { parseReport, findReportRoot, isPrPage } from './parse';

// A fixture mirroring how GitHub renders the Andy/Drift sticky comment:
// markdown badges become <img alt="…"> and `### N.` / `#### Name ![…]` become
// <h3>/<h4> with an inline badge image. Values match tmp/pr-comment-self.md.
const COMMENT_HTML = `
<div class="timeline-comment">
  <div class="comment-body markdown-body">
    <p><img alt="Drift review" src="x.png"></p>
    <p>
      <img alt="⚠ Address before merge" src="b1.svg">
      <img alt="Merge confidence 0/5" src="b2.svg">
      <img alt="High risk · 60 min+ review" src="b3.svg">
    </p>
    <table><tr>
      <td><img alt="MERGE CONFIDENCE 0/5" src="g1"></td>
      <td><img alt="REVIEW EFFORT 5/5" src="g2"></td>
      <td><img alt="RISKS 7" src="g3"></td>
      <td><img alt="DRIFT −5.5%" src="g4"></td>
      <td><img alt="SUGGESTIONS 383" src="g5"></td>
      <td><img alt="NEW TESTS 0" src="g6"></td>
    </tr></table>
    <p>Complexity &amp; Risk Report — Blast radius 100 · 4 critical · 18 metrics</p>
    <h3>1. LLM Complexity</h3>
    <h4>Token footprint <img alt="LOW 2% ↑" src="m"></h4>
    <h4>Context window pressure <img alt="LOW 11% ↑" src="m"></h4>
    <h3>2. Comprehensibility</h3>
    <h4>Decision transparency <img alt="CRITICAL 20% ↓" src="m"></h4>
    <h3>5. Operational</h3>
    <h4>Blast radius <img alt="CRITICAL 100% ↑" src="m"></h4>
  </div>
</div>`;

describe('parseReport', () => {
  beforeEach(() => {
    document.body.innerHTML = COMMENT_HTML;
  });

  it('locates the report root via gauge alt text', () => {
    expect(findReportRoot(document)).not.toBeNull();
  });

  it('parses verdict, effort and merge confidence', () => {
    const r = parseReport(document);
    expect(r.found).toBe(true);
    expect(r.verdict).toBe('address');
    expect(r.verdictLabel).toMatch(/Address before merge/);
    expect(r.effortLabel).toMatch(/60 min\+ review/);
    expect(r.mergeConfidence).toEqual({ value: 0, outOf: 5 });
  });

  it('parses all six headline gauges with fractions', () => {
    const r = parseReport(document);
    const byKey = Object.fromEntries(r.gauges.map((g) => [g.key, g]));
    expect(Object.keys(byKey).sort()).toEqual(
      ['drift', 'merge-confidence', 'new-tests', 'review-effort', 'risks', 'suggestions'].sort(),
    );
    expect(byKey['merge-confidence'].fraction).toBe(0);
    expect(byKey['review-effort'].fraction).toBe(1);
    expect(byKey['risks'].fraction).toBeNull(); // raw count
    expect(byKey['drift'].display).toBe('−5.5%');
  });

  it('parses the summary line', () => {
    const r = parseReport(document);
    expect(r.blastRadius).toBe(100);
    expect(r.criticalCount).toBe(4);
    expect(r.metricCount).toBe(18);
  });

  it('parses sections and metrics with level/percent/direction', () => {
    const r = parseReport(document);
    expect(r.sections.map((s) => s.index)).toEqual([1, 2, 5]);
    const first = r.sections[0];
    expect(first.title).toBe('LLM Complexity');
    expect(first.metrics[0]).toEqual({
      name: 'Token footprint',
      level: 'low',
      percent: 2,
      direction: 'up',
    });
    const critical = r.sections[1].metrics[0];
    expect(critical).toMatchObject({ level: 'critical', percent: 20, direction: 'down' });
  });

  it('does not mistake the "Drift review" logo alt for the DRIFT gauge', () => {
    const r = parseReport(document);
    const drift = r.gauges.find((g) => g.key === 'drift');
    expect(drift?.display).toBe('−5.5%'); // not "review"
  });

  it('returns an empty report when no Drift comment is present', () => {
    document.body.innerHTML = '<div class="comment-body">just a normal PR comment</div>';
    expect(parseReport(document).found).toBe(false);
  });
});

describe('isPrPage', () => {
  it('matches /owner/repo/pull/123', () => {
    expect(isPrPage({ pathname: '/refactorlab/andy/pull/36' } as Location)).toBe(true);
    expect(isPrPage({ pathname: '/refactorlab/andy/issues/36' } as Location)).toBe(false);
  });
});
