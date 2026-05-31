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

  test(`render(${fix.name}): confidence trend line wires through renderOverview when prior history exists`, () => {
    // The header reads confTrend, but the trend is assembled in renderOverview
    // (appendConfHistory(priorState, thisScore)). Exercise that whole path: a
    // prior with ≥1 score → ≥2 points after the append → the trend line renders.
    const withHistory = renderOverview(loadReport(fix.path), { ctx: CTX, priorState: { v: 1, confHistory: [2, 3] } });
    assert.match(withHistory, /🛡️ Merge-confidence trend `[▁▂▃▄▅▆▇█]+`/, 'trend line present with prior history');
    // First push (no prior) → only this score → <2 points → no trend line.
    const firstPush = renderOverview(loadReport(fix.path), { ctx: CTX });
    assert.doesNotMatch(firstPush, /Merge-confidence trend/, 'no trend line on the first push');
  });

  test(`render(${fix.name}): every v7 section is present`, () => {
    const body = render();
    assert.match(body, /<img [^>]*alt="Drift review"[^>]*width="120"/, 'brand banner is the title, pinned small (120px)');
    assert.doesNotMatch(body, /^## [▲▼—]? ?Drift review/m, 'no duplicate H2 title');
    assert.match(body, /img\.shields\.io\/badge\/review-/, 'review-status KPI badge');
    assert.match(body, /## ✅ Before you merge/, 'merge checklist (now a section at the end)');
    assert.match(body, /> \*\*Merge readiness\*\*/, 'merge-readiness bar');
    // Sections are now collapsible: the title lives in a <details><summary>
    // with a one-line TLDR appended ("— …").
    assert.match(body, /<summary><strong>📊 Business value<\/strong> — /, 'business value collapsible + TLDR');
    assert.match(body, /<table>[\s\S]*<caption>PR value drift/, 'HTML dashboard table');
    assert.match(body, /Composite&nbsp;/, 'composite row');
    assert.match(body, /🔁 \*\*Since last review\*\*/, 'since-last-review line');
    assert.match(body, /<summary><strong>⚠️ Code suggestions \(\d+\)<\/strong> — /, 'code suggestions collapsible + TLDR');
    assert.match(body, /\| Priority \| Finding \| Location \| Confidence \|/, 'priority table');
    assert.match(body, /<summary><strong>🛰 Risks<\/strong> — /, 'risks collapsible + TLDR');
    assert.match(body, /<summary><strong>🏗 Architecture<\/strong> — /, 'architecture collapsible + TLDR');
    assert.match(body, /<summary><strong>🧪 Extended findings<\/strong> — /, 'extended findings collapsible + TLDR');
    assert.doesNotMatch(body, /Legend &amp; methodology/, 'legend section removed');
    assert.match(body, /Posted by <a href="https:\/\/drift\.dev">Drift<\/a>/, 'footer');

    // Body order: Architecture leads, then Business value, then Code suggestions.
    const iArch = body.indexOf('🏗 Architecture');
    const iValue = body.indexOf('📊 Business value');
    const iSug = body.indexOf('⚠️ Code suggestions');
    assert.ok(
      iArch > 0 && iArch < iValue && iValue < iSug,
      `section order must be Architecture → Business value → Code suggestions (indices ${iArch}/${iValue}/${iSug})`,
    );
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
  assert.doesNotMatch(body, /⚠️ Code suggestions/, 'no section without passing suggestions');
  // Architecture is diagrams-only now: this fixture has no diagrams and no
  // unreachable files, so the section is omitted entirely.
  assert.doesNotMatch(body, /🏗 Architecture/, 'no architecture without diagrams or a dead-code callout');
});

test('render(no pr_review): factual-only output', () => {
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.py'], affected_roots: ['main'], unreachable_changes: [] },
  });
  assert.match(body, /<img [^>]*alt="Drift review"/, 'brand banner present (no H2 text)');
  assert.match(body, /\[!NOTE\]/, 'NOTE verdict without a value model');
  // Diagrams-only architecture: this factual-only fixture carries no diagrams
  // and no unreachable files, so the section is omitted.
  assert.doesNotMatch(body, /🏗 Architecture/, 'no architecture without diagrams or a dead-code callout');
  assert.doesNotMatch(body, /📊 Business value/, 'no value card without a value model');
  assert.doesNotMatch(body, /img\.shields\.io\/badge\/drift-/, 'no drift badge without a value model');
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

test('render: guardSize can collapse an outer <details> section and preserves its TLDR summary', () => {
  // A huge `bottom_line` lands DIRECTLY in the Business value section's body
  // (not in a nested <details>), so the only way under budget is to collapse
  // the OUTER `<details>` itself. This is the exact case the pre-fix guardSize
  // regex (which couldn't match an outer block holding nested details) could
  // never collapse — the body would blow past the cap. Also asserts the
  // section TLDR survives the collapse (the summary is preserved).
  const huge = 'y'.repeat(70_000);
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [] },
    pr_review: {
      overall_drift: { percent: 5, direction: 'up', confidence: 'low' },
      value_card: {
        axes: [{ name: 'money', label: '💰 Money', delta_percent: 5, direction: 'up', confidence: 'low' }],
        bottom_line: huge,
      },
    },
  });
  assert.ok(body.length < 65_536, `guarded body too large: ${body.length}`);
  // The open Business-value section collapsed to a tagless marker — its TLDR text
  // (carried in the summary) must survive in that marker.
  assert.match(body, /📊 Business value<\/strong> — Overall drift \+5\.0% ▲[\s\S]*?collapsed \(size guard\)/, 'business-value TLDR survives the collapse marker');
  // The 70 KB blob must be gone (the open section's body was dropped).
  assert.doesNotMatch(body, /y{1000}/, 'huge body content was dropped');
});
