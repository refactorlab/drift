export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type GateStatus = 'pass' | 'fail' | 'warn';
export type TraceKind = 'io' | 'cpu' | 'db' | 'cache';
export type FlameHeat = 'hot' | 'warm' | 'cool' | 'mild' | 'calm' | 'faded';
export type PRStatus = 'pending' | 'approved' | 'merged';

export interface Repo { id: number; owner: string; name: string }
export interface DepartmentRef { id: number; name: string }

export interface PR {
  number: number;
  title: string;
  branch: string;
  baseBranch: string;
  commits: number;
  filesChanged: number;
  author: string;
  githubUrl: string;
  status: PRStatus;
  repo: Repo;
}

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

export interface ScanListItem {
  prNumber: number;
  prTitle: string;
  prStatus: PRStatus;
  author: string;
  repo: Repo;
  verdict: string;
  verdictSub: string;
  profiledAt: number;
  p95LatencyMs: number;
  p95BaselineMs: number;
  cpuPct: number;
  cacheHitRate: number;
}

export interface ImprovementRow {
  id: number;
  number: number;
  title: string;
  status: PRStatus;
  author: string;
  githubUrl: string;
  improvement: string | null;
  businessValue: number;
  hoursSaved: number;
  branch: string;
  baseBranch: string;
  commits: number;
  filesChanged: number;
  repo: Repo;
  department: DepartmentRef | null;
  scan: { verdict: string; p95LatencyMs: number; profiledAt: number } | null;
  rollups: {
    repoTotal: number;
    departmentTotal: number;
    companyTotal: number;
  };
}

export interface ImprovementsResponse {
  pending: ImprovementRow[];
  approved: ImprovementRow[];
  totals: {
    pendingCount: number;
    approvedCount: number;
    pendingBusinessValue: number;
    approvedBusinessValue: number;
    pendingHoursSaved: number;
    approvedHoursSaved: number;
    companyBusinessValue: number;
    companyHoursSaved: number;
  };
}

export interface ArchitectureSuggestion {
  id: number;
  title: string;
  description: string;
  githubUrl: string | null;
  businessValue: number;
  hoursSaved: number;
  status: string;
  createdAt: number;
  repo: Repo | null;
  department: DepartmentRef | null;
}

export interface RepoListItem {
  id: number;
  owner: string;
  name: string;
  department: DepartmentRef | null;
  prCount: number;
  totalBusinessValue: number;
  totalHoursSaved: number;
}

export interface DepartmentListItem {
  id: number;
  name: string;
  repoCount: number;
  prCount: number;
  totalBusinessValue: number;
  totalHoursSaved: number;
}

export interface DashboardResponse {
  scans: { total: number; failed: number; passed: number; warn: number };
  improvements: {
    pending: number;
    approved: number;
    pendingBusinessValue: number;
    approvedBusinessValue: number;
    totalHoursSaved: number;
  };
  topRepos: Array<{
    id: number; owner: string; name: string;
    prCount: number; totalBusinessValue: number;
  }>;
  recentScans: ScanListItem[];
}
