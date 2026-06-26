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
/** One call edge of the structured call graph (`from`/`to` are node ids). */
export interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  /** 'solid' (a call) | 'dashed'. */
  style?: string;
}
/** A node-class style (the legend) — `name` is referenced by a node's `class`. */
export interface MermaidClassDef {
  name: string;
  fill: string;
  stroke: string;
  color: string;
  stroke_width?: string;
  stroke_dasharray?: string;
}
/** The scanner's typed call graph (the sibling of every mermaid STRING). Per the
 *  scan-pr OpenAPI schema (`MermaidFlowchart`) the payload ALWAYS carries `edges`
 *  and `class_defs` too — they were just never declared here, so the extension only
 *  read `nodes`. Surfacing them lets us draw the graph (not just re-parse mermaid). */
export interface MermaidStructured {
  direction?: string;
  nodes?: MermaidNode[];
  edges?: MermaidEdge[];
  class_defs?: MermaidClassDef[];
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
  /** Enclosing function/symbol name (the PR-scoped findings carry this). */
  function?: string;
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
  /** Human-readable explanation of the finding. The PR-scoped `pr_findings_top`
   *  set carries this (and category/severity/tier) — it is the highest-signal
   *  text the chat can narrate verbatim instead of re-deriving it. */
  message?: string;
  category?: string;
  tier?: string;
  confidence?: number; // 0..1
  impact_score?: number;
  remediation?: string;
  rule_id?: string;
}
export interface TechDebt {
  high_complexity?: TechDebtFinding[];
  long_functions?: TechDebtFinding[];
  summary_findings_top?: TechDebtFinding[];
  /** PR-scoped, impact-ranked findings over the CHANGED code only — the set the
   *  risk verdict is built from (see drift-static-profiler/pr_signals.rs). Each
   *  carries a human `message`, `file`/`line`, `category`/`severity`/`tier`. */
  pr_findings_top?: TechDebtFinding[];
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

/** One tree-sitter symbol of a changed file (from the profiler's `pr_symbols`).
 *  Lines are 1-based, on the HEAD file — same numbering as the diff's new side. */
export interface PrSymbol {
  name: string;
  kind: 'function' | 'method' | 'class' | string;
  line: number;
  end_line: number;
  /** Enclosing class/type when this is a method. */
  parent?: string;
}
export interface PrFileSymbols {
  path: string;
  symbols: PrSymbol[];
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
  /** Per-changed-file tree-sitter symbols — anchors the live presentation on real
   *  classes/methods/functions (exact spans), not LLM-guessed lines. */
  pr_symbols?: PrFileSymbols[];
  pr_diff?: PrDiff;
  /** The PR's opening-comment body (the author's description), fetched
   *  client-side and injected so it travels with the report + export. */
  pr_description?: string;
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

/** The risk-quadrant items from a scan — the SSOT both the dashboard verdict and
 *  the chat's risk explanation read. The payload nests them under
 *  `visual_summary.risks.items` (a `RisksBlock`); reading `risks` as a bare array
 *  silently yields zero (the verdict then never reaches "address"), so EVERY reader
 *  must go through this one accessor to stay aligned with the real artifact. */
export function riskItems(scan: ScanOutput | null | undefined): RiskItem[] {
  const items = scan?.pr_review?.visual_summary?.risks?.items;
  return Array.isArray(items) ? items : [];
}

/** Risks the scanner flagged to ACT ON before merge — the set that drives the
 *  "Address before merge" verdict. */
export function actBeforeMergeRisks(scan: ScanOutput | null | undefined): RiskItem[] {
  return riskItems(scan).filter((r) => r.quadrant === 'act_before_merge');
}
