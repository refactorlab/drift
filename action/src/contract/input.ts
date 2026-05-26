// Builds the `ScanPrInput` we send to drift-static-profiler.
// Canonical schema: drift-static-profiler/schema/scan_pr_input.openapi.yaml
//
// Two shapes are supported by the scanner:
//   - CLI-minimal:    project_root + changed_files[].path
//   - Action-enriched: + pr_context, discover_opts, analyze_opts
//
// Our Action wrapper today uses the CLI-minimal form (we pipe changed
// files to stdin) so the helper here primarily exists for tests and
// for the future enriched-mode integration.

export type DiffStatus =
  | 'added'
  | 'removed'
  | 'modified'
  | 'renamed'
  | 'copied'
  | 'changed'
  | 'unchanged';

export type ChangedFile = {
  path: string;
  status?: DiffStatus;
  additions?: number;
  deletions?: number;
  changes?: number;
  previous_filename?: string;
  sha?: string | null;
  blob_url?: string;
  raw_url?: string;
  contents_url?: string;
  patch?: string;
};

export type PrContext = {
  number?: number;
  repo?: string;            // "owner/name"
  base_sha?: string;
  head_sha?: string;
  base_ref?: string;
  head_ref?: string;
  title?: string;
  body?: string;
  author?: string;
  commits?: number;
  contributors?: number;
  labels?: string[];
  linked_issues?: number[];
  milestone?: string;
};

export type DiscoverOpts = {
  min_reach?: number;
  max_roots?: number;
  skip_tests?: boolean;
  skip_private?: boolean;
  skip_accessors?: boolean;
};

export type AnalyzeOpts = {
  max_depth?: number;
  skip_accessors?: boolean;
  exclude_tests?: boolean;
  exclude_static_assets?: boolean;
  scan_sql_files?: boolean;
  sql_dialect?: 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'snowflake' | 'bigquery' | 'generic';
};

export type ScanPrInput = {
  project_root: string;
  changed_files: ChangedFile[];
  pr_context?: PrContext;
  discover_opts?: DiscoverOpts;
  analyze_opts?: AnalyzeOpts;
};

// ────────────────────────────────────────────────────────────────────────
// Builders
// ────────────────────────────────────────────────────────────────────────

export type BuildInputArgs = {
  projectRoot: string;
  changedPaths: string[];           // bare paths from `git diff --name-only`
  pr?: PrContextFromGitHub;          // payload-derived
  discover?: DiscoverOpts;
  analyze?: AnalyzeOpts;
};

export type PrContextFromGitHub = {
  number: number;
  repo: string;
  base_sha?: string;
  head_sha: string;
  base_ref: string;
  head_ref?: string;
  title?: string;
  body?: string;
  author?: string;
  labels?: string[];
};

/**
 * Construct a ScanPrInput from the bare information a composite GitHub
 * Action has: a list of changed paths and the github.event.pull_request
 * payload fields. Status/additions/deletions come from the GH REST API
 * if/when we move to the enriched mode; today's CLI-minimal form sets
 * only `path`.
 */
export function buildScanPrInput(args: BuildInputArgs): ScanPrInput {
  const input: ScanPrInput = {
    project_root: args.projectRoot,
    changed_files: args.changedPaths.map((p) => ({ path: p })),
  };
  if (args.pr) input.pr_context = args.pr;
  if (args.discover) input.discover_opts = args.discover;
  if (args.analyze) input.analyze_opts = args.analyze;
  return input;
}
