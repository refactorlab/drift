// 🧭 Reviewer's guide — Drift's answer to Qodo Merge's signature surface (the
// `/describe` walkthrough + the `/review` "PR Reviewer Guide"), rebuilt to BEAT
// it: where Qodo asks an LLM to guess, every line here is DETERMINISTIC from the
// static facts the scanner already produced, so it's reproducible and testable.
//
// It's a triage panel — read it in ~8 seconds, then decide what to open.
// (overview.ts renders it as a collapsed accordion near the END of the comment.)
//
//   [regression tripwire]  — a [!CAUTION] only when this push got riskier than
//                            the last (the persisted state blob as a watchdog)
//   At a glance            — pre-attentive severity counts (🔴 / 🟡 / 💡 / 🧪)
//   ✅ Clean               — Baz-style positive validations (what was checked
//                            and is genuinely SAFE) — a trust device rivals omit
//   Focused-PR verdict     — 🎯 focused · 🔀 consider splitting (cohort-grounded,
//                            no LLM — Qodo's "Focused PR?" done from the graph)
//   🔑 Key issues to review — Qodo's curated triage table (issue · where · why)
//   🗂 Changes             — the cohort walkthrough table (collapsible TOC into
//                            the diff — CodeRabbit's "Changes" map)
//
// All sourced from PrFacts + the changed-file scope + the cross-push state, so
// it can never disagree with the deeper sections it points into. Degrades: with
// no findings it becomes a calm all-clear; with no value model it still maps the
// files and counts coverage.

import type { PrFacts } from '../lib/facts.ts';
import type { PrContext } from '../context.ts';
import type { DriftState } from '../state.ts';
import type { CodeSuggestion } from '../../report.ts';
import { fileLink } from '../context.ts';
import { int, plural, signedPercent, confidencePercent } from '../lib/format.ts';
import { mergeConfidence } from '../lib/confidence.ts';
import { groupCohorts, type CohortSummary } from '../lib/cohorts.ts';

const MAX_KEY_ISSUES = 5;
const MAX_COHORT_ROWS = 8;
const MAX_FILES_PER_COHORT = 6;
const WHY_MAX = 90;
// Mirror agent_prompt.ts: below this, a finding is a strong hint, not a fact —
// so the guide flags it for verification rather than asserting it.
const VERIFY_BELOW = 0.85;

export type ReviewersGuideInput = {
  facts: PrFacts;
  /** PR scope file lists (the cohort walkthrough source). */
  changedFiles: string[];
  unreachable: string[];
  ctx?: PrContext;
  /** Prior sticky comment's snapshot (for the regression tripwire). Null on first run. */
  priorState?: DriftState | null;
  /** This run's snapshot (carries overall drift + the confidence history). */
  currentState: DriftState;
};

export function renderReviewersGuide(input: ReviewersGuideInput): string | null {
  const { facts, changedFiles, ctx } = input;
  // No scope at all → nothing to guide. (Every real PR has changed files.)
  if (changedFiles.length === 0 && facts.passing.length === 0) return null;

  const cohorts = groupCohorts(changedFiles, input.unreachable);

  // The section keeps its plain `## …` heading (a real anchor + the accessible
  // fallback); overview.ts wraps it with its official section-header screenshot
  // via withImage(), exactly like the other major sections.
  const lines: string[] = ['## 🧭 Reviewer’s guide', ''];

  const tripwire = regressionTripwire(facts, input.priorState, input.currentState);
  if (tripwire) lines.push(tripwire, '');

  lines.push(atAGlance(facts), '');

  const clean = cleanChecks(facts);
  if (clean) lines.push(clean, '');

  lines.push(focusVerdict(cohorts), '');

  lines.push(keyIssues(facts, ctx));

  // The walkthrough maps the changed files; skip it entirely when there are none
  // (a suggestions-only edge case) rather than emit an empty table.
  if (cohorts.totalFiles > 0) lines.push('', changesWalkthrough(cohorts, ctx));

  return lines.join('\n').trimEnd();
}

// ── regression tripwire ───────────────────────────────────────────────────────
// The sticky comment as a WATCHDOG, not a snapshot: alarm ONLY when this push is
// riskier than the last one a reviewer saw. No competitor uses persisted
// cross-push state to actively flag a regression in-comment.

function regressionTripwire(facts: PrFacts, prior: DriftState | null | undefined, current: DriftState): string | null {
  const priorConf = lastFinite(prior?.confHistory);
  if (priorConf === null) return null; // first run / no comparable history

  const curConf = mergeConfidence(facts).score;
  const confDropped = curConf < priorConf;

  const priorDrift = typeof prior?.overall === 'number' ? prior.overall : null;
  const curDrift = typeof current.overall === 'number' ? current.overall : null;
  const driftDropped = priorDrift !== null && curDrift !== null && curDrift < priorDrift - 0.05;

  if (!confDropped && !driftDropped) return null;

  const bits: string[] = [];
  if (confDropped) bits.push(`merge confidence **${priorConf} → ${curConf}/5**`);
  if (driftDropped) bits.push(`overall drift **${signedPercent(priorDrift!)} → ${signedPercent(curDrift!)}**`);

  return [
    '> [!CAUTION]',
    `> \u{1F501} **Heads-up — this push got riskier since the last review:** ${joinClauses(bits)}. ` +
      `If you already approved, take another look before merge.`,
  ].join('\n');
}

// ── at a glance — the pre-attentive severity read ─────────────────────────────

function atAGlance(facts: PrFacts): string {
  const reached = facts.perRootCoverage.length;
  const untested = facts.perRootCoverage.filter((r) => !r.tested).length;

  // Ordered by pre-attentive severity: red → amber → informational → coverage.
  const parts = [`\u{1F534} **${int(facts.correctness.length)}** correctness`];
  if (facts.totalRisks > 0) parts.push(`\u{1F7E1} **${int(facts.risksToAddress)}** gating ${plural(facts.risksToAddress, 'risk')}`);
  parts.push(`\u{1F4A1} **${int(facts.passing.length)}** ${plural(facts.passing.length, 'suggestion')}`);
  if (reached > 0) parts.push(`\u{1F9EA} **${int(untested)}/${int(reached)}** reached ${plural(reached, 'root')} untested`);

  return `**At a glance:** ${parts.join(' · ')}`;
}

// ── clean checks — Baz-style positive validations ─────────────────────────────
// Only claims a check is clean when the underlying data was actually present, so
// it never says "no risks" merely because risk data was absent. This honest
// "what I verified and it's safe" is the trust lever LLM-first reviewers skip.

function cleanChecks(facts: PrFacts): string | null {
  const passed: string[] = [];

  if (facts.changedFiles > 0 && facts.correctness.length === 0) passed.push('no product-correctness issues');
  if (facts.axes.length > 0 && facts.regressedAxes.length === 0) passed.push('no value-axis regressions');
  if (facts.totalRisks > 0 && facts.risksToAddress === 0) passed.push('no gating risks');
  if (facts.perRootCoverage.length > 0 && facts.perRootCoverage.every((r) => r.tested)) {
    passed.push(`all ${int(facts.perRootCoverage.length)} reached entry points tested`);
  }
  if (facts.passing.length > 0 && facts.deadCode.length === 0) passed.push('no dead code in changed files');
  if (facts.newTestFiles !== null && facts.newTestFiles > 0) passed.push(`${int(facts.newTestFiles)} new test ${plural(facts.newTestFiles, 'file')} added`);

  if (passed.length === 0) return null;
  return `✅ **Clean:** ${passed.slice(0, 4).join(' · ')}.`;
}

// ── focused-PR verdict — Qodo's "Focused PR?" from the call graph ─────────────

function focusVerdict(cohorts: CohortSummary): string {
  if (cohorts.spread === 'spread') {
    const areas = cohorts.cohorts.filter((c) => c.role === 'source').slice(0, 4).map((c) => `\`${escapeCell(c.label)}\``).join(', ');
    return (
      `\u{1F500} **Consider splitting** — this PR spans **${cohorts.sourceAreas}** source areas (${areas}…); ` +
      `smaller, single-purpose PRs review faster and revert cleaner.`
    );
  }
  if (cohorts.sourceAreas === 1) {
    return '\u{1F3AF} **Focused PR** — the code changes are confined to a single area.';
  }
  if (cohorts.sourceAreas === 0) {
    return '\u{1F4C4} **No source changes** — this PR touches only tests, docs, or config.';
  }
  return `\u{1F9ED} Touches **${cohorts.sourceAreas}** source areas across **${int(cohorts.totalFiles)}** files.`;
}

// ── key issues to review — Qodo's curated triage table ────────────────────────

function keyIssues(facts: PrFacts, ctx?: PrContext): string {
  // Must-review first: real product-correctness findings, highest confidence
  // first. If there are none, fall back to the top advisory suggestions so the
  // table is never empty when there IS something to look at.
  const correctness = [...facts.correctness].sort((a, b) => b.confidence - a.confidence);
  let rows = correctness.slice(0, MAX_KEY_ISSUES);
  let advisory = false;
  if (rows.length === 0) {
    rows = [...facts.passing].sort((a, b) => b.confidence - a.confidence).slice(0, 3);
    advisory = rows.length > 0;
  }

  if (rows.length === 0) {
    return [
      '### \u{1F511} Key issues to review',
      '',
      '✅ No must-review code issues flagged. Skim the **Changes** map below, then check **Blast radius** for coverage.',
    ].join('\n');
  }

  const heading = advisory
    ? '### \u{1F511} Key issues to review <sub>(no must-fix — top advisory items)</sub>'
    : `### \u{1F511} Key issues to review (${rows.length})`;

  const out = [heading, '', '| Issue | Where | Why it matters |', '|---|---|---|'];
  for (const s of rows) {
    out.push(`| ${issueLabel(s)} | ${where(s, ctx)} | ${why(s)} |`);
  }
  return out.join('\n');
}

function issueLabel(s: CodeSuggestion): string {
  const emoji = s.category === 'B' ? '\u{1F7E1}' : s.category === 'C' ? '\u{1F535}' : '⚪';
  const suffix = labelSuffix(s.category_label);
  const name = suffix ?? (s.category === 'B' ? 'Product correctness' : s.category === 'C' ? 'Framework misuse' : 'Optimization');
  return `${emoji} ${escapeCell(name)}`;
}

function where(s: CodeSuggestion, ctx?: PrContext): string {
  // The Where cell lives in a markdown TABLE; a file path can legally contain a
  // `|` or backtick, which would split the row / unbalance the code span. Pass a
  // pre-escaped label so fileLink keeps its monospace anchor while the cell stays
  // a single cell (escapeCell is a no-op for ordinary paths, so styling is kept).
  const line = typeof s.line === 'number' ? s.line : undefined;
  const label = escapeCell(typeof line === 'number' ? `${basenameOf(s.file)}:${line}` : s.file);
  return fileLink(ctx, s.file, line, label);
}

function why(s: CodeSuggestion): string {
  // Many findings open with "<problem> at <file>:<line> — <reason>"; the Where
  // column already carries the location, so prefer the reason clause after the
  // first em-dash to avoid restating file:line in the table.
  const raw = s.why_it_matters.trim();
  const dash = raw.indexOf(' — ');
  const reason = dash >= 0 ? raw.slice(dash + 3).trim() : raw;
  const verify = s.confidence < VERIFY_BELOW ? ` <sub>(${confidencePercent(s.confidence)} — verify)</sub>` : '';
  return `${escapeCell(truncate(firstSentence(reason), WHY_MAX))}${verify}`;
}

// ── changes walkthrough — the cohort map (collapsible TOC into the diff) ───────

function changesWalkthrough(cohorts: CohortSummary, ctx?: PrContext): string {
  const summary = `\u{1F5C2} Changes — ${cohorts.cohorts.length} ${plural(cohorts.cohorts.length, 'area')} · ${int(cohorts.totalFiles)} files`;
  const out = ['<details>', `<summary>${summary}</summary>`, '', '| Area | Files | Notes |', '|---|---|---|'];

  for (const c of cohorts.cohorts.slice(0, MAX_COHORT_ROWS)) {
    const links = c.files
      .slice(0, MAX_FILES_PER_COHORT)
      // escapeCell the label: a `|`/backtick in a path would otherwise break this
      // table row (same defense already applied to the cohort label below).
      .map((f) => fileLink(ctx, f, undefined, escapeCell(basenameOf(f))))
      .join(' · ');
    const more = c.files.length > MAX_FILES_PER_COHORT ? ` *…+${c.files.length - MAX_FILES_PER_COHORT}*` : '';
    const count = `**${c.files.length}** ${plural(c.files.length, 'file')}`;
    const note = c.unreachable > 0 ? `⚠️ ${c.unreachable} unreachable` : '—';
    out.push(`| **${escapeCell(c.label)}** | ${count} · ${links}${more} | ${note} |`);
  }
  if (cohorts.cohorts.length > MAX_COHORT_ROWS) {
    out.push(`| *…+${cohorts.cohorts.length - MAX_COHORT_ROWS} more areas* | | |`);
  }

  out.push('', '</details>');
  return out.join('\n');
}

// ── helpers ────────────────────────────────────────────────────────────────────

function labelSuffix(label?: string): string | null {
  if (!label) return null;
  const idx = label.indexOf('—'); // em-dash
  const suffix = (idx >= 0 ? label.slice(idx + 1) : '').trim();
  return suffix || null;
}

/**
 * First sentence (up to the first terminator + space), else the whole string —
 * but NOT fooled into stopping at a common abbreviation ("e.g.", "i.e.", "etc.")
 * or an implausibly short clip, which would drop the actual reason. Falls back
 * to the whole string in those cases (the caller's truncate() caps the length).
 */
function firstSentence(s: string): string {
  const t = s.trim();
  const m = t.match(/^(.*?[.!?])(\s|$)/);
  if (!m) return t;
  const candidate = m[1];
  const abbrev = /\b(?:e\.g|i\.e|etc|vs|cf|al|approx|no|fig|eq|sec|ch|st|mr|mrs|dr)\.$/i;
  if (candidate.length < 16 || abbrev.test(candidate)) return t;
  return candidate;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Keep `|`, backticks, and line breaks from breaking a markdown table cell. */
function escapeCell(s: string): string {
  return s.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').replace(/`/g, "'").replace(/\s+/g, ' ').trim();
}

function basenameOf(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function lastFinite(xs: number[] | undefined): number | null {
  if (!Array.isArray(xs)) return null;
  for (let i = xs.length - 1; i >= 0; i--) {
    if (Number.isFinite(xs[i])) return xs[i];
  }
  return null;
}

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}
