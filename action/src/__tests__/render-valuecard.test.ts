// Value card: a single quickchart.io horizontal-bar image of per-axis value
// drift (Δ% vs base). Dark theme; regressions red / improvements green / flat
// grey; the composite + regressed-axis count live in the chart title. The old
// HTML dashboard table, "how each axis was computed" details, highlights,
// bottom-line, and since-last-review line were all removed — so the suite now
// asserts the encoded chart config and the null-degradation paths.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderValueCard, type ValueCardInput } from '../render/sections/value_card.ts';
import type { ValueAxis, ValueCard, PrCounts } from '../report.ts';
import type { DriftState } from '../render/state.ts';

// Gauge-palette bar fills the renderer assigns, as they read in the *decoded*
// chart JSON: regression red / improvement green / flat grey.
const RED = 'rgba(226,75,74,0.85)';
const GREEN = 'rgba(63,185,80,0.85)';
const GREY = 'rgba(136,135,128,0.7)';

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

/**
 * Pull the URL-decoded chart config out of the rendered `![…](url)` markdown.
 * The config is everything after `&c=` up to the markdown image's closing `)`.
 * NOTE: encodeURIComponent leaves `(`/`)` literal (the "Change vs base (%)"
 * label), so we anchor on `&c=` and the trailing `)\n?$`, not the first `)`.
 */
function decodeConfig(out: string): string {
  const m = out.match(/quickchart\.io\/chart\?.*?&c=(.+)\)\s*$/s);
  assert.ok(m, 'expected a quickchart image URL with a &c= config');
  return decodeURIComponent(m![1]);
}

test('value card: renders the H2 and a quickchart horizontal-bar image', () => {
  const card: ValueCard = { axes: [axis('money', -15.9), axis('customer', 60), axis('runtime', -3), axis('runtime_ux', 0)] };
  const out = renderValueCard(input(card, { overallPercent: 10.3 }))!;
  assert.match(out, /## 📊 Business value/);
  assert.match(out, /!\[PR value drift\]\(https:\/\/quickchart\.io\/chart\?/);
  // Dark background + canvas size are part of the URL, not the encoded config.
  assert.match(out, /bkg=%230d0d10&w=900&h=400&c=/);
  const cfg = decodeConfig(out);
  assert.match(cfg, /"type":"horizontalBar"/);
});

test('value card: axis labels are emoji-stripped and carry per-axis deltas', () => {
  const card: ValueCard = { axes: [axis('money', -15.9), axis('customer', 60), axis('runtime', -3), axis('runtime_ux', 0)] };
  const out = renderValueCard(input(card, { overallPercent: 10.3 }))!;
  const cfg = decodeConfig(out);
  // Leading emoji dropped from each label.
  assert.match(cfg, /"labels":\["Money","Customer value","Runtime","Runtime UX"\]/);
  // delta_percent values, rounded to 1dp, in axis order.
  assert.match(cfg, /"data":\[-15\.9,60,-3,0\]/);
});

test('value card: bar colours encode regression(red)/improvement(green)/flat(grey)', () => {
  // money down → red, customer up → green, runtime down → red, runtime_ux flat → grey.
  const card: ValueCard = { axes: [axis('money', -15.9), axis('customer', 60), axis('runtime', -3), axis('runtime_ux', 0)] };
  const out = renderValueCard(input(card, { overallPercent: 10.3 }))!;
  const cfg = decodeConfig(out);
  assert.match(cfg, new RegExp(`"backgroundColor":\\["${esc(RED)}","${esc(GREEN)}","${esc(RED)}","${esc(GREY)}"\\]`));
  // The flat axis is grey and is NOT counted as a regression.
  assert.match(cfg, /2 of 4 axes regressed/);
});

test('value card: a "down" direction is red even when delta_percent is non-negative', () => {
  // direction overrides the sign in barColor(): direction 'down' ⇒ red + regressed.
  const card: ValueCard = { axes: [axis('money', 0, 'low', { direction: 'down' })] };
  const out = renderValueCard(input(card, { overallPercent: 0 }))!;
  const cfg = decodeConfig(out);
  assert.match(cfg, new RegExp(`"backgroundColor":\\["${esc(RED)}"\\]`));
  assert.match(cfg, /1 of 1 axis regressed/);
});

test('value card: title is two lines with composite % and regressed-axis count', () => {
  const card: ValueCard = { axes: [axis('money', -15.9), axis('customer', 60), axis('runtime', -3), axis('runtime_ux', 0)] };
  const out = renderValueCard(input(card, { overallPercent: 10.3 }))!;
  const cfg = decodeConfig(out);
  assert.match(cfg, /"text":\["PR value drift - per-axis \(% vs base\)","Composite \+10\.3%   \|   2 of 4 axes regressed"\]/);
});

test('value card: negative composite uses the U+2212 minus in the title', () => {
  const card: ValueCard = { axes: [axis('money', -56.7), axis('customer', 0), axis('runtime', -3), axis('runtime_ux', 0)] };
  const out = renderValueCard(input(card, { overallPercent: -14.9 }))!;
  // U+2212 (−) URL-encodes to %E2%88%92.
  assert.match(out, /Composite%20%E2%88%9214.9%25/);
  assert.match(decodeConfig(out), /Composite −14\.9%   \|   2 of 4 axes regressed/);
});

test('value card: composite falls back to the axis mean when overallPercent is omitted', () => {
  // mean(-15.9, 60) = 22.05 → +22.1%.
  const card: ValueCard = { axes: [axis('money', -15.9), axis('customer', 60)] };
  const out = renderValueCard(input(card))!;
  assert.match(decodeConfig(out), /Composite \+22\.1%   \|   1 of 2 axes regressed/);
});

test('value card: single axis still renders a one-bar chart with singular title', () => {
  const out = renderValueCard(input({ axes: [axis('customer', 12)] }, { overallPercent: 12 }))!;
  const cfg = decodeConfig(out);
  assert.match(cfg, /"type":"horizontalBar"/);
  assert.match(cfg, /"labels":\["Customer value"\]/);
  assert.match(cfg, /"data":\[12\]/);
  assert.match(cfg, new RegExp(`"backgroundColor":\\["${esc(GREEN)}"\\]`));
  // Singular "axis" (not "axes") for a single-axis card.
  assert.match(cfg, /Composite \+12\.0%   \|   0 of 1 axis regressed/);
});

test('value card: the scanner-supplied Mermaid bar-chart is not rendered', () => {
  const card: ValueCard = {
    axes: [axis('customer', 60)],
    bottom_line: 'Bottom line — all positive.',
    bars_mermaid: 'xychart-beta\n bar [1]',
  };
  const out = renderValueCard(input(card))!;
  // Only the quickchart image survives — no Mermaid, no bottom-line prose.
  assert.match(out, /!\[PR value drift\]\(https:\/\/quickchart\.io\/chart\?/);
  assert.doesNotMatch(out, /xychart-beta/);
  assert.doesNotMatch(out, /Bottom line/);
});

// ── degradation ──────────────────────────────────────────────────────────────

test('value card: counts only (no axes) → null (nothing to chart)', () => {
  const counts: PrCounts = { features: { value: 2, label: 'f' } };
  const out = renderValueCard(input(undefined, { counts }));
  assert.equal(out, null);
});

test('value card: nothing to show → null', () => {
  assert.equal(renderValueCard(input(undefined)), null);
  assert.equal(renderValueCard(input({ axes: [] })), null);
});

/** Escape a string for use as a literal inside a RegExp. */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
