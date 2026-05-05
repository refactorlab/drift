import { z } from 'zod';

export const PRStatus = z.enum(['pending', 'approved', 'merged']);
export type PRStatus = z.infer<typeof PRStatus>;

export const RepoRefSchema = z.object({
  id: z.number(),
  owner: z.string(),
  name: z.string(),
});

export const DepartmentRefSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const RepoSchema = z.object({
  id: z.number(),
  owner: z.string(),
  name: z.string(),
  department: DepartmentRefSchema.nullable(),
  prCount: z.number(),
  totalBusinessValue: z.number(),
  totalHoursSaved: z.number(),
});

export const DepartmentSchema = z.object({
  id: z.number(),
  name: z.string(),
  repoCount: z.number(),
  prCount: z.number(),
  totalBusinessValue: z.number(),
  totalHoursSaved: z.number(),
});

export const UserSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  role: z.string(),
  githubUsername: z.string(),
  initials: z.string(),
  department: DepartmentRefSchema.nullable(),
});

export const PRSummarySchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  status: PRStatus,
  author: z.string(),
  githubUrl: z.string(),
  improvement: z.string().nullable(),
  businessValue: z.number(),
  hoursSaved: z.number(),
  branch: z.string(),
  baseBranch: z.string(),
  commits: z.number(),
  filesChanged: z.number(),
  repo: RepoRefSchema,
  department: DepartmentRefSchema.nullable(),
  scan: z
    .object({
      verdict: z.string(),
      p95LatencyMs: z.number(),
      profiledAt: z.number(),
    })
    .nullable(),
});

export const ImprovementRowSchema = PRSummarySchema.extend({
  rollups: z.object({
    repoTotal: z.number(),
    departmentTotal: z.number(),
    companyTotal: z.number(),
  }),
});

export const ImprovementsResponseSchema = z.object({
  pending: z.array(ImprovementRowSchema),
  approved: z.array(ImprovementRowSchema),
  totals: z.object({
    pendingCount: z.number(),
    approvedCount: z.number(),
    pendingBusinessValue: z.number(),
    approvedBusinessValue: z.number(),
    pendingHoursSaved: z.number(),
    approvedHoursSaved: z.number(),
    companyBusinessValue: z.number(),
    companyHoursSaved: z.number(),
  }),
});

export const ArchitectureSuggestionSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  githubUrl: z.string().nullable(),
  businessValue: z.number(),
  hoursSaved: z.number(),
  status: z.string(),
  createdAt: z.number(),
  repo: RepoRefSchema.nullable(),
  department: DepartmentRefSchema.nullable(),
});

export const ScanListItemSchema = z.object({
  prNumber: z.number(),
  prTitle: z.string(),
  prStatus: PRStatus,
  author: z.string(),
  repo: RepoRefSchema,
  verdict: z.string(),
  verdictSub: z.string(),
  profiledAt: z.number(),
  p95LatencyMs: z.number(),
  p95BaselineMs: z.number(),
  cpuPct: z.number(),
  cacheHitRate: z.number(),
});

export const FlameBlockSchema = z.object({
  label: z.string(),
  flex: z.number(),
  pct: z.number().nullable(),
  heat: z.string(),
});

export const FlameRowSchema = z.object({
  depth: z.number(),
  blocks: z.array(FlameBlockSchema),
});

export const FlameAxisSchema = z.object({
  label: z.string(),
  offset_pct: z.number(),
});

export const IssueSchema = z.object({
  id: z.number(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string(),
  file_path: z.string(),
  line_number: z.number().nullable(),
  meta: z.string().nullable(),
  category: z.string().nullable(),
  impact_ms: z.number(),
  problem: z.string().nullable(),
  code_before: z.string().nullable(),
  code_after: z.string().nullable(),
  code_lang: z.string().nullable(),
  code_diff_label: z.string().nullable(),
  suggestion_title: z.string().nullable(),
  suggestion_text: z.string().nullable(),
});

export const GateSchema = z.object({
  name: z.string(),
  value: z.string(),
  status: z.enum(['pass', 'fail', 'warn']),
});

export const TimeDistSchema = z.object({
  name: z.string(),
  pct: z.number(),
  level: z.enum(['high', 'med', 'low']),
});

export const TraceSpanSchema = z.object({
  label: z.string(),
  kind: z.enum(['io', 'cpu', 'db', 'cache']),
  offset_pct: z.number(),
  width_pct: z.number(),
  time_ms: z.number(),
});

export const ScanDetailSchema = z.object({
  pr: z.object({
    number: z.number(),
    title: z.string(),
    branch: z.string(),
    baseBranch: z.string(),
    commits: z.number(),
    filesChanged: z.number(),
    author: z.string(),
    githubUrl: z.string(),
    status: PRStatus,
    repo: RepoRefSchema,
  }),
  scan: z.object({
    verdict: z.string(),
    verdictSub: z.string(),
    profiledAt: z.number(),
    stats: z.object({
      p95: z.object({ value: z.number(), baseline: z.number() }),
      cpu: z.object({ value: z.number(), baseline: z.number() }),
      db: z.object({ queries: z.number(), nPlusOne: z.number() }),
      cache: z.object({ hitRate: z.number(), baseline: z.number() }),
    }),
    autofix: z.object({
      fixable: z.number(),
      total: z.number(),
      savingsMs: z.number(),
    }),
  }),
  issues: z.array(IssueSchema),
  gates: z.array(GateSchema),
  flame: z.object({
    rows: z.array(FlameRowSchema),
    axis: z.array(FlameAxisSchema),
  }),
  timeDistribution: z.array(TimeDistSchema),
  trace: z.array(TraceSpanSchema),
});

export const DashboardSchema = z.object({
  scans: z.object({
    total: z.number(),
    failed: z.number(),
    passed: z.number(),
    warn: z.number(),
  }),
  improvements: z.object({
    pending: z.number(),
    approved: z.number(),
    pendingBusinessValue: z.number(),
    approvedBusinessValue: z.number(),
    totalHoursSaved: z.number(),
  }),
  topRepos: z.array(
    z.object({
      id: z.number(),
      owner: z.string(),
      name: z.string(),
      prCount: z.number(),
      totalBusinessValue: z.number(),
    }),
  ),
  recentScans: z.array(ScanListItemSchema),
});

export const PRPatchSchema = z.object({
  improvement: z.string().optional(),
  businessValue: z.number().int().nonnegative().optional(),
  hoursSaved: z.number().int().nonnegative().optional(),
  status: PRStatus.optional(),
});

export const ArchPatchSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  githubUrl: z.string().nullable().optional(),
  businessValue: z.number().int().nonnegative().optional(),
  hoursSaved: z.number().int().nonnegative().optional(),
  status: z.string().optional(),
});
