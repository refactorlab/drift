// Complexity & Risk gauge report (charts-of-metrics.md).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderQualityGauges } from '../render/sections/quality_gauges.ts';
import { validate, extractBlocks, isInstalled } from '../../scripts/validate-mermaid.mjs';
import type { GaugeLevel, PrReviewExt, QualityGauge } from '../report.ts';

function g(id: string, group: string, label: string, score: number, hib: boolean, level: GaugeLevel): QualityGauge {
  return { id, group, label, score, higher_is_better: hib, level, arrow: hib ? '↓' : '↑', description: `${label} description.` };
}

/** The full 18-gauge set, as the profiler emits them. */
function fullExt(): PrReviewExt {
  const gauges: QualityGauge[] = [
    g('token_footprint', 'LLM Complexity', 'Token footprint', 92, false, 'critical'),
    g('context_window_pressure', 'LLM Complexity', 'Context window pressure', 88, false, 'critical'),
    g('agent_reviewability', 'LLM Complexity', 'Agent reviewability', 28, true, 'high'),
    g('semantic_density', 'LLM Complexity', 'Semantic density', 80, false, 'critical'),
    g('explainability', 'Comprehensibility', 'Explainability score', 40, true, 'high'),
    g('context_dependency', 'Comprehensibility', 'Context dependency', 90, false, 'critical'),
    g('decision_transparency', 'Comprehensibility', 'Decision transparency', 45, true, 'moderate'),
    g('maintenance_burden', 'Longevity', 'Maintenance burden', 70, false, 'high'),
    g('debt_delta', 'Longevity', 'Debt introduced vs. resolved', 75, false, 'high'),
    g('fragility_index', 'Longevity', 'Fragility index', 85, false, 'critical'),
    g('test_coverage', 'Correctness Confidence', 'Test coverage (changed lines)', 55, true, 'moderate'),
    g('repeatability', 'Correctness Confidence', 'Repeatability', 50, true, 'moderate'),
    g('edge_case_surface', 'Correctness Confidence', 'Edge case surface', 75, false, 'high'),
    g('rollback_complexity', 'Operational', 'Rollback complexity', 80, false, 'critical'),
    g('observability', 'Operational', 'Observability', 35, true, 'high'),
    g('blast_radius', 'Operational', 'Blast radius', 95, false, 'critical'),
    g('knowledge_concentration', 'Team & Process', 'Knowledge concentration', 82, false, 'critical'),
    g('review_fatigue', 'Team & Process', 'Review fatigue risk', 90, false, 'critical'),
  ];
  return {
    pr_quality: {
      gauges,
      gauge_summary: {
        context_fits: false,
        token_estimate: 134_000,
        token_limit: 128_000,
        highest: [
          { label: 'Blast radius', score: 95 },
          { label: 'Token footprint', score: 92 },
        ],
        lowest: [{ label: 'Agent reviewability', score: 28 }],
      },
    },
  };
}

test('gauges: renders all 18 across six numbered groups with pills, bars, details', () => {
  const out = renderQualityGauges(fullExt())!;
  assert.match(out, /## Complexity & Risk Report/);
  // six numbered groups
  for (const [n, name] of [
    [1, 'LLM Complexity'],
    [2, 'Comprehensibility'],
    [3, 'Longevity'],
    [4, 'Correctness Confidence'],
    [5, 'Operational'],
    [6, 'Team & Process'],
  ] as const) {
    assert.match(out, new RegExp(`### ${n}\\. ${name}`), `group ${name}`);
  }
  // every gauge heading present (18 #### headings)
  const headings = out.match(/^#### /gm) ?? [];
  assert.equal(headings.length, 18, `expected 18 gauge headings, got ${headings.length}`);
  // pill badge + Mermaid bar + (non-LLM) description block
  assert.match(out, /#### Token footprint !\[/); // shields pill badge on the heading
  assert.match(out, /```mermaid\n%%\{init:[\s\S]*?flowchart LR\n {4}f\["█+"\]:::done/); // Mermaid bar, not quickchart
  assert.doesNotMatch(out, /quickchart\.io\/chart\?/, 'gauge bars are Mermaid now, not quickchart');
  assert.match(out, /<summary>Description &amp; analysis<\/summary>/);
});

test('gauges: LLM-context verdict badge', () => {
  // The band legend and the highest/lowest call-out lines were dropped from the
  // copy; only the LLM-context verdict badge remains above the grouped sections.
  const out = renderQualityGauges(fullExt())!;
  assert.match(out, /\*\*LLM Context:\*\*/);
  assert.match(out, /EXCEEDED/); // context_fits=false
  // Removed copy stays gone.
  assert.doesNotMatch(out, /img\.shields\.io\/static\/v1\?label=LOW/);
  assert.doesNotMatch(out, /Blast radius \(95\)/);
  assert.doesNotMatch(out, /Agent reviewability \(28\)/);
});

test('gauges: "Higher is better" only on quality metrics', () => {
  const out = renderQualityGauges(fullExt())!;
  const hib = (out.match(/^\*Higher is better\*$/gm) ?? []).length;
  // agent_reviewability, explainability, decision_transparency, test_coverage,
  // repeatability, observability = 6 quality metrics
  assert.equal(hib, 6, `expected 6 'Higher is better' markers, got ${hib}`);
});

test('gauges: context-fits verdict flips to FITS', () => {
  const ext = fullExt();
  ext.pr_quality!.gauge_summary!.context_fits = true;
  ext.pr_quality!.gauge_summary!.token_estimate = 12_000;
  const out = renderQualityGauges(ext)!;
  assert.match(out, /FITS 12k tokens/);
  assert.doesNotMatch(out, /EXCEEDED/);
});

test('gauges: degrades to null when absent', () => {
  assert.equal(renderQualityGauges(undefined), null);
  assert.equal(renderQualityGauges({}), null);
  assert.equal(renderQualityGauges({ pr_quality: {} }), null);
  assert.equal(renderQualityGauges({ pr_quality: { gauges: [] } }), null);
});

test('gauges: descriptions are HTML-escaped (no injection)', () => {
  // Use a non-LLM group: LLM Complexity gauges intentionally render no
  // "Description & analysis" detail, so the escaping must be exercised on a
  // group that still emits the description block.
  const ext: PrReviewExt = {
    pr_quality: {
      gauges: [
        {
          ...g('x', 'Comprehensibility', 'X', 50, false, 'moderate'),
          description: '<script>alert(1)</script> & <b>bold</b>',
        },
      ],
    },
  };
  const out = renderQualityGauges(ext)!;
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(out, /<script>/);
});

test('gauges: all shields URLs are encoded; bars + radar carry no quickchart', () => {
  const out = renderQualityGauges(fullExt())!;
  // 18 gauge pills + the LLM-context badge are shields; the bars + radar are
  // Mermaid (no quickchart). Every shields URL must be properly encoded.
  const urls = out.match(/https:\/\/img\.shields\.io\/[^)\s]*/g) ?? [];
  assert.ok(urls.length >= 18, `expected ≥18 shields badge URLs (pills + context), got ${urls.length}`);
  for (const u of urls) {
    assert.doesNotMatch(u, /\s/, `URL must not contain raw whitespace: ${u}`);
    assert.doesNotMatch(u, /[<>"]/, `URL must not contain raw markup chars: ${u}`);
  }
  assert.doesNotMatch(out, /quickchart\.io/, 'bars + radar are Mermaid — no quickchart anywhere');
});

test('gauges: single-series radar-beta chart is emitted', () => {
  const out = renderQualityGauges(fullExt())!;
  // The radar is a Mermaid `radar-beta` chart (dark theme), not a quickchart image.
  assert.match(out, /```mermaid\n---\nconfig:[\s\S]*?radar-beta/);
  assert.match(out, /^ {2}title This PR$/m);
  assert.match(out, /axis tf\["Token footprint"\]/);
  assert.match(out, /curve pr\["This PR"\]\{[\d, ]+\}/);
  assert.match(out, /^ {2}max 100$/m);
  assert.match(out, /^ {2}graticule polygon$/m);
  assert.doesNotMatch(out, /quickchart\.io\/chart\?bkg=%230d0d10/, 'no quickchart radar anymore');
});

test('gauges: renders REAL profiler output (golden fixture, full Rust→JSON→TS round-trip)', () => {
  // Captured from `pr-review` on tests/fixtures/python-fastapi with diff-stats.
  const raw = readFileSync(new URL('./fixtures/pr-quality-fastapi.json', import.meta.url), 'utf8');
  const fixture = JSON.parse(raw) as { pr_review_ext: PrReviewExt };
  const out = renderQualityGauges(fixture.pr_review_ext)!;
  assert.ok(out && out.length > 1000, 'renders a substantial report from real output');
  // 18 gauges across 6 numbered groups.
  assert.equal((out.match(/^#### /gm) ?? []).length, 18, '18 gauge headings');
  for (let n = 1; n <= 6; n++) assert.match(out, new RegExp(`### ${n}\\. `), `group ${n}`);
  // Real token footprint (3120 tokens) → fits the standard window.
  assert.match(out, /FITS .*tokens/);
  // Radar present (Mermaid radar-beta); bars are Mermaid too — no quickchart left.
  assert.match(out, /radar-beta/);
  assert.doesNotMatch(out, /quickchart\.io/, 'no quickchart images — bars + radar are Mermaid');
  const urls = out.match(/https:\/\/img\.shields\.io\/[^)\s]*/g) ?? [];
  for (const u of urls) assert.doesNotMatch(u, /\s|[<>"]/, `unencoded URL: ${u}`);
});

test('gauges: matches the copy layout (embed-ready)', () => {
  const out = renderQualityGauges(fullExt())!;
  // H2 retained (wrapSection consumes it as the summary title)…
  assert.match(out, /^## Complexity & Risk Report$/m);
  // …but the standalone intro line is dropped (the LLM-context badge comes
  // right after the H2).
  assert.doesNotMatch(out, /Per-metric complexity and risk scores for this PR/);
  // The IMPORTANT callout is removed in the copy.
  assert.doesNotMatch(out, /\[!IMPORTANT\]/);
  assert.doesNotMatch(out, /Why LLM complexity matters/);
  // The "Reading the scale" <details> note was dropped entirely.
  assert.doesNotMatch(out, /<summary>Reading the scale<\/summary>/);
  assert.doesNotMatch(out, /Higher is better.*quality metrics/s);
  // Body opens on the LLM-context badge immediately after the H2.
  assert.match(out, /^## Complexity & Risk Report\n\n\*\*LLM Context:\*\*/);
});

test('gauges: every Mermaid block (18 bars + the radar) PARSES in the real engine', async (t) => {
  if (!(await isInstalled())) return void t.skip('mermaid validator not installed');
  // The 18 per-gauge bars + the radar-beta chart are all Mermaid (with init
  // directives / config frontmatter) — syntaxes GitHub silently fails to render
  // if malformed. Validate every emitted block against the REAL mermaid parser,
  // not just string assertions.
  const out = renderQualityGauges(fullExt())!;
  const blocks = await extractBlocks(out);
  assert.equal(blocks.length, 19, `expected 18 bars + 1 radar = 19 mermaid blocks, got ${blocks.length}`);
  assert.ok(blocks.some((b) => /radar-beta/.test(b)), 'the radar-beta chart is among them');
  assert.ok(blocks.some((b) => /flowchart LR\n {4}f\["█+"\]:::done/.test(b)), 'the gauge bars are among them');
  for (const b of blocks) {
    const res = await validate(b);
    assert.ok(res.ok, `Mermaid block failed real-parser validation: ${res.error}\n---\n${b}`);
  }
});
