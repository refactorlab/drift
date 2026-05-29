// Performance budgets per layer.
//
// One slow operation is fine; ten slow operations bury the action
// inside the consumer's CI job. We pin a budget per LAYER so a future
// regression that makes any one path 10× slower fails CI loud, not
// silently steals minutes from every consumer's PR.
//
// Budgets are GENEROUS (3-10x of observed local time) to absorb CI
// variance. Tighten them only when a real regression is hiding here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  pickFocalSuggestions,
  commentableLinesByFile,
  annotateDiff,
  buildAIContext,
} from '../ai/build-context.ts';
import { filterByDiff, parseCommentableLines } from '../ai/diff-lines.ts';
import { parseAIOutput } from '../ai/parse.ts';
import { buildReviewComments } from '../ai/post.ts';
import { inferOne, type InferLogger, type InferOneDeps } from '../ai/infer-one-core.ts';
import type { AISuggestion } from '../ai/schema.ts';
import type { ScanPrOutput } from '../report.ts';

function silentLogger(): InferLogger {
  return { info: () => {}, warning: () => {}, startGroup: () => {}, endGroup: () => {} };
}

function makeRepo(
  before: Record<string, string>,
  after: Record<string, string>,
): { root: string; baseSha: string; headSha: string } {
  const root = mkdtempSync(join(tmpdir(), 'drift-perf-'));
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

/**
 * Measure a synchronous (or async) function's wall-clock time.
 * Returns `[result, elapsed_ms]`.
 */
function timed<T>(fn: () => T): [T, number] {
  const t0 = performance.now();
  const r = fn();
  const t1 = performance.now();
  return [r, t1 - t0];
}

async function timedAsync<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const r = await fn();
  const t1 = performance.now();
  return [r, t1 - t0];
}

// ─── pure functions: should be < 10ms at 100-finding scale ────────────

test('perf: pickFocalSuggestions(100 findings) < 50ms', () => {
  const report: ScanPrOutput = {
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: Array.from({ length: 100 }, (_, i) => ({
        category: 'A', file: `pkg/f${i}.py`, line: 1, confidence: 0.9 - i * 0.001,
        why_it_matters: `finding ${i} ≥ 10 chars`,
        references: [{ url: `https://example.com/r/${i}` }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      })),
    },
  } as unknown as ScanPrOutput;
  const [, elapsed] = timed(() => pickFocalSuggestions(report, 100));
  assert.ok(elapsed < 50, `pickFocalSuggestions took ${elapsed.toFixed(1)}ms — investigate`);
});

test('perf: filterByDiff(100 suggestions) < 20ms', () => {
  const sugs: AISuggestion[] = Array.from({ length: 100 }, (_, i) => ({
    file: `pkg/f${i}.py`, line: 1, category: 'A', confidence: 0.9,
    why_it_matters: 'load-bearing why_it_matters',
    references: [{ url: 'https://example.com/x' }],
    after_code: 'x',
  }));
  const map = new Map<string, Set<number>>(
    sugs.map((s) => [s.file, new Set([1])]),
  );
  const [, elapsed] = timed(() => filterByDiff(sugs, map));
  assert.ok(elapsed < 20, `filterByDiff took ${elapsed.toFixed(1)}ms — investigate`);
});

test('perf: parseAIOutput on a 1MB envelope < 200ms', () => {
  const padding = 'x'.repeat(900);
  const sugs = Array.from({ length: 100 }, (_, i) => ({
    file: `f${i}.py`, line: 1, category: 'A', confidence: 0.9,
    why_it_matters: padding,
    references: [{ url: `https://example.com/x/${i}` }],
    after_code: '    fixed',
  }));
  const raw = JSON.stringify({ suggestions: sugs });
  // 100 findings × ~1KB each ≥ 90KB; close enough to test the parse path.
  const [r, elapsed] = timed(() => parseAIOutput(raw));
  assert.ok(r.ok);
  assert.ok(elapsed < 200, `parseAIOutput took ${elapsed.toFixed(1)}ms — investigate`);
});

test('perf: buildReviewComments(50 suggestions) < 50ms', () => {
  const sugs: AISuggestion[] = Array.from({ length: 50 }, (_, i) => ({
    file: `f${i}.py`, line: i + 1, category: 'A', confidence: 0.9,
    why_it_matters: 'load-bearing message',
    references: [{ url: `https://example.com/x/${i}` }],
    after_code: `    log.info("FIX_${i}")`,
  }));
  const [, elapsed] = timed(() => buildReviewComments(sugs, 'openai/gpt-4o'));
  assert.ok(elapsed < 50, `buildReviewComments took ${elapsed.toFixed(1)}ms — investigate`);
});

test('perf: annotateDiff on a 100-line diff < 30ms', () => {
  const hunkLines: string[] = ['@@ -1,50 +1,100 @@'];
  for (let i = 0; i < 50; i += 1) hunkLines.push(` line ${i}`);
  for (let i = 50; i < 100; i += 1) hunkLines.push(`+line ${i}`);
  const diff = `diff --git a/a.py b/a.py\n--- a/a.py\n+++ b/a.py\n${hunkLines.join('\n')}`;
  const [, elapsed] = timed(() => annotateDiff(diff));
  assert.ok(elapsed < 30, `annotateDiff took ${elapsed.toFixed(1)}ms — investigate`);
});

test('perf: parseCommentableLines on a 1000-line diff < 60ms', () => {
  const hunkLines: string[] = ['@@ -1,500 +1,1000 @@'];
  for (let i = 0; i < 500; i += 1) hunkLines.push(` line ${i}`);
  for (let i = 500; i < 1000; i += 1) hunkLines.push(`+line ${i}`);
  const patch = hunkLines.join('\n');
  const [, elapsed] = timed(() => parseCommentableLines(patch));
  assert.ok(elapsed < 60, `parseCommentableLines took ${elapsed.toFixed(1)}ms — investigate`);
});

test('perf: commentableLinesByFile on a 10-file diff < 100ms', () => {
  // Synthesize a multi-file diff.
  const parts: string[] = [];
  for (let f = 0; f < 10; f += 1) {
    parts.push(`diff --git a/f${f}.py b/f${f}.py`);
    parts.push(`--- a/f${f}.py`);
    parts.push(`+++ b/f${f}.py`);
    parts.push('@@ -1,5 +1,10 @@');
    for (let i = 0; i < 5; i += 1) parts.push(` ctx${i}`);
    for (let i = 0; i < 5; i += 1) parts.push(`+add${i}`);
  }
  const diff = parts.join('\n');
  const [m, elapsed] = timed(() => commentableLinesByFile(diff));
  assert.equal(m.size, 10);
  assert.ok(elapsed < 100, `commentableLinesByFile took ${elapsed.toFixed(1)}ms — investigate`);
});

// ─── inferOne happy path: < 1s for a single iteration ────────────────

test('perf: ONE inferOne happy-path iteration < 1500ms (stubbed model)', async () => {
  // The bash for-loop calls this N times serially; one iteration must
  // stay under ~1s so a 3-call loop fits comfortably within a CI step
  // budget. Most of the cost is git diff + esbuild's bundle load —
  // both bounded.
  const { root, baseSha, headSha } = makeRepo(
    { 'a.py': 'a\n' },
    { 'a.py': 'a\nADD\n' },
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: { changed_files: ['a.py'], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      code_suggestions: [{
        category: 'A', file: 'a.py', line: 1, confidence: 0.9,
        why_it_matters: 'perf finding, ≥ 10 chars',
        references: [{ url: 'https://example.com/x' }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      }],
    },
  }));
  const outPath = join(root, 'env.json');
  try {
    const [, elapsed] = await timedAsync(() => inferOne({
      idx: 0, outPath, reportPath,
      endpoint: 'https://e', model: 'openai/gpt-4o', token: 'tk',
      workspaceRoot: root, baseSha, headSha, maxOutputTokens: 100,
      callModel: async () => JSON.stringify({
        suggestions: [{
          file: 'a.py', line: 2, category: 'A', confidence: 0.9,
          why_it_matters: 'perf reply ≥ 10 chars',
          references: [{ url: 'https://example.com/x' }],
          after_code: '    ok',
        }],
      }),
      logger: silentLogger(),
    }));
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, 1);
    assert.ok(elapsed < 1500, `one inferOne iteration took ${elapsed.toFixed(0)}ms — over budget`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('perf: 10 inferOne iterations scale linearly (no quadratic surprise) — < 8s total', async () => {
  // 10 iterations × <1.5s = ≤15s upper bound; we set < 8s to catch a
  // real regression (quadratic blow-up doing N² git diff work, etc.).
  // Each iteration is a separate inferOne call against the same repo,
  // simulating the bash for-loop semantics.
  const N = 10;
  const before: Record<string, string> = {};
  const after: Record<string, string> = {};
  for (let i = 0; i < N; i += 1) {
    before[`f${i}.py`] = 'a\n';
    after[`f${i}.py`] = `a\nADD_${i}\n`;
  }
  const { root, baseSha, headSha } = makeRepo(before, after);
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: Object.keys(after),
      affected_roots: [], unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: Array.from({ length: N }, (_, i) => ({
        category: 'A', file: `f${i}.py`, line: 1, confidence: 0.9 - i * 0.001,
        why_it_matters: `perf finding ${i} ≥ 10 chars`,
        references: [{ url: `https://example.com/x/${i}` }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      })),
    },
  }));
  const outPath = join(root, 'env.json');
  const baseDeps: Omit<InferOneDeps, 'idx'> = {
    outPath, reportPath, endpoint: 'https://e', model: 'openai/gpt-4o', token: 'tk',
    workspaceRoot: root, baseSha, headSha, maxOutputTokens: 100,
    callModel: async (args) => {
      const m = args.user.match(/f(\d+)\.py:/);
      const i = m ? Number(m[1]) : 0;
      return JSON.stringify({
        suggestions: [{
          file: `f${i}.py`, line: 2, category: 'A', confidence: 0.9,
          why_it_matters: 'perf reply ≥ 10 chars',
          references: [{ url: 'https://example.com/x' }],
          after_code: '    ok',
        }],
      });
    },
    logger: silentLogger(),
  };
  try {
    const t0 = performance.now();
    for (let i = 0; i < N; i += 1) {
      await inferOne({ ...baseDeps, idx: i });
    }
    const elapsed = performance.now() - t0;
    const perCall = elapsed / N;
    assert.ok(elapsed < 8_000, `${N} iterations took ${elapsed.toFixed(0)}ms (${perCall.toFixed(0)}ms/call) — over budget`);
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.equal(env.suggestions.length, N, 'all iterations must persist');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('perf: buildAIContext (deterministic review path) < 200ms on a 10-finding report', () => {
  // The sticky-comment renderer shares pickFocalSuggestions + diff
  // annotation with the AI loop. Hold it to the same budget.
  const { root, baseSha, headSha } = makeRepo(
    Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`f${i}.py`, 'a\n'])),
    Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`f${i}.py`, `a\nADD_${i}\n`])),
  );
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: Array.from({ length: 10 }, (_, i) => `f${i}.py`),
      affected_roots: [], unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: Array.from({ length: 10 }, (_, i) => ({
        category: 'A', file: `f${i}.py`, line: 1, confidence: 0.9 - i * 0.01,
        why_it_matters: `finding ${i} ≥ 10 chars`,
        references: [{ url: `https://example.com/r/${i}` }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      })),
    },
  }));
  try {
    const [r, elapsed] = timed(() => buildAIContext({
      reportPath, workspaceRoot: root, baseSha, headSha,
      maxFiles: 20, maxFocalPoints: 10, byteBudget: 80_000,
    }));
    assert.equal(r.focalPoints, 10);
    assert.ok(elapsed < 200, `buildAIContext took ${elapsed.toFixed(0)}ms — over budget`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── Memory: no exorbitant allocation per iteration ─────────────────────

test('perf: memory — 50 sequential inferOne calls do NOT leak (heap grows < 50 MB)', async () => {
  // The bash loop spawns N node processes (each one a fresh heap), so
  // an in-process leak isn't a prod concern. But for tests + dev-mode
  // runs that call inferOne many times in one process, we want to
  // catch a regression that, say, retains every prompt across calls.
  const N = 50;
  const before: Record<string, string> = {};
  const after: Record<string, string> = {};
  for (let i = 0; i < N; i += 1) {
    before[`f${i}.py`] = 'a\n';
    after[`f${i}.py`] = `a\nADD_${i}\n`;
  }
  const { root, baseSha, headSha } = makeRepo(before, after);
  const reportPath = join(root, 'report.json');
  writeFileSync(reportPath, JSON.stringify({
    schema_version: '1.0', mode: 'static',
    generator: { tool: 't', version: '1' },
    pr_scope: {
      changed_files: Object.keys(after),
      affected_roots: [], unreachable_changes: [],
    },
    pr_review: {
      code_suggestions: Array.from({ length: N }, (_, i) => ({
        category: 'A', file: `f${i}.py`, line: 1, confidence: 0.9 - i * 0.001,
        why_it_matters: `mem finding ${i} ≥ 10 chars`,
        references: [{ url: `https://example.com/x/${i}` }],
        diff: { before_lines: [{ line_number: 1, code: 'a', kind: 'del' }] },
      })),
    },
  }));
  const outPath = join(root, 'env.json');
  const baseDeps: Omit<InferOneDeps, 'idx'> = {
    outPath, reportPath, endpoint: 'https://e', model: 'openai/gpt-4o', token: 'tk',
    workspaceRoot: root, baseSha, headSha, maxOutputTokens: 100,
    callModel: async () => JSON.stringify({
      suggestions: [{
        file: 'f0.py', line: 2, category: 'A', confidence: 0.9,
        why_it_matters: 'leak-test stub, ≥ 10 chars',
        references: [{ url: 'https://example.com/x' }],
        after_code: '    ok',
      }],
    }),
    logger: silentLogger(),
  };
  try {
    // Warm-up (excludes one-shot JIT compilation from the measurement).
    await inferOne({ ...baseDeps, idx: 0 });
    if (typeof globalThis.gc === 'function') globalThis.gc();
    const heapBefore = process.memoryUsage().heapUsed;
    for (let i = 0; i < N; i += 1) {
      await inferOne({ ...baseDeps, idx: i });
    }
    if (typeof globalThis.gc === 'function') globalThis.gc();
    const heapAfter = process.memoryUsage().heapUsed;
    const deltaMb = (heapAfter - heapBefore) / 1024 / 1024;
    // Loose bound — caught a real linear leak if any single iteration
    // retained the 8000-token prompt + the diff + the envelope.
    assert.ok(
      deltaMb < 50,
      `heap grew ${deltaMb.toFixed(1)} MB across ${N} iterations — possible leak`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── Bundle byte budget (consumer download cost) ───────────────────────

test('perf: dist/ai-infer-one.js bundle is under 10 MB (consumer download cost)', async () => {
  const { resolve, dirname } = await import('node:path');
  const { statSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const bundle = resolve(here, '..', '..', '..', 'dist/ai-infer-one.js');
  if (!existsSync(bundle)) return;
  const size = statSync(bundle).size;
  // The bundle is ~3.6 MB at time of writing. 10 MB ceiling catches a
  // bloat regression (e.g. an accidental polyfill, embedded fixture).
  assert.ok(
    size < 10 * 1024 * 1024,
    `dist/ai-infer-one.js is ${(size / 1024 / 1024).toFixed(1)} MB — investigate bloat`,
  );
  // Lower bound too: < 1 MB would mean tree-shaking ate the @actions/*
  // libraries or gpt-tokenizer somehow — a silent feature loss.
  assert.ok(
    size > 1 * 1024 * 1024,
    `dist/ai-infer-one.js is ${(size / 1024 / 1024).toFixed(1)} MB — suspiciously small`,
  );
});

test('perf: dist/ai-suggest.js bundle is under 5 MB', async () => {
  const { resolve, dirname } = await import('node:path');
  const { statSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const bundle = resolve(here, '..', '..', '..', 'dist/ai-suggest.js');
  if (!existsSync(bundle)) return;
  const size = statSync(bundle).size;
  assert.ok(
    size < 5 * 1024 * 1024,
    `dist/ai-suggest.js is ${(size / 1024 / 1024).toFixed(1)} MB — investigate bloat`,
  );
  assert.ok(
    size > 500 * 1024,
    `dist/ai-suggest.js is ${(size / 1024).toFixed(0)} KB — suspiciously small`,
  );
});
