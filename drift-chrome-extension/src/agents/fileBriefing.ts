// The FILE BRIEFING — Level 1 + Level 2 of the handover's 3-level file framing.
//
// SINGLE RESPONSIBILITY: turn a changed file's diff/symbols PLUS the PR's
// architecture-CORRELATION signals (from the scan) into a two-line overview:
//   Level 1 (prChange): what this PR changes in THIS file AND where the file sits
//                       in the correlated flow — its architectural responsibility /
//                       high-level role, not just "+N/−N".
//   Level 2 (purpose):  what the file is responsible for, in the scope of the file
//                       and this PR.
//
// It owns three things, so handover.ts stays a thin orchestrator:
//   1. buildFileCorrelation — extract the per-file flow signals from the scan
//      (key-file `why`, the affected root it lives under, the call-graph nodes that
//      touch it, the data structures it defines). FILE-SCOPED on purpose: we never
//      inject the whole-PR call-graph theme, which made the small model invent
//      functions that aren't in the file (see handover.test.ts).
//   2. correlationContext — render those signals as a compact prompt block so the
//      model's Level 1 is flow-aware.
//   3. resolveOverview — parse the model's header (tolerantly) and, for any level it
//      omits, fall back to a correlation-GROUNDED line (never the bare "+N/−N" /
//      "Defines a, b, c" the old fallback produced).
//
// Pure + unit-tested; the only I/O (the generation) stays in handover.buildPresentation.

import type { ScanRecord } from '../state/scanHistory';
import type { HandoverStep } from '../state/handoverSession';
import { asScanOutput } from '../core/scanOutput';
import { parseFileOverview, type FileOverview, type FileSymbol } from './scrollPlan';
import { tightenDescription } from './descriptionQuality';

const basename = (p: string): string => p.split('/').pop() ?? p;

/** The scan's key-file `why` is sometimes a GRAPH METRIC ("744 root(s) reach this
 *  file") rather than a description — useless as a Level-1 line. This matches those
 *  so we drop them (the bug report's unhelpful Level 1). */
const GRAPH_METRIC = /root\(s\)|reach(?:es)? this file|^\d+\s+root|node\(s\)|edge\(s\)/i;

/** Is `why` a real description (worth showing) rather than a graph metric? */
export function isDescriptiveWhy(why: string | undefined): why is string {
  const w = (why ?? '').trim();
  return !!w && !GRAPH_METRIC.test(w);
}

/** The affected root `path` lives under (equals or dir-prefixes it), or null. */
function matchedRoot(path: string, roots: string[]): string | null {
  for (const r of roots) {
    if (!r) continue;
    if (path === r || path.startsWith(r.endsWith('/') ? r : `${r}/`)) return r;
  }
  return null;
}

/** The PER-FILE architecture-correlation signals — how this one file relates to the
 *  rest of the change. Everything here is scoped to the file (matched by path /
 *  basename / its own symbols), never the whole-PR theme. */
export interface FileCorrelation {
  /** A descriptive key-file `why` (graph metrics filtered out), or ''. */
  keyWhy: string;
  /** The affected root this file lives under, or '' (its place in the tree). */
  root: string;
  /** Call-graph node labels (added/changed/removed) that resolve to THIS file —
   *  the symbols of this file the structural delta touches. */
  touchedNodes: string[];
  /** Data structures this file defines/changes (new/modified), by name. */
  dataStructures: string[];
  /** The plan tier ('critical'…'minor') — how central the file is. */
  tier: string;
}

/** Extract the file-scoped correlation signals for `step` from the scan. Pure. */
export function buildFileCorrelation(rec: ScanRecord, step: HandoverStep, symbols: FileSymbol[]): FileCorrelation {
  const scan = asScanOutput(rec.scan);
  const review = scan?.pr_review;
  const base = basename(step.path).toLowerCase();
  const symNames = new Set(symbols.map((s) => s.name.toLowerCase()));

  // Key-file `why` for THIS path (only if descriptive).
  let keyWhy = '';
  for (const g of review?.visual_summary?.key_files?.groups ?? []) {
    for (const f of g.files ?? []) {
      if (f?.path === step.path && isDescriptiveWhy(f.why)) keyWhy = f.why.trim();
    }
  }

  const root = matchedRoot(step.path, (scan?.pr_scope?.affected_roots ?? []).filter(Boolean)) ?? '';

  // Call-graph delta nodes that resolve to THIS file: a node whose label matches the
  // file's basename, or one of the file's own tree-sitter symbol names. (We never list
  // unrelated nodes — that whole-PR theme is what made the model hallucinate.)
  const touchedNodes = [
    ...new Set(
      (review?.architecture_flow?.diff_merged_structured?.nodes ?? [])
        .filter((n) => n.class === 'added' || n.class === 'changed' || n.class === 'removed')
        .map((n) => (n.label ?? '').trim())
        .filter((label) => {
          const l = label.toLowerCase();
          return !!l && (symNames.has(l) || l === base || (l.length >= 4 && base.includes(l)));
        }),
    ),
  ].slice(0, 4);

  // Data structures whose name is one of this file's symbols (the types it defines/owns).
  const dataStructures = [
    ...new Set(
      (review?.architecture_flow?.data_structures ?? [])
        .filter((d) => d.kind === 'new' || d.kind === 'modified')
        .map((d) => d.name?.trim())
        .filter((name): name is string => !!name && symNames.has(name.toLowerCase())),
    ),
  ].slice(0, 4);

  return { keyWhy, root, touchedNodes, dataStructures, tier: step.tier };
}

/** Render the correlation as a compact prompt block, so the model's Level 1 names the
 *  file's place in the flow. Empty string when there's nothing file-specific to add
 *  (then the model leans on the diff alone). Pure. */
export function correlationContext(corr: FileCorrelation): string {
  const lines: string[] = [];
  if (corr.keyWhy) lines.push(`Why it matters: ${corr.keyWhy}`);
  if (corr.root) lines.push(`Lives under the affected area: ${corr.root}`);
  if (corr.touchedNodes.length) lines.push(`Part of the changed call-graph: ${corr.touchedNodes.join(', ')}`);
  if (corr.dataStructures.length) lines.push(`Defines/changes data structures: ${corr.dataStructures.join(', ')}`);
  return lines.length ? `How this file fits the change:\n${lines.map((l) => `- ${l}`).join('\n')}` : '';
}

/** The verb for a change code, for the deterministic Level-1 clause. */
function changeVerb(code: string): string {
  return code === 'A' ? 'adds' : code === 'D' ? 'removes' : code === 'R' ? 'renames' : code === 'C' ? 'copies' : 'modifies';
}

/** A correlation-GROUNDED fallback overview — used for any level the model omitted.
 *  Level 1 always carries the file's role in the flow (key-`why` / root / call-graph),
 *  not just the +/− line; Level 2 names the file's real symbols + its place. Pure. */
export function fallbackOverview(step: HandoverStep, corr: FileCorrelation, symbols: FileSymbol[]): FileOverview {
  const name = basename(step.path);
  const change = `This PR ${changeVerb(step.code)} ${name} (+${step.additions}/−${step.deletions}).`;
  // The flow clause — the architectural correlation, in priority order.
  let flow = '';
  if (corr.keyWhy) flow = ` ${corr.keyWhy.replace(/\.?\s*$/, '')}.`;
  else if (corr.touchedNodes.length) flow = ` It's wired into ${corr.touchedNodes.join(', ')} in the changed call-graph.`;
  else if (corr.root) flow = ` Part of the ${corr.root} area touched by this PR.`;
  const prChange = `${change}${flow}`;

  // Level 2 — real, namable definitions + the file's place.
  const named = symbols.filter((s) => !s.name.startsWith('<')).slice(0, 3).map((s) => s.name);
  const defines = named.length ? `Defines ${named.join(', ')}.` : `${name} — see the changes below.`;
  const place = corr.root && !corr.keyWhy ? ` It sits in the ${corr.root} flow.` : '';
  return { prChange, purpose: `${defines}${place}` };
}

/** Combine the model's parsed header with the correlation fallback: keep the model's
 *  words for any level it produced — but only AFTER a quality gate (descriptionQuality)
 *  tightens a ramble to its informative head and rejects a content-free "implements the
 *  functionality" non-answer — and fill the rest from the grounded fallback. So neither
 *  level is ever blank, every level is short + concrete, and Level 1 is always flow-aware.
 *  Pure. */
export function resolveOverview(
  raw: string,
  step: HandoverStep,
  corr: FileCorrelation,
  symbols: FileSymbol[],
): FileOverview {
  const parsed = parseFileOverview(raw);
  const fb = fallbackOverview(step, corr, symbols);
  // Level 1 is one sentence; Level 2 is the high-level + lower-level pair, so up to two.
  return {
    prChange: tightenDescription(parsed?.prChange, { maxSentences: 1 }) || fb.prChange,
    purpose: tightenDescription(parsed?.purpose, { maxSentences: 2 }) || fb.purpose,
  };
}
