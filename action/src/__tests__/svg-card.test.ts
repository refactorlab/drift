// The merge-confidence card SVG (render/svg/card.ts) — the single-image
// alternative to the badge dashboard. Locks the contract that matters for an
// asset we'll host and reference from a PR comment:
//   1. it's WELL-FORMED XML (a malformed byte → GitHub/camo renders nothing);
//   2. it carries the SAME numbers as the header (reads the shared facts);
//   3. it's DETERMINISTIC (same report → same bytes → cacheable hosted asset);
//   4. dynamic text (branch/title) is XML-ESCAPED (no markup injection);
//   5. it DEGRADES when there's no value model (drift → "n/a", still valid).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
// jsdom ships no bundled type declarations in this repo (it's a transitive
// mermaid devDep we reuse for runtime XML validation), so import it untyped.
// @ts-expect-error - no @types/jsdom; used at runtime only
import { JSDOM } from 'jsdom';
import { loadReport, type ScanPrOutput, type ValueAxis } from '../report.ts';
import { renderConfidenceCardSvg } from '../render/svg/card.ts';

const fixtureDir = join(import.meta.dirname, '../../.dev');

// Same minimal-report shape the header tests use, so this card can't drift from
// the rest of the renderer's expectations.
function makeReport(over: Partial<ScanPrOutput['pr_review']>, scope?: Partial<ScanPrOutput['pr_scope']>): ScanPrOutput {
  return {
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: 't' },
    pr_scope: { changed_files: ['a.ts', 'b.ts'], affected_roots: ['main'], unreachable_changes: [], ...scope },
    pr_review: over,
  };
}

function axis(name: ValueAxis['name'], delta: number): ValueAxis {
  return {
    name,
    label: { money: '💰 Money', customer: '👥 Customer value', runtime: '⚙️ Runtime', runtime_ux: '🎨 Runtime UX' }[name],
    delta_percent: delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
    confidence: 'low',
    inputs: name === 'money' ? { loc_added: 6940, loc_deleted: 1819 } : undefined,
  };
}

// A mixed regression like the self-scan: money down hard, customer up, one
// product-correctness finding, gating risks, no new tests.
function regressionReport(): ScanPrOutput {
  return makeReport(
    {
      overall_drift: { percent: -11.9, direction: 'down', confidence: 'low' },
      value_card: { axes: [axis('money', -84.8), axis('customer', 7.3)] },
      counts: { new_test_files: { value: 0, label: 't' } },
      code_suggestions: [
        { category: 'B', category_label: 'Product correctness — Bad', file: 'b.ts', line: 9, confidence: 0.9, why_it_matters: 'y', references: [{ url: 'https://r' }] },
      ],
      visual_summary: {
        risks: {
          items: [
            { label: 'r1', likelihood: 0.8, severity: 0.8, quadrant: 'act_before_merge' },
            { label: 'r2', likelihood: 0.7, severity: 0.9, quadrant: 'act_before_merge' },
          ],
        },
      },
    },
    { changed_files: Array.from({ length: 60 }, (_, i) => `f${i}.ts`) },
  );
}

/** Parse as XML via jsdom; return the root <svg> node or throw on a parser error. */
function parseSvg(svg: string) {
  const dom = new JSDOM('<!doctype html><body></body>');
  const doc = new dom.window.DOMParser().parseFromString(svg, 'image/svg+xml');
  const err = doc.querySelector('parsererror');
  assert.equal(err, null, `SVG must be well-formed XML — parser error: ${err?.textContent ?? ''}`);
  const root = doc.documentElement;
  assert.equal(root.tagName.toLowerCase(), 'svg', 'root element is <svg>');
  return root;
}

test('card: well-formed SVG with the expected geometry + a11y role', () => {
  const svg = renderConfidenceCardSvg(regressionReport());
  const root = parseSvg(svg);
  assert.equal(root.getAttribute('viewBox'), '0 0 1080 460');
  assert.equal(root.getAttribute('role'), 'img');
  assert.match(root.getAttribute('aria-label') ?? '', /merge-confidence/i);
  // The gauge ring + the six row dots = at least 2 circles, 6 separator-free dots.
  const doc = root.ownerDocument!;
  assert.ok(doc.querySelectorAll('circle').length >= 3, 'gauge track + arc + row dots');
  assert.ok(doc.querySelectorAll('text').length >= 12, 'title, subtitle, gauge, 6 labels, 6 values');
});

test('card: carries the same metrics the header would (real numbers, right labels)', () => {
  const svg = renderConfidenceCardSvg(regressionReport(), { prNumber: 4821, branch: 'feature/money-refactor' });
  // Title line from the event inputs.
  assert.match(svg, /PR #4821 — feature\/money-refactor/);
  // The six ledger labels, in order, all present.
  for (const label of ['Risks to address', 'Review effort', 'Drift from baseline', 'Files changed', 'Suggestions', 'New tests']) {
    assert.ok(svg.includes(label), `row label "${label}"`);
  }
  // Real derived values: overall drift, net LOC (6940-1819=5121), files, risks=2.
  assert.match(svg, /−11\.9%/, 'overall drift value');
  assert.match(svg, /60 · \+5,121 LOC/, 'files · net LOC');
  assert.ok(svg.includes('agent-ready'), 'suggestions row shows agent-ready');
  // Verdict pill: mixed regression → "address before merge" (amber), not red.
  assert.match(svg, /address before merge/);
  assert.match(svg, /MERGE CONFIDENCE/);
});

test('card: deterministic — identical report renders identical bytes', () => {
  const a = renderConfidenceCardSvg(regressionReport(), { prNumber: 1, branch: 'x' });
  const b = renderConfidenceCardSvg(regressionReport(), { prNumber: 1, branch: 'x' });
  assert.equal(a, b);
});

test('card: dynamic text is XML-escaped (no markup injection from a branch name)', () => {
  const svg = renderConfidenceCardSvg(regressionReport(), { branch: 'a<b>&"x' });
  // The raw special chars must be entity-encoded in the title…
  assert.ok(svg.includes('a&lt;b&gt;&amp;&quot;x'), 'branch name escaped');
  // …and the document must still parse (the injection didn't open a tag).
  parseSvg(svg);
});

test('card: degrades with no value model — drift "n/a", tests "—", still valid SVG', () => {
  const svg = renderConfidenceCardSvg(makeReport({}));
  parseSvg(svg);
  assert.match(svg, /Drift from baseline/);
  assert.match(svg, /n\/a/, 'no overall_drift → n/a');
  assert.ok(svg.includes('—'), 'no counts → tests em-dash');
});

test('card: dark-theme styles are embedded (best-effort prefers-color-scheme)', () => {
  const svg = renderConfidenceCardSvg(regressionReport());
  assert.match(svg, /@media \(prefers-color-scheme: dark\)/);
});

test('card: renders the real fixtures without throwing', () => {
  for (const f of ['scan-pr-output.json', 'scan-pr-output-kotlin-ktor.json']) {
    const svg = renderConfidenceCardSvg(loadReport(join(fixtureDir, f)));
    parseSvg(svg);
    assert.match(svg, /MERGE CONFIDENCE/);
  }
});
