// Extended findings (wrapped in one <details>) + legend & methodology.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderExt } from '../render/sections/ext.ts';
import { renderLegend } from '../render/sections/legend.ts';
import type { PrReviewExt } from '../report.ts';
import type { PrContext } from '../render/context.ts';

const CTX: PrContext = { owner: 'acme', repo: 'shop', sha: 'cafe' };

test('ext: all four blocks render inside one collapsible', () => {
  const ext: PrReviewExt = {
    duplication: { threshold: 95, count: 1, clusters: [{ members: [{ name: 'start', file: 'a/H.tsx' }, { name: 'start', file: 'b/S.tsx' }] }] },
    tests_in_graph: { test_files: 0, test_functions: 0, by_language: {}, uncovered_roots: ['App', 'Worker'] },
    nfr_edge_cases: { families: {}, per_root: [], reliability_gaps: ['App'] },
    tech_debt: { high_complexity: [{}, {}], long_functions: [{}], summary_findings_top: [], thresholds: { complexity: 10, loc: 80 } },
  };
  const out = renderExt(ext, CTX)!;
  assert.match(out, /## 🧪 Extended findings/);
  assert.match(out, /<summary>Duplication, uncovered entry points, reliability gaps &amp; tech debt<\/summary>/);
  assert.match(out, /### 🧬 Duplication \(1 cluster\)/);
  assert.match(out, /`start` in \[`H\.tsx`\]\(https:\/\/github\.com\/acme\/shop\/blob\/cafe\/a\/H\.tsx\) ↔ `start` in \[`S\.tsx`\]/);
  assert.match(out, /### 🧪 Uncovered entry points \(2\)/);
  assert.match(out, /`App` · `Worker`/);
  assert.match(out, /### 🛡️ Reliability gaps \(1\)/);
  assert.match(out, /### ⚠️ Tech-debt findings/);
  assert.match(out, /\*\*2\*\* high-complexity functions \(threshold 10\)/);
  assert.match(out, /\*\*1\*\* long function \(threshold 80 LOC\)/);
});

test('ext: null when there is nothing extended to report', () => {
  assert.equal(renderExt(undefined), null);
  assert.equal(renderExt({}), null);
  assert.equal(renderExt({ tests_in_graph: { test_files: 0, test_functions: 0, by_language: {}, uncovered_roots: [] } }), null);
});

test('ext: partial — only duplication present', () => {
  const out = renderExt({ duplication: { threshold: 95, count: 1, clusters: [{ members: [{ name: 'x', file: 'a.ts' }] }] } })!;
  assert.match(out, /### 🧬 Duplication/);
  assert.doesNotMatch(out, /Uncovered entry points/);
  assert.doesNotMatch(out, /Reliability gaps/);
});

test('legend: static key + thresholds filled from the report', () => {
  const out = renderLegend({ high_complexity: [], long_functions: [], summary_findings_top: [], thresholds: { complexity: 12, loc: 60 } });
  assert.match(out, /<summary>🔖 Legend &amp; methodology<\/summary>/);
  assert.match(out, /\| Symbol \| Meaning \|/);
  assert.match(out, /Magnitude bar/);
  assert.match(out, /complexity > 12, long function > 60 LOC/, 'thresholds from report');
  assert.match(out, /Findings are \*\*advisory\*\* and never fail the check/);
});

test('legend: default thresholds when none provided', () => {
  assert.match(renderLegend(), /complexity > 10, long function > 80 LOC/);
});
