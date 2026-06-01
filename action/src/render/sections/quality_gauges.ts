// Complexity & Risk Report — the lead section of the sticky comment
// (charts-of-metrics.md). Renders the 18 PR-quality gauges the profiler
// computes (pr_review_ext.pr_quality.gauges) as: a band legend, an
// LLM-context verdict, highest/lowest call-outs, six grouped sections of
// (band pill · quickchart bar · description), a reading-scale note, and a
// single-series radar.
//
// Bulletproofing:
//   • All scoring/orientation is done in Rust; this file is pure presentation.
//   • shields badges use the static/v1 QUERY form with encodeURIComponent on
//     every segment — no path dash/underscore-escaping minefield, no injection.
//   • quickchart configs are plain JSON (encodeURIComponent(JSON.stringify))
//     — no `getGradientFillHelper` eval-string to sanitize; a solid level
//     colour on a dark track replaces the gradient.
//   • Returns null when no gauges are present, so the comment degrades cleanly.

import type { GaugeLevel, GaugeSummary, PrReviewExt, QualityGauge } from '../../report.ts';
import { escapeHtml } from '../lib/format.ts';

// charts-of-metrics.md palette (Tailwind), shields colours need no leading '#'.
const LEVEL_HEX: Record<GaugeLevel, string> = {
  low: '22c55e',
  moderate: 'eab308',
  high: 'f97316',
  critical: 'ef4444',
};
const LEVEL_LABEL: Record<GaugeLevel, string> = {
  low: 'LOW',
  moderate: 'MODERATE',
  high: 'HIGH',
  critical: 'CRITICAL',
};

// One-line section intros, keyed by gauge `group` (verbatim intent from the doc).
const GROUP_INTRO: Record<string, string> = {
  'LLM Complexity':
    'Evaluating AI-driven code-review readiness. High structural entanglement or exceeding model context limits silently degrades automated reviews.',
  Comprehensibility: 'Human readability, cognitive load, and engineering transparency.',
  Longevity: 'Code health, technical-debt impact, and long-term maintainability.',
  'Correctness Confidence': 'Test coverage, isolation of side effects, and edge-case safety.',
  Operational: 'Post-deployment stability, operability, and rollback capability.',
  'Team & Process': 'Organizational dynamics and review safety.',
};

/** Markdown image-alt: strip `[]` and newlines so the `![alt](url)` never breaks. */
function altText(s: string): string {
  return s.replace(/[\][\n\r]/g, ' ').trim();
}

/** shields.io static badge via the query form (every segment URL-encoded). */
function shield(label: string, message: string, hex: string): string {
  const p = (s: string) => encodeURIComponent(s);
  return `https://img.shields.io/static/v1?label=${p(label)}&message=${p(message)}&color=${hex}&style=for-the-badge`;
}

/** The band pill repeating the exact value + direction arrow. */
function pill(g: QualityGauge): string {
  const hex = LEVEL_HEX[g.level] ?? LEVEL_HEX.moderate;
  const lvl = LEVEL_LABEL[g.level] ?? 'MODERATE';
  const message = `${g.score}% ${g.arrow}`;
  return `![${altText(`${lvl} ${g.score}%`)}](${shield(lvl, message, hex)})`;
}

/** A thin horizontal gauge bar: score-long solid level colour on a dark track. */
function bar(g: QualityGauge): string {
  const hex = LEVEL_HEX[g.level] ?? LEVEL_HEX.moderate;
  const score = Math.max(0, Math.min(100, Math.round(g.score)));
  const config = {
    type: 'bar',
    data: {
      labels: [''],
      datasets: [
        { data: [score], backgroundColor: `#${hex}`, borderRadius: 3, borderSkipped: false, barThickness: 6 },
        { data: [100 - score], backgroundColor: '#22252a', borderRadius: 3, borderSkipped: false, barThickness: 6 },
      ],
    },
    options: {
      indexAxis: 'y',
      layout: { padding: 0 },
      scales: {
        x: { stacked: true, display: false, min: 0, max: 100 },
        y: { stacked: true, display: false },
      },
      plugins: { legend: { display: false } },
    },
  };
  const url = `https://quickchart.io/chart?w=280&h=20&v=3&bkg=transparent&c=${encodeURIComponent(JSON.stringify(config))}`;
  return `![${altText(`${g.label} gauge`)}](${url})`;
}

function tokensK(n: number | undefined): string {
  if (!n || n <= 0) return '0';
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

function llmContextBadge(s: GaugeSummary): string {
  const tk = tokensK(s.token_estimate);
  const limit = tokensK(s.token_limit);
  if (s.context_fits) {
    return `![LLM context: FITS ${tk} tokens](${shield('LLM_CONTEXT', `FITS ${tk} tokens`, LEVEL_HEX.low)})`;
  }
  return `![LLM context: EXCEEDED ${tk} tokens (${limit} limit)](${shield('LLM_CONTEXT', `EXCEEDED ${tk} tokens (${limit} limit)`, LEVEL_HEX.critical)})`;
}

/** Single-series radar over the 14 headline axes (matches the doc's labels). */
const RADAR_AXES: Array<{ id: string; label: string }> = [
  { id: 'token_footprint', label: 'Token footprint' },
  { id: 'context_window_pressure', label: 'Context window pressure' },
  { id: 'agent_reviewability', label: 'Agent reviewability' },
  { id: 'semantic_density', label: 'Semantic density' },
  { id: 'explainability', label: 'Explainability' },
  { id: 'context_dependency', label: 'Context dependency' },
  { id: 'maintenance_burden', label: 'Maintenance burden' },
  { id: 'fragility_index', label: 'Fragility index' },
  { id: 'test_coverage', label: 'Test coverage' },
  { id: 'edge_case_surface', label: 'Edge case surface' },
  { id: 'rollback_complexity', label: 'Rollback complexity' },
  { id: 'blast_radius', label: 'Blast radius' },
  { id: 'knowledge_concentration', label: 'Knowledge concentration' },
  { id: 'review_fatigue', label: 'Review fatigue risk' },
];

function radar(byId: Map<string, QualityGauge>): string {
  const labels = RADAR_AXES.map((a) => a.label);
  const data = RADAR_AXES.map((a) => byId.get(a.id)?.score ?? 0);
  const config = {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: 'This PR',
          backgroundColor: 'rgba(79,142,230,0.18)',
          borderColor: 'rgb(79,142,230)',
          pointBackgroundColor: 'rgb(79,142,230)',
          borderWidth: 2,
          pointRadius: 3,
          data,
        },
      ],
    },
    options: {
      legend: { position: 'top', labels: { fontColor: '#c8ccd2', fontSize: 13, usePointStyle: true } },
      scale: {
        ticks: { min: 0, max: 100, stepSize: 25, backdropColor: 'rgba(0,0,0,0)', fontColor: '#7a7f87' },
        gridLines: { color: 'rgba(255,255,255,0.07)' },
        angleLines: { color: 'rgba(255,255,255,0.07)' },
        pointLabels: { fontColor: '#9aa0a6', fontSize: 13 },
      },
    },
  };
  const url = `https://quickchart.io/chart?bkg=%230d0d10&w=1000&h=720&v=2&c=${encodeURIComponent(JSON.stringify(config))}`;
  return `![Full metric profile radar](${url})`;
}

/**
 * Render the gauge report. Returns null when there are no gauges (so the
 * overview omits the section cleanly).
 */
export function renderQualityGauges(ext: PrReviewExt | undefined): string | null {
  const gauges = ext?.pr_quality?.gauges;
  if (!gauges || gauges.length === 0) return null;
  const summary = ext?.pr_quality?.gauge_summary ?? {};
  const byId = new Map(gauges.map((g) => [g.id, g]));

  const out: string[] = [];

  // H2 is consumed by wrapSection as the collapsible's summary title; the
  // body opens straight on the band legend (matches charts-of-metrics copy.md,
  // which drops the standalone title/intro for the embed-ready layout).
  out.push('## Complexity & Risk Report');

  // LLM-context verdict only. The band legend and the highest/lowest call-outs
  // were dropped — the pill colours are self-explanatory and the grid speaks
  // for itself.
  out.push(`**LLM Context:** ${llmContextBadge(summary)}`);

  // Six grouped sections, numbered, in first-seen group order.
  const groupOrder: string[] = [];
  const grouped = new Map<string, QualityGauge[]>();
  for (const g of gauges) {
    if (!grouped.has(g.group)) {
      grouped.set(g.group, []);
      groupOrder.push(g.group);
    }
    grouped.get(g.group)!.push(g);
  }

  groupOrder.forEach((group, idx) => {
    out.push('---');
    out.push(`### ${idx + 1}. ${group}`);
    // The LLM Complexity section drops its intro AND its per-gauge descriptions
    // (requested): the token/context gauges read on their own. Other groups keep
    // their one-line intro + collapsed "Description & analysis" detail.
    const isLlm = group === 'LLM Complexity';
    const intro = GROUP_INTRO[group];
    if (intro && !isLlm) out.push(intro);
    for (const g of grouped.get(group)!) {
      const block: string[] = [];
      block.push(`#### ${g.label} ${pill(g)}`);
      if (g.higher_is_better) block.push('*Higher is better*');
      block.push(bar(g));
      if (!isLlm) {
        block.push(
          [
            '<details>',
            '<summary>Description &amp; analysis</summary>',
            '',
            `<font face="monospace">${escapeHtml(g.description)}</font>`,
            '</details>',
          ].join('\n'),
        );
      }
      out.push(block.join('\n\n'));
    }
  });

  // Full metric profile radar (the reading-scale note was dropped).
  out.push('---');
  out.push(radar(byId));

  return out.join('\n\n');
}
