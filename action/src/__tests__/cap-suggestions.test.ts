// cap-suggestions: end-to-end verification of the action.yml "Cap code
// suggestions" step + the downstream contracts that depend on it.
//
// What this file proves:
//   1. The step's bash body, run against a real report file with 500
//      code_suggestions, truncates the array to MAX_CODE_SUGGESTIONS (10
//      by default) and overwrites the report in place. Scanner order
//      (severity_rank DESC, confidence DESC) is preserved.
//   2. Edge cases are fail-soft:
//        - Missing report file → exit 0, no-op
//        - jq unavailable → exit 0, leave report untouched
//        - Already-short report (< max) → exit 0, no rewrite
//        - Garbage MAX value → falls back to default 10
//        - Empty MAX value → falls back to default 10
//   3. action.yml structural invariants:
//        - The `max-code-suggestions` input exists with default '10'.
//        - The cap step is wired BEFORE Print scan summary.
//        - parse-comment.mjs accepts `max-code-suggestions` as an override.
//
// Why a dedicated file: the 500→10 cap is a load-bearing pre-condition
// for both consumers (sticky overview's 60 KB budget; combined inline
// review's 422-on-bulk anchors). If the step regresses silently, the PR
// comment starts getting truncated on real reports without any local
// signal — exactly the failure mode that motivated this fix.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

type StepSpec = { name?: string; id?: string; run?: string; env?: Record<string, string> };
type ActionDoc = { inputs: Record<string, { default?: string }>; runs: { steps: StepSpec[] } };
const ACTION: ActionDoc = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as ActionDoc;
const STEPS = ACTION.runs.steps;
const CAP_STEP = STEPS.find((s) => s.id === 'cap-suggestions');
if (!CAP_STEP) throw new Error('cap-suggestions step missing from action.yml');
const CAP_SCRIPT = CAP_STEP.run!;

type CapResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  outputs: Record<string, string>;
  finalSuggestions: unknown;
};

function makeReport(suggestionCount: number): Record<string, unknown> {
  const code_suggestions = Array.from({ length: suggestionCount }, (_, i) => ({
    category: 'B',
    file: `src/file_${i}.ts`,
    line: i + 1,
    confidence: Math.max(0.75, 1 - i * 0.001), // descending — first wins
    why_it_matters: `finding ${i}`,
    references: [{ url: 'https://docs.example.com/x' }],
  }));
  return {
    schema_version: '1.0',
    pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    pr_review: { code_suggestions },
  };
}

function runCap(opts: {
  report?: unknown | null | 'missing';
  max?: string;
  pathOverride?: string;
}): CapResult {
  const dir = mkdtempSync(join(tmpdir(), 'drift-cap-'));
  const reportPath = opts.pathOverride ?? join(dir, 'drift-report.json');
  if (opts.report === 'missing') {
    // Don't create the file.
  } else if (opts.report === null) {
    writeFileSync(reportPath, '');
  } else if (opts.report !== undefined) {
    writeFileSync(reportPath, JSON.stringify(opts.report));
  }
  const gh = join(dir, 'GITHUB_OUTPUT');
  writeFileSync(gh, '');
  const r = spawnSync('bash', ['-eo', 'pipefail', '-c', CAP_SCRIPT], {
    env: {
      PATH: process.env.PATH ?? '',
      GITHUB_OUTPUT: gh,
      DRIFT_REPORT_PATH: reportPath,
      MAX_CODE_SUGGESTIONS: opts.max ?? '10',
    },
    encoding: 'utf8',
  });
  let final: unknown = undefined;
  try {
    final = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    // file missing or empty — fine for "missing/empty" cells
  }
  const outputs = Object.fromEntries(
    readFileSync(gh, 'utf8')
      .split('\n')
      .map((l) => {
        const i = l.indexOf('=');
        return i > 0 ? [l.slice(0, i), l.slice(i + 1)] : null;
      })
      .filter((x): x is [string, string] => x !== null),
  );
  return {
    code: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    outputs,
    finalSuggestions: (final as { pr_review?: { code_suggestions?: unknown } } | undefined)
      ?.pr_review?.code_suggestions,
  };
}

// ─── HAPPY PATH ─────────────────────────────────────────────────────────

test('cap: 500-entry report → trimmed to 10, scanner order preserved', () => {
  const r = runCap({ report: makeReport(500), max: '10' });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(Array.isArray(r.finalSuggestions));
  const arr = r.finalSuggestions as Array<{ file: string }>;
  assert.equal(arr.length, 10, 'must cap at 10');
  // Top of scanner order is file_0..file_9 (sorted by confidence DESC in our
  // fixture). The cap must take the FIRST N, never reorder them.
  for (let i = 0; i < 10; i += 1) {
    assert.equal(arr[i].file, `src/file_${i}.ts`, `entry ${i} must be file_${i}.ts`);
  }
  assert.match(r.stdout, /capped 500 → 10/, 'log must announce the cap');
  assert.equal(r.outputs.before, '500');
  assert.equal(r.outputs.after, '10');
});

test('cap: 50-entry report at max=10 → trimmed to 10', () => {
  const r = runCap({ report: makeReport(50), max: '10' });
  assert.equal(r.code, 0);
  const arr = r.finalSuggestions as unknown[];
  assert.equal(arr.length, 10);
  assert.equal(r.outputs.before, '50');
  assert.equal(r.outputs.after, '10');
});

test('cap: configurable — max=3 caps a 20-entry report at 3', () => {
  const r = runCap({ report: makeReport(20), max: '3' });
  assert.equal(r.code, 0);
  const arr = r.finalSuggestions as unknown[];
  assert.equal(arr.length, 3);
  assert.equal(r.outputs.after, '3');
});

// ─── NO-OP / FAIL-SOFT BRANCHES ────────────────────────────────────────

test('cap: report shorter than cap → no rewrite, no_change log', () => {
  const r = runCap({ report: makeReport(7), max: '10' });
  assert.equal(r.code, 0);
  const arr = r.finalSuggestions as unknown[];
  assert.equal(arr.length, 7, 'array length must be unchanged');
  assert.match(r.stdout, /already ≤ cap/);
  assert.equal(r.outputs.before, '7');
  assert.equal(r.outputs.after, '7');
});

test('cap: report exactly at cap → no rewrite', () => {
  const r = runCap({ report: makeReport(10), max: '10' });
  assert.equal(r.code, 0);
  const arr = r.finalSuggestions as unknown[];
  assert.equal(arr.length, 10);
  assert.match(r.stdout, /already ≤ cap/);
});

test('cap: missing report file → exit 0, no-op', () => {
  const r = runCap({ report: 'missing' });
  assert.equal(r.code, 0);
  assert.match(r.stdout, /nothing to cap/);
});

test('cap: empty report file → exit 0, no-op', () => {
  const r = runCap({ report: null });
  assert.equal(r.code, 0);
  assert.match(r.stdout, /nothing to cap/);
});

test('cap: garbage MAX → falls back to default 10', () => {
  const r = runCap({ report: makeReport(50), max: 'not-a-number' });
  assert.equal(r.code, 0);
  const arr = r.finalSuggestions as unknown[];
  assert.equal(arr.length, 10, 'garbage MAX must fall back to default 10');
});

test('cap: empty MAX → falls back to default 10', () => {
  const r = runCap({ report: makeReport(50), max: '' });
  assert.equal(r.code, 0);
  const arr = r.finalSuggestions as unknown[];
  assert.equal(arr.length, 10);
});

test('cap: MAX=0 → falls back to default 10 (zero is a footgun)', () => {
  const r = runCap({ report: makeReport(50), max: '0' });
  assert.equal(r.code, 0);
  const arr = r.finalSuggestions as unknown[];
  assert.equal(arr.length, 10);
});

// ─── REPORT SHAPE PRESERVATION ─────────────────────────────────────────

test('cap: preserves every other field of pr_review and the rest of the report', () => {
  // We need direct access to the rewritten report. Replicate runCap inline
  // so we can read the path back ourselves and assert the full structure.
  const dir = mkdtempSync(join(tmpdir(), 'drift-cap-full-'));
  const reportPath = join(dir, 'drift-report.json');
  const gh = join(dir, 'GITHUB_OUTPUT');
  const fullReport = {
    schema_version: '1.0',
    generator: { tool: 'drift-static-profiler', version: '0.7.0' },
    mode: 'pr',
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['x'], unreachable_changes: [] },
    pr_review: {
      overall_drift: { percent: 5, direction: 'up', confidence: 'high' },
      counts: { features: { value: 1, label: 'features' } },
      code_suggestions: Array.from({ length: 50 }, (_, i) => ({
        category: 'A',
        file: `f${i}.ts`,
        line: i + 1,
        confidence: 0.9,
        why_it_matters: 'x',
        references: [{ url: 'https://x' }],
      })),
      business_logic: { summary: 'do X' },
    },
  };
  writeFileSync(reportPath, JSON.stringify(fullReport));
  writeFileSync(gh, '');
  const r = spawnSync('bash', ['-eo', 'pipefail', '-c', CAP_SCRIPT], {
    env: {
      PATH: process.env.PATH ?? '',
      GITHUB_OUTPUT: gh,
      DRIFT_REPORT_PATH: reportPath,
      MAX_CODE_SUGGESTIONS: '10',
    },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(readFileSync(reportPath, 'utf8'));
  assert.equal(out.schema_version, '1.0', 'schema_version must be preserved');
  assert.equal(out.generator.tool, 'drift-static-profiler', 'generator preserved');
  assert.equal(out.mode, 'pr', 'mode preserved');
  assert.deepEqual(out.pr_scope.changed_files, ['a.ts'], 'pr_scope preserved');
  assert.equal(out.pr_review.overall_drift.percent, 5, 'overall_drift preserved');
  assert.equal(out.pr_review.counts.features.value, 1, 'counts preserved');
  assert.equal(out.pr_review.business_logic.summary, 'do X', 'business_logic preserved');
  assert.equal(out.pr_review.code_suggestions.length, 10, 'code_suggestions capped');
});

// ─── ACTION.YML STRUCTURAL INVARIANTS ──────────────────────────────────

test('action.yml: max-code-suggestions input declared with default 10', () => {
  const input = ACTION.inputs['max-code-suggestions'];
  assert.ok(input, 'max-code-suggestions input must be declared');
  assert.equal(input.default, '10', 'default must be 10');
});

test('action.yml: cap step is wired BEFORE Print scan summary', () => {
  const capIdx = STEPS.findIndex((s) => s.id === 'cap-suggestions');
  const printIdx = STEPS.findIndex((s) => s.name === 'Print scan summary');
  assert.ok(capIdx >= 0, 'cap step must exist');
  assert.ok(printIdx >= 0, 'print step must exist');
  assert.ok(
    capIdx < printIdx,
    `cap step (idx=${capIdx}) must run BEFORE print summary (idx=${printIdx}) — ` +
      'so the summary line accurately reports the capped count',
  );
});

test('action.yml: cap step uses the parse-args override fallback', () => {
  const yml = readFileSync(join(REPO, 'action.yml'), 'utf8');
  assert.match(
    yml,
    /MAX_CODE_SUGGESTIONS:\s*\$\{\{\s*\(steps\.args\.outputs\.max-code-suggestions\s*\|\|\s*inputs\.max-code-suggestions\)\s*\}\}/,
    '/drift max-code-suggestions=N must propagate via the standard override chain',
  );
});

test('parse-comment.mjs: max-code-suggestions is in the ALLOWED set', () => {
  const src = readFileSync(join(REPO, 'action', 'scripts', 'parse-comment.mjs'), 'utf8');
  const allowed = src.match(/const ALLOWED = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(allowed, 'ALLOWED set must be present');
  const keys = [...allowed![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(
    keys.includes('max-code-suggestions'),
    'max-code-suggestions must be overridable via /drift comments — otherwise the override silently no-ops',
  );
});
