// Normalised "PR facts" — the single place we derive the cross-cutting numbers
// the template needs that the JSON doesn't hand us directly (net LOC from the
// money axis, the test gap, regressed axes, dead-code findings, …). The header
// KPIs, the merge checklist, the advisory narrative, and the value-card
// highlights all read from THIS, so they can never disagree with each other.

import type { ScanPrOutput, ValueAxis, CodeSuggestion } from '../../report.ts';
import { passesQualityBar } from '../../report.ts';

export type PrFacts = {
  changedFiles: number;
  affectedRoots: number;
  unreachable: number;

  /** overall_drift.percent, or null when there's no value model. */
  overallPercent: number | null;
  overallDirection: 'up' | 'down' | 'neutral' | null;

  axes: ValueAxis[];
  regressedAxes: ValueAxis[];
  improvedAxes: ValueAxis[];
  /** Axis with the largest positive Δ% (what "carries" a mixed result). */
  topImprovement: ValueAxis | null;

  /** From the money axis inputs; null when that axis / input is absent. */
  locAdded: number | null;
  locDeleted: number | null;
  netLoc: number | null;

  /** counts.new_test_files.value (default 0 when counts present, null when absent). */
  newTestFiles: number | null;
  features: number;
  bugFixes: number;
  issuesResolved: number;

  /** Suggestions that clear the quality bar (confidence ≥ .75, ref, A/B/C). */
  passing: CodeSuggestion[];
  correctness: CodeSuggestion[]; // category B
  deadCode: CodeSuggestion[]; // category A, dead-code kind

  risksToAddress: number; // quadrant === act_before_merge
  totalRisks: number;

  uncoveredRoots: string[];
  reliabilityGaps: string[];
  highComplexity: number;
  longFunctions: number;
  duplicationClusters: number;

  /** Per reached entry point: is it test-covered, and which NFR families are missing.
   *  Powers the blast-radius / coverage panel. Empty when there's no call-graph data. */
  perRootCoverage: RootCoverage[];
};

export type RootCoverage = {
  root: string;
  /** A test reaches this root in the call graph. */
  tested: boolean;
  /** Missing reliability families (retry / timeout / fallback / …). */
  missing: string[];
};

export function extractFacts(report: ScanPrOutput): PrFacts {
  const ps = report.pr_scope;
  const review = report.pr_review;
  const ext = report.pr_review_ext;

  const axes = review?.value_card?.axes ?? [];
  const regressedAxes = axes.filter((a) => a.direction === 'down');
  const improvedAxes = axes.filter((a) => a.direction === 'up');
  const topImprovement =
    improvedAxes.length > 0
      ? improvedAxes.reduce((best, a) => (a.delta_percent > best.delta_percent ? a : best))
      : null;

  const moneyInputs = axes.find((a) => a.name === 'money')?.inputs;
  const locAdded = numInput(moneyInputs, 'loc_added');
  const locDeleted = numInput(moneyInputs, 'loc_deleted');
  const netLoc = locAdded === null && locDeleted === null ? null : (locAdded ?? 0) - (locDeleted ?? 0);

  const counts = review?.counts;
  const passing = (review?.code_suggestions ?? []).filter(passesQualityBar);

  const risks = review?.visual_summary?.risks?.items ?? [];

  // Per reached entry point: cross-reference test coverage (tests_in_graph) with
  // missing reliability families (nfr_edge_cases.per_root), keyed by root name.
  const uncoveredSet = new Set(ext?.tests_in_graph?.uncovered_roots ?? []);
  const missingByRoot = new Map((ext?.nfr_edge_cases?.per_root ?? []).map((p) => [p.root, p.missing ?? []]));
  const perRootCoverage = ps.affected_roots.map((root) => ({
    root,
    tested: !uncoveredSet.has(root),
    missing: missingByRoot.get(root) ?? [],
  }));

  return {
    changedFiles: ps.changed_files.length,
    affectedRoots: ps.affected_roots.length,
    unreachable: ps.unreachable_changes.length,

    overallPercent: review?.overall_drift?.percent ?? null,
    overallDirection: review?.overall_drift?.direction ?? null,

    axes,
    regressedAxes,
    improvedAxes,
    topImprovement,

    locAdded,
    locDeleted,
    netLoc,

    newTestFiles: counts?.new_test_files ? counts.new_test_files.value : counts ? 0 : null,
    features: counts?.features?.value ?? 0,
    bugFixes: counts?.bug_fixes?.value ?? 0,
    issuesResolved: counts?.issues_resolved?.value ?? 0,

    passing,
    correctness: passing.filter((s) => s.category === 'B'),
    deadCode: passing.filter((s) => s.category === 'A' && isDeadCode(s)),

    risksToAddress: risks.filter((r) => r.quadrant === 'act_before_merge').length,
    totalRisks: risks.length,

    uncoveredRoots: ext?.tests_in_graph?.uncovered_roots ?? [],
    reliabilityGaps: ext?.nfr_edge_cases?.reliability_gaps ?? [],
    highComplexity: ext?.tech_debt?.high_complexity?.length ?? 0,
    longFunctions: ext?.tech_debt?.long_functions?.length ?? 0,
    duplicationClusters: ext?.duplication?.clusters?.length ?? 0,

    perRootCoverage,
  };
}

/** Dead-code findings are recognised by kind or category label (best-effort). */
function isDeadCode(s: CodeSuggestion): boolean {
  const hay = `${s.kind ?? ''} ${s.category_label ?? ''}`.toLowerCase();
  return hay.includes('dead');
}

function numInput(
  inputs: Record<string, number | string | boolean> | undefined,
  key: string,
): number | null {
  if (!inputs || !(key in inputs)) return null;
  const v = inputs[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
