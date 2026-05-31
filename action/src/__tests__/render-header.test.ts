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
  assert.doesNotMatch(h, /^## .*Drift review/m, 'no duplicate H2 title — the brand banner is the title now');
  assert.match(h, /\[`acme\/shop`\]\(https:\/\/github\.com\/acme\/shop\)/, 'repo permalink');
  assert.match(h, /\[!TIP\]/, 'all-up → TIP');
  assert.match(h, /badge\/advisory-does_not_gate/, 'advisory pill is unconditional (also on a TIP verdict)');
  assert.match(h, /badge\/drift-%2B21\.0%25-2ea043/, 'green drift badge, + encoded');
  assert.match(h, /badge\/files-3-/, 'files KPI');
  assert.match(h, /badge\/net_LOC-/, 'net LOC KPI');
  assert.match(h, /badge\/new_tests-0-d1242f/, 'new-tests 0 → red');
  // The checklist + readiness bar moved out of the header → not here anymore.
  assert.doesNotMatch(h, /Before you merge/, 'checklist is no longer in the header');
  assert.doesNotMatch(h, /Merge readiness/, 'readiness bar is no longer in the header');
});

test('header: KPI dashboard renders exactly three themed badge rows (verdict · size · findings), gauges isolated to row 1', () => {
  // The redesign's core: badges are grouped into three rows (joined by single
  // `\n`), not one flat strip. Lock the row count AND per-row membership so a
  // regression that collapses them back into one wrapping line is caught.
  const r = makeReport({
    overall_drift: { percent: -5, direction: 'down', confidence: 'low' },
    value_card: { axes: [axis('money', -5)] },
    counts: { new_test_files: { value: 0, label: 't' } },
    code_suggestions: [
      { category: 'B', category_label: 'Product correctness — Bad', file: 'b.ts', line: 9, confidence: 0.9, why_it_matters: 'y', references: [{ url: 'https://r' }] },
    ],
  });
  const h = renderHeader(r, CTX);
  const rows = h.split('\n').filter((l) => l.includes('img.shields.io'));
  assert.equal(rows.length, 3, 'three themed badge rows, not one flat strip');
  // Row 1 — verdict status + the two 0–5 gauges + the unconditional advisory pill.
  assert.match(rows[0], /badge\/review-/, 'row 1: review status');
  assert.match(rows[0], /badge\/merge_confidence-/, 'row 1: merge-confidence gauge');
  assert.match(rows[0], /badge\/review_effort-/, 'row 1: review-effort gauge');
  assert.match(rows[0], /badge\/advisory-does_not_gate/, 'row 1: advisory pill');
  // Row 2 — value drift & change size.
  assert.match(rows[1], /badge\/drift-/, 'row 2: drift');
  assert.match(rows[1], /badge\/files-/, 'row 2: files');
  assert.match(rows[1], /badge\/net_LOC-/, 'row 2: net LOC');
  // Row 3 — findings & actionability.
  assert.match(rows[2], /badge\/suggestions-/, 'row 3: suggestions');
  // The gauges + advisory belong ONLY to row 1 — they must not leak into others.
  assert.doesNotMatch(rows[1], /merge_confidence|review_effort|badge\/advisory/, 'row 2 carries no gauges/advisory');
  assert.doesNotMatch(rows[2], /merge_confidence|review_effort|badge\/advisory/, 'row 3 carries no gauges/advisory');
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
  assert.match(h, /badge\/review-address_before_merge-d29922/, 'mixed stays AMBER (not red) — the gain offsets the regression');
  assert.match(h, /^> 🟡 /m, 'amber hero dot for a mixed case');
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
  assert.match(h, /badge\/review-address_before_merge-d1242f/, 'review pill is red on a pure net regression (matches the 🔴 hero dot)');
  // The hero dot must agree with the pill — both red here.
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
  assert.match(h, /badge\/review-address_before_merge-d1242f/, 'red review pill agrees with the value-card composite');
});

test('header(no value model): NOTE verdict, factual narrative, no drift/LOC badges', () => {
  const r = makeReport({}, { changed_files: ['x.ts', 'y.ts'], affected_roots: ['main'], unreachable_changes: [] });
  const h = renderHeader(r, CTX);
  assert.match(h, /\[!NOTE\]/);
  assert.match(h, /2 changed files, 1 entry point reached\./);
  assert.match(h, /badge\/advisory-does_not_gate/, 'advisory pill is unconditional (also on a NOTE verdict)');
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
