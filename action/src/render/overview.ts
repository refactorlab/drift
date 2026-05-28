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
import { extractFacts } from './lib/facts.ts';

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

  const major = [header, valueCard, suggestions, risks, architecture].filter((s): s is string => !!s);
  const tail = [ext, legend].filter((s): s is string => !!s).join('\n\n');
  const footer = renderFooter(report.generator, audioUrl);

  let body = `${STICKY_MARKER}\n${major.join('\n\n---\n\n')}`;
  if (tail) body += `\n\n---\n\n${tail}`;
  body += `\n\n---\n\n${footer}`;
  body += `\n\n${serializeState(currentState)}`;

  return guardSize(body);
}

/**
 * Keep the body under GitHub's cap. Collapses <details> bodies INNERMOST-first
 * (so nested disclosures don't get mangled), then hard-truncates as a last
 * resort. A no-op on the normal ~20–30 KB body.
 */
function guardSize(body: string): string {
  if (body.length <= BODY_SIZE_BUDGET) return body;

  // Innermost details = one whose body contains no further <details>.
  const innermost = /<details>\s*<summary>([\s\S]*?)<\/summary>(?:(?!<details>)[\s\S])*?<\/details>/;
  let out = body;
  for (let i = 0; i < 1000 && out.length > BODY_SIZE_BUDGET; i++) {
    const next = out.replace(innermost, (_m, summary: string) => `<details><summary>${summary.trim()} — _collapsed (size guard)_</summary></details>`);
    if (next === out) break;
    out = next;
  }

  if (out.length > HARD_CAP) {
    out = `${out.slice(0, HARD_CAP - 80)}\n\n<sub>…report truncated (size guard).</sub>`;
  }
  return out;
}
