// build-scan-context.mjs: the zero-dep Node helper that assembles
// pr-scan-context.json (PR identity + exact diff scope + scanner identity +
// run pointers) for upload alongside the raw scanner report. Runs the script
// as the action does — bare `node` over env vars + on-disk diff files — and
// asserts the emitted JSON. Must never throw: a missing report or missing diff
// file degrades to nulls / empty arrays, never a crash.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, '..', '..', 'scripts', 'build-scan-context.mjs');

/** Run build-scan-context.mjs with a controlled env; return the parsed JSON. */
function run(env: Record<string, string>): { json: any; status: number; outPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'drift-ctx-'));
  const outPath = join(dir, 'pr-scan-context.json');
  // Controlled env: only PATH from the parent (so `node` resolves) + the
  // explicit test vars. This isolates the test from any DRIFT_*/GITHUB_* that
  // the surrounding CI run might have exported.
  const res = spawnSync('node', [SCRIPT], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', SCAN_CONTEXT_OUT: outPath, ...env },
  });
  const json = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : null;
  return { json, status: res.status ?? -1, outPath };
}

/** Write the four diff input files + a report into a temp dir; return their paths. */
function fixtures(): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'drift-fix-'));
  const changed = join(dir, 'changed.txt');
  const stats = join(dir, 'stats.tsv');
  const status = join(dir, 'status.tsv');
  const commits = join(dir, 'commits.txt');
  const report = join(dir, 'drift-report.json');
  writeFileSync(changed, 'src/a.ts\nsrc/b.ts\nnew.ts\n');
  // numstat: additions<TAB>deletions<TAB>path; binary rows carry `-`.
  writeFileSync(stats, '10\t2\tsrc/a.ts\n-\t-\tassets/logo.png\n');
  // name-status: plain codes + a rename row (R<sim>\told\tnew).
  writeFileSync(status, 'M\tsrc/a.ts\nA\tsrc/b.ts\nR096\told.ts\tnew.ts\n');
  // NUL-separated commit bodies (git log --format=%B%x00).
  writeFileSync(commits, 'feat: add thing\nbody detail\0fix: a bug\0');
  writeFileSync(
    report,
    JSON.stringify({
      schema_version: '1.2',
      mode: 'static',
      generator: { tool: 'drift-static-profiler', version: '0.6.0' },
      pr_scope: { changed_files: ['a', 'b', 'c'], affected_roots: ['r1', 'r2'], unreachable_changes: ['u'] },
      pr_review: { code_suggestions: [1, 2, 3, 4] },
    }),
  );
  return {
    CHANGED_PATH: changed,
    STATS_PATH: stats,
    STATUS_PATH: status,
    COMMITS_PATH: commits,
    REPORT_PATH: report,
  };
}

const PR_ENV = {
  DRIFT_PR_NUMBER: '42',
  DRIFT_PR_TITLE: 'feat: ship the thing',
  DRIFT_PR_BODY: 'line one\nline two',
  DRIFT_PR_AUTHOR: 'octocat',
  DRIFT_PR_HTML_URL: 'https://github.com/acme/shop/pull/42',
  DRIFT_BASE_REF: 'main',
  DRIFT_HEAD_REF: 'feat/thing',
  DRIFT_BASE_SHA: 'base1234',
  DRIFT_HEAD_SHA: 'head5678',
  MERGE_BASE_SHA: 'mergebase90',
  RELEASE_TAG: 'drift-lab-v0.6.0',
  GITHUB_REPOSITORY: 'acme/shop',
  GITHUB_RUN_ID: '999',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_SERVER_URL: 'https://github.com',
  GITHUB_WORKFLOW: 'Drift',
  GITHUB_EVENT_NAME: 'pull_request',
};

test('build-scan-context: full fixtures → complete, well-formed context', () => {
  const { json, status } = run({ ...PR_ENV, ...fixtures() });
  assert.equal(status, 0, 'exits 0');
  assert.equal(json.schema, 'drift.pr-scan-context/v1');

  // PR identity
  assert.equal(json.pr.number, 42, 'PR number coerced to int');
  assert.equal(json.pr.title, 'feat: ship the thing');
  assert.equal(json.pr.body, 'line one\nline two');
  assert.equal(json.pr.author, 'octocat');
  assert.equal(json.pr.base_sha, 'base1234');
  assert.equal(json.pr.head_sha, 'head5678');
  assert.equal(json.pr.merge_base_sha, 'mergebase90', 'merge-base distinct from base tip');

  // Diff scope
  assert.equal(json.diff.changed_file_count, 3);
  assert.deepEqual(json.diff.changed_files, ['src/a.ts', 'src/b.ts', 'new.ts']);
  assert.deepEqual(
    json.diff.stats.find((s: any) => s.path === 'src/a.ts'),
    { path: 'src/a.ts', additions: 10, deletions: 2 },
  );
  const binary = json.diff.stats.find((s: any) => s.path === 'assets/logo.png');
  assert.equal(binary.additions, null, 'binary numstat `-` → null');
  assert.equal(binary.deletions, null);
  const rename = json.diff.name_status.find((s: any) => s.status === 'R');
  assert.deepEqual(rename, { status: 'R', old_path: 'old.ts', path: 'new.ts' });
  assert.equal(json.diff.commit_count, 2);
  assert.deepEqual(json.diff.commit_subjects, ['feat: add thing', 'fix: a bug'], 'subject = first line of each commit');

  // Scanner identity + report summary
  assert.equal(json.scanner.tool, 'drift-static-profiler');
  assert.equal(json.scanner.version, '0.6.0');
  assert.equal(json.scanner.release_tag, 'drift-lab-v0.6.0');
  assert.equal(json.scanner.schema_version, '1.2');
  assert.equal(json.report_summary.code_suggestions, 4);
  assert.equal(json.report_summary.changed_files, 3);
  assert.equal(json.report_summary.unreachable_changes, 1);

  // Run pointers
  assert.equal(json.generated_for.repository, 'acme/shop');
  assert.equal(json.generated_for.run_url, 'https://github.com/acme/shop/actions/runs/999');
});

test('build-scan-context: missing report → scanner/report null, still valid JSON', () => {
  const fx = fixtures();
  const { json, status } = run({ ...PR_ENV, ...fx, REPORT_PATH: '/no/such/report.json' });
  assert.equal(status, 0);
  assert.equal(json.scanner.tool, null, 'no report → tool null');
  assert.equal(json.scanner.release_tag, 'drift-lab-v0.6.0', 'release tag still comes from env');
  assert.equal(json.report_summary, null);
  // Diff scope is independent of the report — still fully populated.
  assert.equal(json.diff.changed_file_count, 3);
});

test('build-scan-context: missing diff files → empty arrays, never throws', () => {
  const { json, status } = run({
    ...PR_ENV,
    CHANGED_PATH: '/no/changed.txt',
    STATS_PATH: '/no/stats.tsv',
    STATUS_PATH: '/no/status.tsv',
    COMMITS_PATH: '/no/commits.txt',
    REPORT_PATH: '/no/report.json',
  });
  assert.equal(status, 0);
  assert.equal(json.diff.changed_file_count, 0);
  assert.deepEqual(json.diff.changed_files, []);
  assert.deepEqual(json.diff.stats, []);
  assert.equal(json.diff.commit_count, 0);
  assert.equal(json.pr.number, 42, 'PR identity still present from env');
});

test('build-scan-context: non-numeric PR number → null (not NaN)', () => {
  const { json } = run({ ...PR_ENV, DRIFT_PR_NUMBER: 'not-a-number' });
  assert.equal(json.pr.number, null);
});

/** Write a one-off text file in a fresh temp dir; return its path. */
function tmpFile(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'drift-one-'));
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

test('build-scan-context: numstat rename paths are normalized to the clean NEW path', () => {
  // git diff --numstat --find-renames emits a DISPLAY path for renames: the
  // brace form (shared prefix/suffix) and the arrow form (no shared affix).
  // stats[].path must resolve to the clean new path so it keys to changed_files.
  const stats = tmpFile(
    'stats.tsv',
    [
      '3\t1\tsrc/{old => new}/mod.ts', // brace form → src/new/mod.ts
      '5\t0\tlib/a.ts => lib/b.ts', // arrow form → lib/b.ts
      '7\t2\tsrc/{ => added}/x.ts', // added-segment brace → src/added/x.ts
      '2\t2\tplain/file.ts', // non-rename passes through
    ].join('\n') + '\n',
  );
  const { json } = run({ ...PR_ENV, STATS_PATH: stats, REPORT_PATH: '/no/report.json' });
  const paths = json.diff.stats.map((s: any) => s.path);
  assert.deepEqual(paths, ['src/new/mod.ts', 'lib/b.ts', 'src/added/x.ts', 'plain/file.ts']);
  assert.equal(json.diff.stats[0].additions, 3, 'LOC still parsed alongside the cleaned path');
});

test('build-scan-context: PR title/body preserve whitespace (verbatim handoff fidelity)', () => {
  const body = '    indented code line\n\ntrailing spaces here   ';
  const { json } = run({
    ...PR_ENV,
    DRIFT_PR_TITLE: '  spaced title  ',
    DRIFT_PR_BODY: body,
    REPORT_PATH: '/no/report.json',
  });
  assert.equal(json.pr.title, '  spaced title  ', 'title whitespace preserved (not trimmed)');
  assert.equal(json.pr.body, body, 'body indentation/trailing whitespace preserved verbatim');
});

test('build-scan-context: whitespace-only title/body → null (not an empty string)', () => {
  const { json } = run({ ...PR_ENV, DRIFT_PR_TITLE: '   ', DRIFT_PR_BODY: '\n\n', REPORT_PATH: '/no/report.json' });
  assert.equal(json.pr.title, null);
  assert.equal(json.pr.body, null);
});

test('build-scan-context: name-status row with empty status column is dropped (no status:undefined)', () => {
  const status = tmpFile('status.tsv', 'M\tsrc/a.ts\n\tsrc/orphan.ts\nA\tsrc/b.ts\n');
  const { json } = run({ ...PR_ENV, STATUS_PATH: status, REPORT_PATH: '/no/report.json' });
  assert.ok(
    json.diff.name_status.every((s: any) => typeof s.status === 'string' && s.status.length > 0),
    'no entry carries an empty/undefined status',
  );
  assert.deepEqual(
    json.diff.name_status.map((s: any) => s.path),
    ['src/a.ts', 'src/b.ts'],
    'the malformed empty-status row is skipped',
  );
});

test('build-scan-context: SCAN_CONTEXT_OUT missing → exit 2, no crash', () => {
  const res = spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } });
  assert.equal(res.status, 2, 'hard-requires an output path');
});
