// The header block — the whole-PR TL;DR, everything above the value card. It is
// GAUGE-FORWARD and trimmed to two things only (no prose): a 3-badge TL;DR row
// and the quickchart KPI gauge dashboard. There is NO `##` title here — the
// brand banner (added by overview.ts) IS the title.
//   1. TL;DR badges — three centered shields: the merge recommendation, the
//      0–5 merge-confidence, and the risk + review-time band. This is the whole
//      verdict at a glance; the old bottom-line + callout prose was removed.
//   2. KPI gauge dashboard — a table of quickchart.io radialGauge tiles
//      (lib/gauge.ts): merge confidence N/5 · review effort N/5 · risks · drift ·
//      suggestions · new tests. Files-changed & net-LOC are NOT here — GitHub's
//      PR header already shows both.
// Everything degrades: no value model → no drift tile, a factual verdict badge.

import type { ScanPrOutput } from '../../report.ts';
import type { PrContext } from '../context.ts';
import { COLOR, compositeStatus, type Composite } from '../lib/severity.ts';
import { extractFacts, type PrFacts } from '../lib/facts.ts';
import { reviewEffort, type ReviewEffort } from '../lib/effort.ts';
import { mergeConfidence, type MergeConfidence } from '../lib/confidence.ts';
import { gaugeTable, type Gauge, type GaugeColor } from '../lib/gauge.ts';
import { signedPercent, int } from '../lib/format.ts';
import { flatBadge, centerBadges } from '../lib/badge.ts';

type Verdict = {
  alert: 'WARNING' | 'TIP' | 'NOTE';
  /** Status dot (kept for callers/tests; the header itself is badge-only now). */
  emoji: string;
  /** BLUF recommendation phrase, lowercase (e.g. "address before merge"). */
  tldr: string;
  statusMessage: string; // verdict badge text
  statusColor: string; // shields colour (no `#`)
};

export type HeaderOptions = {
  /** Merge-confidence history (0–5) — persisted by overview for the state blob. */
  confTrend?: number[];
};

export function renderHeader(report: ScanPrOutput, _ctx?: PrContext, _opts: HeaderOptions = {}): string {
  const facts = extractFacts(report);
  const composite = compositeStatus(facts.axes);
  const verdict = decideVerdict(facts, composite);
  const effort = reviewEffort(facts);
  const confidence = mergeConfidence(facts);

  // Two blocks only: the 3-badge TL;DR (the whole-PR verdict at a glance), then
  // the quickchart KPI gauge dashboard. All the old prose (bottom line, callout
  // TL;DR, "look here first" pointer, trend, sub-line) was removed.
  return [tldrBadges(verdict, confidence, effort), gaugeDashboard(facts, effort, confidence)]
    .filter(Boolean)
    .join('\n\n');
}

// ── TL;DR badges — the whole verdict in three centered shields ────────────────

/**
 * Three shields, one centered row, replacing the old prose TL;DR:
 *   1. the merge recommendation (⚠ Address before merge / ✓ Looks good / ℹ Advisory)
 *   2. Merge confidence N/5
 *   3. <risk> risk · <time> review
 * Colours track the same palette as the gauges, so the badges and the dials
 * never tell different stories.
 */
function tldrBadges(verdict: Verdict, confidence: MergeConfidence, effort: ReviewEffort): string {
  const risk = effort.score >= 4 ? 'High' : effort.score === 3 ? 'Moderate' : 'Low';
  const mins = effort.minutes.replace(/≈\s*/, ''); // "≈ 60 min+" → "60 min+"
  const badges = [
    flatBadge(verdictMessage(verdict), verdict.statusColor),
    flatBadge(`Merge confidence ${confidence.score}/5`, confidence.color),
    flatBadge(`${risk} risk · ${mins} review`, effort.color),
  ];
  return centerBadges(badges);
}

/** The verdict badge text with a leading glyph (⚠ / ✓ / ℹ), title-cased. */
function verdictMessage(v: Verdict): string {
  const glyph = v.alert === 'WARNING' ? '⚠' : v.alert === 'TIP' ? '✓' : 'ℹ';
  const text = v.statusMessage.charAt(0).toUpperCase() + v.statusMessage.slice(1);
  return `${glyph} ${text}`;
}


// ── verdict ────────────────────────────────────────────────────────────────

function decideVerdict(facts: PrFacts, composite: Composite): Verdict {
  const needsAttention = facts.correctness.length > 0 || facts.regressedAxes.length > 0 || composite.mixed;
  if (needsAttention) {
    // 🔴 when the whole PR is a net regression; 🟡 for a mixed/attention case.
    const netRegression = composite.label === 'regressed' || (facts.overallDirection === 'down' && !composite.mixed);
    return {
      alert: 'WARNING',
      emoji: netRegression ? '🔴' : '🟡',
      tldr: 'address before merge',
      statusMessage: 'address before merge',
      statusColor: netRegression ? COLOR.red : COLOR.amber,
    };
  }
  if (facts.overallDirection === 'up') {
    return { alert: 'TIP', emoji: '🟢', tldr: 'looks good', statusMessage: 'looks good', statusColor: COLOR.green };
  }
  return { alert: 'NOTE', emoji: '🔵', tldr: 'advisory', statusMessage: 'advisory', statusColor: COLOR.blue };
}

// ── KPI gauge dashboard ──────────────────────────────────────────────────────
// A table of quickchart.io radialGauge tiles (lib/gauge.ts) in priority order:
// merge confidence · review effort · risks · drift · suggestions · new tests.
// The two 0–5 gauges show a proportional arc; count/percent tiles show a full
// arc because the centred NUMBER is the signal. A tile only appears when its
// metric exists, so a partial report degrades gracefully.

function gaugeDashboard(facts: PrFacts, effort: ReviewEffort, confidence: MergeConfidence): string {
  const gauges: Gauge[] = [
    { title: 'MERGE CONFIDENCE', center: `${confidence.score}/5`, arc: (confidence.score / 5) * 100, color: gaugeColor(confidence.color) },
    { title: 'REVIEW EFFORT', center: `${effort.score}/5`, arc: (effort.score / 5) * 100, color: gaugeColor(effort.color) },
  ];

  if (facts.totalRisks > 0) {
    gauges.push({ title: 'RISKS', center: int(facts.risksToAddress), arc: 100, color: facts.risksToAddress > 0 ? 'red' : 'green' });
  }
  if (facts.overallPercent !== null) {
    const color: GaugeColor = facts.overallDirection === 'up' ? 'green' : facts.overallDirection === 'down' ? 'red' : 'grey';
    gauges.push({ title: 'DRIFT', center: signedPercent(facts.overallPercent), arc: 100, color });
  }
  gauges.push({ title: 'SUGGESTIONS', center: int(facts.passing.length), arc: 100, color: facts.passing.length > 0 ? 'blue' : 'grey' });
  if (facts.newTestFiles !== null) {
    gauges.push({ title: 'NEW TESTS', center: int(facts.newTestFiles), arc: 100, color: facts.newTestFiles > 0 ? 'green' : 'red' });
  }

  return gaugeTable(gauges);
}

/** Map a shields.io palette hex (no `#`) onto the gauge tile's semantic colour. */
function gaugeColor(shieldsHex: string): GaugeColor {
  switch (shieldsHex) {
    case COLOR.green:
      return 'green';
    case COLOR.amber:
      return 'amber';
    case COLOR.red:
      return 'red';
    case COLOR.blue:
      return 'blue';
    default:
      return 'grey';
  }
}
