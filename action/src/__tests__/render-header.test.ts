// Header section: title, sub-line, advisory callout, KPI gauges, the
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

// The KPI dashboard is now a table of quickchart.io radialGauge tiles, each a
// `<picture>` whose `alt` is "TITLE value". This returns the one tile whose
// ALL-CAPS title matches, so a test can assert its presence + arc colour (the
// dark `backgroundColor` hex, percent-encoded as `%23<hex>` inside the URL).
function tile(html: string, title: string): string {
  const cell = html.split('</picture>').find((c) => c.includes(`alt="${title} `));
  return cell ? `${cell}</picture>` : '';
}
// Dark-variant arc hexes from the accessible gauge palette (lib/gauge.ts).
const GAUGE = { green: '%234ae3b0', amber: '%23e3b341', red: '%23ff7b6b', blue: '%2379c0ff', grey: '%239aa5b1' };

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

test('header(python): TIP verdict, all-up drift, gauge dashboard (checklist now lives at the END, not here)', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output.json')), CTX);
  assert.doesNotMatch(h, /^## .*Drift review/m, 'no duplicate H2 title — the brand banner is the title now');
  assert.match(h, /\[`acme\/shop`\]\(https:\/\/github\.com\/acme\/shop\)/, 'repo permalink');
  assert.match(h, /\[!TIP\]/, 'all-up → TIP');
  assert.match(h, /advisory — does not gate the merge/, 'does-not-gate advisory folded into the sub-line');
  // Drift tile renders the signed percent and is green when up.
  assert.match(tile(h, 'DRIFT'), /alt="DRIFT \+21\.0%"/, 'drift tile shows +21.0%');
  assert.match(tile(h, 'DRIFT'), new RegExp(GAUGE.green), 'green drift tile when up');
  assert.match(tile(h, 'NEW TESTS'), new RegExp(GAUGE.red), 'new-tests 0 → red tile');
  // Files-changed & net-LOC tiles are intentionally gone (GitHub's PR header shows both).
  assert.equal(tile(h, 'FILES CHANGED'), '', 'no files tile');
  assert.equal(tile(h, 'NET LOC'), '', 'no net-LOC tile');
  assert.doesNotMatch(h, /img\.shields\.io/, 'no shields pills — the dashboard is gauges now');
  // The checklist + readiness bar moved out of the header → not here anymore.
  assert.doesNotMatch(h, /Before you merge/, 'checklist is no longer in the header');
  assert.doesNotMatch(h, /Merge readiness/, 'readiness bar is no longer in the header');
});

test('header: KPI dashboard is a gauge table in priority order, files/net-LOC omitted', () => {
  // The redesign's core: the dashboard is an HTML <table> of quickchart gauge
  // tiles, in priority order, NOT shields pills. Lock the tiles that must be
  // present, the ones that must NOT, and that they share one table.
  const r = makeReport({
    overall_drift: { percent: -5, direction: 'down', confidence: 'low' },
    value_card: { axes: [axis('money', -5)] },
    counts: { new_test_files: { value: 0, label: 't' } },
    code_suggestions: [
      { category: 'B', category_label: 'Product correctness — Bad', file: 'b.ts', line: 9, confidence: 0.9, why_it_matters: 'y', references: [{ url: 'https://r' }] },
    ],
  });
  const h = renderHeader(r, CTX);
  assert.equal((h.match(/<table>/g) ?? []).length, 1, 'one dashboard table');
  for (const t of ['MERGE CONFIDENCE', 'REVIEW EFFORT', 'DRIFT', 'SUGGESTIONS', 'NEW TESTS']) {
    assert.notEqual(tile(h, t), '', `${t} tile present`);
  }
  assert.equal(tile(h, 'FILES CHANGED'), '', 'no files tile');
  assert.equal(tile(h, 'NET LOC'), '', 'no net-LOC tile');
  // Order: merge confidence first, drift before suggestions.
  assert.ok(h.indexOf('MERGE CONFIDENCE') < h.indexOf('REVIEW EFFORT'), 'confidence before effort');
  assert.ok(h.indexOf('DRIFT') < h.indexOf('SUGGESTIONS'), 'drift before suggestions');
  assert.match(tile(h, 'DRIFT'), new RegExp(GAUGE.red), 'red drift tile when down');
});

test('header(kotlin): cat-B → WARNING + amber hero dot + narrative (no checklist in header)', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  assert.match(h, /\[!WARNING\]/);
  assert.match(h, /^> 🟡 /m, 'amber hero dot for the mixed/attention case');
  assert.match(h, /product-correctness issue\*\* flagged/, 'narrative mentions the finding');
  assert.doesNotMatch(h, /Fix the product-correctness issue at/, 'checklist item is no longer in the header');
});

// ── context degradation ──────────────────────────────────────────────────────

test('header(no context): no PR-title suffix, no repo link, code-span fallbacks', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')));
  assert.doesNotMatch(h, /^## .*Drift review/m, 'no H2 title in the header (banner carries it)');
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
  assert.match(h, /^> 🟡 /m, 'amber hero dot for a mixed case (the gain offsets the regression)');
});

test('header(all down): net-regression narrative, WARNING', () => {
  const r = makeReport({
    overall_drift: { percent: -12, direction: 'down', confidence: 'low' },
    value_card: { axes: [axis('money', -12), axis('runtime', -4)] },
  });
  const h = renderHeader(r, CTX);
  assert.match(h, /\[!WARNING\]/);
  assert.match(h, /net regression/);
  assert.match(tile(h, 'DRIFT'), new RegExp(GAUGE.red), 'red drift tile when down');
  // The hero dot is red on a pure net regression.
  assert.match(h, /^> 🔴 /m, 'red hero dot on a pure net regression');
});

test('header(all-down axes, no overall_drift block): still red — the per-axis composite drives net-regression, not the optional drift sign', () => {
  // The schema allows partial reports (overall_drift omitted). With only down
  // axes, the value card composite is 🔴 "regressed"; the header must agree
  // rather than fall back to amber just because overallDirection is null.
  const r = makeReport({
    value_card: { axes: [axis('money', -10), axis('runtime', -5)] },
    // deliberately NO overall_drift block
  });
  const h = renderHeader(r, CTX);
  assert.match(h, /\[!WARNING\]/);
  assert.match(h, /^> 🔴 /m, 'red hero dot from the all-down composite, even without overall_drift');
});

test('header(no value model): NOTE verdict, factual narrative, no drift/LOC badges', () => {
  const r = makeReport({}, { changed_files: ['x.ts', 'y.ts'], affected_roots: ['main'], unreachable_changes: [] });
  const h = renderHeader(r, CTX);
  assert.match(h, /\[!NOTE\]/);
  assert.match(h, /2 changed files, 1 entry point reached\./);
  assert.match(h, /advisory — does not gate the merge/, 'does-not-gate advisory shows on a NOTE verdict too');
  assert.equal(tile(h, 'DRIFT'), '', 'no drift tile without a value model');
  // Confidence + effort + suggestions tiles always render (call-graph facts only).
  assert.notEqual(tile(h, 'MERGE CONFIDENCE'), '', 'confidence tile always present');
  assert.notEqual(tile(h, 'SUGGESTIONS'), '', 'suggestions tile always present');
});

test('header(clean improvement, tests added): no "Add tests" item', () => {
  const r = makeReport({
    overall_drift: { percent: 8, direction: 'up', confidence: 'high' },
    value_card: { axes: [axis('customer', 8)] },
    counts: { new_test_files: { value: 4, label: 'New test files' } },
  });
  const h = renderHeader(r, CTX);
  assert.match(h, /\[!TIP\]/);
  assert.match(tile(h, 'NEW TESTS'), /alt="NEW TESTS 4"/, 'new-tests tile shows 4');
  assert.match(tile(h, 'NEW TESTS'), new RegExp(GAUGE.green), 'new tests > 0 → green');
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

test('header: a hostile PR title cannot inject a heading (the title is never rendered)', () => {
  // The PR title is not rendered anywhere in the comment (GitHub already shows it
  // at the top of the page) and there's no `##` title line at all now — the brand
  // banner is the title — so a hostile title has no heading surface to reach.
  const hostile = ['fix: thing\n## INJECTED', 'feat: use `code` here', 'x'.repeat(500), 'fix\x00INJECT'];
  for (const t of hostile) {
    const h = renderHeader(makeReport({ value_card: { axes: [axis('customer', 1)] } }), { ...CTX, prTitle: t });
    assert.doesNotMatch(h, /^## /m, 'no H2 heading in the header at all');
    assert.doesNotMatch(h, /INJECTED/, 'no injected heading text from the title');
    // The header still renders its hero verdict line, so structure survived.
    assert.match(h, /^> (🟢|🟡|🔴|🔵) /m, 'hero verdict line still present');
  }
});
