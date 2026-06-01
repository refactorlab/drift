// Sticky overview comment — assembled top-down: lead with WHAT the PR touches
// (the architecture diagrams), then its value, the fixes, the risk, and finally
// the extended findings:
//
//   marker
//   1. Header           — 3-badge TL;DR + KPI gauge dashboard
//   2. Complexity gauges — the lead complexity/risk profile
//   3. Architecture     — color-coded diff graph · business · mindmap
//   4. Business value   — single per-axis drift chart
//   5. Code suggestions — priority table (one row per finding) + Fix-All prompt
//   6. Risks            — impact-ordered table + quadrant map
//   7. Extended findings
//   8. Before you merge — the actionable, GitHub-tallied checklist (closes the comment)
//   9. Footer           — attribution + (optional) audio link
//   state blob          — invisible snapshot, diffed on the next push
//
// Every section returns null when its data is absent, so the comment degrades
// cleanly from a full value-model report down to a factual-only one.

import type { ScanPrOutput, PrReviewExt } from '../report.ts';
import type { PrContext } from './context.ts';
import { type DriftState, stateFromReport, serializeState, appendConfHistory } from './state.ts';
import { extractFacts, type PrFacts } from './lib/facts.ts';
import { mergeConfidence } from './lib/confidence.ts';
import { reviewEffort } from './lib/effort.ts';
import { wrapSection } from './lib/section.ts';
import { signedPercent, plural, int, escapeHtml } from './lib/format.ts';

import { renderHeader } from './sections/header.ts';
import { renderQualityGauges } from './sections/quality_gauges.ts';
import { renderValueCard } from './sections/value_card.ts';
import { renderSuggestions } from './sections/suggestions.ts';
import { renderRisks } from './sections/risks.ts';
import { renderArchitecture } from './sections/architecture.ts';
import { renderExt } from './sections/ext.ts';
import { renderBeforeMerge } from './sections/before_merge.ts';
import { renderFooter } from './sections/footer.ts';
import { renderScanArtifacts } from './sections/artifacts.ts';

export const STICKY_MARKER = '<!-- drift:sticky-comment -->';

// Architecture is the one section the size guard must NEVER collapse or cut:
// the before/after diagrams ARE the "what changed" payload, useless once folded
// to a one-line marker. We bracket the rendered Architecture block with these
// invisible HTML-comment sentinels (GitHub renders comments to nothing) so
// `guardSize` can locate the protected span and skip every <details> inside it;
// all other sections still collapse first to make room. Kept distinct from the
// `drift:state`/`drift:status` markers so the state-snapshot parser never trips
// on them.
export const ARCH_GUARD_OPEN = '<!-- drift:arch:nocollapse -->';
export const ARCH_GUARD_CLOSE = '<!-- /drift:arch:nocollapse -->';

/** Bracket a rendered block with the Architecture no-collapse sentinels. */
const protectArchitecture = (block: string): string => `${ARCH_GUARD_OPEN}\n${block}\n${ARCH_GUARD_CLOSE}`;

// GitHub caps comment bodies at 65 536 chars. We aim for 60 000 to leave
// headroom for the markers; over budget, <details> contents are collapsed.
const BODY_SIZE_BUDGET = 60_000;
const HARD_CAP = 65_000;

// Official Drift section-header screenshots (refactorlab/andy/docs/screenshots).
// Fail-soft: GitHub's Camo proxy degrades a missing/404 asset to its `alt` text
// without breaking the comment, so these can ship before the PNGs are committed.
const SCREENSHOTS = 'https://raw.githubusercontent.com/refactorlab/andy/main/docs/screenshots';
// Banner sizing. These brand PNGs are wide hero images; at full width they
// dominate the comment, so every banner is pinned to a small FIXED width
// (height auto-scales, preserving aspect ratio). Deliberately kept compact so a
// banner reads as a section marker, not a hero that pushes the content below
// the fold. Section banners share BANNER_WIDTH; the audio button is the one
// call-to-action banner so it's pinned WIDER (AUDIO_BANNER_WIDTH) to draw the
// eye; the Andy sign-off is smaller still.
const BANNER_WIDTH = 120;
const AUDIO_BANNER_WIDTH = 200;
const ANDY_WIDTH = 64;
const sectionImage = (file: string, alt: string): string =>
  `<p><img src="${SCREENSHOTS}/${file}" alt="${alt}" width="${BANNER_WIDTH}" /></p>`;
/** Prepend a section-header screenshot to a section's markdown (own line, above it). */
const withImage = (file: string, alt: string, section: string): string => `${sectionImage(file, alt)}\n\n${section}`;

/**
 * Clickable "🔊 audio summary" button banner — the `summary-audio.png` screenshot
 * wrapped in a link to the spoken-summary artifact. `escapeHtml` closes the
 * `href` attribute safely (the URL is env-influenced). Only rendered when an
 * audio URL exists; same artifact caveat as the footer's text link.
 */
const audioBanner = (url: string): string =>
  `<p align="center"><a href="${escapeHtml(url)}"><img src="${SCREENSHOTS}/summary-audio.png" alt="🔊 Listen to the spoken summary (Piper TTS)" width="${AUDIO_BANNER_WIDTH}" /></a></p>`;

/**
 * Andy sign-off — a small mascot banner pinned to the VERY END of the comment,
 * after the audio button and the attribution line. It is the last visible
 * element, so the comment always closes on the Andy handoff whether or not a
 * spoken summary is present. Kept small (ANDY_WIDTH) so it reads as a sign-off,
 * not a hero banner. Fail-soft to alt text like every other screenshot.
 */
const andySignoff = (): string =>
  `<p><img src="${SCREENSHOTS}/andy.png" alt="Andy — your PR handoff assistant" width="${ANDY_WIDTH}" /></p>`;

export type RenderOptions = {
  ctx?: PrContext;
  /** Prior run's snapshot (from the previous sticky comment) for the delta line. */
  priorState?: DriftState | null;
  /** Artifact URL of the spoken-summary WAV, linked in the footer. */
  audioUrl?: string;
  /**
   * Artifact URL of the MP4 sibling (silent black frame + AAC audio). Surfaced
   * in the footer alongside the WAV. The MP4 exists because GitHub strips
   * <audio> in PR comments but auto-embeds a <video> player when a logged-in
   * reviewer drag-drops the MP4 into a reply.
   */
  audioMp4Url?: string;
  /**
   * Artifact URL of the raw scanner report (pr-scan.json), linked in the
   * collapsed scan-artifacts accordion at the bottom of the comment. Absent →
   * the accordion omits that link (and omits the whole block if both URLs are
   * absent). Threaded in from the action as DRIFT_SCAN_JSON_URL.
   */
  scanJsonUrl?: string;
  /**
   * Artifact URL of the scan-context bundle (pr-scan-context.json) — PR
   * identity, diff scope, and run/scanner pointers an agent can reload.
   * Threaded in from the action as DRIFT_SCAN_CONTEXT_URL.
   */
  scanContextUrl?: string;
  /**
   * Render cap on the Code-suggestions section (default 10). Only the top-N
   * highest-priority findings are rendered; the heading + overflow note keep
   * the true total visible. RENDER-ONLY — the underlying report is untouched,
   * so the inline review + AI focal-point picker still see every suggestion.
   * Overridden from the CLI via `--max-suggestions=N` / `DRIFT_MAX_SUGGESTIONS`.
   */
  maxSuggestions?: number;
};

export function renderOverview(report: ScanPrOutput, opts: RenderOptions = {}): string {
  const { ctx, priorState, audioUrl, audioMp4Url, scanJsonUrl, scanContextUrl, maxSuggestions } = opts;
  const review = report.pr_review;
  const facts = extractFacts(report);
  const currentState = stateFromReport(report);

  // Merge-confidence trend: append this push's 0–5 score to the prior history
  // (carried in the previous sticky comment's state snapshot), bounded, and
  // persist it so the next push can draw the sparkline. The append must happen
  // HERE, where priorState is available — stateFromReport() stays pure.
  const confidence = mergeConfidence(facts);
  const confTrend = appendConfHistory(priorState, confidence.score);
  currentState.confHistory = confTrend;

  const header = renderHeader(report, ctx, { confTrend });
  // 📊 Complexity & Risk gauges — the lead gauge report (charts-of-metrics.md).
  // All 18 metrics are computed by the profiler (pr_quality.gauges); this is
  // pure presentation. Sits right under the header as the initial reporting.
  const qualityGauges = renderQualityGauges(report.pr_review_ext, ctx?.prTitle);
  const valueCard = renderValueCard({
    counts: review?.counts,
    card: review?.value_card,
    overallPercent: review?.overall_drift?.percent,
    currentState,
    priorState,
  });
  const suggestions = renderSuggestions(review?.code_suggestions, ctx, { max: maxSuggestions });
  const risks = renderRisks(review?.visual_summary?.risks);
  const architecture = renderArchitecture({
    prScope: report.pr_scope,
    arch: review?.architecture_flow,
    business: review?.business_logic,
    keyFiles: review?.visual_summary?.key_files,
    ctx,
  });
  const ext = renderExt(report.pr_review_ext, ctx);
  // The "✅ Before you merge" checklist now closes the comment (moved out of the
  // header). Visible (not collapsed) so GitHub tallies the task boxes.
  const beforeMerge = renderBeforeMerge(facts, ctx);

  // Every detail section is wrapped in an expandable <details> whose summary
  // is "Title — TLDR", so the comment reads as a scannable list of TLDRs the
  // reviewer can open on demand. The header stays OUTSIDE this framing: it is
  // the whole-PR TLDR (verdict + KPIs) and its "Before you merge" task boxes
  // must stay visible for GitHub to tally merge-readiness. Every detail section
  // below defaults to COLLAPSED — the comment is a scannable list of TLDRs the
  // reviewer expands on demand. Architecture leads the body (the diagrams that
  // show WHAT changed), then the value dashboard, suggestions, and supporting
  // detail follow.
  // Each major section is preceded by its official Drift screenshot banner.
  // Each section's screenshot banner sits ABOVE it as a decorative header; the
  // collapsible's own <summary> row (rendered by GitHub with a ▸/▾ disclosure
  // arrow) is the toggle. The banner can't be the toggle — clicking an image
  // opens the image, never the <details>.
  const sections: string[] = [withImage('drift-review.png', 'Drift review', header)];
  // Lead with the gauge report — the at-a-glance complexity/risk profile.
  if (qualityGauges)
    sections.push(withImage('complexity-risk-report.png', 'Complexity & Risk Report', wrapSection(qualityGauges, { tldr: tldrGauges(report.pr_review_ext) })));
  // Architecture is bracketed with no-collapse sentinels so the size guard
  // leaves its color-coded diff graph fully expanded even when the comment is
  // over budget (every other section collapses first to make room).
  if (architecture)
    sections.push(protectArchitecture(withImage('architecture.png', 'Architecture', wrapSection(architecture, { tldr: tldrArchitecture(facts) }))));
  if (valueCard) sections.push(withImage('business-value.png', 'Business value', wrapSection(valueCard, { tldr: tldrValue(facts) })));
  if (suggestions) sections.push(withImage('code-suggestions.png', 'Code suggestions', wrapSection(suggestions, { tldr: tldrSuggestions(facts) })));
  if (risks) sections.push(wrapSection(risks, { tldr: tldrRisks(facts) }));
  if (ext) sections.push(wrapSection(ext, { tldr: tldrExt(facts) }));
  // Closes the comment: the actionable, GitHub-tallied merge checklist.
  sections.push(beforeMerge);

  // The footer block, in order: (when there's a spoken summary) the clickable
  // audio button banner, then the attribution/audio text, then the collapsed
  // scan-artifacts accordion (machine-readable JSON links), then the small Andy
  // sign-off LAST. This keeps the audio "before the end" and pins the Andy
  // banner to the very end of the comment (the trailing state markers are
  // invisible HTML comments, so Andy is the last *visible* element). Each
  // segment returns '' when its data is absent, so the block degrades cleanly.
  const footer = [
    audioUrl?.trim() ? audioBanner(audioUrl.trim()) : '',
    renderFooter(report.generator, audioUrl, audioMp4Url),
    renderScanArtifacts({ scanJsonUrl, scanContextUrl }),
    andySignoff(),
  ]
    .filter(Boolean)
    .join('\n\n');

  let body = `${STICKY_MARKER}\n${sections.join('\n\n---\n\n')}`;
  body += `\n\n---\n\n${footer}`;
  // A hidden, machine-readable verdict line a tiny companion action can grep to
  // gate branch protection on Drift's result (Qodo publishes GitHub labels; we
  // publish a parseable marker). Invisible like the state blob, and emitted just
  // BEFORE it so the `drift:state` snapshot stays the final line (the next push
  // reads it from the end of the prior comment).
  body += `\n${statusMarker(facts, confidence.score, reviewEffort(facts).score)}`;
  body += `\n\n${serializeState(currentState)}`;

  return guardSize(body);
}

/**
 * The hidden CI-gateable status marker: stable `key=value` pairs carrying the
 * 0–5 merge-confidence + review-effort scores, the product-correctness count,
 * the gating-risk count, and overall drift % (`na` when there's no value model).
 * An HTML comment, so it never renders; `parseState()` keys off `drift:state`,
 * not `drift:status`, so the two markers never collide.
 */
function statusMarker(facts: PrFacts, confidence: number, effort: number): string {
  const drift = facts.overallPercent === null ? 'na' : facts.overallPercent.toFixed(1);
  return (
    `<!-- drift:status v=1 confidence=${confidence} effort=${effort} ` +
    `correctness=${facts.correctness.length} gatingRisks=${facts.risksToAddress} drift=${drift} -->`
  );
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
  // The section is diagrams-only (the color-coded diff graph · business-logic
  // reach · key-file mindmap) — so the teaser describes the diagrams. A terse
  // unreachable hint is kept even though the verbose callout was removed.
  const dead = f.unreachable > 0 ? ` · ${int(f.unreachable)} unreachable` : '';
  return `Color-coded diff graph${dead}`;
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

function tldrGauges(ext: PrReviewExt | undefined): string {
  const pq = ext?.pr_quality;
  const gauges = pq?.gauges ?? [];
  if (gauges.length === 0) return 'Complexity & risk gauges';
  const crit = gauges.filter((g) => g.level === 'critical').length;
  const high = gauges.filter((g) => g.level === 'high').length;
  const bits: string[] = [];
  const top = pq?.gauge_summary?.highest?.[0];
  if (top) bits.push(`${top.label} ${top.score}`);
  if (crit > 0) bits.push(`${crit} critical`);
  else if (high > 0) bits.push(`${high} high`);
  if (pq?.gauge_summary?.context_fits === false) bits.push('LLM context exceeded');
  bits.push(`${gauges.length} metrics`);
  return bits.join(' · ');
}

/**
 * Keep the body under GitHub's cap. Collapses <details> bodies INNERMOST-first
 * (so nested disclosures don't get mangled), then hard-truncates as a last
 * resort. A no-op on the normal ~20–30 KB body.
 *
 * The Architecture section is EXEMPT: the slice between ARCH_GUARD_OPEN and
 * ARCH_GUARD_CLOSE is never collapsed and never cut, so its before/after
 * diagrams always render in full. Every other section collapses first to claw
 * back budget; only if that still isn't enough does the hard-truncate fire, and
 * even then it refuses to slice into the protected span.
 */
function guardSize(body: string): string {
  if (body.length <= BODY_SIZE_BUDGET) return body;

  // Collapse INNERMOST-first. Two correctness requirements drove this shape:
  //   1. Both the target match AND the nested-boundary lookahead accept
  //      `<details open>` as well as `<details>`. The renderer currently emits
  //      only collapsed `<details>`, but the `(?: open)?` tolerance is kept so
  //      that if any section is ever made open-by-default again, the regex can
  //      still collapse it and still treat a nested `<details open>` as a
  //      boundary (a regex that only knew `<details>` could do neither).
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
  // The `g` flag lets us WALK the matches instead of always replacing the
  // first one: we collapse the first innermost <details> that does NOT overlap
  // the exempt Architecture span, leaving that section's diagram disclosures
  // untouched. Recomputed each pass because every replacement shifts indices.
  const innermost = /<details(?: open)?>\s*<summary>((?:(?!<\/summary>)[\s\S])*?)<\/summary>(?:(?!<details(?: open)?>)[\s\S])*?<\/details>/g;
  let out = body;
  for (let i = 0; i < 1000 && out.length > BODY_SIZE_BUDGET; i++) {
    const arch = archSpan(out);
    innermost.lastIndex = 0;
    // Collapse BOTTOM-UP: walk every innermost <details> and remember the LAST
    // one that doesn't overlap the protected Architecture span, then collapse
    // that. The comment is laid out lead-first — the at-a-glance gauge report,
    // then business value and code suggestions, with the reviewer's guide and
    // extended findings as an appendix at the bottom. Shedding the last block
    // in document order first therefore reclaims budget from the appendix
    // before the lead, so the gauge report stays expanded right under the
    // banner even when the body is over budget. (Picking the FIRST match would
    // collapse the lead gauges first — exactly backwards.) Innermost-first is
    // preserved because the regex only matches leaf <details>; once a section's
    // children are folded to tagless markers its outer block becomes a leaf and
    // collapses on a later pass, so collapse marches appendix→lead, depth-first.
    let target: { start: number; end: number; summary: string } | null = null;
    let m: RegExpExecArray | null;
    while ((m = innermost.exec(out)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // Skip any disclosure that overlaps the protected Architecture span.
      if (arch && start < arch.end && end > arch.start) continue;
      target = { start, end, summary: m[1].trim() };
    }
    // Nothing left to collapse outside Architecture — stop (the hard-cut below
    // is the only remaining lever, and it too spares the protected span).
    if (!target) break;
    out = `${out.slice(0, target.start)}<sub>${target.summary} — _collapsed (size guard)_</sub>${out.slice(target.end)}`;
  }

  if (out.length > HARD_CAP) {
    // Last resort tail-cut. Never slice into the exempt Architecture span: if
    // the normal cut point would land before its close sentinel, push the cut
    // out to the end of that span so the diagrams survive whole. The body may
    // then exceed HARD_CAP — the accepted cost of exempting Architecture, and
    // unreachable in practice once every other section has collapsed.
    const arch = archSpan(out);
    const cut = arch ? Math.max(HARD_CAP - 80, arch.end) : HARD_CAP - 80;
    out = `${out.slice(0, cut)}\n\n<sub>…report truncated (size guard).</sub>`;
  }
  return out;
}

/**
 * Locate the no-collapse Architecture span — the slice between ARCH_GUARD_OPEN
 * and ARCH_GUARD_CLOSE that `guardSize` must leave untouched. Null when the
 * section is absent (factual-only reports carry no diagrams, so no sentinels).
 */
function archSpan(body: string): { start: number; end: number } | null {
  const start = body.indexOf(ARCH_GUARD_OPEN);
  if (start === -1) return null;
  const closeIdx = body.indexOf(ARCH_GUARD_CLOSE, start);
  if (closeIdx === -1) return null;
  return { start, end: closeIdx + ARCH_GUARD_CLOSE.length };
}
