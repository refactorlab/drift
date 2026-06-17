// Architecture OVERVIEW builder — turns a persisted scan into a compact,
// token-bounded map of the PR's structure, reusing what the Rust profiler
// already computed (no tree-sitter/PageRank in the browser). It is the seed both
// for the `get_pr_architecture` tool (what the brain reads) AND for the iterative
// agent (the map that tells it WHICH files to open).
//
// Source: `record.scan` is the raw ScanPrOutput; `asScanOutput` narrows it. We
// surface the parts that answer "how is this PR shaped + what matters": affected
// roots, key files (with WHY), data structures, the call-graph delta, business
// logic, top tech-debt, and uncovered/risk roots — plus commit intent.

import type { ScanRecord } from '../state/scanHistory';
import { asScanOutput } from '../core/scanOutput';
import { truncateToTokens } from '../core/chatContext';

/** The whole overview is clamped to this many tokens so it always fits alongside
 *  a question + reply inside Qwen's ~4k window. */
export const ARCHITECTURE_TOKEN_CAP = 900;
/** Caps on each list so one huge section can't crowd out the rest. */
const MAX_ROOTS = 12;
const MAX_KEY_FILES = 14;
const MAX_DATA_STRUCTURES = 12;
const MAX_GRAPH_NODES = 16;
const MAX_DEBT = 8;
const MAX_COMMITS = 8;
const MAX_CHANGED = 40;

/** Build the compact architecture overview for a scan. Defensive: every section
 *  is optional, so a partial scan still yields a useful map (falling back to the
 *  changed-file list + commit intent when the profiler emitted no graph). */
export function buildArchitectureOverview(record: ScanRecord): string {
  const scan = asScanOutput(record.scan);
  const review = scan?.pr_review;
  const ext = scan?.pr_review_ext;
  const scope = scan?.pr_scope;

  const sections: string[] = [];
  sections.push(`Architecture overview for ${record.owner}/${record.repo}#${record.number}.`);
  if (record.title) sections.push(`Title: ${record.title}`);
  sections.push(`Changed files: ${record.changedFiles}. Verdict: ${record.verdictLabel || record.verdict}.`);

  const roots = scope?.affected_roots?.filter(Boolean) ?? [];
  if (roots.length) sections.push(`Affected roots:\n${bullets(roots.slice(0, MAX_ROOTS))}`);

  const keyFiles = (review?.visual_summary?.key_files?.groups ?? [])
    .flatMap((g) => (g.files ?? []).map((f) => (f.why ? `${f.path} — ${f.why}` : f.path)))
    .filter(Boolean);
  if (keyFiles.length) sections.push(`Key files:\n${bullets(keyFiles.slice(0, MAX_KEY_FILES))}`);

  const ds = (review?.architecture_flow?.data_structures ?? [])
    .map((d) => `${d.name}${d.kind ? ` (${d.kind}${d.scope ? `, ${d.scope}` : ''})` : ''}`)
    .filter(Boolean);
  if (ds.length) sections.push(`Data structures:\n${bullets(ds.slice(0, MAX_DATA_STRUCTURES))}`);

  // The call-graph delta — surface added/changed nodes (the structural change).
  const nodes = review?.architecture_flow?.diff_merged_structured?.nodes ?? [];
  const touched = nodes
    .filter((n) => n.class === 'added' || n.class === 'changed' || n.class === 'removed')
    .map((n) => `${n.label}${n.class ? ` [${n.class}]` : ''}`);
  if (touched.length) {
    const more = touched.length > MAX_GRAPH_NODES ? ` (+${touched.length - MAX_GRAPH_NODES} more)` : '';
    sections.push(`Call-graph delta${more}:\n${bullets(touched.slice(0, MAX_GRAPH_NODES))}`);
  }

  const biz = review?.business_logic?.summary?.trim();
  if (biz) sections.push(`Business logic:\n${biz}`);

  const debt = [
    ...(ext?.tech_debt?.summary_findings_top ?? []),
    ...(ext?.tech_debt?.high_complexity ?? []),
  ]
    .map((d) => d.symbol || d.node_id || d.file)
    .filter((x): x is string => !!x);
  if (debt.length) sections.push(`Top tech-debt symbols:\n${bullets(dedupe(debt).slice(0, MAX_DEBT))}`);

  const uncovered = ext?.tests_in_graph?.uncovered_roots?.filter(Boolean) ?? [];
  if (uncovered.length) sections.push(`Uncovered roots:\n${bullets(uncovered.slice(0, MAX_ROOTS))}`);

  const gaps = ext?.nfr_edge_cases?.reliability_gaps?.filter(Boolean) ?? [];
  if (gaps.length) sections.push(`Reliability gaps:\n${bullets(gaps.slice(0, MAX_ROOTS))}`);

  const commits = (record.commits ?? []).map((c) => c.split('\n', 1)[0].trim()).filter(Boolean);
  if (commits.length) sections.push(`Commit intent:\n${bullets(commits.slice(-MAX_COMMITS))}`);

  // Always include the changed-file list — it's the agent's read_file menu.
  const changed = (record.changedStatus ?? []).map((f) => `${f.code} ${f.path}`);
  if (changed.length) {
    const more = changed.length > MAX_CHANGED ? `\n… and ${changed.length - MAX_CHANGED} more` : '';
    sections.push(`Changed files (readable):\n${changed.slice(0, MAX_CHANGED).join('\n')}${more}`);
  }

  return truncateToTokens(sections.join('\n\n'), ARCHITECTURE_TOKEN_CAP);
}

const bullets = (items: string[]): string => items.map((s) => `- ${s}`).join('\n');
const dedupe = (items: string[]): string[] => [...new Set(items)];
