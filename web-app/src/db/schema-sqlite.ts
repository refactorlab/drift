import {
  sqliteTable,
  integer,
  text,
  real,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const departments = sqliteTable('departments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  githubUsername: text('github_username').notNull(),
  initials: text('initials').notNull(),
  departmentId: integer('department_id').references(() => departments.id),
  passwordHash: text('password_hash'),
});

export const repos = sqliteTable(
  'repos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    departmentId: integer('department_id').references(() => departments.id),
  },
  (t) => ({
    ownerNameUq: uniqueIndex('repos_owner_name_uq').on(t.owner, t.name),
  }),
);

export const pullRequests = sqliteTable(
  'pull_requests',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    repoId: integer('repo_id').notNull().references(() => repos.id),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    branch: text('branch').notNull(),
    baseBranch: text('base_branch').notNull(),
    commits: integer('commits').notNull(),
    filesChanged: integer('files_changed').notNull(),
    author: text('author').notNull(),
    status: text('status').notNull().default('pending'),
    githubUrl: text('github_url').notNull(),
    improvement: text('improvement'),
    businessValue: integer('business_value').notNull().default(0),
    hoursSaved: integer('hours_saved').notNull().default(0),
  },
  (t) => ({
    repoNumberUq: uniqueIndex('prs_repo_number_uq').on(t.repoId, t.number),
  }),
);

export const scans = sqliteTable('scans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  prId: integer('pr_id').notNull().references(() => pullRequests.id),
  verdict: text('verdict').notNull(),
  verdictSub: text('verdict_sub').notNull(),
  profiledAt: integer('profiled_at').notNull(),
  p95LatencyMs: integer('p95_latency_ms').notNull(),
  p95BaselineMs: integer('p95_baseline_ms').notNull(),
  cpuPct: integer('cpu_pct').notNull(),
  cpuBaselinePct: integer('cpu_baseline_pct').notNull(),
  dbQueries: integer('db_queries').notNull(),
  dbNPlusOne: integer('db_n_plus_one').notNull(),
  cacheHitRate: integer('cache_hit_rate').notNull(),
  cacheBaseline: integer('cache_baseline').notNull(),
  autofixCount: integer('autofix_count').notNull(),
  autofixTotal: integer('autofix_total').notNull(),
  autofixSavingsMs: integer('autofix_savings_ms').notNull(),
});

export const issues = sqliteTable('issues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scanId: integer('scan_id').notNull().references(() => scans.id),
  severity: text('severity').notNull(),
  title: text('title').notNull(),
  filePath: text('file_path').notNull(),
  lineNumber: integer('line_number'),
  meta: text('meta'),
  category: text('category'),
  impactMs: integer('impact_ms').notNull(),
  problem: text('problem'),
  codeBefore: text('code_before'),
  codeAfter: text('code_after'),
  codeLang: text('code_lang'),
  codeDiffLabel: text('code_diff_label'),
  suggestionTitle: text('suggestion_title'),
  suggestionText: text('suggestion_text'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const gates = sqliteTable('gates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scanId: integer('scan_id').notNull().references(() => scans.id),
  name: text('name').notNull(),
  value: text('value').notNull(),
  status: text('status').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const flameRows = sqliteTable('flame_rows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scanId: integer('scan_id').notNull().references(() => scans.id),
  depth: integer('depth').notNull(),
});

export const flameBlocks = sqliteTable('flame_blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rowId: integer('row_id').notNull().references(() => flameRows.id),
  label: text('label').notNull(),
  flex: real('flex').notNull(),
  pct: integer('pct'),
  heat: text('heat').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const flameAxis = sqliteTable('flame_axis', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scanId: integer('scan_id').notNull().references(() => scans.id),
  label: text('label').notNull(),
  offsetPct: integer('offset_pct').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const timeDistribution = sqliteTable('time_distribution', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scanId: integer('scan_id').notNull().references(() => scans.id),
  name: text('name').notNull(),
  pct: integer('pct').notNull(),
  level: text('level').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const traceSpans = sqliteTable('trace_spans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scanId: integer('scan_id').notNull().references(() => scans.id),
  label: text('label').notNull(),
  kind: text('kind').notNull(),
  offsetPct: integer('offset_pct').notNull(),
  widthPct: integer('width_pct').notNull(),
  timeMs: integer('time_ms').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const architectureSuggestions = sqliteTable('architecture_suggestions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  githubUrl: text('github_url'),
  businessValue: integer('business_value').notNull().default(0),
  hoursSaved: integer('hours_saved').notNull().default(0),
  repoId: integer('repo_id').references(() => repos.id),
  departmentId: integer('department_id').references(() => departments.id),
  status: text('status').notNull().default('proposed'),
  createdAt: integer('created_at').notNull(),
});
