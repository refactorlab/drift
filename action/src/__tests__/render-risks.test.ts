// Risks section: intro count, impact-ordered table, quadrant labels, quadrant
// map <details>, and degradation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRisks } from '../render/sections/risks.ts';
import type { RiskItem } from '../report.ts';

const items: RiskItem[] = [
  { label: 'PR size · 3 files', likelihood: 0.03, severity: 0.32, quadrant: 'acceptable' },
  { label: 'Reliability gaps', likelihood: 0.5, severity: 0.7, quadrant: 'act_before_merge' },
  { label: 'Uncovered roots', likelihood: 0.4, severity: 0.6, quadrant: 'monitor_closely' },
  { label: 'Wide blast radius', likelihood: 0.84, severity: 1.0, quadrant: 'act_before_merge' },
];

test('risks: intro counts act-before-merge, table is impact-ordered and capped at 3', () => {
  const out = renderRisks({ items })!;
  assert.match(out, /## 🛰 Risks/);
  assert.match(out, /\*\*2 of 4\*\* risks land in \*Act before merge\*/, 'intro still references the true total');
  // Top-3 by impact, in order; the 4th (lowest-impact) is summarised, not a row.
  const order = ['Wide blast radius', 'Reliability gaps', 'Uncovered roots'];
  let last = -1;
  for (const label of order) {
    const idx = out.indexOf(label);
    assert.ok(idx > last, `${label} out of order`);
    last = idx;
  }
  assert.match(out, /Wide blast radius \| 0\.84 \| 1\.00 \| 🔴 Act before merge/);
  assert.match(out, /Uncovered roots \| 0\.40 \| 0\.60 \| 🟡 Monitor closely/);
  // The lowest-impact risk is rolled into a "+N more" summary row, not shown.
  assert.doesNotMatch(out, /PR size · 3 files \| 0\.03/, 'lowest-impact risk is not a data row');
  assert.match(out, /…\+1 lower-impact risk/);
});

test('risks: 0 act-before-merge gets the reassuring intro', () => {
  const out = renderRisks({ items: [{ label: 'PR size', likelihood: 0.1, severity: 0.2, quadrant: 'acceptable' }] })!;
  assert.match(out, /\*\*0 of 1\*\* risk[s]? land in \*Act before merge\* — none gate the merge/);
});

test('risks: quadrant map <details> frames the scanner mermaid', () => {
  const out = renderRisks({ items, mermaid: 'quadrantChart\n title Risk Map' })!;
  assert.match(out, /<summary>🗺 Risk quadrant map/);
  assert.match(out, /```mermaid\nquadrantChart/);
});

test('risks: pipe in a label is escaped', () => {
  const out = renderRisks({ items: [{ label: 'a | b', likelihood: 0.1, severity: 0.2, quadrant: 'acceptable' }] })!;
  assert.match(out, /a \\\| b/);
});

test('risks: null when empty', () => {
  assert.equal(renderRisks(undefined), null);
  assert.equal(renderRisks({ items: [] }), null);
  assert.equal(renderRisks({}), null);
});

test('risks: mermaid-only (no items) still renders the map', () => {
  const out = renderRisks({ mermaid: 'quadrantChart' })!;
  assert.match(out, /## 🛰 Risks/);
  assert.match(out, /Risk quadrant map/);
  assert.doesNotMatch(out, /\| Risk \|/, 'no table without items');
});
