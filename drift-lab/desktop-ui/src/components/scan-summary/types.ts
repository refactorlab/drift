/**
 * Minimal subset of the static-profiler viewer types — just what the desktop
 * summary cards need. Copied here verbatim from
 * `drift-static-profiler/viewer/src/types.ts` so this app can render saved
 * scan JSON without depending on the viewer package directly.
 *
 * Two reasons for the copy rather than a shared package:
 *  1. The desktop ships in its own bundle; pulling in the viewer's React
 *     entry tree would drag in `react-flame-graph` and friends we don't
 *     render here.
 *  2. The two surfaces are theme-isolated (viewer = dark, desktop = light),
 *     so having a thin local copy lets us evolve presentation without
 *     touching the source-of-truth viewer.
 *
 * The JSON shape itself remains the contract — keep the field names in
 * sync with `drift_static_profiler::report::{Summary, FindingTopRef,
 * ImmediateFix, RefactorCandidate}`.
 */

export type Severity = "low" | "medium" | "high";
export type Effort = "trivial" | "small" | "medium" | "large";

export type Category =
  | "db"
  | "network"
  | "io"
  | "cache"
  | "queue"
  | "log"
  | "compute";

export type FindingKind =
  | "n_plus_one"
  | "blocking_in_async"
  | "recursive"
  | "smelly_loop"
  | "noisy_log"
  | "outdated_package"
  | "memory_explosion"
  | "hot_zone"
  | "expensive_compute"
  | "missing_caching"
  | "log_amplification"
  | "sql_antipattern"
  | "migration_safety"
  | "django_antipattern"
  | "sqlalchemy_antipattern"
  | "alembic_migration"
  | "sql_ir_antipattern"
  | "prisma_antipattern"
  | "drizzle_antipattern"
  | "typeorm_antipattern"
  | "sequelize_antipattern"
  | "mongoose_antipattern"
  | "jpa_antipattern"
  | "gorm_antipattern"
  | "sqlx_antipattern"
  | "llm_antipattern"
  | "auth_crypto_antipattern";

/// High-level semantic grouping — matches `FindingCategory` in
/// `src/insights.rs`. The viewer/desktop should branch on category,
/// not on individual kinds, so new ORMs slot in without UI changes.
export type FindingCategoryName =
  | "orm"
  | "sql"
  | "performance"
  | "security"
  | "reliability"
  | "observability"
  | "ai"
  | "maintenance";

export interface CategoryRollup {
  total: number;
  by_kind: Record<string, number>;
}

export interface CategoryTopEntry {
  node_id: string;
  file: string;
  line: number;
  kind: string;
  severity: Severity;
  confidence: number;
  rule?: string;
  message: string;
  originating_orm?: string;
}

export interface FindingTopRef {
  node_id: string;
  kind: FindingKind;
  severity: Severity;
  line: number;
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
  pagerank_top?: RankedByScore[];
  findings_by_kind?: Record<string, number>;
  findings_top?: FindingTopRef[];
  findings_by_category?: Record<string, CategoryRollup>;
  findings_by_orm_family?: Record<string, number>;
  findings_top_by_category?: Record<string, CategoryTopEntry[]>;
  immediate_fixes?: ImmediateFix[];
  refactor_candidates?: RefactorCandidate[];
  language_breakdown?: LanguageBreakdownEntry[];
  profiled_language?: string | null;
  profiled_language_percent?: number | null;
}

export interface Generator {
  tool: string;
  version: string;
  source_root?: string;
  captured_at?: string;
}

export interface CallTreeEntry {
  id: string;
  name: string;
  file: string;
  line: number;
  subtree_size: number;
  parent_class: string | null;
}

export interface Report {
  generator?: Generator;
  summary: Summary;
  entries: CallTreeEntry[];
}

/// Drift Lab is a light-theme app (vs. the viewer's dark surface). Same
/// semantic ramp — red/orange/gray for high/medium/low — but with values
/// that read on the warm off-white background defined in globals.css.
export const SEVERITY_COLORS: Record<Severity, string> = {
  high: "#e53935",
  medium: "#ff9558",
  low: "#9e9e9e",
};

export const CATEGORY_COLORS: Record<Category, string> = {
  db: "#e26d6d",
  network: "#7e6ff0",
  io: "#e0a458",
  cache: "#48a999",
  queue: "#d09bd1",
  log: "#9e9e9e",
  compute: "#5b8def",
};

export const FINDING_KIND_LABEL: Record<FindingKind, string> = {
  n_plus_one: "N+1",
  blocking_in_async: "BLOCKING IN ASYNC",
  recursive: "RECURSIVE",
  smelly_loop: "SMELLY LOOP",
  noisy_log: "NOISY LOG",
  outdated_package: "OUTDATED PKG",
  memory_explosion: "MEMORY EXPLOSION",
  hot_zone: "HOT ZONE",
  expensive_compute: "EXPENSIVE COMPUTE",
  missing_caching: "MISSING CACHING",
  log_amplification: "LOG AMPLIFICATION",
  sql_antipattern: "SQL ANTIPATTERN",
  migration_safety: "MIGRATION SAFETY",
  django_antipattern: "DJANGO",
  sqlalchemy_antipattern: "SQLALCHEMY",
  alembic_migration: "ALEMBIC",
  sql_ir_antipattern: "SQL-IR",
  prisma_antipattern: "PRISMA",
  drizzle_antipattern: "DRIZZLE",
  typeorm_antipattern: "TYPEORM",
  sequelize_antipattern: "SEQUELIZE",
  mongoose_antipattern: "MONGOOSE",
  jpa_antipattern: "JPA",
  gorm_antipattern: "GORM",
  sqlx_antipattern: "SQLX",
  llm_antipattern: "LLM",
  auth_crypto_antipattern: "AUTH/CRYPTO",
};

/// Canonical ordering of categories — keep aligned with
/// `FindingCategory::all()` on the Rust side.
export const CATEGORY_ORDER: readonly FindingCategoryName[] = [
  "orm",
  "sql",
  "performance",
  "security",
  "reliability",
  "observability",
  "ai",
  "maintenance",
] as const;

export const CATEGORY_LABEL: Record<FindingCategoryName, string> = {
  orm: "ORM",
  sql: "SQL",
  performance: "Performance",
  security: "Security",
  reliability: "Reliability",
  observability: "Observability",
  ai: "AI / LLM",
  maintenance: "Maintenance",
};

/// Light-theme palette for category badges — picks values that read
/// on the desktop app's warm off-white background.
export const CATEGORY_BADGE_COLOR: Record<FindingCategoryName, string> = {
  orm: "#5b8def",
  sql: "#7e6ff0",
  performance: "#e0a458",
  security: "#e53935",
  reliability: "#48a999",
  observability: "#5bd9f3",
  ai: "#d09bd1",
  maintenance: "#9e9e9e",
};
