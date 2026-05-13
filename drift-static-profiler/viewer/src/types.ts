export type SymbolKind = 'Function' | 'Method' | 'Class';

export type Category = 'db' | 'network' | 'io' | 'cache' | 'queue' | 'log' | 'compute';

export type Severity = 'low' | 'medium' | 'high';

export type Effort = 'trivial' | 'small' | 'medium' | 'large';

export type FindingKind =
  | 'n_plus_one'
  | 'blocking_in_async'
  | 'recursive'
  | 'smelly_loop'
  | 'noisy_log'
  | 'outdated_package'
  | 'memory_explosion'
  | 'hot_zone'
  | 'expensive_compute'
  | 'missing_caching'
  | 'log_amplification';

export interface Evidence {
  call: string;
  line: number;
  category?: Category;
}

export interface Finding {
  kind: FindingKind;
  severity: Severity;
  /// Defaults to 'medium' if absent (older fixtures).
  effort?: Effort;
  confidence: number;
  line: number;
  message: string;
  evidence?: Evidence[];
  remediation?: string;
}

export interface FindingTopRef {
  node_id: string;
  kind: FindingKind;
  severity: Severity;
  line: number;
}

export interface RootCallerSummary {
  node_id: string;
  name: string;
  file: string;
  line: number;
  parent_class?: string | null;
}

export interface RootCalleeSummary {
  node_id: string;
  name: string;
  file: string;
  line: number;
  parent_class?: string | null;
  subtree_size: number;
}

export interface RootOverview {
  node_id: string;
  name: string;
  file: string;
  line: number;
  parent_class?: string | null;
  kind: SymbolKind;
  subtree_size: number;
  percent_of_all_roots: number;
  categories_reached?: Record<string, number>;
  findings_by_severity?: Record<string, number>;
  findings_total: number;
  callers?: RootCallerSummary[];
  first_callees?: RootCalleeSummary[];
}

export interface ImmediateFix {
  node_id: string;
  name: string;
  file: string;
  line: number;
  parent_class?: string | null;
  kind: FindingKind;
  severity: Severity;
  effort: Effort;
  message: string;
}

// Closed-set of entry-declaration sources. Two families:
//   - container deployment (Dockerfile + docker-compose)
//   - language manifests (package.json, deno.json, pyproject.toml, Cargo.toml)
// Older fixtures will only carry the first four; newer ones may carry any
// of these, so consumers should treat unknown values as benign.
export type EntryKind =
  | 'dockerfile_cmd'
  | 'dockerfile_entrypoint'
  | 'compose_command'
  | 'compose_entrypoint'
  | 'package_json_main'
  | 'package_json_module'
  | 'package_json_bin'
  | 'package_json_script'
  | 'deno_task'
  | 'pyproject_script'
  | 'cargo_bin';

export type EntryMatchConfidence = 'exact' | 'likely' | 'unmatched';

export interface EntryMatch {
  confidence: EntryMatchConfidence;
  symbol_id: string;
  symbol_name: string;
  symbol_file: string;
  symbol_line: number;
  evidence: string;
}

export interface EntryDecl {
  file: string;
  line: number;
  kind: EntryKind;
  raw: string;
  argv: string[];
  service?: string | null;
  workdir?: string | null;
  matched?: EntryMatch;
}

export const ENTRY_KIND_LABEL: Record<EntryKind, string> = {
  dockerfile_cmd:        'Dockerfile CMD',
  dockerfile_entrypoint: 'Dockerfile ENTRYPOINT',
  compose_command:       'compose command',
  compose_entrypoint:    'compose entrypoint',
  package_json_main:     'package.json main',
  package_json_module:   'package.json module',
  package_json_bin:      'package.json bin',
  package_json_script:   'package.json script',
  deno_task:             'deno task',
  pyproject_script:      'pyproject script',
  cargo_bin:             'Cargo [[bin]]',
};

// Coarse family grouping for the viewer's filter chips and color bucket.
// `container` covers Dockerfile + docker-compose; `manifest` covers all the
// per-language package configs. New kinds default to `manifest` if unknown.
export type EntryFamily = 'container' | 'manifest';

export function entryFamily(kind: EntryKind): EntryFamily {
  switch (kind) {
    case 'dockerfile_cmd':
    case 'dockerfile_entrypoint':
    case 'compose_command':
    case 'compose_entrypoint':
      return 'container';
    default:
      return 'manifest';
  }
}

export interface RefactorCandidate {
  node_id: string;
  name: string;
  file: string;
  line: number;
  parent_class?: string | null;
  findings_count: number;
  kinds: FindingKind[];
  worst_severity: Severity;
  max_effort: Effort;
  complexity: number;
  loc: number;
  percent_total: number;
  why: string;
}

export interface ExternalCall {
  name: string;
  receiver?: string | null;
  category: Category;
  tier?: 'imported_module' | 'receiver_pattern' | 'method_signature';
  evidence?: string;
  line: number;
  in_loop?: boolean;
  in_await?: boolean;
}

export interface CallerRef {
  id: string;
  name: string;
  file: string;
  line: number;
  parent_class: string | null;
}

export interface CallTreeNode {
  id: string;
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  depth: number;
  parent_class: string | null;
  children: CallTreeNode[];
  truncated_reason: string | null;

  callers: CallerRef[];
  callers_count: number;
  callees_count: number;
  subtree_size: number;

  category_self: Category | null;
  categories_reached: Record<string, number>;
  external_calls: ExternalCall[];

  // Phase A — per-symbol code quality
  complexity: number;
  loc: number;
  nesting_depth: number;
  parameter_count: number;
  is_async: boolean;

  // Phase B — graph-derived
  call_site_count: number;
  is_recursive: boolean;
  pagerank: number;

  // Phase C — tree percentages
  percent_total: number;
  percent_parent: number;

  // Phase D — risk flags (derived from `findings` when present; kept as
  // a convenience for older consumers and the flame-mode 'smells' painter)
  n_plus_one_risk: boolean;
  blocking_in_async: boolean;

  // Phase E — structured findings (optional; older fixtures omit it)
  findings?: Finding[];

  // Entry-declaration labels — populated when this symbol is the resolved
  // target of an `EntryDecl` (Dockerfile/compose, package.json scripts,
  // pyproject scripts, deno tasks, Cargo bins). See Summary.entry_declarations.
  entry_labels?: string[];
}

export interface TopSymbol {
  name: string;
  file: string;
  line: number;
  parent_class: string | null;
  count: number;
}

export interface HotPath {
  frames: string[];
  depth: number;
  terminal_category: string;
}

export interface RankedByScore {
  name: string;
  file: string;
  line: number;
  parent_class: string | null;
  score: number;
}

export interface LanguageBreakdownEntry {
  language: string;
  bytes: number;
  percent: number;
  supported: boolean;
}

export interface Summary {
  languages: string[];
  files: number;
  symbols: number;
  edges: number;
  categories: Record<string, number>;
  top_callers: TopSymbol[];
  top_callees: TopSymbol[];
  hot_paths: HotPath[];
  dead_code: TopSymbol[];
  pagerank_top: RankedByScore[];
  recursive_symbols: TopSymbol[];

  // GitHub-Linguist style language breakdown (always emitted by the profiler)
  language_breakdown?: LanguageBreakdownEntry[];
  profiled_language?: string | null;
  profiled_language_percent?: number | null;

  // Phase E — insights rollups (optional; older fixtures omit them)
  findings_by_kind?: Record<string, number>;
  findings_top?: FindingTopRef[];
  /// Per-entry-point rollup. Mirrors pprof's `top -cum` at root granularity.
  roots_overview?: RootOverview[];
  /// "Quick wins" — high severity + trivial/small effort findings.
  immediate_fixes?: ImmediateFix[];
  /// "Where do I need a full refactor?" — per-symbol aggregates with
  /// multiple findings, large effort, or god-function bodies.
  refactor_candidates?: RefactorCandidate[];

  /// Declared entry points harvested from container-deployment files
  /// (Dockerfile + docker-compose) AND per-language package manifests
  /// (package.json scripts/bin/main, deno.json tasks, pyproject.toml
  /// `[project.scripts]`, Cargo.toml `[[bin]]`).
  entry_declarations?: EntryDecl[];
}

export interface Generator {
  tool: string;
  version: string;
  source_root?: string;
}

export interface Report {
  generator?: Generator;
  summary: Summary;
  entries: CallTreeNode[];
}

export interface FixtureSpec {
  key: string;
  label: string;
  json: string;
  description: string;
}

export interface FlameNode {
  name: string;
  value: number;
  tooltip: string;
  backgroundColor: string;
  color: string;
  id: string;
  source: CallTreeNode;
  children?: FlameNode[];
}

export const CATEGORY_COLORS: Record<Category, string> = {
  db:       '#e26d6d',
  network:  '#7e6ff0',
  io:       '#e0a458',
  cache:    '#48a999',
  queue:    '#d09bd1',
  log:      '#7e8189',
  compute:  '#5b8def',
};

// Severity palette intentionally aliases existing category colors so
// nothing new gets introduced visually. red/orange/gray match the
// existing semantic ranking.
export const SEVERITY_COLORS: Record<Severity, string> = {
  high:   '#e26d6d',
  medium: '#e0a458',
  low:    '#7e8189',
};

// Human labels for the eight finding kinds used by Insights / ScanReport.
// Adding a kind on the Rust side without updating this map is harmless —
// the UI falls back to the raw kind string.
export const FINDING_KIND_LABEL: Record<FindingKind, string> = {
  n_plus_one:        'N+1',
  blocking_in_async: 'BLOCKING IN ASYNC',
  recursive:         'RECURSIVE',
  smelly_loop:       'SMELLY LOOP',
  noisy_log:         'NOISY LOG',
  outdated_package:  'OUTDATED PKG',
  memory_explosion:  'MEMORY EXPLOSION',
  hot_zone:          'HOT ZONE',
  expensive_compute: 'EXPENSIVE COMPUTE',
  missing_caching:   'MISSING CACHING',
  log_amplification: 'LOG AMPLIFICATION',
};

export const EFFORT_LABEL: Record<Effort, string> = {
  trivial: 'TRIVIAL',
  small:   'SMALL',
  medium:  'MEDIUM',
  large:   'LARGE',
};
