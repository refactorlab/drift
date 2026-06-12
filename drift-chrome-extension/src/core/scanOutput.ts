// Typed view of the raw `scan-pr.json` (the Rust scanner's `ScanPrOutput`) — the
// subset the native React report renders. Mirrors action/src/report.ts field
// names exactly so the extension reads the SAME payload the GitHub Action does.
// Everything is optional/defensive: a partial scan renders only what it has.

import type { FileDiff } from './prDiff';
export type { FileDiff } from './prDiff';

export type GaugeLevel = 'low' | 'moderate' | 'high' | 'critical';
export type DriftDirection = 'up' | 'down' | 'neutral';

export interface QualityGauge {
  id: string;
  group: string;
  label: string;
  score: number; // 0..100
  higher_is_better: boolean;
  level: GaugeLevel;
  arrow: string; // "↑" risk · "↓" quality
  description: string;
}

export interface GaugeRef {
  label: string;
  score: number;
}

export interface GaugeSummary {
  context_fits?: boolean;
  token_estimate?: number;
  token_limit?: number;
  highest?: GaugeRef[];
  lowest?: GaugeRef[];
}

export interface QualityComposite {
  score?: number; // 0..1
  band?: string; // A..E
  label?: string; // "do not merge as-is"
  confidence?: string;
  notes?: string[];
}

export interface PrQuality {
  composite?: QualityComposite;
  gauges?: QualityGauge[];
  gauge_summary?: GaugeSummary;
}

export interface OverallDrift {
  percent: number;
  direction: DriftDirection;
  confidence?: 'low' | 'medium' | 'high';
  interpretation?: string;
}

export interface CountChip {
  value: number;
  label: string;
  detail?: string;
  source?: string;
}
export interface PrCounts {
  features?: CountChip;
  bug_fixes?: CountChip;
  issues_resolved?: CountChip;
  new_test_files?: CountChip;
}

export interface DataStructureEntry {
  name: string;
  version?: string;
  kind: 'new' | 'modified' | 'removed' | 'unchanged';
  scope?: string;
  description?: string;
  direction?: 'in' | 'out' | 'internal';
}

/** One node of the scanner's structured call graph — the data the mermaid is
 *  built from. `label` is the humanized symbol (`anon <file:line>`, a function
 *  or class name, or a file basename); `class` is its diff status. */
export interface MermaidNode {
  id: string;
  label: string;
  shape?: string;
  /** Diff status: 'added' | 'changed' | 'removed' | 'muted' | … */
  class?: string;
}
export interface MermaidStructured {
  direction?: string;
  nodes?: MermaidNode[];
}

export interface ArchitectureFlow {
  diff_merged_mermaid?: string;
  before_mermaid?: string;
  after_mermaid?: string;
  combined_mermaid?: string;
  diff_merged_structured?: MermaidStructured;
  before_structured?: MermaidStructured;
  after_structured?: MermaidStructured;
  combined_structured?: MermaidStructured;
  data_structures?: DataStructureEntry[];
}

export interface BusinessLogic {
  mermaid?: string;
  summary?: string;
}

export interface ValueKv {
  label: string;
  value: string;
  kind?: 'cost' | 'profit' | 'muted' | 'neutral';
}
export interface ValueAxis {
  name: string;
  label: string;
  subtitle?: string;
  delta_percent: number;
  direction: DriftDirection;
  confidence?: 'low' | 'medium' | 'high';
  formula?: string;
  kv?: ValueKv[];
}
export interface ValueCard {
  axes?: ValueAxis[];
  bottom_line?: string;
}

export interface DiffLine {
  line_number?: number;
  code: string;
  kind?: 'del' | 'add' | 'ctx';
}
export interface CodeDiff {
  before_lines?: DiffLine[];
  after_lines?: DiffLine[];
  unified?: string;
}
export interface CodeSuggestion {
  category: 'A' | 'B' | 'C' | string;
  category_label?: string;
  kind?: string;
  rule_id?: string;
  file: string;
  function?: string;
  line?: number;
  confidence: number; // 0..1
  severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  why_it_matters: string;
  remediation_hint?: string;
  diff?: CodeDiff;
  language?: string;
  source?: 'scanner' | 'ai';
  summary?: string;
}

export interface RiskItem {
  label: string;
  likelihood: number; // 0..1
  severity: number; // 0..1
  quadrant?: 'act_before_merge' | 'monitor_closely' | 'acceptable' | 'document_and_ship';
}
export interface RisksBlock {
  mermaid?: string;
  items?: RiskItem[];
}
export interface KeyFile {
  path: string;
  why?: string;
}
export interface KeyFileGroup {
  name: string;
  files: KeyFile[];
}
export interface KeyFilesBlock {
  mermaid?: string;
  groups?: KeyFileGroup[];
}
export interface VisualSummary {
  risks?: RisksBlock;
  key_files?: KeyFilesBlock;
}

export interface DuplicationCluster {
  members: Array<{ name: string; file: string }>;
}
export interface Duplication {
  threshold?: number;
  clusters?: DuplicationCluster[];
  count?: number;
}
export interface TestsInGraph {
  test_files?: number;
  test_functions?: number;
  uncovered_roots?: string[];
}
export interface NfrEdgeCases {
  reliability_gaps?: string[];
}
export interface TechDebtFinding {
  symbol?: string;
  file?: string;
  line?: number;
  value?: number;
  severity?: string;
  /** Fully-qualified graph node id ("/repo/<file>::<Class>::<method>"). The
   *  `summary_findings_top` findings carry only this + `kind`/`line` — no
   *  `symbol`/`file` — so the UI derives the display label from it. */
  node_id?: string;
  /** What kind of debt this is (e.g. "recursive", "long", "complex"). */
  kind?: string;
}
export interface TechDebt {
  high_complexity?: TechDebtFinding[];
  long_functions?: TechDebtFinding[];
  summary_findings_top?: TechDebtFinding[];
  thresholds?: { complexity?: number; loc?: number };
}

export interface PrReview {
  generated_at?: string;
  overall_drift?: OverallDrift;
  counts?: PrCounts;
  architecture_flow?: ArchitectureFlow;
  business_logic?: BusinessLogic;
  value_card?: ValueCard;
  code_suggestions?: CodeSuggestion[];
  visual_summary?: VisualSummary;
}

export interface PrReviewExt {
  tech_debt?: TechDebt;
  duplication?: Duplication;
  tests_in_graph?: TestsInGraph;
  nfr_edge_cases?: NfrEdgeCases;
  pr_quality?: PrQuality;
}

export interface PrScope {
  changed_files?: string[];
  affected_roots?: string[];
  unreachable_changes?: string[];
}

/** The literal +/- code change, collected client-side from GitHub's `.diff`
 *  (the scanner has no base tree to diff against) and injected into the scan-pr
 *  JSON so the actual added/removed lines travel with the report + export. */
export interface PrDiff {
  files: FileDiff[];
  /** Hunks were capped by the size budget on at least one file. */
  truncated?: boolean;
}

export interface ScanOutput {
  schema_version?: string;
  mode?: string;
  pr_scope?: PrScope;
  pr_review?: PrReview;
  pr_review_ext?: PrReviewExt;
  pr_diff?: PrDiff;
  /** The PR's opening-comment body (the author's description), fetched
   *  client-side and injected so it travels with the report + export. */
  pr_description?: string;
}

// ─── Review brief ────────────────────────────────────────────────────────────
// A compact, reviewer-facing distillation of the scan JSON — the signal a code
// reviewer actually asks about (risk, tests, suggestions, value, scope) that the
// raw `report`/`pr_diff` don't carry. Built once per scan and threaded into the
// PrContext so the Dial phone agent can ground on it, not just the literal diff.
// Bounded by construction (every list is capped) so it stays small enough to pin.

export interface BriefRisk {
  label: string;
  /** The scanner's action quadrant — act_before_merge is the "do something now" set. */
  quadrant?: RiskItem['quadrant'];
}
export interface BriefSuggestion {
  file: string;
  line?: number;
  severity?: string;
  /** Why the change matters — the reviewer-facing explanation. */
  why: string;
}

export interface ReviewBrief {
  /** Who wrote the PR — distinct commit-author display names (from the patch). */
  authors?: string[];
  /** The author's own description of the PR (the opening comment body). */
  description?: string;
  /** Commit subject lines (first line of each message). */
  commits?: string[];
  /** Business-logic summary the scanner inferred from the change. */
  businessSummary?: string;
  /** Overall quality band + label, e.g. "C — do not merge as-is". */
  qualityBand?: string;
  /** Human-readable change counts, e.g. ["2 features", "1 bug fix", "3 new test files"]. */
  counts?: string[];
  /** Flagged risks, most-actionable first. */
  risks?: BriefRisk[];
  /** Concrete code-review suggestions, highest-severity first. */
  suggestions?: BriefSuggestion[];
  /** Files the reviewer should look at first ("path — why"). */
  keyFiles?: string[];
  /** Code areas (graph roots) the change reaches into. */
  affectedRoots?: string[];
  /** Changes the scanner could not reach from any root — possible dead code. */
  unreachableChanges?: string[];
  /** Entry points with no test coverage in the graph. */
  uncoveredRoots?: string[];
  /** Reliability / edge-case gaps (error handling, missing guards, …). */
  reliabilityGaps?: string[];
  /** Maintainability hotspots (high complexity / long functions). */
  techDebt?: string[];
  /** Count of duplicate-code clusters the scanner found. */
  duplication?: number;
  /** The value-card bottom line (is the change worth its cost?). */
  valueBottomLine?: string;
}

/** Narrow an unknown payload to a ScanOutput if it carries the PR markers. */
export function asScanOutput(o: unknown): ScanOutput | null {
  if (!o || typeof o !== 'object') return null;
  const s = o as Record<string, unknown>;
  if ('pr_review' in s || 'pr_review_ext' in s || 'pr_scope' in s) return s as ScanOutput;
  return null;
}

/** The 6 metric groups in canonical display order. */
export const GROUP_ORDER = [
  'LLM Complexity',
  'Comprehensibility',
  'Longevity',
  'Correctness Confidence',
  'Operational',
  'Team & Process',
] as const;

/** Group the flat 18-gauge array into its display sections, ordered. */
export function groupGauges(gauges: QualityGauge[]): { group: string; gauges: QualityGauge[] }[] {
  const by = new Map<string, QualityGauge[]>();
  for (const g of gauges) {
    const k = g.group || 'Metrics';
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(g);
  }
  const order = (k: string) => {
    const i = (GROUP_ORDER as readonly string[]).indexOf(k);
    return i < 0 ? 99 : i;
  };
  return [...by.keys()]
    .sort((a, b) => order(a) - order(b))
    .map((group) => ({ group, gauges: by.get(group)! }));
}
