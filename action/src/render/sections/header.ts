// The header block — the whole-PR TL;DR, everything above the value card. It's
// written bottom-line-up-front and GAUGE-FORWARD: the verdict in one line, then
// an at-a-glance dial dashboard, then the one place to look. There is NO `##`
// title here — the brand banner (added by overview.ts) IS the title, so we don't
// repeat "Drift review" as text. Order:
//   1. bottom line    — one plain-language verdict + the move (the BLUF)
//   2. KPI gauge dashboard — a table of quickchart.io radialGauge tiles
//      (lib/gauge.ts), in priority order: merge confidence N/5 · review effort
//      N/5 · risks · drift · suggestions · new tests. The two 0–5 gauges show a
//      proportional arc; count/percent tiles show a full arc (the number is the
//      signal). Files-changed & net-LOC are deliberately NOT here — GitHub's PR
//      header already shows both, so a tile would only duplicate them.
//   3. confidence trend — a cross-push sparkline; the ONE signal with no tile
//      equivalent, so it stays a tiny line (only ≥2 pushes)
//   4. sub-line       — repo permalink · advisory (does-not-gate) · sticky note
//   5. advisory callout — GFM alert, BLUF-ordered:
//        • **TL;DR** — the data-driven one-paragraph verdict (numbers)
//        • 👉 **Look here first** — the single highest-value spot for the
//          reviewer's eyes (à la Qodo's "key issues", distilled to ONE pointer)
//
// The "✅ Before you merge" checklist + merge-readiness bar are NO LONGER here —
// they render as their own section at the END of the comment (sections/before_merge.ts).
// Everything degrades: no value model → no drift tile, a factual verdict.
// Review effort + the focus pointer always render — they need only the call-graph facts.

import type { ScanPrOutput, CodeSuggestion } from '../../report.ts';
import type { PrContext } from '../context.ts';
import { repoSlug, fileLink } from '../context.ts';
import { COLOR, compositeStatus, type Composite } from '../lib/severity.ts';
import { extractFacts, type PrFacts } from '../lib/facts.ts';
import { correctnessTag } from '../lib/checklist.ts';
import { reviewEffort, type ReviewEffort } from '../lib/effort.ts';
import { mergeConfidence, type MergeConfidence } from '../lib/confidence.ts';
import { sparkline } from '../lib/bars.ts';
import { gaugeTable, type Gauge, type GaugeColor } from '../lib/gauge.ts';
import { signedPercent, signedInt, int, plural, confidencePercent } from '../lib/format.ts';

type Verdict = {
  alert: 'WARNING' | 'TIP' | 'NOTE';
  /** Status dot for the hero line (🟢 ship · 🟡 attention · 🔴 regression · 🔵 advisory). */
  emoji: string;
  /** BLUF recommendation phrase, lowercase, no markdown (e.g. "address before merge"). */
  tldr: string;
  statusMessage: string; // review-status badge text
  statusColor: string;
};

export type HeaderOptions = {
  /** Merge-confidence history (0–5, oldest→newest incl. this push) for the trend sparkline. */
  confTrend?: number[];
};

export function renderHeader(report: ScanPrOutput, ctx?: PrContext, opts: HeaderOptions = {}): string {
  const facts = extractFacts(report);
  const composite = compositeStatus(facts.axes);
  const verdict = decideVerdict(facts, composite);
  const effort = reviewEffort(facts);
  const confidence = mergeConfidence(facts);

  // Bottom-line-up-front, badge-forward: the FIRST thing is one plain-language
  // line a reviewer can read and stop — verdict + the single move. Directly
  // under it sits the badge dashboard (every metric is a pill, grouped by
  // theme), so the two 0–5 gauges are read from badges, not a duplicate prose
  // line. The cross-push confidence trend has no badge equivalent, so it rides
  // as a tiny line; the callout carries the supporting numbers + the focus
  // pointer. NOTE: there is no `##` title — the brand banner (overview.ts) is
  // the title, so we never repeat "Drift review" as text here.
  const blocks: string[] = [
    bottomLine(verdict, facts),
    gaugeDashboard(facts, effort, confidence),
    trendLine(opts.confTrend),
    subLine(ctx),
    calloutBlock(verdict, facts, composite, ctx),
  ];

  // NOTE: the "✅ Before you merge" checklist used to live here; it now renders
  // as its own section at the END of the comment (see sections/before_merge.ts).
  return blocks.filter(Boolean).join('\n\n');
}

// ── sub-line ──────────────────────────────────────────────────────────────
// Repo permalink + the does-not-gate advisory + the sticky-comment note. The
// advisory used to be its own shields pill; with the dashboard now a table of
// numeric gauges (no text pills), it folds in here as a one-line `<sub>` note so
// the "Drift never blocks the merge" signal isn't lost.

function subLine(ctx?: PrContext): string {
  const slug = repoSlug(ctx);
  const repo = slug ? `📍 [\`${slug}\`](https://github.com/${ctx!.owner}/${ctx!.repo}) &nbsp;·&nbsp; ` : '';
  return `<sub>${repo}advisory — does not gate the merge &nbsp;·&nbsp; sticky review comment — re-rendered on every push</sub>`;
}

// ── advisory callout ─────────────────────────────────────────────────────────

function decideVerdict(facts: PrFacts, composite: Composite): Verdict {
  const needsAttention = facts.correctness.length > 0 || facts.regressedAxes.length > 0 || composite.mixed;
  if (needsAttention) {
    // 🔴 when the whole PR is a net regression; 🟡 for a mixed/attention case.
    // Key off the per-axis composite (the always-present, direction-grounded
    // signal the value card itself uses) rather than the OPTIONAL overall_drift
    // block — so the hero dot + review pill stay in agreement with the value
    // card even when a partial report omits overall_drift (overallDirection null).
    const netRegression = composite.label === 'regressed' || (facts.overallDirection === 'down' && !composite.mixed);
    return {
      alert: 'WARNING',
      emoji: netRegression ? '🔴' : '🟡',
      tldr: 'address before merge',
      statusMessage: 'address before merge',
      // The review-status pill tracks the hero dot: red for a pure net
      // regression, amber for a mixed/attention case — so the badge and the dot
      // never tell different stories.
      statusColor: netRegression ? COLOR.red : COLOR.amber,
    };
  }
  if (facts.overallDirection === 'up') {
    return {
      alert: 'TIP',
      emoji: '🟢',
      tldr: 'looks good — nothing to gate on',
      statusMessage: 'looks good',
      statusColor: COLOR.green,
    };
  }
  return {
    alert: 'NOTE',
    emoji: '🔵',
    tldr: 'advisory review only — nothing flagged',
    statusMessage: 'advisory',
    statusColor: COLOR.blue,
  };
}

// ── hero "bottom line" — the one line to read and stop ───────────────────────
// The TL;DR-of-the-TL;DR, the way a principal engineer opens: verdict + THE
// single move, in plain language, no numbers to decode. The colored callout
// below carries the supporting drift/LOC/finding numbers, so this line
// deliberately does NOT repeat them; the 0–5 gauges live on the badge dashboard.

function bottomLine(verdict: Verdict, facts: PrFacts): string {
  const move = theMove(facts);
  const win = facts.overallDirection === 'up' && facts.overallPercent !== null ? ` ${signedPercent(facts.overallPercent)}` : '';

  let sentence: string;
  if (verdict.alert === 'WARNING') {
    sentence = move
      ? `**Address before merge** — ${move}${win ? `, then ship the${win} improvement` : ''}.`
      : `**Address the regressions below before merge.**`;
  } else if (verdict.alert === 'TIP') {
    sentence = move ? `**Looks good** — ${move} before you ship.` : `**Looks good — ship it.**`;
  } else {
    sentence = move ? `**Advisory** — ${move}.` : `**Advisory only — nothing flagged.**`;
  }

  return `> ${verdict.emoji} ${sentence}`;
}

// ── confidence trend — the one cross-push signal with no badge equivalent ─────
// A Unicode-block sparkline of how merge confidence has moved across pushes (the
// living-dashboard signal no rival shows in-comment). The two 0–5 gauges
// themselves are read from the badge dashboard now; only the trend stays prose,
// because a single static badge can't show a series. Renders only with ≥2 data
// points (sparkline() returns '' otherwise) → dropped by the block filter.

function trendLine(confTrend?: number[]): string {
  const trend = sparkline(confTrend ?? []);
  if (!trend) return '';
  return `<sub>🛡️ Merge-confidence trend \`${trend}\` (over the last ${confTrend!.length} pushes)</sub>`;
}

/**
 * THE move — the top one-or-two imperative actions, compressed for the hero
 * line (a prose echo of the highest-priority checklist items). Capped at two so
 * the line stays one-glance. Empty when there's genuinely nothing to do.
 */
function theMove(facts: PrFacts): string {
  const parts: string[] = [];

  const c = topCorrectness(facts.correctness);
  if (c) parts.push(`fix the ${correctnessTag(c.category_label) ?? 'correctness issue'}`);

  if (facts.newTestFiles === 0 && facts.locAdded !== null && facts.locAdded > 0) parts.push('add tests');

  if (parts.length < 2 && facts.regressedAxes.length > 0) {
    const worst = facts.regressedAxes.reduce((w, a) => (a.delta_percent < w.delta_percent ? a : w));
    parts.push(`confirm the ${worst.label} ${signedPercent(worst.delta_percent)} regression`);
  }

  if (parts.length < 2 && facts.deadCode.length > 0) {
    parts.push(`drop ${facts.deadCode.length} dead ${plural(facts.deadCode.length, 'export')}`);
  }

  return joinClauses(parts.slice(0, 2));
}

function calloutBlock(verdict: Verdict, facts: PrFacts, composite: Composite, ctx?: PrContext): string {
  // The supporting detail under the hero line: the factual TL;DR paragraph
  // (drift / LOC / findings), then the single highest-value place to look.
  // It does NOT restate the recommendation — the hero line already made the
  // call — and it no longer carries the "advisory" note, which is now a badge.
  // Blank `>` lines separate paragraphs inside the GFM alert.
  const tldr = `**TL;DR —** ${narrative(facts, composite).join(' ')}`.trim();
  const focus = focusLine(facts, ctx);

  const paras = [tldr];
  if (focus) paras.push(focus);

  const lines = [`> [!${verdict.alert}]`];
  paras.forEach((p, i) => {
    if (i > 0) lines.push('>'); // blank quoted line → paragraph break in the alert
    lines.push(`> ${p}`);
  });
  return lines.join('\n');
}

// ── "Look here first" — the single highest-value reviewer pointer ────────────
// Qodo lists "key issues to review"; a principal engineer points at the ONE
// thing first. Priority is by how much careful human judgement the spot needs:
// a real correctness bug > a regression to confirm > unguarded entry points >
// dead code > an untested diff > (clean) a quick skim.

function focusLine(facts: PrFacts, ctx?: PrContext): string {
  const c = topCorrectness(facts.correctness);
  if (c) {
    const loc = fileLink(ctx, c.file, c.line);
    const tag = correctnessTag(c.category_label) ?? 'product-correctness issue';
    return `👉 **Look here first:** ${loc} — ${tag} · ${confidencePercent(c.confidence)} confidence`;
  }

  if (facts.regressedAxes.length > 0) {
    const worst = facts.regressedAxes.reduce((w, a) => (a.delta_percent < w.delta_percent ? a : w));
    return `👉 **Look here first:** the **${worst.label} ${signedPercent(worst.delta_percent)}** regression — confirm it's acceptable or fix it`;
  }

  const gaps = facts.reliabilityGaps.length || facts.uncoveredRoots.length;
  if (gaps > 0) {
    return `👉 **Look here first:** **${int(gaps)}** entry ${plural(gaps, 'point')} ${plural(gaps, 'lacks', 'lack')} retry / timeout / fallback or test coverage`;
  }

  if (facts.deadCode.length > 0) {
    const s = facts.deadCode[0];
    const n = facts.deadCode.length;
    return `👉 **Look here first:** **${n}** dead ${plural(n, 'export')} in changed files (e.g. ${fileLink(ctx, s.file, s.line)})`;
  }

  if (facts.newTestFiles === 0 && facts.locAdded !== null && facts.locAdded > 0) {
    return `👉 **Look here first:** **${signedInt(facts.locAdded)} LOC** shipped with **0** tests — spot-check the risky paths`;
  }

  return `👉 **Looks clean** — no findings; a quick skim of the **${int(facts.changedFiles)}** changed ${plural(facts.changedFiles, 'file')} should do`;
}

/** Highest-confidence correctness finding (the most likely real bug). */
function topCorrectness(items: CodeSuggestion[]): CodeSuggestion | null {
  if (items.length === 0) return null;
  return [...items].sort((a, b) => b.confidence - a.confidence)[0];
}

/** Factual, deterministic verdict prose (never an LLM call). */
function narrative(facts: PrFacts, composite: Composite): string[] {
  const lines: string[] = [];

  if (facts.overallPercent !== null) {
    let lead = `Overall drift **${signedPercent(facts.overallPercent)}**`;
    if (composite.mixed && facts.topImprovement) {
      lead += ` is led by ${facts.topImprovement.label} (**${signedPercent(facts.topImprovement.delta_percent)}**)`;
    } else if (facts.overallDirection === 'up') {
      lead += ' — a net improvement';
    } else if (facts.overallDirection === 'down') {
      lead += ' — a net regression';
    }
    lines.push(`${lead}.`);
  }

  const subs: string[] = [];
  if (facts.regressedAxes.length > 0) {
    const list = facts.regressedAxes.map((a) => `**${a.label} ${signedPercent(a.delta_percent)}**`).join(' and ');
    subs.push(`${list} regressed`);
  }
  if (facts.locAdded !== null && facts.locAdded > 0 && facts.newTestFiles === 0) {
    subs.push(`**${signedInt(facts.locAdded)} LOC** shipped with **0** tests`);
  }
  if (facts.correctness.length > 0) {
    const n = facts.correctness.length;
    subs.push(`**${n} product-correctness ${plural(n, 'issue')}** flagged`);
  }
  if (subs.length > 0) lines.push(`Underneath: ${joinClauses(subs)}.`);

  if (lines.length === 0) {
    // Factual-only fallback (no value model on this PR).
    lines.push(
      `${int(facts.changedFiles)} changed ${plural(facts.changedFiles, 'file')}, ` +
        `${int(facts.affectedRoots)} entry ${plural(facts.affectedRoots, 'point')} reached.`,
    );
  }
  return lines;
}

// ── KPI gauge dashboard ──────────────────────────────────────────────────────
// A table of quickchart.io radialGauge tiles (lib/gauge.ts) — the metrics the
// header used to say in prose/pills, now as dials a reviewer scans in one glance.
// Priority order (highest-judgement signals first): merge confidence · review
// effort · risks · drift · suggestions · new tests. The two 0–5 gauges show a
// proportional arc (score/5); count/percent tiles show a full arc because the
// centred NUMBER is the signal, not the arc. A tile only appears when its metric
// exists, so a partial report degrades gracefully (e.g. no value model → no
// drift tile). Files-changed & net-LOC are intentionally omitted — GitHub's PR
// header already shows both, so a tile would add nothing.

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

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}
