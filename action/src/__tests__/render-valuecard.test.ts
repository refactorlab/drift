// Value-card dashboard: HTML table layout, ⅛-block bars, composite verdict,
// since-last-review delta, highlights, nested "how computed", bar-chart view,
// and graceful degradation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderValueCard, type ValueCardInput } from '../render/sections/value_card.ts';
import type { ValueAxis, ValueCard, PrCounts } from '../report.ts';
import type { DriftState } from '../render/state.ts';

function axis(name: ValueAxis['name'], delta: number, conf: ValueAxis['confidence'] = 'low', extra?: Partial<ValueAxis>): ValueAxis {
  return {
    name,
    label: { money: '💰 Money', customer: '👥 Customer value', runtime: '⚙️ Runtime', runtime_ux: '🎨 Runtime UX' }[name],
    delta_percent: delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
    confidence: conf,
    ...extra,
  };
}

function input(card: ValueCard | undefined, over: Partial<ValueCardInput> = {}): ValueCardInput {
  const axes = card?.axes ?? [];
  const cur: DriftState = { v: 1, axes: Object.fromEntries(axes.map((a) => [a.name, a.delta_percent])) };
  return { card, currentState: cur, overallPercent: over.overallPercent, counts: over.counts, priorState: over.priorState ?? null };
}

test('value card: HTML table with composite row, headers, bars, confidence', () => {
  const card: ValueCard = { axes: [axis('money', -15.9), axis('customer', 60), axis('runtime', -3), axis('runtime_ux', 0)] };
  const out = renderValueCard(input(card, { overallPercent: 10.3 }))!;
  assert.match(out, /## 📊 Business value/);
  assert.match(out, /<table>/);
  assert.match(out, /<caption>PR value drift/);
  assert.match(out, /colspan="4"[^>]*><strong>Composite&nbsp; 🟡 \+10\.3%/, 'mixed composite');
  assert.match(out, /<th align="center" width="25%" scope="col">💰 Money<\/th>/);
  assert.match(out, /<strong>🔴 −15\.9%<\/strong><br><sub>regressed<\/sub>/);
  assert.match(out, /<strong>🟢 \+60\.0%<\/strong>/);
  assert.match(out, /<code>██▋░░░░░░░<\/code>/, 'money ⅛-block bar');
  assert.match(out, /<code>██████████<\/code>/, 'customer full bar');
  assert.match(out, /<sub>confidence&nbsp;·&nbsp;<code>low<\/code><\/sub>/);
});

test('value card: composite "mixed" note names the masking gain/regression', () => {
  const card: ValueCard = { axes: [axis('money', -15.9), axis('customer', 60)] };
  const out = renderValueCard(input(card, { overallPercent: 22 }))!;
  assert.match(out, /<strong>mixed<\/strong>: a \+60\.0% customer gain masks a −15\.9% money regression/);
});

test('value card: composite note degrades to label when not mixed', () => {
  const card: ValueCard = { axes: [axis('customer', 60), axis('runtime', 5)] };
  const out = renderValueCard(input(card, { overallPercent: 32 }))!;
  assert.match(out, /mean of the 2 axes — <strong>improved<\/strong>/);
});

test('value card: since-last-review shows deltas when prior state exists', () => {
  const card: ValueCard = { axes: [axis('money', 2.9), axis('runtime', -3)] };
  const prior: DriftState = { v: 1, axes: { money: 0.8, runtime: -2 } };
  const out = renderValueCard(input(card, { priorState: prior }))!;
  assert.match(out, /🔁 \*\*Since last review\*\* &nbsp; 💰 ▲ \+2\.1pp · ⚙️ ▼ −1\.0pp/);
});

test('value card: since-last-review first-run placeholder without prior', () => {
  const card: ValueCard = { axes: [axis('money', 2.9)] };
  const out = renderValueCard(input(card))!;
  assert.match(out, /First run on this PR — no prior snapshot/);
});

test('value card: highlights + bottom line, and NO redundant bar-chart (dashboard bars already show it)', () => {
  const card: ValueCard = {
    axes: [axis('customer', 60)],
    bottom_line: 'Bottom line — all positive.',
    bars_mermaid: 'xychart-beta\n bar [1]',
  };
  const counts: PrCounts = {
    features: { value: 3, label: 'f' },
    bug_fixes: { value: 0, label: 'b' },
    issues_resolved: { value: 0, label: 'i' },
    new_test_files: { value: 0, label: 't' },
  };
  const out = renderValueCard(input(card, { counts }))!;
  assert.match(out, /\*\*Bottom line —\*\* all positive\./, 'strips the scanner prefix');
  assert.doesNotMatch(out, /Bottom line —\s*Bottom line —/);
  assert.match(out, /\*\*Highlights:\*\* ✨ \*\*3\*\* new features/);
  // The Mermaid bar-chart was removed as a duplicate of the dashboard's bars,
  // even when the scanner supplies bars_mermaid.
  assert.doesNotMatch(out, /📈 Bar-chart view/, 'no duplicate bar-chart view');
  assert.doesNotMatch(out, /xychart-beta/, 'scanner bar-chart is not rendered');
});

test('value card: how-computed nests one <details> per axis with formula + inputs', () => {
  const card: ValueCard = {
    axes: [
      axis('money', 2.9, 'high', {
        subtitle: 'Net infra delta',
        formula: 'Δ% = a − b',
        kv: [{ label: 'Potential cost', value: '-$399', kind: 'cost' }],
        inputs: { loc_added: 54, touches_infrastructure: false },
        source: 'HiBob',
        source_link: 'https://hibob',
      }),
    ],
  };
  const out = renderValueCard(input(card))!;
  assert.match(out, /<summary>📐 How each axis was computed/);
  assert.match(out, /<summary>💰 Money · <code>\+2\.9%<\/code> · confidence <code>high<\/code><\/summary>/);
  assert.match(out, /\*Net infra delta\*/);
  assert.match(out, /Δ% = a − b/);
  assert.match(out, /- Potential cost: \*\*-\$399\*\*/);
  assert.match(out, /\*\*Key inputs:\*\* `loc_added=54` · `touches_infrastructure=false`/);
  assert.match(out, /\*\*Source:\*\* \[HiBob\]\(https:\/\/hibob\)/);
});

// ── degradation ──────────────────────────────────────────────────────────────

test('value card: counts only (no axes) → highlights, no table', () => {
  const counts: PrCounts = { features: { value: 2, label: 'f' } };
  const out = renderValueCard(input(undefined, { counts }))!;
  assert.doesNotMatch(out, /<table>/);
  assert.match(out, /\*\*Highlights:\*\*/);
});

test('value card: nothing to show → null', () => {
  assert.equal(renderValueCard(input(undefined)), null);
  assert.equal(renderValueCard(input({ axes: [] })), null);
});

test('value card: single axis → 100% width, composite bar present', () => {
  const out = renderValueCard(input({ axes: [axis('customer', 12)] }, { overallPercent: 12 }))!;
  assert.match(out, /width="100%"/);
  assert.match(out, /mean of the axis/);
});
