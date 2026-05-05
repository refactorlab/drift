export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type GateStatus = 'pass' | 'fail' | 'warn';
export type TraceKind = 'io' | 'cpu' | 'db' | 'cache';
export type FlameHeat = 'hot' | 'warm' | 'cool' | 'mild' | 'calm' | 'faded';

export interface Repo { owner: string; name: string }

export interface PR {
  number: number;
  title: string;
  branch: string;
  baseBranch: string;
  commits: number;
  filesChanged: number;
  author: string;
  repo: Repo;
}

export interface Stat<T = number> { value: T; baseline: T }

export interface ScanStats {
  p95: { value: number; baseline: number };
  cpu: { value: number; baseline: number };
  db: { queries: number; nPlusOne: number };
  cache: { hitRate: number; baseline: number };
}

export interface Scan {
  verdict: string;
  verdictSub: string;
  profiledAt: number;
  stats: ScanStats;
  autofix: { fixable: number; total: number; savingsMs: number };
}

export interface Issue {
  id: number;
  severity: Severity;
  title: string;
  file_path: string;
  line_number: number | null;
  meta: string | null;
  category: string | null;
  impact_ms: number;
  problem: string | null;
  code_before: string | null;
  code_after: string | null;
  code_lang: string | null;
  code_diff_label: string | null;
  suggestion_title: string | null;
  suggestion_text: string | null;
}

export interface Gate { name: string; value: string; status: GateStatus }

export interface FlameBlock {
  label: string;
  flex: number;
  pct: number | null;
  heat: FlameHeat;
}

export interface FlameRow { depth: number; blocks: FlameBlock[] }
export interface FlameAxis { label: string; offset_pct: number }

export interface TimeDistRow { name: string; pct: number; level: 'high' | 'med' | 'low' }
export interface TraceSpan {
  label: string;
  kind: TraceKind;
  offset_pct: number;
  width_pct: number;
  time_ms: number;
}

export interface ScanResponse {
  pr: PR;
  scan: Scan;
  issues: Issue[];
  gates: Gate[];
  flame: { rows: FlameRow[]; axis: FlameAxis[] };
  timeDistribution: TimeDistRow[];
  trace: TraceSpan[];
}
