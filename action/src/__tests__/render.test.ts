// Full-comment integration snapshots for the sticky body. Exercises the real
// fixtures (python-fastapi · kotlin-ktor) and asserts the v7 template structure
// is present and well-formed end-to-end.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadReport, type ScanPrOutput } from '../report.ts';
import { renderOverview, STICKY_MARKER } from '../render/overview.ts';
import type { PrContext } from '../render/context.ts';

const fixtureDir = join(import.meta.dirname, '../../.dev');
const CTX: PrContext = { owner: 'refactorlab', repo: 'andy', sha: 'a1b2c3d4', prTitle: 'feat: modern motion system' };
const fixtures = [
  { name: 'python-fastapi', path: join(fixtureDir, 'scan-pr-output.json') },
  { name: 'kotlin-ktor', path: join(fixtureDir, 'scan-pr-output-kotlin-ktor.json') },
] as const;

for (const fix of fixtures) {
  const render = () => renderOverview(loadReport(fix.path), { ctx: CTX });

  test(`render(${fix.name}): sticky marker first, state blob last`, () => {
    const body = render();
    assert.ok(body.startsWith(STICKY_MARKER), 'marker must be first line');
    assert.match(body, /<!-- drift:state \{.*\} -->\s*$/, 'state blob is appended last');
  });

  test(`render(${fix.name}): body stays under the 60 KiB budget`, () => {
    assert.ok(render().length < 60_000, `body is ${render().length} bytes`);
  });

  test(`render(${fix.name}): every v7 section is present`, () => {
    const body = render();
    assert.match(body, /^## [▲▼—] Drift review — `feat: modern motion system`/m, 'title line');
    assert.match(body, /img\.shields\.io\/badge\/review-/, 'review-status KPI badge');
    assert.match(body, /### ✅ Before you merge/, 'merge checklist');
    assert.match(body, /> \*\*Merge readiness\*\*/, 'merge-readiness bar');
    assert.match(body, /## 📊 Value card/, 'value card');
    assert.match(body, /<table>[\s\S]*<caption>PR value drift/, 'HTML dashboard table');
    assert.match(body, /Composite&nbsp;/, 'composite row');
    assert.match(body, /🔁 \*\*Since last review\*\*/, 'since-last-review line');
    assert.match(body, /## ⚠️ Suggestions \(\d+\)/, 'suggestions section');
    assert.match(body, /\| Priority \| Finding \| Location \| Confidence \|/, 'priority table');
    assert.match(body, /## 🛰 Risks/, 'risks section');
    assert.match(body, /## 🏗 Architecture & reach/, 'architecture section');
    assert.match(body, /## 🧪 Extended findings/, 'extended findings');
    assert.match(body, /Legend &amp; methodology/, 'legend');
    assert.match(body, /Posted by <a href="https:\/\/drift\.dev">Drift<\/a>/, 'footer');
  });

  test(`render(${fix.name}): no broken-template artifacts`, () => {
    const body = render();
    assert.doesNotMatch(body, /undefined|\[object Object\]|NaN/, 'no stringified blanks');
    assert.doesNotMatch(body, /Bottom line —\s*Bottom line —/i, 'no doubled bottom-line prefix');
    const opens = (body.match(/```mermaid/g) ?? []).length;
    const total = (body.match(/```/g) ?? []).length;
    assert.ok(opens >= 1, 'has at least one mermaid block');
    assert.equal(total % 2, 0, `unbalanced code fences (${total} total)`);
  });

  test(`render(${fix.name}): permalinks are SHA-pinned to the head commit`, () => {
    const body = render();
    assert.match(body, /https:\/\/github\.com\/refactorlab\/andy\/blob\/a1b2c3d4\//, 'blob permalinks use the head SHA');
  });
}

test('render(kotlin-ktor): category-B → WARNING header + CAUTION callout', () => {
  const body = renderOverview(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), { ctx: CTX });
  assert.match(body, /\[!WARNING\]/, 'header alert is WARNING');
  assert.match(body, /\[!CAUTION\]/, 'suggestions CAUTION callout');
  assert.match(body, /product-correctness issue/, 'names the issue type');
  assert.match(body, /🅑 .*Product correctness|🅑 .*SQL/, 'category-B suggestion present');
  assert.match(body, /OWASP/, 'reference link rendered');
});

test('render(python-fastapi): A-only suggestions → TIP, no CAUTION callout', () => {
  const body = renderOverview(loadReport(join(fixtureDir, 'scan-pr-output.json')), { ctx: CTX });
  assert.match(body, /\[!TIP\]/, 'all-up + no cat-B → TIP');
  assert.doesNotMatch(body, /\[!CAUTION\]/, 'no CAUTION without a product-correctness issue');
  assert.match(body, /🅐 .*[Dd]ead code/, 'category-A optimization labelled');
});

test('render(no suggestions): suggestions section omitted, checklist still sane', () => {
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.py'], affected_roots: ['main'], unreachable_changes: [] },
    pr_review: { code_suggestions: [] },
  });
  assert.doesNotMatch(body, /## ⚠️ Suggestions/, 'no section without passing suggestions');
  assert.match(body, /## 🏗 Architecture & reach/, 'architecture still renders');
});

test('render(no pr_review): factual-only output', () => {
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.py'], affected_roots: ['main'], unreachable_changes: [] },
  });
  assert.match(body, /## [▲▼—]? ?Drift review/, 'title present');
  assert.match(body, /\[!NOTE\]/, 'NOTE verdict without a value model');
  assert.match(body, /## 🏗 Architecture & reach/, 'factual architecture section');
  assert.doesNotMatch(body, /## 📊 Value card/, 'no value card without a value model');
  assert.doesNotMatch(body, /img\.shields\.io\/badge\/drift-/, 'no drift badge without a value model');
  assert.doesNotMatch(body, /Legend &amp; methodology/, 'legend skipped on factual-only');
});

test('render: guardSize collapses <details> innermost-first when over budget', () => {
  const big = 'x'.repeat(70_000);
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      value_card: {
        axes: [{ name: 'money', label: '💰 Money', delta_percent: 1, direction: 'up', confidence: 'low', formula: big }],
      },
    },
  });
  assert.ok(body.length < 65_536, `guarded body too large: ${body.length}`);
  assert.match(body, /collapsed \(size guard\)/);
});
