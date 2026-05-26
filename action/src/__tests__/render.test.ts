// Render-output snapshot tests for the sticky comment body.
// Exercises both real-world fixtures (python-fastapi + kotlin-ktor) and
// asserts that every spec section is present and well-formed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadReport } from '../report.ts';
import { renderOverview, STICKY_MARKER } from '../render/overview.ts';

// Fixtures live next to .dev/report.json so they're tracked in git and
// available on CI — `tmp/` is gitignored.
const fixtureDir = join(import.meta.dirname, '../../.dev');
const fixtures = [
  { name: 'python-fastapi', path: join(fixtureDir, 'scan-pr-output.json') },
  { name: 'kotlin-ktor', path: join(fixtureDir, 'scan-pr-output-kotlin-ktor.json') },
] as const;

for (const fix of fixtures) {
  test(`render(${fix.name}): sticky marker is the first line`, () => {
    const body = renderOverview(loadReport(fix.path));
    assert.ok(body.startsWith(STICKY_MARKER), 'marker must be first');
  });

  test(`render(${fix.name}): body stays under the 60 KiB budget`, () => {
    const body = renderOverview(loadReport(fix.path));
    assert.ok(body.length < 60_000, `body is ${body.length} bytes`);
  });

  test(`render(${fix.name}): every spec section is present`, () => {
    const body = renderOverview(loadReport(fix.path));
    assert.match(body, /\[!(TIP|WARNING|NOTE)\]/, 'banner alert');
    assert.match(body, /Drift score/, 'shields.io badge');
    assert.match(body, /## 🏗 Architecture flow/, 'architecture section');
    assert.match(body, /## 🧭 Business logic/, 'business logic section');
    assert.match(body, /## 🎯 Affected entry points/, 'affected roots section');
    assert.match(body, /## 📊 Value card/, 'value card section');
    assert.match(body, /xychart-beta/, 'bars chart');
    assert.match(body, /How these numbers were computed/, 'axis details');
    assert.match(body, /Visual summary/, 'visual summary section');
  });

  test(`render(${fix.name}): no broken-template artifacts`, () => {
    const body = renderOverview(loadReport(fix.path));
    assert.doesNotMatch(body, /undefined|\[object Object\]/, 'no stringified blanks');
    assert.doesNotMatch(body, /Bottom line —\s*Bottom line —/i, 'no doubled bottom-line prefix');
    // We use ```mermaid fences — every opener needs a closer.
    const opens = (body.match(/```mermaid/g) ?? []).length;
    const closes = (body.match(/```/g) ?? []).length;
    assert.ok(closes >= opens * 2, `unbalanced mermaid fences (${opens} open vs ${closes} total)`);
  });
}

test('render(kotlin-ktor): category-B suggestion shows as a ⚠️ warning in the comment', () => {
  const body = renderOverview(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')));
  assert.match(body, /## ⚠️ Suggestions & warnings/, 'suggestions section present');
  assert.match(body, /\[!WARNING\]/, 'category-B renders a WARNING callout');
  assert.match(body, /product-correctness issue/, 'callout names the issue type');
  assert.match(body, /Product correctness/, 'the B suggestion is labelled');
  assert.match(body, /OWASP/, 'the reference link is rendered');
});

test('render(python-fastapi): A-only suggestions render without the WARNING callout', () => {
  const body = renderOverview(loadReport(join(fixtureDir, 'scan-pr-output.json')));
  assert.match(body, /## ⚠️ Suggestions & warnings/, 'suggestions section present');
  assert.doesNotMatch(body, /\[!WARNING\]/, 'no WARNING callout when no category-B issues');
  assert.match(body, /Optimization/, 'category-A suggestions are labelled');
});

test('render(no suggestions): suggestions section is omitted entirely', () => {
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.py'], affected_roots: ['main'], unreachable_changes: [] },
    pr_review: { code_suggestions: [] },
  });
  assert.doesNotMatch(body, /Suggestions & warnings/, 'no section without passing suggestions');
});

test('render(no pr_review): falls back to factual-only output', () => {
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.py'], affected_roots: ['main'], unreachable_changes: [] },
  });
  assert.ok(body.includes('## 🎯 Affected entry points'));
  assert.ok(!body.includes('## 🏗 Architecture flow'));
  assert.ok(!body.includes('Drift score')); // no banner without overall_drift
});

test('render: guardSize collapses <details> when body is over budget', () => {
  // Synthesise an oversized report by stuffing a huge mermaid into the
  // business_logic block (which lives outside <details> so it would stay)
  // and a huge axes-details list (inside <details>, should collapse).
  const big = 'x'.repeat(70_000);
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      value_card: {
        axes: [
          {
            name: 'money',
            label: '💰 Money',
            delta_percent: 1,
            direction: 'up',
            confidence: 'low',
            formula: big,
          },
        ],
      },
    },
  });
  // After guardSize, the <details> contents are stripped but the summary remains.
  assert.ok(body.length < 65_536, `guarded body too large: ${body.length}`);
  assert.match(body, /collapsed \(body size guard\)/);
});
