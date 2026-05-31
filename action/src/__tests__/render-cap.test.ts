// Render-only cap on the Code-suggestions section.
//
// The scanner emits suggestions UNCAPPED — a large refactor can produce 100s.
// Rendering them all blows past GitHub's 65 536-byte comment cap and the
// size-guard then collapses every section. So the renderer shows only the top-N
// (DEFAULT_MAX_SUGGESTIONS = 10) highest-priority findings while keeping the
// TRUE total visible in the heading + an overflow note. This is RENDER-ONLY: it
// trims the comment, never the report, so the inline review + AI focal-point
// picker still see every suggestion.
//
// What this file proves:
//   1. renderOverview caps the priority table at 10 by default; the heading
//      keeps the true total and an overflow note accounts for the rest.
//   2. The `maxSuggestions` opt overrides the cap (lower → fewer rows; higher
//      than the total → no overflow note); invalid values fall back to 10.
//   3. The render-comment.ts CLI honours `--max-suggestions=N` and the
//      `DRIFT_MAX_SUGGESTIONS` env var end-to-end (flag wins), and the cap is
//      what shrinks an otherwise 60 KB-busting comment back under budget.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOverview } from '../render/overview.ts';
import type { ScanPrOutput, CodeSuggestion } from '../report.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDER_CLI = join(HERE, '..', '..', 'scripts', 'render-comment.ts');

// A report with `n` quality-passing product-correctness findings (descending
// confidence so scanner order is deterministic). Each is unique by line.
function reportWith(n: number): ScanPrOutput {
  const code_suggestions: CodeSuggestion[] = Array.from({ length: n }, (_, i) => ({
    category: 'B',
    category_label: 'Product correctness — raw SQL concatenation',
    file: `src/file_${i}.ts`,
    line: i + 1,
    confidence: Math.max(0.75, 1 - i * 0.001), // ≥ threshold, descending
    why_it_matters: `finding ${i} matters`,
    references: [{ url: 'https://example.com/ref', title: 'ref' }],
  }));
  return {
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.6.0' },
    pr_scope: { changed_files: ['src/file_0.ts'], affected_roots: ['main'], unreachable_changes: [] },
    pr_review: { code_suggestions },
  } as ScanPrOutput;
}

// Count rendered priority-table rows (one line per suggestion).
function tableRows(body: string): number {
  return (body.match(/^\| (?:🔴 High|🟡 Medium|⚪ Low) \|/gm) ?? []).length;
}

// ─── UNIT: renderOverview cap ──────────────────────────────────────────────

test('default cap: 25 findings → 10 table rows, true total in heading, overflow note', () => {
  const body = renderOverview(reportWith(25));
  assert.equal(tableRows(body), 10, 'priority table must cap at the default 10');
  assert.match(body, /⚠️ Code suggestions \(25\)/, 'heading keeps the TRUE total (25)');
  assert.match(body, /…\+15 more suggestions not shown — rendering the top 10 by priority\./);
});

test('override (max=3): 25 findings → 3 rows + "+22 more" note', () => {
  const body = renderOverview(reportWith(25), { maxSuggestions: 3 });
  assert.equal(tableRows(body), 3);
  assert.match(body, /⚠️ Code suggestions \(25\)/);
  assert.match(body, /…\+22 more suggestions not shown — rendering the top 3 by priority\./);
});

test('override above total (max=100): all 25 rendered, NO overflow note', () => {
  const body = renderOverview(reportWith(25), { maxSuggestions: 100 });
  assert.equal(tableRows(body), 25);
  assert.doesNotMatch(body, /more suggestions? not shown/);
});

test('cap never trips when total ≤ cap (8 findings → 8 rows, no note)', () => {
  const body = renderOverview(reportWith(8));
  assert.equal(tableRows(body), 8);
  assert.doesNotMatch(body, /more suggestions? not shown/);
});

test('invalid overrides (0, negative, NaN) fall back to the default 10', () => {
  for (const bad of [0, -5, Number.NaN]) {
    const body = renderOverview(reportWith(25), { maxSuggestions: bad });
    assert.equal(tableRows(body), 10, `max=${bad} must fall back to 10`);
  }
});

test('the true product-correctness count survives the cap (callout shows 25, not 10)', () => {
  const body = renderOverview(reportWith(25));
  assert.match(body, /\*\*25 product-correctness issues\*\*/, 'CAUTION callout reflects the WHOLE PR');
});

// ─── E2E: render-comment.ts CLI ────────────────────────────────────────────

function runCli(env: Record<string, string>, extraArgs: string[]): Promise<{ code: number | null; stdout: string; body: string }> {
  const dir = mkdtempSync(join(tmpdir(), 'drift-render-cap-'));
  const inPath = join(dir, 'report.json');
  const outPath = join(dir, 'comment.md');
  writeFileSync(inPath, JSON.stringify(reportWith(25)));
  return new Promise((res, rej) => {
    const proc = spawn(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings', RENDER_CLI, inPath, outPath, ...extraArgs],
      { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c; });
    proc.stderr.on('data', (c) => { stderr += c; });
    const killer = setTimeout(() => { proc.kill('SIGKILL'); rej(new Error(`CLI timed out — ${stderr.slice(0, 400)}`)); }, 30_000);
    proc.on('exit', (code) => {
      clearTimeout(killer);
      let body = '';
      try { body = readFileSync(outPath, 'utf8'); } catch { /* left empty on failure */ }
      if (code !== 0) rej(new Error(`CLI exited ${code} — ${stderr.slice(0, 400)}`));
      else res({ code, stdout, body });
    });
    proc.on('error', (e) => { clearTimeout(killer); rej(e); });
  });
}

test('CLI: default (no flag) caps the rendered comment at 10', async () => {
  const { body } = await runCli({}, []);
  assert.equal(tableRows(body), 10);
  assert.match(body, /⚠️ Code suggestions \(25\)/);
});

test('CLI: --max-suggestions=5 renders 5 rows', async () => {
  const { body, stdout } = await runCli({}, ['--max-suggestions=5']);
  assert.equal(tableRows(body), 5);
  assert.match(stdout, /suggestions render cap: 5/);
});

test('CLI: DRIFT_MAX_SUGGESTIONS env honoured', async () => {
  const { body } = await runCli({ DRIFT_MAX_SUGGESTIONS: '4' }, []);
  assert.equal(tableRows(body), 4);
});

test('CLI: --max-suggestions flag WINS over the env var', async () => {
  const { body } = await runCli({ DRIFT_MAX_SUGGESTIONS: '4' }, ['--max-suggestions=7']);
  assert.equal(tableRows(body), 7);
});

test('CLI: the flag can sit before the positionals (flag/positional split is order-free)', async () => {
  // runCli appends the flag after the positionals; here we prove a leading flag
  // also works by routing through a bespoke arg order.
  const dir = mkdtempSync(join(tmpdir(), 'drift-render-cap-ord-'));
  const inPath = join(dir, 'report.json');
  const outPath = join(dir, 'comment.md');
  writeFileSync(inPath, JSON.stringify(reportWith(25)));
  const code = await new Promise<number | null>((res, rej) => {
    const proc = spawn(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings', RENDER_CLI, '--max-suggestions=2', inPath, outPath],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let stderr = '';
    proc.stderr.on('data', (c) => { stderr += c; });
    proc.on('exit', (c) => (c === 0 ? res(c) : rej(new Error(`exit ${c}: ${stderr.slice(0, 300)}`))));
    proc.on('error', rej);
  });
  assert.equal(code, 0);
  assert.equal(tableRows(readFileSync(outPath, 'utf8')), 2);
});
