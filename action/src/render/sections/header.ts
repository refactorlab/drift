// The header block — the whole-PR TL;DR, everything above the value card. It's
// written bottom-line-up-front, the way a principal engineer opens a review:
// the verdict, then the one place to look, then the numbers, then the to-dos.
//   1. title line   — `## ▲ Drift review`
//   2. sub-line      — repo permalink · sticky-comment note · advisory check
//   3. advisory callout — GFM alert, BLUF-ordered:
//        • **TL;DR** — recommendation + the data-driven one-paragraph verdict
//        • 👉 **Look here first** — the single highest-value spot for the
//          reviewer's eyes (à la Qodo's "key issues", distilled to ONE pointer)
//   4. KPI badge row — shields.io pills (review / confidence / effort / drift / …)
//
// The "✅ Before you merge" checklist + merge-readiness bar are NO LONGER here —
// they render as their own section at the END of the comment (sections/before_merge.ts).
// Everything degrades: no value model → no drift/LOC badges, a factual verdict.
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

  // Bottom-line-up-front: the FIRST thing is one plain-language line a reviewer
  // can read and stop — verdict + the single move. A muted signal line under it
  // carries the two 0–5 gauges (merge confidence + review effort) and the
  // cross-push confidence trend; the callout below carries the supporting
  // numbers and the focus pointer.
  const blocks: string[] = [
    titleLine(facts),
    bottomLine(verdict, facts),
    signalLine(confidence, effort, opts.confTrend),
    subLine(ctx),
    calloutBlock(verdict, facts, composite, ctx),
    badgeRow(facts, verdict, effort, confidence),
  ];

  // NOTE: the "✅ Before you merge" checklist used to live here; it now renders
  // as its own section at the END of the comment (see sections/before_merge.ts).
  return blocks.filter(Boolean).join('\n\n');
}

// ── 1. title ────────────────────────────────────────────────────────────────

// Just `## <arrow> Drift review` — no PR-title suffix. GitHub already shows the
// PR title at the top of the page, so repeating it here is redundant noise; the
// arrow encodes overall direction (▲ up · ▼ down · — flat).
function titleLine(facts: PrFacts): string {
  const arrow =
    facts.overallDirection === 'up' ? '▲ ' : facts.overallDirection === 'down' ? '▼ ' : facts.overallDirection === 'neutral' ? '— ' : '';
  return `## ${arrow}Drift review`;
}

// ── 2. sub-line ──────────────────────────────────────────────────────────────

function subLine(ctx?: PrContext): string {
  const slug = repoSlug(ctx);
  const repo = slug ? `📍 [\`${slug}\`](https://github.com/${ctx!.owner}/${ctx!.repo}) &nbsp;·&nbsp; ` : '';
  return `<sub>${repo}sticky review comment — re-rendered on every push &nbsp;·&nbsp; advisory check</sub>`;
}

// ── 3. advisory callout ──────────────────────────────────────────────────────

function decideVerdict(facts: PrFacts, composite: Composite): Verdict {
  const needsAttention = facts.correctness.length > 0 || facts.regressedAxes.length > 0 || composite.mixed;
  if (needsAttention) {
    // 🔴 when the whole PR is a net regression; 🟡 for a mixed/attention case.
    const netRegression = facts.overallDirection === 'down' && !composite.mixed;
    return {
      alert: 'WARNING',
      emoji: netRegression ? '🔴' : '🟡',
      tldr: 'address before merge',
      statusMessage: 'address before merge',
      statusColor: COLOR.amber,
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

// ── 2b. hero "bottom line" — the one line to read and stop ───────────────────
// The TL;DR-of-the-TL;DR, the way a principal engineer opens: verdict + THE
// single move, in plain language, no numbers to decode. The colored callout
// below carries the supporting drift/LOC/finding numbers, so this line
// deliberately does NOT repeat them; the 0–5 gauges live on the signal line.

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

// ── 2c. signal line — the two 0–5 gauges + the cross-push confidence trend ────
// 🛡️ Merge confidence (Greptile-style, inverse-risk) and 🧮 Review effort (Qodo-
// style) side by side, both grounded in the static facts, plus a Unicode-block
// sparkline of how confidence has trended across pushes (the living-dashboard
// signal no rival shows in-comment). Trend appears only with ≥2 data points.

function signalLine(confidence: MergeConfidence, effort: ReviewEffort, confTrend?: number[]): string {
  const trend = sparkline(confTrend ?? []);
  const trendTag = trend ? ` · trend \`${trend}\` <sub>(confidence over the last ${confTrend!.length} pushes)</sub>` : '';
  return (
    `> <sub>🛡️ **Merge confidence ${confidence.score}/5** (${confidence.label}) ` +
    `&nbsp;·&nbsp; 🧮 **Review effort ${effort.score}/5** · ${effort.minutes}</sub>${trendTag}`
  );
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
  // call. Blank `>` lines separate paragraphs inside the GFM alert.
  const tldr = `**TL;DR —** ${narrative(facts, composite).join(' ')} _Advisory — does not fail the check._`.trim();
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

// ── 3b. "Look here first" — the single highest-value reviewer pointer ────────
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

// ── 4. KPI badge row ─────────────────────────────────────────────────────────

function badgeRow(facts: PrFacts, verdict: Verdict, effort: ReviewEffort, confidence: MergeConfidence): string {
  const badges: string[] = [];
  badges.push(badge('Review status', 'review', verdict.statusMessage, verdict.statusColor));

  // The two 0–5 verdict gauges lead the numeric KPIs: merge confidence (how safe
  // to merge, Greptile-style) and review effort (how much attention, Qodo-style),
  // both grounded in the static facts.
  badges.push(badge(`Merge confidence ${confidence.score}/5`, 'merge confidence', `${confidence.score}/5`, confidence.color));
  badges.push(badge(`Review effort ${effort.score}/5`, 'review effort', `${effort.score}/5`, effort.color));

  if (facts.overallPercent !== null) {
    const color = facts.overallDirection === 'up' ? COLOR.green : facts.overallDirection === 'down' ? COLOR.red : COLOR.grey;
    badges.push(badge(`Drift ${signedPercent(facts.overallPercent)}`, 'drift', signedPercent(facts.overallPercent), color));
  }

  badges.push(badge(`Files ${facts.changedFiles}`, 'files', int(facts.changedFiles), COLOR.blue));

  if (facts.netLoc !== null) {
    badges.push(badge(`Net LOC ${signedInt(facts.netLoc)}`, 'net LOC', signedInt(facts.netLoc), COLOR.grey));
  }

  badges.push(badge(`Suggestions ${facts.passing.length}`, 'suggestions', int(facts.passing.length), facts.passing.length > 0 ? COLOR.blue : COLOR.grey));

  // Every shown finding ships a copy-paste AI-fix prompt — surface that as a
  // brand-orange KPI so reviewers know the review is one-click-actionable.
  if (facts.passing.length > 0) {
    badges.push(badge(`Agent-ready: ${facts.passing.length} fix prompts`, 'agent-ready', `${int(facts.passing.length)} fix prompts`, COLOR.brand));
  }

  if (facts.totalRisks > 0) {
    const color = facts.risksToAddress > 0 ? COLOR.red : COLOR.green;
    badges.push(badge(`Risks: ${facts.risksToAddress} to address`, 'risks', `${facts.risksToAddress} to address`, color));
  }

  if (facts.newTestFiles !== null) {
    const color = facts.newTestFiles > 0 ? COLOR.green : COLOR.red;
    badges.push(badge(`New tests: ${facts.newTestFiles}`, 'new tests', int(facts.newTestFiles), color));
  }

  return badges.join(' &nbsp;');
}

function badge(alt: string, label: string, message: string, color: string): string {
  return `![${alt}](https://img.shields.io/badge/${shields(label)}-${shields(message)}-${color}?style=flat-square)`;
}

/** shields.io path encoding: double `_`/`-`, spaces→`_`, then percent-encode. */
function shields(s: string): string {
  return encodeURIComponent(s.replace(/_/g, '__').replace(/-/g, '--').replace(/ /g, '_'));
}

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}
