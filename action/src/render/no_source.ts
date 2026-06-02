// The "no code to analyze" sticky comment — Drift's graceful answer to a PR
// that touches only docs/config/non-code (no file in a language the scanner
// understands). The normal flow SKIPS the scan + comment entirely on such PRs
// (action.yml's `has_source=false` gate) to avoid a misleading negative-money
// "Drift ▼" verdict. But silence reads as "Drift didn't run / is broken." This
// renderer replaces that silence with one honest, badge-forward note posted to
// the SAME sticky surface (STICKY_MARKER), so reviewers always get a clear
// signal: "I looked, there's no code drift to report, here's why."
//
// Design (mirrors overview.ts, badge-forward per the comment style guide):
//   marker
//   • Drift banner (same screenshot header as the full report)
//   • a 3-badge TL;DR row — verdict · category · file count
//   • one short NOTE callout explaining WHY there's no report
//   • a collapsed table of the changed files, each tagged docs/config/other
//   • a hint: push a source-file change to get the full value/risk dashboard
//   • (when present) the clickable 🔊 audio banner — a docs/config-only PR
//     still gets a commit-based spoken summary, so the link rides here too
//   • the shared footer + Andy sign-off
//   • a hidden status marker (state=no-source) so a CI gate reads a benign
//     neutral state rather than tripping on a missing snapshot
//
// Pure + I/O-free: every input is passed in, so it unit-tests without a report,
// a scanner, or a network. Degrades to valid markdown with zero changed files
// and with no PR context.

import type { Generator } from '../report.ts';
import { type PrContext, fileLink } from './context.ts';
import { STICKY_MARKER } from './overview.ts';
import { COLOR } from './lib/severity.ts';
import { flatBadge, centerBadges } from './lib/badge.ts';
import { plural, int } from './lib/format.ts';
import { sectionImage, audioBanner, andySignoff } from './lib/branding.ts';
import { renderFooter } from './sections/footer.ts';

/** The languages the scanner analyzes — mirrors action.yml's `has_source` set
 *  and Language::from_path in drift-static-profiler. Shown so reviewers know
 *  exactly what WOULD trigger a full report. */
const ANALYZED_LANGUAGES = 'Python · TypeScript / JavaScript · Go · Rust · Java · Kotlin · Scala';

export type NoSourceOptions = {
  ctx?: PrContext;
  /** Paths changed by the PR (none are source files, by definition of this path). */
  changedFiles?: string[];
  /** Scanner identity for the footer. Defaults to a generic Drift line. */
  generator?: Generator;
  /**
   * Artifact URL of the spoken-summary WAV. A docs/config-only PR now gets a
   * commit-based spoken briefing too (the audio gates fire on has_source=false),
   * so when present we render the clickable 🔊 banner + footer link, exactly
   * like the full report. Absent → both are omitted (fail-soft).
   */
  audioUrl?: string;
  /** Cap on how many files the changed-files table lists (the rest are summarized). */
  maxFiles?: number;
};

const DEFAULT_MAX_FILES = 50;

/** Render the full no-source sticky comment body (begins with STICKY_MARKER). */
export function renderNoSource(opts: NoSourceOptions = {}): string {
  const { ctx } = opts;
  const files = (opts.changedFiles ?? []).filter((f) => f.trim().length > 0);
  const gen = opts.generator ?? { tool: 'drift-static-profiler', version: '—' };
  const audioUrl = opts.audioUrl?.trim() || undefined;

  const banner = sectionImage('drift-review.png', 'Drift review');

  const sections = [
    banner,
    badges(files),
    callout(),
    changedFilesTable(files, ctx, opts.maxFiles ?? DEFAULT_MAX_FILES),
    nextStepHint(),
  ].filter(Boolean);

  // Footer block: (when present) the clickable 🔊 audio banner, then the
  // attribution/audio text line, then the Andy sign-off — mirrors overview.ts.
  const footer = [
    audioUrl ? audioBanner(audioUrl) : '',
    renderFooter(gen, audioUrl),
    andySignoff(),
  ]
    .filter(Boolean)
    .join('\n\n');

  let body = `${STICKY_MARKER}\n${sections.join('\n\n')}`;
  body += `\n\n---\n\n${footer}`;
  // Benign neutral status so a branch-protection gate that greps `drift:status`
  // sees a deliberate "nothing to score" state instead of a missing marker.
  body += `\n${statusMarker(files.length)}`;
  return body;
}

// ── building blocks ───────────────────────────────────────────────────────────

/** 3-badge TL;DR row: the verdict, the change category, and the file count. */
function badges(files: string[]): string {
  const count = `${int(files.length)} ${plural(files.length, 'file')} changed`;
  return centerBadges([
    flatBadge('✓ No code to analyze', COLOR.blue),
    flatBadge(categoryBadgeLabel(files), COLOR.grey),
    flatBadge(count, COLOR.grey),
  ]);
}

/** Accurate change-category label for the badge. Stays TRUE for every PR on
 *  this path: docs/config-only PRs name the bucket; anything else (binary,
 *  assets, OR real source in a language Drift doesn't analyze — .rb/.cpp/.php)
 *  is "No analyzed source", never the false "docs/config" or "non-code". */
function categoryBadgeLabel(files: string[]): string {
  if (files.length === 0) return 'No source files';
  const cats = new Set(files.map(categoryOf));
  if (cats.has('other')) return 'No analyzed source';
  const parts: string[] = [];
  if (cats.has('docs')) parts.push('docs');
  if (cats.has('config')) parts.push('config');
  const joined = parts.join(' & ');
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} only`;
}

/** The one-paragraph explanation — a GitHub NOTE callout, no hero prose.
 *  Wording is accurate for the WHOLE has_source=false set: docs/config AND
 *  source in a language Drift doesn't analyze (the analyzed set below is
 *  narrower than "all code"), so it never falsely claims "only docs/config". */
function callout(): string {
  return [
    '> [!NOTE]',
    `> **This PR changes no files in a language Drift analyzes** (${ANALYZED_LANGUAGES}).`,
    '> So there is no code drift, complexity shift, or business-value change to report, and the',
    '> usual value & risk dashboard is intentionally skipped. Drift ran and found nothing to flag.',
  ].join('\n');
}

/** Collapsed table of changed files, each tagged by category. Omitted when the
 *  changed-file list is empty (e.g. the list wasn't threaded through). */
function changedFilesTable(files: string[], ctx: PrContext | undefined, maxFiles: number): string {
  if (files.length === 0) return '';
  const shown = files.slice(0, maxFiles);
  const overflow = files.length - shown.length;
  // fileLink (the canonical permalink helper) keeps the path in a code-span
  // link identical to every other Drift table — single escaping behaviour.
  const rows = shown.map((f) => `| ${fileLink(ctx, f)} | ${categoryOf(f)} |`).join('\n');
  const overflowNote =
    overflow > 0 ? `\n\n<sub>… and ${int(overflow)} more ${plural(overflow, 'file')} not shown.</sub>` : '';
  const summary = `📄 Files changed (${int(files.length)}) — none in a language Drift analyzes`;
  return [
    '<details>',
    `<summary>${summary}</summary>`,
    '',
    '| File | Type |',
    '| --- | --- |',
    rows,
    overflowNote,
    '',
    '</details>',
  ].join('\n');
}

/** Coarse human label for a changed path, by extension / well-known name.
 *  Dot-prefixed files default to 'config' (the common case: .gitignore,
 *  .nvmrc, .eslintrc, …); anything unrecognized is 'other'. */
function categoryOf(path: string): string {
  const lower = path.toLowerCase();
  const base = lower.split('/').pop() ?? lower;
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : '';
  if (DOCS_EXT.has(ext)) return 'docs';
  if (CONFIG_EXT.has(ext) || CONFIG_NAMES.has(base) || base.startsWith('.')) return 'config';
  return 'other';
}

const DOCS_EXT = new Set(['md', 'mdx', 'markdown', 'rst', 'adoc', 'txt']);
const CONFIG_EXT = new Set([
  'yml', 'yaml', 'json', 'jsonc', 'toml', 'ini', 'cfg', 'conf', 'env', 'lock', 'properties', 'xml', 'editorconfig',
]);
const CONFIG_NAMES = new Set([
  'dockerfile', 'makefile', 'license', '.gitignore', '.dockerignore', '.gitattributes',
]);

/** The actionable next step, in a quiet sub-line. */
function nextStepHint(): string {
  return (
    '<sub>💡 Push a change to a source file ' +
    `(${ANALYZED_LANGUAGES}) and Drift will post its full value, complexity, and risk report here.</sub>`
  );
}

/** Hidden CI-gateable status marker for the no-source state. Distinct `state`
 *  value so a gate can treat it as a deliberate pass (nothing scored), and so
 *  it never collides with overview.ts's `drift:status` (which carries scores). */
function statusMarker(fileCount: number): string {
  return `<!-- drift:status v=1 state=no-source confidence=na effort=0 changed=${fileCount} -->`;
}
