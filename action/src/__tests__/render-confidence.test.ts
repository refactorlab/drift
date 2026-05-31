// Merge-confidence 0–5 score, the cross-push trend sparkline, the bounded
// state history, and the blast-radius / coverage panel — Feature 2's pieces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type ScanPrOutput, type ValueAxis } from '../report.ts';
import { extractFacts } from '../render/lib/facts.ts';
import { mergeConfidence } from '../render/lib/confidence.ts';
import { sparkline } from '../render/lib/bars.ts';
import { appendConfHistory, CONF_HISTORY_CAP } from '../render/state.ts';
import { renderBlastRadius } from '../render/sections/blast_radius.ts';

function makeReport(over: Partial<ScanPrOutput['pr_review']>, ext?: ScanPrOutput['pr_review_ext'], scope?: Partial<ScanPrOutput['pr_scope']>): ScanPrOutput {
  return {
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: 't' },
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [], ...scope },
    pr_review: over,
    pr_review_ext: ext,
  };
}

function axis(name: ValueAxis['name'], delta: number): ValueAxis {
  return {
    name,
    label: { money: '💰 Money', customer: '👥 Customer value', runtime: '⚙️ Runtime', runtime_ux: '🎨 Runtime UX' }[name],
    delta_percent: delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
    confidence: 'low',
    inputs: name === 'money' ? { loc_added: 40, loc_deleted: 5 } : undefined,
  };
}

const bug = { category: 'B' as const, category_label: 'Product correctness — bad', file: 'a.ts', line: 1, confidence: 0.9, why_it_matters: 'x', references: [{ url: 'https://r' }] };

// ── merge-confidence ─────────────────────────────────────────────────────────

test('confidence: a clean improvement scores 5/5 (ship), green, no drivers', () => {
  const c = mergeConfidence(extractFacts(makeReport({ overall_drift: { percent: 8, direction: 'up', confidence: 'high' }, value_card: { axes: [axis('customer', 8)] }, counts: { new_test_files: { value: 3, label: 't' } } })));
  assert.equal(c.score, 5);
  assert.equal(c.label, 'ship with confidence');
  assert.equal(c.drivers.length, 0);
});

test('confidence: a correctness finding drops the score and names it as a driver', () => {
  const c = mergeConfidence(extractFacts(makeReport({ value_card: { axes: [axis('customer', 5)] }, code_suggestions: [bug] })));
  assert.ok(c.score <= 4, `correctness lowers confidence (got ${c.score})`);
  assert.ok(c.drivers.some((d) => /correctness/.test(d)));
});

test('confidence: untested reached roots penalise and surface as a driver', () => {
  const r = makeReport(
    { value_card: { axes: [axis('customer', 5)] } },
    { tests_in_graph: { test_files: 0, test_functions: 0, by_language: {}, uncovered_roots: ['a', 'b'] } },
    { affected_roots: ['a', 'b'], changed_files: ['a.ts'], unreachable_changes: [] },
  );
  const c = mergeConfidence(extractFacts(r));
  assert.ok(c.score < 5);
  assert.ok(c.drivers.some((d) => /untested/.test(d)));
});

test('confidence: monotonic — adding findings never raises the score', () => {
  const base = mergeConfidence(extractFacts(makeReport({ value_card: { axes: [axis('customer', 5)] } }))).score;
  const worse = mergeConfidence(extractFacts(makeReport({ value_card: { axes: [axis('customer', 5)] }, code_suggestions: [bug] }))).score;
  assert.ok(worse <= base);
});

// ── sparkline ────────────────────────────────────────────────────────────────

test('sparkline: <2 points → empty; ascending → same length, rising blocks', () => {
  assert.equal(sparkline([]), '');
  assert.equal(sparkline([3]), '');
  const s = sparkline([2, 3, 4, 5]);
  assert.equal([...s].length, 4);
  assert.equal(s[0], '▁', 'min maps to the lowest block');
  assert.equal(s[s.length - 1], '█', 'max maps to the highest block');
});

test('sparkline: a flat series renders without throwing (no divide-by-zero)', () => {
  const s = sparkline([3, 3, 3]);
  assert.equal([...s].length, 3);
});

// ── state history ────────────────────────────────────────────────────────────

test('appendConfHistory: appends, tolerates a missing/garbage prior, and caps length', () => {
  assert.deepEqual(appendConfHistory(null, 4), [4]);
  assert.deepEqual(appendConfHistory({ v: 1, confHistory: [2, 3] }, 4), [2, 3, 4]);
  // @ts-expect-error — exercising a hand-edited/garbage prior
  assert.deepEqual(appendConfHistory({ v: 1, confHistory: 'nope' }, 4), [4]);
  const long = appendConfHistory({ v: 1, confHistory: Array.from({ length: CONF_HISTORY_CAP + 5 }, () => 5) }, 4);
  assert.equal(long.length, CONF_HISTORY_CAP);
  assert.equal(long[long.length - 1], 4);
});

// ── blast radius panel ───────────────────────────────────────────────────────

test('blastRadius: omitted when there is nothing to act on (all tested, no missing)', () => {
  const r = makeReport(
    {},
    { tests_in_graph: { test_files: 1, test_functions: 1, by_language: {}, uncovered_roots: [] }, nfr_edge_cases: { families: {}, per_root: [{ root: 'a', covered: ['reliability'], missing: [] }], reliability_gaps: [] } },
    { affected_roots: ['a'], changed_files: ['a.ts'], unreachable_changes: [] },
  );
  assert.equal(renderBlastRadius(extractFacts(r)), null);
});

test('blastRadius: untested reached roots render 🔴, capped guards, and a "add tests for" line', () => {
  const r = makeReport(
    {},
    {
      tests_in_graph: { test_files: 0, test_functions: 0, by_language: {}, uncovered_roots: ['createOrder', 'findById'] },
      nfr_edge_cases: { families: {}, per_root: [{ root: 'findById', covered: [], missing: ['retry', 'timeout', 'fallback', 'observability', 'security'] }], reliability_gaps: ['findById'] },
    },
    { affected_roots: ['createOrder', 'findById'], changed_files: ['a.ts'], unreachable_changes: [] },
  );
  const out = renderBlastRadius(extractFacts(r))!;
  assert.match(out, /## 🎯 Blast radius & coverage/);
  assert.match(out, /🔴 \*\*no\*\*/, 'untested roots flagged red');
  assert.match(out, /\*\+2\*/, 'guard families capped to 3 with a +N tail');
  assert.match(out, /Before merge, add tests for:.*createOrder/);
});
