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

/** shields.io static badge via the query form (every segment URL-encoded). */
function shield(label: string, message: string, hex: string): string {
  const p = (s: string) => encodeURIComponent(s);
  return `https://img.shields.io/static/v1?label=${p(label)}&message=${p(message)}&color=${hex}&style=for-the-badge`;
}

/** Markdown image-alt: strip `[]` and newlines so the `![alt](url)` never breaks. */
function altText(s: string): string {
  return s.replace(/[\][\n\r]/g, ' ').trim();
}

/** The band pill badge repeating the exact value + direction arrow. */
function pill(g: QualityGauge): string {
  const hex = LEVEL_HEX[g.level] ?? LEVEL_HEX.moderate;
  const lvl = LEVEL_LABEL[g.level] ?? 'MODERATE';
  const message = `${g.score}% ${g.arrow}`;
  return `![${altText(`${lvl} ${g.score}%`)}](${shield(lvl, message, hex)})`;
}

// A fixed BAR_CELLS-wide horizontal bar rendered as a Mermaid flowchart (no
// quickchart): `filled` cells in the band colour, the rest muted grey. The █
// string sets each node's width; fill == text-colour paints each node a solid
// block; the invisible `~~~` link butts them together so they read as one bar.
const BAR_CELLS = 40;
const BAR_GREY = 'd1d5db';
function bar(g: QualityGauge): string {
  const hex = LEVEL_HEX[g.level] ?? LEVEL_HEX.moderate;
  const score = Math.max(0, Math.min(100, Math.round(g.score)));
  const filled = Math.round((score / 100) * BAR_CELLS);
  const remaining = BAR_CELLS - filled;
  const cell = '█';
  const lines = [
    "%%{init: {'flowchart': {'htmlLabels': true, 'padding': 1, 'nodeSpacing': 1, 'rankSpacing': 1}}}%%",
    'flowchart LR',
  ];
  if (filled > 0 && remaining > 0) {
    lines.push(`    f["${cell.repeat(filled)}"]:::done ~~~ r["${cell.repeat(remaining)}"]:::todo`);
  } else if (remaining === 0) {
    lines.push(`    f["${cell.repeat(BAR_CELLS)}"]:::done`);
  } else {
    lines.push(`    r["${cell.repeat(BAR_CELLS)}"]:::todo`);
  }
  lines.push(`    classDef done fill:#${hex},stroke:#${hex},stroke-width:0px,color:#${hex};`);
  lines.push(`    classDef todo fill:#${BAR_GREY},stroke:#${BAR_GREY},stroke-width:0px,color:#${BAR_GREY};`);
  if (filled > 0 && remaining > 0) lines.push('    linkStyle 0 stroke-width:0px;');
  return ['```mermaid', ...lines, '```'].join('\n');
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

// Single-series radar over the 14 headline axes, rendered as a Mermaid
// `radar-beta` chart (replaces the old quickchart image). `key` is the short
// axis id Mermaid wants, `label` the human axis name; the curve pulls each
// gauge's 0–100 score from `byId`.
const RADAR_AXES: Array<{ id: string; key: string; label: string }> = [
  { id: 'token_footprint', key: 'tf', label: 'Token footprint' },
  { id: 'context_window_pressure', key: 'cwp', label: 'Context window pressure' },
  { id: 'agent_reviewability', key: 'ar', label: 'Agent reviewability' },
  { id: 'semantic_density', key: 'sd', label: 'Semantic density' },
  { id: 'explainability', key: 'ex', label: 'Explainability' },
  { id: 'context_dependency', key: 'cd', label: 'Context dependency' },
  { id: 'maintenance_burden', key: 'mb', label: 'Maintenance burden' },
  { id: 'fragility_index', key: 'fi', label: 'Fragility index' },
  { id: 'test_coverage', key: 'tc', label: 'Test coverage' },
  { id: 'edge_case_surface', key: 'ecs', label: 'Edge case surface' },
  { id: 'rollback_complexity', key: 'rc', label: 'Rollback complexity' },
  { id: 'blast_radius', key: 'br', label: 'Blast radius' },
  { id: 'knowledge_concentration', key: 'kc', label: 'Knowledge concentration' },
  { id: 'review_fatigue', key: 'rfr', label: 'Review fatigue risk' },
];

/** The full metric-profile radar as a dark-themed Mermaid `radar-beta` chart. */
function radar(byId: Map<string, QualityGauge>): string {
  // Axis declarations, three per line (mirrors the requested layout); each
  // gauge's score (0–100, rounded) feeds the single "This PR" curve in order.
  const axisLines: string[] = [];
  for (let i = 0; i < RADAR_AXES.length; i += 3) {
    axisLines.push('  axis ' + RADAR_AXES.slice(i, i + 3).map((a) => `${a.key}["${a.label}"]`).join(', '));
  }
  const data = RADAR_AXES.map((a) => Math.round(byId.get(a.id)?.score ?? 0)).join(', ');
  return [
    '```mermaid',
    '---',
    'config:',
    '  theme: dark',
    '  themeVariables:',
    '    cScale0: "#5b9bd5"',
    '    background: "#0a0a0e"',
    '    radar:',
    '      curveTension: 1',
    '      curveOpacity: 0.18',
    '      curveStrokeWidth: 2',
    '      axisColor: "#2c2c34"',
    '      axisLabelFontSize: 12',
    '      graticuleColor: "#2c2c34"',
    '      graticuleOpacity: 0.55',
    '---',
    'radar-beta',
    '  title This PR',
    ...axisLines,
    `  curve pr["This PR"]{${data}}`,
    '  max 100',
    '  min 0',
    '  graticule polygon',
    '  ticks 4',
    '```',
  ].join('\n');
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
