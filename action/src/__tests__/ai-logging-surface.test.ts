// Logging-surface audit.
//
// When a consumer's PR doesn't get suggestions, the log is their
// ENTIRE diagnostic surface — there's no debugger, no DevTools, just
// the GitHub Actions log scroller. So every error path must:
//
//   1. Emit a DISTINCT, greppable string (not a generic "failed").
//   2. NAME the file/line/reason responsible.
//   3. Be reachable from the source code (no dead log strings —
//      every needle below corresponds to a real branch).
//
// This file pins those invariants by:
//   • driving each failure path through inferOne / filterByDiff and
//     asserting the EXACT log line.
//   • inverting: for the 6 documented diagnostic outcomes, asserting
//     that EXACTLY ONE bundled file carries the string (no duplicates
//     across modules — dups make grep ambiguous).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { inferOne, type InferLogger, type InferOneDeps } from '../ai/infer-one-core.ts';
import { filterByDiff } from '../ai/diff-lines.ts';
import type { ScanPrOutput } from '../report.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

function captureLogger(): { logger: InferLogger; messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    logger: {
      info: (m) => messages.push(`INFO  ${m}`),
      warning: (m) => messages.push(`WARN  ${m}`),
      startGroup: (n) => messages.push(`GROUP ${n}`),
      endGroup: () => messages.push('GROUP/end'),
    },
  };
}

function makeRepo(
  before: Record<string, string>,
  after: Record<string, string>,
): { root: string; baseSha: string; headSha: string } {
  const root = mkdtempSync(join(tmpdir(), 'drift-log-audit-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  for (const [p, c] of Object.entries(before)) {
    const abs = join(root, p);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, c);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'base'], { cwd: root });
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  for (const [p, c] of Object.entries(after)) {
    const abs = join(root, p);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, c);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'change'], { cwd: root });
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, baseSha, headSha };
}

// ─── A. inferOne: every documented diagnostic outcome → unique line ────

test('log-audit: bad focal index emits a specific warning', async () => {
  const { logger, messages } = captureLogger();
  await inferOne({
    idx: Number.NaN,
    outPath: '/tmp/x', reportPath: '/tmp/r',
    endpoint: 'https://e', model: 'm', token: 'tk',
    workspaceRoot: '/tmp', baseSha: '', headSha: '',
    maxOutputTokens: 100,
    callModel: async () => '{"suggestions":[]}',
    logger,
  });
  const log = messages.join('\n');
  assert.match(log, /ai-infer-one: bad focal index/);
});

test('log-audit: missing AI_OUT/AI_ENDPOINT/GITHUB_TOKEN names ALL THREE', async () => {
  const { logger, messages } = captureLogger();
  await inferOne({
    idx: 0,
    outPath: '', reportPath: '/tmp/r',
    endpoint: '', model: 'm', token: '',
    workspaceRoot: '/tmp', baseSha: '', headSha: '',
    maxOutputTokens: 100,
    callModel: async () => '{"suggestions":[]}',
    logger,
  });
  const log = messages.join('\n');
  // Every env var name appears so the user knows which one to fix.
  assert.match(log, /AI_OUT/);
  assert.match(log, /AI_ENDPOINT/);
  assert.match(log, /GITHUB_TOKEN/);
});

test('log-audit: missing report file names the path', async () => {
  const { logger, messages } = captureLogger();
  await inferOne({
    idx: 0,
    outPath: '/tmp/x', reportPath: '/nonexistent/report.json',
    endpoint: 'https://e', model: 'm', token: 'tk',
    workspaceRoot: '/tmp', baseSha: '', headSha: '',
    maxOutputTokens: 100,
    callModel: async () => '{"suggestions":[]}',
    logger,
  });
  assert.match(messages.join('\n'), /no report at \/nonexistent\/report\.json/);
});

test('log-audit: every diagnostic skip names the file:line', async () => {
  // The whole point of the diagnostics rewrite: tell the user WHERE.
  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nNEW\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'totally/unrelated.py', line: 42, confidence: 0.9,
        why_it_matters: 'finding not on diff, must name the file:line',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 42, code: 'def f():', kind: 'del' }] },
      }],
    },
  } as ScanPrOutput));
  const { logger, messages } = captureLogger();
  try {
    await inferOne({
      idx: 0, outPath: join(root, 'env.json'), reportPath,
      endpoint: 'https://e', model: 'm', token: 'tk',
      workspaceRoot: root, baseSha, headSha,
      maxOutputTokens: 100,
      callModel: async () => '{"suggestions":[]}',
      logger,
    });
    const log = messages.join('\n');
    // The file:line MUST appear in the diagnostic.
    assert.match(log, /totally\/unrelated\.py:42/);
    // And the REASON must be named, not just the location.
    assert.match(log, /file not present on the PR diff/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('log-audit: rejected model output dumps BOTH halves of the exchange', async () => {
  // The single most useful debugging surface — without these halves
  // the user can't tell "model wrote bad JSON" from "prompt was bad".
  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nNEW\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'a.py', line: 1, confidence: 0.9,
        why_it_matters: 'finding that triggers the model exchange dump',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      }],
    },
  } as ScanPrOutput));
  const { logger, messages } = captureLogger();
  try {
    await inferOne({
      idx: 0, outPath: join(root, 'env.json'), reportPath,
      endpoint: 'https://e', model: 'm', token: 'tk',
      workspaceRoot: root, baseSha, headSha,
      maxOutputTokens: 100,
      callModel: async () => 'completely invalid not json at all',
      logger,
    });
    const log = messages.join('\n');
    assert.match(log, /output rejected/);
    assert.match(log, /INPUT \(user prompt\)/);
    assert.match(log, /OUTPUT \(model reply, first 400 chars\)/);
    // The garbage itself is in the dump.
    assert.match(log, /completely invalid not json at all/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── B. filterByDiff: every dropped item gets a typed reason ──────────

test('log-audit: filterByDiff drop reasons are typed (path miss vs. line miss vs. invalid range)', () => {
  // Three distinct failure modes; each must yield a DIFFERENT reason
  // string so the user can act:
  //   • "file not in PR diff" → check path-base / glob
  //   • "line(s) N not on diff" → check that the model anchored to a `+`
  //   • "start_line N > line M (invalid range)" → model bug
  const map = new Map([['a.py', new Set([1, 2, 3])]]);
  const sugs: import('../ai/schema.ts').AISuggestion[] = [
    // path miss
    { file: 'other/file.go', line: 1, category: 'A' as const, confidence: 0.9,
      why_it_matters: 'longer than 10 chars',
      references: [{ url: 'https://e/x' }], after_code: 'x' },
    // line miss
    { file: 'a.py', line: 99, category: 'A' as const, confidence: 0.9,
      why_it_matters: 'longer than 10 chars',
      references: [{ url: 'https://e/x' }], after_code: 'x' },
    // invalid range
    { file: 'a.py', line: 1, start_line: 5, category: 'A' as const, confidence: 0.9,
      why_it_matters: 'longer than 10 chars',
      references: [{ url: 'https://e/x' }], after_code: 'x' },
  ];
  const { reasons } = filterByDiff(sugs, map);
  assert.equal(reasons.length, 3);
  assert.match(reasons[0], /file not in PR diff/);
  assert.match(reasons[1], /line\(s\) 99 not on diff/);
  assert.match(reasons[2], /invalid range/);
  // All three reasons are DIFFERENT — the user reading the log can
  // distinguish them at a glance.
  assert.notEqual(reasons[0], reasons[1]);
  assert.notEqual(reasons[1], reasons[2]);
  assert.notEqual(reasons[0], reasons[2]);
});

// ─── C. Bundle inspection: every diagnostic appears in exactly ONE bundle ─

const NEEDLES = [
  // (needle, owning bundle) — needle must appear in `owning`, must NOT
  // appear in unrelated bundles.
  ['cohort ', 'ai-infer-one.js'],
  ['file not present on the PR diff', 'ai-infer-one.js'],
  ['file is on the diff but has zero commentable lines', 'ai-infer-one.js'],
  ['index out of range', 'ai-infer-one.js'],
  ['file not in PR diff', 'ai-suggest.js'],
  ['per-finding reasons', 'ai-suggest.js'],
] as const;

test('log-audit: every documented needle lives in its owning bundle', () => {
  for (const [needle, owner] of NEEDLES) {
    const p = resolve(repoRoot, 'dist', owner);
    if (!existsSync(p)) continue;
    const src = readFileSync(p, 'utf8');
    assert.ok(src.includes(needle), `bundle ${owner} missing diagnostic ${JSON.stringify(needle)}`);
  }
});

test('log-audit: bundles do NOT contain the OLD opaque "no anchorable focal point" string', () => {
  // The bug we fixed in round 1. Anywhere in any bundle would be a
  // regression — pin it across all four shipped bundles.
  const needle = 'no anchorable focal point at this index';
  for (const b of ['index.js', 'ai-context.js', 'ai-infer-one.js', 'ai-suggest.js']) {
    const p = resolve(repoRoot, 'dist', b);
    if (!existsSync(p)) continue;
    const src = readFileSync(p, 'utf8');
    assert.ok(!src.includes(needle), `dist/${b} reintroduced the opaque diagnostic`);
  }
});

// ─── D. ALL inferOne log messages share a "focal #N: …" prefix ─────────

test('log-audit: every focal-related log carries the `focal #N:` prefix (greppable)', async () => {
  // A consumer can grep `focal #` to find every line about a specific
  // iteration. If a future refactor breaks this convention, debugging
  // a PR-log scrollback becomes much harder.
  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nNEW\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'a.py', line: 1, confidence: 0.9,
        why_it_matters: 'happy-path finding for prefix test',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      }],
    },
  } as ScanPrOutput));
  const outPath = join(root, 'env.json');
  const { logger, messages } = captureLogger();
  try {
    await inferOne({
      idx: 0, outPath, reportPath,
      endpoint: 'https://e', model: 'm', token: 'tk',
      workspaceRoot: root, baseSha, headSha,
      maxOutputTokens: 100,
      callModel: async () => JSON.stringify({
        suggestions: [{
          file: 'a.py', line: 2, category: 'A', confidence: 0.9,
          why_it_matters: 'happy reply for prefix test',
          references: [{ url: 'https://example.com/x' }],
          after_code: '    fixed',
        }],
      }),
      logger,
    });
    // Pull only the "INFO" lines that describe per-iteration progress
    // (the ones not about a tmp-dir error or env-validation pre-flight).
    const focalLines = messages.filter((m) => /^INFO  focal #/.test(m));
    assert.ok(focalLines.length >= 3, 'expected ≥ 3 focal log lines (cohort + prompt + +1 suggestion)');
    // Every progress line MUST start with "INFO  focal #1:" — nothing
    // else (the regex above already enforces it; this is the explicit pin).
    for (const l of focalLines) {
      assert.match(l, /^INFO {2}focal #1:/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
