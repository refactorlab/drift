// Build the compact {@link ReviewBrief} from a raw scan-pr.json (ScanOutput).
//
// This is where the scan's reviewer-facing signal — the stuff a human reviewer
// actually asks about (risk, suggestions, tests, scope, value) — is lifted out of
// the deep `pr_review` / `pr_review_ext` / `pr_scope` tree into a flat, bounded
// shape the voice agent can ground on. Pure + React-free → unit-testable.

import {
  asScanOutput,
  type ReviewBrief,
  type BriefRisk,
  type BriefSuggestion,
  type RiskItem,
  type CodeSuggestion,
  type CountChip,
  type PrCounts,
  type TechDebtFinding,
} from './scanOutput';

function trimTo(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function dropEmpty<T>(arr: T[] | undefined): T[] | undefined {
  return arr && arr.length ? arr : undefined;
}

// act_before_merge is the scanner's "do something now" quadrant — surface it first.
const QUADRANT_WEIGHT: Record<NonNullable<RiskItem['quadrant']>, number> = {
  act_before_merge: 3,
  monitor_closely: 2,
  document_and_ship: 1,
  acceptable: 0,
};
const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);

function topRisks(items: RiskItem[]): BriefRisk[] {
  return items
    .filter((r) => r.label?.trim())
    .map((r) => ({ r, score: (QUADRANT_WEIGHT[r.quadrant ?? 'acceptable'] ?? 0) * 10 + num(r.likelihood) * num(r.severity) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ r }) => ({ label: trimTo(r.label, 120) ?? r.label, quadrant: r.quadrant }));
}

const SEV_RANK: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
function topSuggestions(suggestions: CodeSuggestion[]): BriefSuggestion[] {
  return [...suggestions]
    .sort((a, b) => (SEV_RANK[b.severity ?? ''] ?? 0) - (SEV_RANK[a.severity ?? ''] ?? 0) || num(b.confidence) - num(a.confidence))
    .slice(0, 6)
    .map((s) => ({
      file: s.file,
      line: s.line,
      severity: s.severity,
      why: trimTo(s.summary || s.why_it_matters || s.rule_id || 'Flagged change', 180) ?? 'Flagged change',
    }));
}

function countLabels(counts: PrCounts | undefined): string[] | undefined {
  if (!counts) return undefined;
  const out: string[] = [];
  const add = (chip: CountChip | undefined, one: string, many = `${one}s`) => {
    const n = num(chip?.value);
    if (n > 0) out.push(`${n} ${n === 1 ? one : many}`);
  };
  add(counts.features, 'feature');
  add(counts.bug_fixes, 'bug fix', 'bug fixes');
  add(counts.issues_resolved, 'issue resolved', 'issues resolved');
  add(counts.new_test_files, 'new test file');
  return dropEmpty(out);
}

// A reviewer-readable label for a tech-debt finding: prefer the symbol, else the
// last segment of the graph node id, else the file. Tag with the kind of debt.
function debtLabel(f: TechDebtFinding): string {
  const fromNode = f.node_id ? f.node_id.split('::').pop() : undefined;
  const name = f.symbol || fromNode || f.file || 'symbol';
  const where = f.file && !name.includes('/') ? ` in ${f.file}` : '';
  return f.kind ? `${name} (${f.kind})${where}` : `${name}${where}`;
}

/**
 * Distill a raw scan-pr.json into the compact ReviewBrief. `commits` is passed
 * separately because the scan JSON doesn't carry commit messages (they ride on the
 * scan record / display). Returns `{}` when the payload isn't a scan — every field
 * is optional, so a partial scan yields a partial brief.
 */
export function buildReviewBrief(scan: unknown, commits?: string[], authors?: string[]): ReviewBrief {
  const out = asScanOutput(scan);
  if (!out) return authors?.length ? { authors: authors.slice(0, 5) } : {};
  const review = out.pr_review;
  const ext = out.pr_review_ext;
  const scope = out.pr_scope;

  const composite = ext?.pr_quality?.composite;
  const qualityBand = composite?.band
    ? `${composite.band}${composite.label ? ` — ${composite.label}` : ''}`
    : undefined;

  const debt = ext?.tech_debt;
  const debtFindings = [
    ...(debt?.summary_findings_top ?? []),
    ...(debt?.high_complexity ?? []),
    ...(debt?.long_functions ?? []),
  ]
    .slice(0, 6)
    .map(debtLabel);

  const keyFiles = review?.visual_summary?.key_files?.groups
    ?.flatMap((g) => g.files.map((f) => (f.why ? `${f.path} — ${trimTo(f.why, 90)}` : f.path)))
    .slice(0, 6);

  const brief: ReviewBrief = {
    authors: dropEmpty(authors?.slice(0, 5)),
    description: trimTo((scan as { pr_description?: string }).pr_description, 600),
    commits: dropEmpty(commits?.map((c) => trimTo(c.split('\n')[0], 100)!).filter(Boolean).slice(0, 8)),
    businessSummary: trimTo(review?.business_logic?.summary, 300),
    qualityBand,
    counts: countLabels(review?.counts),
    risks: dropEmpty(review?.visual_summary?.risks?.items ? topRisks(review.visual_summary.risks.items) : undefined),
    suggestions: dropEmpty(review?.code_suggestions ? topSuggestions(review.code_suggestions) : undefined),
    keyFiles: dropEmpty(keyFiles),
    affectedRoots: dropEmpty(scope?.affected_roots?.slice(0, 8)),
    unreachableChanges: dropEmpty(scope?.unreachable_changes?.slice(0, 6)),
    uncoveredRoots: dropEmpty(ext?.tests_in_graph?.uncovered_roots?.slice(0, 8)),
    reliabilityGaps: dropEmpty(ext?.nfr_edge_cases?.reliability_gaps?.slice(0, 6)),
    techDebt: dropEmpty(debtFindings),
    duplication: ext?.duplication?.count ?? (ext?.duplication?.clusters?.length || undefined),
    valueBottomLine: trimTo(review?.value_card?.bottom_line, 200),
  };

  // Strip keys that came out empty so callers can truthiness-check each section.
  (Object.keys(brief) as (keyof ReviewBrief)[]).forEach((k) => {
    if (brief[k] === undefined) delete brief[k];
  });
  return brief;
}
