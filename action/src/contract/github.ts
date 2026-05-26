// TypeScript types mirroring the official GitHub REST API + webhook
// payload shapes the Action consumes.
//
// Sources:
//   - GET /repos/{owner}/{repo}/pulls/{pull_number}/files → DiffEntry[]
//       https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#list-pull-requests-files
//   - github.event.pull_request (webhook payload)
//       https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request
//
// These are intentionally separate from src/contract/input.ts's
// `ChangedFile`, because the SCANNER's schema renames GitHub's
// `filename` to `path`. `toChangedFile()` does the conversion.

import type { ChangedFile } from './input.ts';

// ─── GET /pulls/{n}/files response ──────────────────────────────────────

export type GitHubDiffStatus =
  | 'added'
  | 'removed'
  | 'modified'
  | 'renamed'
  | 'copied'
  | 'changed'
  | 'unchanged';

/**
 * One element of the array returned by the REST API. ALL fields here
 * are REQUIRED by GitHub except `patch` and `previous_filename`.
 */
export type GitHubDiffEntry = {
  sha: string | null;
  filename: string;        // ← scanner's schema renames this to `path`
  status: GitHubDiffStatus;
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string;
  previous_filename?: string;
};

/**
 * Convert a GitHub Diff Entry to the scanner's `ChangedFile`. The only
 * semantic transform is `filename` → `path`; everything else is
 * pass-through. Returns `null` for `removed` files since there's no
 * AST to walk after deletion (the scanner silently drops them anyway,
 * but rejecting here saves a roundtrip).
 */
export function toChangedFile(entry: GitHubDiffEntry): ChangedFile | null {
  if (entry.status === 'removed') return null;
  return {
    path: entry.filename,
    status: entry.status,
    additions: entry.additions,
    deletions: entry.deletions,
    changes: entry.changes,
    sha: entry.sha,
    blob_url: entry.blob_url,
    raw_url: entry.raw_url,
    contents_url: entry.contents_url,
    ...(entry.patch !== undefined ? { patch: entry.patch } : {}),
    ...(entry.previous_filename !== undefined ? { previous_filename: entry.previous_filename } : {}),
  };
}

// ─── github.event.pull_request (webhook payload) ────────────────────────

/**
 * The subset of `pull_request` payload fields the Action reads. GitHub
 * doesn't publish a strict OpenAPI for webhook payloads — these names
 * come from observed payloads (matching what @actions/github exposes
 * via `context.payload.pull_request`).
 */
export type WebhookPullRequest = {
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  state: 'open' | 'closed';
  draft?: boolean;
  user: { login: string; id: number };
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  labels?: Array<{ name: string }>;
  milestone?: { title: string } | null;
  commits?: number;
  changed_files?: number;
  additions?: number;
  deletions?: number;
  created_at?: string;
  updated_at?: string;
};

// ─── POST /pulls/{n}/reviews comment shape ──────────────────────────────

/**
 * Shape of each entry in `comments` for POST /pulls/{n}/reviews.
 *
 *   - `path` + `body` are REQUIRED.
 *   - `line` + `side` are optional; `side` defaults to `RIGHT`.
 *   - For multi-line ranges add `start_line` + `start_side`; `line`
 *     then becomes the LAST line of the range.
 */
export type ReviewComment = {
  path: string;
  body: string;
  line?: number;
  side?: 'LEFT' | 'RIGHT';
  start_line?: number;
  start_side?: 'LEFT' | 'RIGHT';
  position?: number;     // legacy diff-position; mutually exclusive w/ line
};
