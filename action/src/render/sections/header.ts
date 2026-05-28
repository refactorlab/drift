// The header block — everything above the value card:
//   1. title line   — `## ▲ Drift review — \`<PR title>\``
//   2. sub-line      — repo permalink · sticky-comment note · advisory check
//   3. advisory callout — GFM alert with a data-driven one-paragraph verdict
//   4. KPI badge row — shields.io pills (review / drift / files / net LOC / …)
//   5. ✅ Before you merge — the synthesised checklist
//   6. Merge readiness — a progress bar GitHub re-tallies as boxes are ticked
//
// Everything degrades: no value model → no drift/LOC badges, a factual verdict,
// and a checklist driven only by what IS known.

import type { ScanPrOutput } from '../../report.ts';
import type { PrContext } from '../context.ts';
import { repoSlug } from '../context.ts';
import { COLOR, compositeStatus, type Composite } from '../lib/severity.ts';
import { extractFacts, type PrFacts } from '../lib/facts.ts';
import { buildChecklist } from '../lib/checklist.ts';
import { progressBar } from '../lib/bars.ts';
import { signedPercent, signedInt, int, plural } from '../lib/format.ts';

type Verdict = {
  alert: 'WARNING' | 'TIP' | 'NOTE';
  headline: string;
  statusMessage: string; // review-status badge text
  statusColor: string;
};

export function renderHeader(report: ScanPrOutput, ctx?: PrContext): string {
  const facts = extractFacts(report);
  const composite = compositeStatus(facts.axes);
  const verdict = decideVerdict(facts, composite);

  const blocks: string[] = [
    titleLine(facts, ctx),
    subLine(ctx),
    calloutBlock(verdict, facts, composite),
    badgeRow(facts, verdict),
  ];

  const checklist = buildChecklist(facts, ctx);
  blocks.push(checklistBlock(checklist));

  return blocks.filter(Boolean).join('\n\n');
}

// ── 1. title ────────────────────────────────────────────────────────────────

// Pathologically long titles blow out the H2; cap with an ellipsis. (PR titles
// up to ~120 chars are common; cap is generous but defensive.)
const TITLE_MAX_CHARS = 200;

/**
 * Sanitize a PR title for inline-code-span use in an H2 heading. Defends:
 *  - **backticks** — would break the surrounding `` ` `` code span;
 *  - **newline / CR / LF / line-/paragraph-separator** — would END the heading
 *    line and let the rest of the title inject markdown (e.g. `## INJECTED`);
 *  - **NUL / other control chars** — would corrupt rendering.
 * Each hostile char becomes a space; consecutive whitespace is collapsed.
 */
function sanitizeTitle(raw: string): string {
  let s = raw
    // CR, LF, NEL, line/paragraph separators → space.
    .replace(/[\r\n\u0085\u2028\u2029]+/g, ' ')
    // Backticks would break the code span.
    .replace(/`/g, "'")
    // Any remaining ASCII control char → space.
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    // Collapse runs of whitespace.
    .replace(/\s+/g, ' ')
    .trim();
  if ([...s].length > TITLE_MAX_CHARS) {
    s = [...s].slice(0, TITLE_MAX_CHARS - 1).join('') + '…';
  }
  return s;
}

function titleLine(facts: PrFacts, ctx?: PrContext): string {
  const arrow =
    facts.overallDirection === 'up' ? '▲ ' : facts.overallDirection === 'down' ? '▼ ' : facts.overallDirection === 'neutral' ? '— ' : '';
  const raw = ctx?.prTitle?.trim();
  const title = raw ? sanitizeTitle(raw) : '';
  const suffix = title ? ` — \`${title}\`` : '';
  return `## ${arrow}Drift review${suffix}`;
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
    return {
      alert: 'WARNING',
      headline: '**Recommend addressing before merge**',
      statusMessage: 'address before merge',
      statusColor: COLOR.amber,
    };
  }
  if (facts.overallDirection === 'up') {
    return {
      alert: 'TIP',
      headline: '**Looks good** — advisory review found nothing to gate on',
      statusMessage: 'looks good',
      statusColor: COLOR.green,
    };
  }
  return {
    alert: 'NOTE',
    headline: '**Advisory review**',
    statusMessage: 'advisory',
    statusColor: COLOR.blue,
  };
}

function calloutBlock(verdict: Verdict, facts: PrFacts, composite: Composite): string {
  const body = [`${verdict.headline} &nbsp;·&nbsp; advisory, does not fail the check.`, ...narrative(facts, composite)];
  return [`> [!${verdict.alert}]`, ...body.map((l) => `> ${l}`)].join('\n');
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

function badgeRow(facts: PrFacts, verdict: Verdict): string {
  const badges: string[] = [];
  badges.push(badge('Review status', 'review', verdict.statusMessage, verdict.statusColor));

  if (facts.overallPercent !== null) {
    const color = facts.overallDirection === 'up' ? COLOR.green : facts.overallDirection === 'down' ? COLOR.red : COLOR.grey;
    badges.push(badge(`Drift ${signedPercent(facts.overallPercent)}`, 'drift', signedPercent(facts.overallPercent), color));
  }

  badges.push(badge(`Files ${facts.changedFiles}`, 'files', int(facts.changedFiles), COLOR.blue));

  if (facts.netLoc !== null) {
    badges.push(badge(`Net LOC ${signedInt(facts.netLoc)}`, 'net LOC', signedInt(facts.netLoc), COLOR.grey));
  }

  badges.push(badge(`Suggestions ${facts.passing.length}`, 'suggestions', int(facts.passing.length), facts.passing.length > 0 ? COLOR.blue : COLOR.grey));

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

// ── 5. checklist + 6. merge readiness ────────────────────────────────────────

function checklistBlock(items: string[]): string {
  if (items.length === 0) {
    return ['### ✅ Before you merge', '', '_Nothing blocking — Drift found no gating issues. Advisory review only._'].join('\n');
  }
  const boxes = items.map((t) => `- [ ] ${t}`);
  const readiness = `> **Merge readiness** &nbsp; \`${progressBar(0, items.length)}\` &nbsp; **0 / ${items.length}** — GitHub tallies the boxes above as you check them off.`;
  return ['### ✅ Before you merge', '', ...boxes, '', readiness].join('\n');
}

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}
