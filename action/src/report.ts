// TypeScript view of the scanner's `ScanPrOutput` contract.
// Canonical schema: drift-static-profiler/schema/scan_pr_output.openapi.yaml
//
// The scanner ALWAYS emits the factual `pr_scope` block; the rich
// `pr_review` block is optional and produced by downstream algorithms
// (LLM, value model, code-suggestion engine). Today the Rust binary
// emits only `pr_scope` — our types reflect that by making `pr_review?`.

import { readFileSync } from 'node:fs';

// ─── factual (always present) ───────────────────────────────────────────

export type PrScope = {
  changed_files: string[];
  affected_roots: string[];      // humanized entry-point labels (e.g. `OrderService.createOrder`, `anon <routes.js:8>`); join key for per-root coverage vs `uncovered_roots` / `nfr.per_root`
  unreachable_changes: string[];
};

// ─── statistical (optional, downstream-produced) ────────────────────────

export type CountChip = {
  value: number;
  label: string;
  detail?: string;
  source?: string;
};

export type PrCounts = {
  features?: CountChip;
  bug_fixes?: CountChip;
  issues_resolved?: CountChip;
  new_test_files?: CountChip;
};

export type OverallDrift = {
  percent: number;
  direction: 'up' | 'down' | 'neutral';
  confidence: 'low' | 'medium' | 'high';
  interpretation?: string;
};

export type ReferenceLink = {
  url: string;
  title?: string;
  tag?: 'official' | 'wiki' | 'stackoverflow' | 'rfc' | 'cncf' | 'blog' | 'other';
};

export type DataStructureEntry = {
  name: string;
  version?: string;
  kind: 'new' | 'modified' | 'removed' | 'unchanged';
  scope?: string;
  description?: string;
  direction?: 'in' | 'out' | 'internal';
};

// Typed mermaid flowchart — the `*_structured` companion to each
// `*_mermaid` string. The scanner emits both so a future SVG/PNG or
// re-themed renderer doesn't have to re-parse mermaid syntax. The action's
// markdown renderer reads ONLY the `*_mermaid` strings today; this type
// exists so the structured fields are documented and don't silently drift
// from the Rust schema (drift-static-profiler::pr_algorithms::mermaid).
export type MermaidFlowchart = {
  direction: 'LR' | 'RL' | 'TB' | 'BT';
  title?: string;
  subgraphs?: unknown[];
  nodes: { id: string; label: string; shape?: string; class?: string }[];
  edges: { from: string; to: string; label?: string; style?: 'solid' | 'dashed' }[];
  class_defs: { name: string; fill: string; stroke: string; color: string }[];
};

export type ArchitectureFlow = {
  // PRIMARY: a single color-coded diff diagram merging BEFORE and AFTER — the
  // call graph at HEAD with every node tinted by its file's diff status (green
  // added, amber modified/renamed, no class unchanged) plus a red `🗑 removed`
  // card per deletion. The renderer prefers this single chart.
  diff_merged_mermaid?: string;
  // Two separate charts — 🔴 BEFORE (the call graph pre-PR) and 🟢 AFTER
  // (at HEAD). FALLBACK for older-scanner reports that predate the merged
  // diagram; the renderer uses these only when `diff_merged_mermaid` is absent.
  before_mermaid?: string;
  after_mermaid?: string;
  // Legacy single combined chart (BEFORE+AFTER+DS in one graph). Retained
  // for back-compat with older scanner builds; superseded by the
  // merged diagram above.
  combined_mermaid?: string;
  // Structured companions (see MermaidFlowchart). Populated alongside the
  // matching `*_mermaid` string; not consumed by the markdown renderer.
  before_structured?: MermaidFlowchart;
  after_structured?: MermaidFlowchart;
  combined_structured?: MermaidFlowchart;
  data_structures?: DataStructureEntry[];
  reference_link?: ReferenceLink;
};

export type BusinessLogic = {
  mermaid?: string;
  summary?: string;
};

export type ValueKv = {
  label: string;
  value: string;
  kind?: 'cost' | 'profit' | 'muted' | 'neutral';
};

export type ValueAxis = {
  name: 'money' | 'customer' | 'runtime' | 'runtime_ux';
  label: string;
  subtitle?: string;
  delta_percent: number;
  direction: 'up' | 'down' | 'neutral';
  confidence: 'low' | 'medium' | 'high';
  formula?: string;
  inputs?: Record<string, number | string | boolean>;
  kv?: ValueKv[];
  source?: string;
  source_link?: string;
  additional_sources?: ReferenceLink[];
};

export type ValueAxisBar = {
  axis: 'money' | 'customer' | 'runtime' | 'runtime_ux';
  delta_percent: number;
  direction: 'up' | 'down' | 'neutral';
};

export type ValueCard = {
  axes: ValueAxis[];
  bars?: ValueAxisBar[];
  bars_mermaid?: string;
  bottom_line?: string;
};

export type DiffLine = {
  line_number?: number;
  code: string;
  kind?: 'del' | 'add' | 'ctx';
};

export type CodeDiff = {
  before_lines?: DiffLine[];
  after_lines?: DiffLine[];
  unified?: string;
};

export type CodeSuggestion = {
  category: 'A' | 'B' | 'C';
  category_label?: string;
  /** Stable finding kind, e.g. `dead_code_in_changed_file`, `raw_sql_concat`. */
  kind?: string;
  /** Rule identifier, e.g. `S2:dead-code`. */
  rule_id?: string;
  file: string;
  function?: string;
  line?: number;
  confidence: number;
  /** Finding severity tier — drives the suggestion's display priority. */
  severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  why_it_matters: string;
  /** One-line remediation hint shown when there's no machine-applicable diff. */
  remediation_hint?: string;
  references?: ReferenceLink[];
  diff?: CodeDiff;
  /** Source language of the focal file, e.g. `python`, `kotlin`. */
  language?: string;
  /** Prompt hint handed to the AI pass; unused by the renderer. */
  llm_prompt_hint?: string;
  notes?: string;
  /**
   * Origin of this finding. `'scanner'` (default/absent) is a deterministic
   * static-analysis finding; `'ai'` is one refined by the per-suggestion
   * inference pass. The renderer keys off this to give AI suggestions the
   * expanded "code suggestion" disclosure (narrative + red/green diff) while
   * leaving deterministic findings in the priority table — see
   * render/sections/suggestions.ts.
   */
  source?: 'scanner' | 'ai';
  /**
   * One plain-language sentence describing WHAT the change does (e.g. "Wrap the
   * login call in a retry loop with backoff"). Distinct from `why_it_matters`
   * (the WHY). Populated for `source: 'ai'` suggestions; rendered as the lead
   * line of the AI code-suggestion block.
   */
  summary?: string;
  /** Model id that produced an `source: 'ai'` suggestion, e.g. `openai/gpt-4.1`. */
  model?: string;
};

export type RiskItem = {
  label: string;
  likelihood: number;
  severity: number;
  quadrant?: 'act_before_merge' | 'monitor_closely' | 'acceptable' | 'document_and_ship';
};

export type RisksBlock = {
  mermaid?: string;
  items?: RiskItem[];
};

export type KeyFile = {
  path: string;
  why?: string;
};

export type KeyFileGroup = {
  name: string;
  files: KeyFile[];
};

export type KeyFilesBlock = {
  mermaid?: string;
  groups?: KeyFileGroup[];
};

export type VisualSummary = {
  risks?: RisksBlock;
  key_files?: KeyFilesBlock;
};

export type PrReview = {
  generated_at?: string;
  overall_drift?: OverallDrift;
  counts?: PrCounts;
  architecture_flow?: ArchitectureFlow;
  business_logic?: BusinessLogic;
  value_card?: ValueCard;
  code_suggestions?: CodeSuggestion[];
  visual_summary?: VisualSummary;
};

// ─── envelope ───────────────────────────────────────────────────────────

export type Generator = {
  tool: string;
  version: string;
  source_root?: string;
  captured_at?: string;
};

export type DuplicationCluster = {
  members: Array<{ name: string; file: string }>;
};

export type Duplication = {
  threshold: number;
  clusters: DuplicationCluster[];
  count: number;
};

export type TestsInGraph = {
  test_files: number;
  test_functions: number;
  by_language: Record<string, unknown>;
  uncovered_roots: string[];
  patterns?: {
    filename?: string[];
    function?: string[];
  };
};

export type NfrPerRoot = {
  root: string;
  covered: string[];
  missing: string[];
};

export type NfrEdgeCases = {
  families: Record<string, number>;
  per_root: NfrPerRoot[];
  reliability_gaps: string[];
  markers?: Record<string, string[]>;
  source?: string;
  source_link?: string;
};

export type SchemaValidationLib = { name: string; docs: string };
export type SchemaValidation = {
  libraries: SchemaValidationLib[];
  found: boolean;
  files_inspected: number;
  supported_languages: string[];
  per_language_known_libraries: Record<string, SchemaValidationLib[]>;
};

export type TechDebtFinding = {
  symbol?: string;
  file?: string;
  line?: number;
  value?: number;
  severity?: string;
  source?: string;
  source_link?: string;
};

export type TechDebt = {
  high_complexity: TechDebtFinding[];
  long_functions: TechDebtFinding[];
  schema_validation?: SchemaValidation;
  summary_findings_top: TechDebtFinding[];
  thresholds?: { complexity: number; loc: number };
  sources?: Array<{ label: string; source: string; source_link?: string }>;
};

export type PrReviewExt = {
  tech_debt?: TechDebt;
  duplication?: Duplication;
  tests_in_graph?: TestsInGraph;
  nfr_edge_cases?: NfrEdgeCases;
  pr_quality?: PrQuality;
};

// ─── pr_quality (six dimensions + composite + the 18 render-ready gauges) ─

export type GaugeLevel = 'low' | 'moderate' | 'high' | 'critical';

/** One render-ready gauge — all orientation/normalization done in Rust. */
export type QualityGauge = {
  id: string;
  group: string;
  label: string;
  /** Raw 0..100 → bar length. */
  score: number;
  /** Quality metric ("higher is better") vs risk metric. */
  higher_is_better: boolean;
  /** Band on the RISK magnitude → pill + bar colour. */
  level: GaugeLevel;
  /** `↑` risk · `↓` quality. */
  arrow: string;
  description: string;
};

export type GaugeRef = { label: string; score: number };

export type GaugeSummary = {
  context_fits?: boolean;
  token_estimate?: number;
  token_limit?: number;
  highest?: GaugeRef[];
  lowest?: GaugeRef[];
};

export type QualityComposite = {
  score?: number;
  band?: string;
  label?: string;
  confidence?: string;
};

export type PrQuality = {
  composite?: QualityComposite;
  /** The flat 18-metric projection the gauge report renders. */
  gauges?: QualityGauge[];
  gauge_summary?: GaugeSummary;
};

export type ScanPrOutput = {
  schema_version: '1.0' | '1.1' | '1.2';
  mode: 'static' | 'sampled' | 'evented';
  generator: Generator;

  // PR-specific
  pr_scope: PrScope;
  pr_review?: PrReview;
  pr_review_ext?: PrReviewExt;
};

// ─── loader ─────────────────────────────────────────────────────────────

export function loadReport(path: string): ScanPrOutput {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as Partial<ScanPrOutput>;
  validate(parsed);
  return parsed as ScanPrOutput;
}

function validate(r: Partial<ScanPrOutput>): void {
  if (r.schema_version !== '1.0' && r.schema_version !== '1.1' && r.schema_version !== '1.2') {
    throw new Error(
      `Unsupported schema_version: ${JSON.stringify(r.schema_version)} (action understands 1.0, 1.1, 1.2)`,
    );
  }
  // Compact-report fields (summary/entries/frames/string_table) were dropped
  // from ScanPrOutput in the slim-envelope reshape — they live in the
  // separate full `scan` command's output.
  for (const key of ['mode', 'generator', 'pr_scope'] as const) {
    if (r[key] === undefined) {
      throw new Error(`scan-pr report missing required field "${key}"`);
    }
  }
  const ps = r.pr_scope as PrScope;
  for (const k of ['changed_files', 'affected_roots', 'unreachable_changes'] as const) {
    if (!Array.isArray(ps[k])) {
      throw new Error(`pr_scope.${k} must be an array`);
    }
  }
}

// ─── PR-failure kill switch ───────────────────────────────────────────────
/**
 * Drift is advisory ONLY for now: it NEVER fails a PR. Both fail paths read
 * this single flag — the "Drift / PR review" check run (check.ts) and the
 * job-level core.setFailed (main.ts) — so neither can go red ✗ regardless of
 * findings or `fail-threshold`. Flip to `true` to re-enable the
 * fail-threshold opt-in. Typed `boolean` (not the literal `false`) so the
 * opt-in branches stay live for that flip.
 */
export const DRIFT_FAILS_PR: boolean = false;

// ─── suggestion quality bar (Spec rule: category in {A,B,C}, ≥1 ref, confidence ≥ 0.75) ─

export const SUGGESTION_CONFIDENCE_THRESHOLD = 0.75;

export function passesQualityBar(s: CodeSuggestion): boolean {
  const hasRef = Array.isArray(s.references) && s.references.length > 0 && !!s.references[0].url;
  const validCategory = s.category === 'A' || s.category === 'B' || s.category === 'C';
  return s.confidence >= SUGGESTION_CONFIDENCE_THRESHOLD && hasRef && validCategory;
}
