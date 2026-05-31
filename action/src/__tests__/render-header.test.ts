// Header section: title, sub-line, advisory callout, KPI badges, the
// "Before you merge" checklist, and merge-readiness — across the real fixtures
// and synthetic edge cases (mixed / regression / clean / no value model / no
// context).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadReport, type ScanPrOutput, type ValueAxis } from '../report.ts';
import { renderHeader } from '../render/sections/header.ts';
import { extractFacts } from '../render/lib/facts.ts';
import { buildChecklist } from '../render/lib/checklist.ts';
import type { PrContext } from '../render/context.ts';

const fixtureDir = join(import.meta.dirname, '../../.dev');
const CTX: PrContext = { owner: 'acme', repo: 'shop', sha: 'cafe1234', prTitle: 'feat: speed up checkout' };

/** The Drift-review H2 title line — no longer line 0 now that a brand banner leads. */
const titleLineOf = (h: string): string => h.split('\n').find((l) => l.startsWith('## ') && l.includes('Drift review')) ?? '';

function makeReport(over: Partial<ScanPrOutput['pr_review']>, scope?: Partial<ScanPrOutput['pr_scope']>): ScanPrOutput {
  return {
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: 't' },
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [], ...scope },
    pr_review: over,
  };
}

function axis(name: ValueAxis['name'], delta: number, conf: ValueAxis['confidence'] = 'low'): ValueAxis {
  return {
    name,
    label: { money: '💰 Money', customer: '👥 Customer value', runtime: '⚙️ Runtime', runtime_ux: '🎨 Runtime UX' }[name],
    delta_percent: delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
    confidence: conf,
    inputs: name === 'money' ? { loc_added: 100, loc_deleted: 20 } : undefined,
  };
}

// ── real fixtures ────────────────────────────────────────────────────────────

test('header(python): TIP verdict, all-up drift, full KPI row (checklist now lives at the END, not here)', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output.json')), CTX);
  assert.match(h, /^## ▲ Drift review$/m, 'title is just the arrow + "Drift review" (no PR-title suffix)');
  assert.match(h, /\[`acme\/shop`\]\(https:\/\/github\.com\/acme\/shop\)/, 'repo permalink');
  assert.match(h, /\[!TIP\]/, 'all-up → TIP');
  assert.match(h, /badge\/drift-%2B21\.0%25-2ea043/, 'green drift badge, + encoded');
  assert.match(h, /badge\/files-3-/, 'files KPI');
  assert.match(h, /badge\/net_LOC-/, 'net LOC KPI');
  assert.match(h, /badge\/new_tests-0-d1242f/, 'new-tests 0 → red');
  // The checklist + readiness bar moved out of the header → not here anymore.
  assert.doesNotMatch(h, /Before you merge/, 'checklist is no longer in the header');
  assert.doesNotMatch(h, /Merge readiness/, 'readiness bar is no longer in the header');
});

test('header(kotlin): cat-B → WARNING + amber badge + narrative (no checklist in header)', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  assert.match(h, /\[!WARNING\]/);
  assert.match(h, /badge\/review-address_before_merge-d29922/, 'amber review badge');
  assert.match(h, /product-correctness issue\*\* flagged/, 'narrative mentions the finding');
  assert.doesNotMatch(h, /Fix the product-correctness issue at/, 'checklist item is no longer in the header');
});

// ── context degradation ──────────────────────────────────────────────────────

test('header(no context): no PR-title suffix, no repo link, code-span fallbacks', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')));
  assert.match(h, /^## ▲ Drift review$/m, 'no — title suffix without a PR title');
  assert.doesNotMatch(h, /📍/, 'no repo pin without owner/repo');
  assert.match(h, /Look here first:\*\* `OrdersRepository\.kt:17`/, 'focus location is a code span, not a link');
  assert.doesNotMatch(h, /\]\(https:\/\/github\.com/, 'no permalinks anywhere');
});

// ── synthetic verdicts ───────────────────────────────────────────────────────

test('header(mixed axes): amber "mixed", narrative says "led by" the top gain', () => {
  const r = makeReport({
    overall_drift: { percent: 10.3, direction: 'up', confidence: 'low' },
    value_card: { axes: [axis('money', -15.9), axis('customer', 60), axis('runtime', -3), axis('runtime_ux', 0)] },
  });
  const h = renderHeader(r, CTX);
  assert.match(h, /\[!WARNING\]/, 'divergent signs warn');
  assert.match(h, /led by 👥 Customer value \(\*\*\+60\.0%\*\*\)/);
  assert.match(h, /\*\*💰 Money −15\.9%\*\* and \*\*⚙️ Runtime −3\.0%\*\* regressed/);
  assert.match(h, /badge\/review-address_before_merge/);
});

test('header(all down): net-regression narrative, WARNING', () => {
  const r = makeReport({
    overall_drift: { percent: -12, direction: 'down', confidence: 'low' },
    value_card: { axes: [axis('money', -12), axis('runtime', -4)] },
  });
  const h = renderHeader(r, CTX);
  assert.match(h, /\[!WARNING\]/);
  assert.match(h, /net regression/);
  assert.match(h, /badge\/drift-.*-d1242f/, 'red drift badge when down');
});

test('header(no value model): NOTE verdict, factual narrative, no drift/LOC badges', () => {
  const r = makeReport({}, { changed_files: ['x.ts', 'y.ts'], affected_roots: ['main'], unreachable_changes: [] });
  const h = renderHeader(r, CTX);
  assert.match(h, /\[!NOTE\]/);
  assert.match(h, /2 changed files, 1 entry point reached\./);
  assert.doesNotMatch(h, /badge\/drift-/, 'no drift badge without a value model');
  assert.doesNotMatch(h, /badge\/net_LOC-/, 'no net-LOC badge without money inputs');
});

test('header(clean improvement, tests added): no "Add tests" item', () => {
  const r = makeReport({
    overall_drift: { percent: 8, direction: 'up', confidence: 'high' },
    value_card: { axes: [axis('customer', 8)] },
    counts: { new_test_files: { value: 4, label: 'New test files' } },
  });
  const h = renderHeader(r, CTX);
  assert.match(h, /\[!TIP\]/);
  assert.match(h, /badge\/new_tests-4-2ea043/, 'new tests > 0 → green');
  assert.doesNotMatch(h, /Add tests/, 'no test-gap item when tests were added');
});

// ── facts + checklist units ──────────────────────────────────────────────────

test('extractFacts: net LOC from money inputs, regressions, dead code', () => {
  const r = makeReport({
    overall_drift: { percent: 5, direction: 'up', confidence: 'low' },
    value_card: { axes: [axis('money', -2), axis('customer', 12)] },
    code_suggestions: [
      { category: 'A', category_label: 'Optimization — Dead code', file: 'a.ts', function: 'foo', line: 3, confidence: 1, why_it_matters: 'x', references: [{ url: 'https://r' }] },
      { category: 'B', category_label: 'Product correctness — Bad', file: 'b.ts', line: 9, confidence: 0.9, why_it_matters: 'y', references: [{ url: 'https://r' }] },
    ],
  });
  const f = extractFacts(r);
  assert.equal(f.netLoc, 80); // 100 - 20
  assert.equal(f.locAdded, 100);
  assert.equal(f.regressedAxes.length, 1);
  assert.equal(f.improvedAxes.length, 1);
  assert.equal(f.topImprovement?.name, 'customer');
  assert.equal(f.deadCode.length, 1);
  assert.equal(f.correctness.length, 1);
});

test('extractFacts: no money axis → netLoc null, newTestFiles null without counts', () => {
  const f = extractFacts(makeReport({ value_card: { axes: [axis('customer', 5)] } }));
  assert.equal(f.netLoc, null);
  assert.equal(f.locAdded, null);
  assert.equal(f.newTestFiles, null);
});

test('buildChecklist orders product-correctness first and degrades links', () => {
  const f = extractFacts(makeReport({
    value_card: { axes: [axis('money', -3)] },
    counts: { new_test_files: { value: 0, label: 't' } },
    code_suggestions: [
      { category: 'B', category_label: 'Product correctness — Raw SQL concatenation', file: 'repo.kt', line: 17, confidence: 0.8, why_it_matters: 'x', references: [{ url: 'https://r' }] },
    ],
  }));
  const items = buildChecklist(f); // no ctx
  assert.match(items[0], /^Fix the product-correctness issue at `repo\.kt:17` \(raw SQL concatenation\)$/);
  assert.ok(items.some((i) => /Add tests/.test(i)));
  assert.ok(items.some((i) => /regression/.test(i)));
});

test('header: the H2 never repeats the PR title (no injection surface), even for hostile titles', () => {
  // The PR title is no longer rendered in the comment (GitHub already shows it
  // at the top of the page), so a hostile title cannot reach the H2 at all.
  const hostile = ['fix: thing\n## INJECTED', 'feat: use `code` here', 'x'.repeat(500), 'fix\x00INJECT'];
  for (const t of hostile) {
    const h = renderHeader(makeReport({ value_card: { axes: [axis('customer', 1)] } }), { ...CTX, prTitle: t });
    const titleLine = titleLineOf(h);
    assert.match(titleLine, /^## (?:[▲▼—] )?Drift review$/, `clean H2 with no title suffix: ${titleLine}`);
    const h2Lines = h.split('\n').filter((l) => l.startsWith('## ') && l.includes('Drift review'));
    assert.equal(h2Lines.length, 1, 'exactly one Drift-review H2');
    assert.doesNotMatch(h, /## INJECTED/, 'no injected heading from the title');
  }
});
