// Sticky overview comment — assembled top-down in the reading order a senior
// reviewer uses (verdict → numbers → fixes → risk → architecture → reference):
//
//   marker
//   1. Header           — title · KPIs · advisory verdict · "Before you merge"
//   2. Value card       — composite + per-axis dashboard
//   3. Suggestions      — priority table + per-finding details
//   4. Risks            — impact-ordered table + quadrant map
//   5. Architecture     — reach table + flow/business/mindmap diagrams
//   6. Extended findings + Legend & methodology
//   7. Footer           — attribution + (optional) audio link
//   state blob          — invisible snapshot, diffed on the next push
//
// Every section returns null when its data is absent, so the comment degrades
// cleanly from a full value-model report down to a factual-only one.

import type { ScanPrOutput } from '../report.ts';
import type { PrContext } from './context.ts';
import { type DriftState, stateFromReport, serializeState } from './state.ts';
import { extractFacts, type PrFacts } from './lib/facts.ts';
import { wrapSection } from './lib/section.ts';
import { signedPercent, plural, int } from './lib/format.ts';

import { renderHeader } from './sections/header.ts';
import { renderValueCard } from './sections/value_card.ts';
import { renderSuggestions } from './sections/suggestions.ts';
import { renderRisks } from './sections/risks.ts';
import { renderArchitecture } from './sections/architecture.ts';
import { renderExt } from './sections/ext.ts';
import { renderLegend } from './sections/legend.ts';
import { renderFooter } from './sections/footer.ts';

export const STICKY_MARKER = '<!-- drift:sticky-comment -->';

// GitHub caps comment bodies at 65 536 chars. We aim for 60 000 to leave
// headroom for the markers; over budget, <details> contents are collapsed.
const BODY_SIZE_BUDGET = 60_000;
const HARD_CAP = 65_000;

export type RenderOptions = {
  ctx?: PrContext;
  /** Prior run's snapshot (from the previous sticky comment) for the delta line. */
  priorState?: DriftState | null;
  /** Artifact URL of the spoken-summary WAV, linked in the footer. */
  audioUrl?: string;
};

export function renderOverview(report: ScanPrOutput, opts: RenderOptions = {}): string {
  const { ctx, priorState, audioUrl } = opts;
  const review = report.pr_review;
  const facts = extractFacts(report);
  const currentState = stateFromReport(report);

  const header = renderHeader(report, ctx);
  const valueCard = renderValueCard({
    counts: review?.counts,
    card: review?.value_card,
    overallPercent: review?.overall_drift?.percent,
    currentState,
    priorState,
  });
  const suggestions = renderSuggestions(review?.code_suggestions, ctx);
  const risks = renderRisks(review?.visual_summary?.risks);
  const architecture = renderArchitecture({
    prScope: report.pr_scope,
    arch: review?.architecture_flow,
    business: review?.business_logic,
    keyFiles: review?.visual_summary?.key_files,
    deadCodeCount: facts.deadCode.length,
    ctx,
  });
  const ext = renderExt(report.pr_review_ext, ctx);

  // The legend is reference detail — show it only when there's rich content to
  // legend. A factual-only PR skips it.
  const hasRich = [valueCard, suggestions, risks].some(Boolean);
  const legend = hasRich ? renderLegend(report.pr_review_ext?.tech_debt) : null;

  // Every detail section is wrapped in an expandable <details> whose summary
  // is "Title — TLDR", so the comment reads as a scannable list of TLDRs the
  // reviewer can open on demand. The header stays OUTSIDE this framing: it is
  // the whole-PR TLDR (verdict + KPIs) and its "Before you merge" task boxes
  // must stay visible for GitHub to tally merge-readiness. Primary sections
  // (value dashboard, suggestions) default to OPEN; supporting detail
  // (risks, architecture, extended findings, legend) defaults to collapsed.
  const sections: string[] = [header];
  if (valueCard) sections.push(wrapSection(valueCard, { tldr: tldrValue(facts), open: true }));
  if (suggestions) sections.push(wrapSection(suggestions, { tldr: tldrSuggestions(facts), open: true }));
  // Risks auto-opens when there's something to act on before merge — it's as
  // actionable as the suggestions section in that case; otherwise collapsed.
  if (risks) sections.push(wrapSection(risks, { tldr: tldrRisks(facts), open: facts.risksToAddress > 0 }));
  if (architecture) sections.push(wrapSection(architecture, { tldr: tldrArchitecture(facts) }));
  if (ext) sections.push(wrapSection(ext, { tldr: tldrExt(facts) }));
  // The legend is ALREADY a self-contained <details> (its own summary) — it's
  // expandable as-is, so push it directly rather than double-nesting it.
  if (legend) sections.push(legend);

  const footer = renderFooter(report.generator, audioUrl);

  let body = `${STICKY_MARKER}\n${sections.join('\n\n---\n\n')}`;
  body += `\n\n---\n\n${footer}`;
  body += `\n\n${serializeState(currentState)}`;

  return guardSize(body);
}

// ── per-section TLDRs (one-line teasers shown in the collapsed summary) ───────
// All derived from `facts` so they can never disagree with the section bodies.

function tldrValue(f: PrFacts): string {
  if (f.overallPercent === null) return 'Per-axis value dashboard';
  const arrow = f.overallDirection === 'up' ? '▲' : f.overallDirection === 'down' ? '▼' : '—';
  let s = `Overall drift ${signedPercent(f.overallPercent)} ${arrow}`;
  if (f.regressedAxes.length > 0) {
    s += ` · ${f.regressedAxes.length} ${plural(f.regressedAxes.length, 'axis', 'axes')} regressed`;
  } else if (f.topImprovement) {
    s += ` · ${f.topImprovement.label} leads`;
  }
  return s;
}

function tldrSuggestions(f: PrFacts): string {
  const n = f.passing.length;
  const parts = [`${int(n)} ${plural(n, 'suggestion')}`];
  if (f.correctness.length > 0) {
    parts.push(`${f.correctness.length} product-correctness`);
  }
  return parts.join(' · ');
}

function tldrRisks(f: PrFacts): string {
  // `totalRisks` counts structured items only. When it's 0 the section still
  // renders IFF a risk-quadrant chart is present (renderRisks returns null
  // otherwise), so "No risks flagged" would be a lie — show the chart label.
  if (f.totalRisks === 0) return 'Risk quadrant map';
  if (f.risksToAddress > 0) return `${f.risksToAddress} to address · ${f.totalRisks} total`;
  return `${f.totalRisks} ${plural(f.totalRisks, 'risk')} · none gating`;
}

function tldrArchitecture(f: PrFacts): string {
  const n = f.affectedRoots;
  // Subject–verb agreement: "1 entry point reaches" vs "2 entry points reach".
  // With 0 roots the architecture section still renders (internal/config-only
  // change, or unreachable files), so phrase it as a non-reaching change.
  const reach =
    n === 0
      ? 'no entry point reaches it'
      : `${int(n)} entry ${plural(n, 'point')} ${n === 1 ? 'reaches' : 'reach'} it`;
  const dead = f.unreachable > 0 ? ` · ${f.unreachable} unreachable` : '';
  return `Before vs after · ${reach}${dead}`;
}

function tldrExt(f: PrFacts): string {
  const bits: string[] = [];
  if (f.duplicationClusters > 0) bits.push(`${f.duplicationClusters} dup ${plural(f.duplicationClusters, 'cluster')}`);
  if (f.uncoveredRoots.length > 0) bits.push(`${f.uncoveredRoots.length} uncovered`);
  if (f.reliabilityGaps.length > 0) bits.push(`${f.reliabilityGaps.length} reliability ${plural(f.reliabilityGaps.length, 'gap')}`);
  const debt = f.highComplexity + f.longFunctions;
  if (debt > 0) bits.push(`${debt} tech-debt`);
  return bits.length > 0 ? bits.join(' · ') : 'Duplication · uncovered roots · reliability gaps · tech debt';
}

/**
 * Keep the body under GitHub's cap. Collapses <details> bodies INNERMOST-first
 * (so nested disclosures don't get mangled), then hard-truncates as a last
 * resort. A no-op on the normal ~20–30 KB body.
 */
function guardSize(body: string): string {
  if (body.length <= BODY_SIZE_BUDGET) return body;

  // Collapse INNERMOST-first. Two correctness requirements drove this shape:
  //   1. Both the target match AND the nested-boundary lookahead accept
  //      `<details open>` as well as `<details>` — the top-level Value /
  //      Suggestions / (act-before-merge) Risks sections are `<details open>`,
  //      and a regex that only knew `<details>` could neither collapse them nor
  //      correctly treat a nested `<details open>` as a boundary.
  //   2. A collapsed block is replaced by a marker with NO `<details>` tags
  //      (a `<sub>` line). If we kept an (empty) `<details>` placeholder, its
  //      tags would still satisfy the "contains a nested details" lookahead of
  //      the ENCLOSING section forever — so a section with huge DIRECT content
  //      plus any nested details could never be collapsed, and guardSize would
  //      fall through to the ugly hard-truncate. Emitting a tagless marker
  //      genuinely shrinks the nesting each pass, so outer sections become
  //      collapsible once their children are folded. The summary (which
  //      carries the section TLDR) is preserved in the marker either way.
  // The summary capture is bounded by a `(?!</summary>)` guard so it can never
  // backtrack PAST its own `</summary>` and swallow following content/tags — a
  // lazy `([\s\S]*?)` would otherwise gobble the outer summary + a nested
  // `<details>` open-tag when the outer block can't match cleanly, producing
  // garbage. With the guard, an outer section that still contains a nested
  // `<details>` simply fails to match (its body can't reach a `</details>`
  // without crossing the forbidden `<details>`), so only true-innermost blocks
  // collapse — until their tagless markers free the parent to collapse next.
  const innermost = /<details(?: open)?>\s*<summary>((?:(?!<\/summary>)[\s\S])*?)<\/summary>(?:(?!<details(?: open)?>)[\s\S])*?<\/details>/;
  let out = body;
  for (let i = 0; i < 1000 && out.length > BODY_SIZE_BUDGET; i++) {
    const next = out.replace(innermost, (_m, summary: string) => `<sub>${summary.trim()} — _collapsed (size guard)_</sub>`);
    if (next === out) break;
    out = next;
  }

  if (out.length > HARD_CAP) {
    out = `${out.slice(0, HARD_CAP - 80)}\n\n<sub>…report truncated (size guard).</sub>`;
  }
  return out;
}
