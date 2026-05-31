#!/usr/bin/env node
// build-scan-context.mjs — assemble the machine-readable `pr-scan-context.json`
// that the action uploads alongside the raw scanner report (`pr-scan.json`).
//
// "Context" = everything an agent (or a human picking up the handoff) needs to
// understand WHAT was scanned and reproduce it, without re-deriving it from the
// PR: the PR identity, the exact diff scope (changed files + numstat +
// name-status + commit subjects), the merge-base the diff was computed against,
// the scanner identity (tool/version/release tag), and the workflow-run
// pointers. The raw scanner report answers "what did Drift find"; this answers
// "what did Drift look at".
//
// Reads (all via env; every field is optional and tolerated-empty):
//   SCAN_CONTEXT_OUT  — REQUIRED output path for the JSON file.
//   REPORT_PATH       — path to drift-report.json (for generator + counts).
//   RELEASE_TAG       — resolved profiler release tag.
//   MERGE_BASE_SHA    — the merge-base the diff was actually computed from.
//   CHANGED_PATH / STATS_PATH / STATUS_PATH / COMMITS_PATH — diff input files.
//   DRIFT_PR_* (NUMBER/HEAD_SHA/BASE_SHA/BASE_REF/HEAD_REF/PR_HTML_URL/
//               PR_AUTHOR/PR_TITLE/PR_BODY) — exported earlier to $GITHUB_ENV.
//   GitHub-injected: GITHUB_REPOSITORY / GITHUB_RUN_ID / GITHUB_RUN_ATTEMPT /
//               GITHUB_SERVER_URL / GITHUB_WORKFLOW / GITHUB_EVENT_NAME.
//
// Writes: SCAN_CONTEXT_OUT (pretty JSON). NEVER throws — on any failure it
// still writes a minimal `{schema, error}` object and exits 0, so the upload
// step always has a file and the chain stays fail-soft.
//
// ZERO DEPENDENCIES on purpose: the action runs this with bare `node` (no
// `npm ci` on the consumer's runner), so it uses only node:fs builtins.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const env = process.env;
const out = env.SCAN_CONTEXT_OUT;
if (!out) {
  console.error('build-scan-context: SCAN_CONTEXT_OUT is required — nothing written.');
  process.exit(2);
}

/** Read a file to string, or '' if missing/unreadable (never throws). */
function readMaybe(path) {
  if (!path || !existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/** Non-empty, trimmed lines of a text file. */
function lines(path) {
  return readMaybe(path)
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
}

/** Trimmed env value, or undefined when empty/unset. Use for scalars (SHAs,
 *  refs, tags) where surrounding whitespace is never meaningful. */
function val(key) {
  const v = env[key];
  if (v === undefined) return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

/** Free-text env value preserving leading/internal/trailing whitespace (a
 *  fenced code block in a PR body keeps its indentation); only a value that is
 *  entirely whitespace/unset collapses to undefined. Use for PR title/body. */
function freeText(key) {
  const v = env[key];
  if (v === undefined || v.trim() === '') return undefined;
  return v;
}

/**
 * `git diff --numstat --find-renames` emits a DISPLAY path for renamed files,
 * not a usable one: the arrow form `old.ts => new.ts`, or the shared-affix brace
 * form `src/{old => new}/mod.ts`. Collapse either to the NEW path so a stats row
 * keys to the same path `changed_files` carries (that list comes from
 * --name-only, which already resolves to the clean new path). A normal path has
 * no ` => ` and passes through untouched.
 */
function cleanRenamePath(p) {
  if (!p.includes('=>')) return p;
  const brace = p.match(/^(.*)\{.*? => (.*?)\}(.*)$/);
  if (brace) {
    const [, pre, neu, suf] = brace;
    return `${pre}${neu}${suf}`.replace(/\/{2,}/g, '/');
  }
  const arrow = p.split('=>');
  return arrow[arrow.length - 1].trim();
}

/** A non-negative integer column from numstat, or null for binary (`-`). */
function numOrNull(s) {
  if (s === undefined || s === '-' || s === '') return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

// ── PR identity ──────────────────────────────────────────────────────────────
const numberRaw = val('DRIFT_PR_NUMBER');
const numberInt = numberRaw !== undefined && /^\d+$/.test(numberRaw) ? Number.parseInt(numberRaw, 10) : null;

const pr = {
  number: numberInt,
  title: freeText('DRIFT_PR_TITLE') ?? null,
  body: freeText('DRIFT_PR_BODY') ?? null,
  author: val('DRIFT_PR_AUTHOR') ?? null,
  html_url: val('DRIFT_PR_HTML_URL') ?? null,
  base_ref: val('DRIFT_BASE_REF') ?? null,
  head_ref: val('DRIFT_HEAD_REF') ?? null,
  base_sha: val('DRIFT_BASE_SHA') ?? null,
  head_sha: val('DRIFT_HEAD_SHA') ?? null,
  // The merge-base the diff was actually computed against (three-dot
  // semantics). Differs from base_sha when the base branch advanced past the
  // fork point — this is the value the scanner saw.
  merge_base_sha: val('MERGE_BASE_SHA') ?? null,
};

// ── Diff scope ───────────────────────────────────────────────────────────────
const changedFiles = lines(env.CHANGED_PATH);

// numstat rows: `additions\tdeletions\tpath` (binary rows carry `-`).
const stats = lines(env.STATS_PATH)
  .map((line) => {
    const parts = line.split('\t');
    if (parts.length < 3) return null;
    const [adds, dels, ...rest] = parts;
    return { path: cleanRenamePath(rest.join('\t')), additions: numOrNull(adds), deletions: numOrNull(dels) };
  })
  .filter(Boolean);

// name-status rows: `A\tpath` / `M\tpath` / `D\tpath` / `T\tpath` and
// `R<sim>\told\tnew` / `C<sim>\told\tnew` for renames/copies.
const nameStatus = lines(env.STATUS_PATH)
  .map((line) => {
    const parts = line.split('\t');
    if (parts.length < 2) return null;
    const code = parts[0];
    if (!code) return null; // defensive: a row with an empty status column
    const kind = code[0]; // R092 → R
    if ((kind === 'R' || kind === 'C') && parts.length >= 3) {
      return { status: kind, old_path: parts[1], path: parts[2] };
    }
    return { status: kind, path: parts[1] };
  })
  .filter(Boolean);

// Commit bodies are NUL-separated (git log --format=%B%x00). The subject is the
// first line of each body.
const commitBodies = readMaybe(env.COMMITS_PATH)
  .split('\0')
  .map((b) => b.trim())
  .filter((b) => b.length > 0);
const commitSubjects = commitBodies.map((b) => b.split(/\r?\n/)[0].trim());

// ── Scanner identity + report summary (best-effort) ──────────────────────────
let scanner = {
  tool: null,
  version: null,
  release_tag: val('RELEASE_TAG') ?? null,
  schema_version: null,
  mode: null,
};
let reportSummary = null;
const reportText = readMaybe(env.REPORT_PATH);
if (reportText) {
  try {
    const report = JSON.parse(reportText);
    scanner = {
      tool: report?.generator?.tool ?? null,
      version: report?.generator?.version ?? null,
      release_tag: val('RELEASE_TAG') ?? null,
      schema_version: report?.schema_version ?? null,
      mode: report?.mode ?? null,
    };
    const scope = report?.pr_scope ?? {};
    reportSummary = {
      changed_files: Array.isArray(scope.changed_files) ? scope.changed_files.length : null,
      affected_roots: Array.isArray(scope.affected_roots) ? scope.affected_roots.length : null,
      unreachable_changes: Array.isArray(scope.unreachable_changes) ? scope.unreachable_changes.length : null,
      code_suggestions: Array.isArray(report?.pr_review?.code_suggestions)
        ? report.pr_review.code_suggestions.length
        : null,
    };
  } catch {
    // Malformed report → leave scanner identity / summary null. Non-fatal.
  }
}

// ── Workflow-run pointers ────────────────────────────────────────────────────
const server = val('GITHUB_SERVER_URL') ?? 'https://github.com';
const repo = val('GITHUB_REPOSITORY');
const runId = val('GITHUB_RUN_ID');
const runUrl = repo && runId ? `${server}/${repo}/actions/runs/${runId}` : null;

const context = {
  schema: 'drift.pr-scan-context/v1',
  generated_for: {
    repository: repo ?? null,
    run_id: runId ?? null,
    run_attempt: val('GITHUB_RUN_ATTEMPT') ?? null,
    run_url: runUrl,
    workflow: val('GITHUB_WORKFLOW') ?? null,
    event_name: val('GITHUB_EVENT_NAME') ?? null,
    server_url: server,
  },
  pr,
  scanner,
  diff: {
    changed_file_count: changedFiles.length,
    changed_files: changedFiles,
    stats,
    name_status: nameStatus,
    commit_count: commitSubjects.length,
    commit_subjects: commitSubjects,
  },
  report_summary: reportSummary,
};

try {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(context, null, 2) + '\n');
  console.log(
    `📎 wrote scan context → ${out} (${changedFiles.length} changed file(s), ${commitSubjects.length} commit(s))`,
  );
} catch (err) {
  // Last-ditch: still emit a minimal valid file so the upload has something and
  // the link can render. NEVER fail the step on our own write error.
  try {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ schema: 'drift.pr-scan-context/v1', error: String(err) }, null, 2) + '\n');
  } catch {
    /* give up silently — the gate checks file existence and skips the link */
  }
  console.log(`::warning::build-scan-context: wrote minimal context after error: ${String(err)}`);
}
