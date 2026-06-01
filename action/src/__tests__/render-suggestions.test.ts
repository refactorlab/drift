// Suggestions: priority table (one row per finding), CAUTION callout,
// severity→priority mapping, the Fix-All handoff, render cap + overflow note,
// table-cell escaping, quality-bar filtering, dedupe, and ordering.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSuggestions, DEFAULT_MAX_SUGGESTIONS } from '../render/sections/suggestions.ts';
import type { CodeSuggestion } from '../report.ts';
import type { PrContext } from '../render/context.ts';

const CTX: PrContext = { owner: 'acme', repo: 'shop', sha: 'cafe1234' };

function sug(over: Partial<CodeSuggestion> = {}): CodeSuggestion {
  return {
    category: 'A',
    file: 'src/a.ts',
    line: 10,
    confidence: 1,
    why_it_matters: 'because',
    references: [{ url: 'https://ref', title: 'Ref' }],
    ...over,
  };
}

test('suggestions: header count + priority table + CAUTION for cat-B', () => {
  const out = renderSuggestions(
    [
      sug({ category: 'B', severity: 'high', category_label: 'Product correctness — SQLi', file: 'r.kt', line: 17, confidence: 0.78 } as Partial<CodeSuggestion>),
      sug({ category: 'A', severity: 'low', category_label: 'Optimization — Dead code', file: 'd.ts', line: 6 } as Partial<CodeSuggestion>),
    ],
    CTX,
  )!;
  assert.match(out, /## ⚠️ Code suggestions \(2\)/);
  assert.match(out, /\[!CAUTION\]/);
  assert.match(out, /\*\*1 product-correctness issue\*\* was flagged/);
  assert.match(out, /\| Priority \| Finding \| Location \| Confidence \|/);
  // cat-B (high) ranks above cat-A (low)
  const bIdx = out.indexOf('🅑 SQLi');
  const aIdx = out.indexOf('🅐 Dead code');
  assert.ok(bIdx > 0 && aIdx > 0 && bIdx < aIdx, 'product-correctness row first');
  assert.match(out, /🔴 High \| 🅑 SQLi \| \[`r\.kt:17`\]/);
  assert.match(out, /⚪ Low \| 🅐 Dead code \| \[`d\.ts:6`\]/);
});

test('suggestions: severity→priority mapping', () => {
  const high = renderSuggestions([sug({ category: 'A', severity: 'critical' } as Partial<CodeSuggestion>)], CTX)!;
  assert.match(high, /🔴 High/);
  const med = renderSuggestions([sug({ category: 'C' })], CTX)!;
  assert.match(med, /🟡 Medium/);
  const low = renderSuggestions([sug({ category: 'A', severity: 'low' } as Partial<CodeSuggestion>)], CTX)!;
  assert.match(low, /⚪ Low/);
});

// NOTE: the old per-finding <details> detail blocks (bare snippet permalink vs
// fenced code-span fallback, red/green `Suggested fix:` diff, and the
// backtick-widening current-code fence) were REMOVED — renderSuggestions now
// emits one priority-table row per finding plus a single batched Fix-All
// handoff. The diff-shape tests that covered renderDetail were deleted with the
// feature; the cap/overflow + Fix-All tests below cover the new surface.

test('suggestions: caps at DEFAULT_MAX_SUGGESTIONS rows + overflow note keeps the true total', () => {
  const many = Array.from({ length: DEFAULT_MAX_SUGGESTIONS + 3 }, (_, i) =>
    sug({ category: 'A', severity: 'high', file: `src/f${i}.ts`, line: i + 1 }),
  );
  const out = renderSuggestions(many, CTX)!;
  // Heading carries the TRUE total, not the capped count.
  assert.match(out, new RegExp(`## ⚠️ Code suggestions \\(${many.length}\\)`));
  // Exactly DEFAULT_MAX_SUGGESTIONS data rows render (the link text is the
  // basename `fN.ts:line`, so match the location code-span, not the full path).
  const dataRows = out.split('\n').filter((l) => l.startsWith('|') && /`f\d+\.ts:\d+`/.test(l));
  assert.equal(dataRows.length, DEFAULT_MAX_SUGGESTIONS, `expected ${DEFAULT_MAX_SUGGESTIONS} rows`);
  // Overflow note states how many were hidden and how many are shown.
  const hidden = many.length - DEFAULT_MAX_SUGGESTIONS;
  assert.match(out, new RegExp(`_…\\+${hidden} more suggestions not shown — rendering the top ${DEFAULT_MAX_SUGGESTIONS} by priority\\._`));
});

test('suggestions: the `max` opt overrides the default cap', () => {
  const many = Array.from({ length: 4 }, (_, i) => sug({ category: 'A', severity: 'high', file: `src/f${i}.ts`, line: i + 1 }));
  const out = renderSuggestions(many, CTX, { max: 2 })!;
  const dataRows = out.split('\n').filter((l) => l.startsWith('|') && /`f\d+\.ts:\d+`/.test(l));
  assert.equal(dataRows.length, 2, 'max:2 keeps two rows');
  assert.match(out, /_…\+2 more suggestions not shown — rendering the top 2 by priority\._/);
});

test('suggestions: single batched Fix-All handoff dispatches the shown findings', () => {
  const out = renderSuggestions(
    [
      sug({ category: 'A', severity: 'high', file: 'src/a.ts', line: 10 }),
      sug({ category: 'B', severity: 'high', file: 'src/b.ts', line: 20 }),
    ],
    CTX,
  )!;
  assert.match(out, /<summary>🤖 <strong>Fix-All handoff<\/strong> — one prompt that dispatches all 2 findings<\/summary>/);
  // It is wrapped in a copy-paste ```text fence.
  assert.match(out, /```text\nYou are resolving the 2 findings from a Drift PR review\./);
});

test('suggestions: a lone finding omits the Fix-All handoff', () => {
  // buildFixAllPrompt returns null for a single finding (a batch of one is just
  // the per-finding ask) — so no Fix-All <details> is rendered.
  const out = renderSuggestions([sug({ category: 'A', severity: 'high' })], CTX)!;
  assert.doesNotMatch(out, /Fix-All handoff/);
});

test('suggestions: table cell escapes pipe in the finding label', () => {
  const out = renderSuggestions([sug({ category: 'A', category_label: 'Opt — a | b' })], CTX)!;
  assert.match(out, /🅐 a \\\| b/);
});

test('suggestions: hostile PR-controlled label + file path stay one well-formed table row', () => {
  // The per-finding <details>/<summary> disclosure was REMOVED, so a hostile
  // file path can no longer close a <summary> early or inject a phantom
  // <details> — there is no structural HTML summary per finding anymore. The
  // surviving escaping surface is the markdown TABLE: the finding LABEL cell
  // (cell() escapes `|`) and the Location cell (fileLink → a `code span`). A
  // hostile `|` in the label must not split the row into extra columns.
  const evil = sug({
    // The label cell renders the SUFFIX after the em-dash; put the hostile `|`
    // there so a fake column would appear if it weren't escaped.
    category: 'B',
    category_label: 'Raw SQL — drop | TABLE users',
    file: 'src/</summary><details>evil.ts',
    line: 1,
    confidence: 0.9,
  });
  const out = renderSuggestions([evil], CTX)!;
  // The finding is rendered as exactly one data row carrying the label suffix.
  const rows = out.split('\n').filter((l) => l.startsWith('|') && l.includes('TABLE users'));
  assert.equal(rows.length, 1, 'one well-formed data row for the finding');
  // The `|` inside the label is escaped so the cell can't fork into a fake
  // column (4 logical cells → 5 unescaped pipes: leading/trailing + 3 separators).
  assert.match(rows[0], /🅑 drop \\\| TABLE users/);
  assert.equal((rows[0].match(/(?<!\\)\|/g) ?? []).length, 5, 'exactly four cells — the label pipe did not split the row');
  // The file path lands in the Location code-span (not a structural HTML
  // context): the raw `<details>` there is inert markdown text inside `` `…` ``.
  assert.match(rows[0], /\[`[^`]*<details>evil\.ts:1`\]/, 'hostile path is a markdown code span, URL-encoded in the href');
  // The per-finding <summary> injection surface is GONE: the only <summary> the
  // section can emit is the batched Fix-All handoff, which never carries the
  // file path — so the hostile path can never reach a structural <summary>.
  assert.ok(!out.split('\n').some((l) => l.startsWith('<summary>') && l.includes('evil')), 'no per-finding summary carries the hostile path');
});

test('suggestions: null when nothing clears the quality bar', () => {
  assert.equal(renderSuggestions(undefined), null);
  assert.equal(renderSuggestions([]), null);
  assert.equal(renderSuggestions([sug({ confidence: 0.5 })]), null, 'below confidence threshold');
  assert.equal(renderSuggestions([sug({ references: [] })]), null, 'no reference link');
});

test('suggestions: identical findings (same file+line+kind) collapse to one row', () => {
  // Mirrors the real bug: a call-graph node reached from several roots emitted
  // one identical N+1 suggestion per root, repeating verbatim in the comment.
  // (The per-finding <details> block was removed, so we now assert ONLY the
  // single collapsed table row — the dedupe is what's under test.)
  const dupe = sug({
    category: 'A',
    severity: 'high',
    file: 'src/api.rs',
    line: 173,
    confidence: 0.95,
    kind: 'call_graph_n_plus_one',
  } as Partial<CodeSuggestion>);
  const out = renderSuggestions([dupe, { ...dupe }, { ...dupe }], CTX)!;
  // Header count reflects distinct findings, not the 3 raw copies.
  assert.match(out, /## ⚠️ Code suggestions \(1\)/);
  // Exactly one table row references the location (link text is the basename).
  const rows = out.split('\n').filter((l) => l.startsWith('|') && l.includes('`api.rs:173`'));
  assert.equal(rows.length, 1, `expected one table row, got ${rows.length}`);
});

test('suggestions: same file+line but different kind are both kept', () => {
  // Distinct findings at one location (e.g. recursion + N+1 on a function
  // header line) must NOT be collapsed — the dedupe key includes `kind`.
  const base = { category: 'A', severity: 'high', file: 'src/api.rs', line: 433, confidence: 0.95 } as Partial<CodeSuggestion>;
  const out = renderSuggestions(
    [sug({ ...base, kind: 'recursive' }), sug({ ...base, kind: 'call_graph_n_plus_one' })],
    CTX,
  )!;
  assert.match(out, /## ⚠️ Code suggestions \(2\)/);
  const rows = out.split('\n').filter((l) => l.startsWith('|') && l.includes('`api.rs:433`'));
  assert.equal(rows.length, 2, `both distinct kinds should render, got ${rows.length}`);
});

test('suggestions: dedupe keeps the highest-confidence copy', () => {
  const lo = sug({ category: 'A', severity: 'high', file: 'src/api.rs', line: 173, confidence: 0.6, kind: 'call_graph_n_plus_one' } as Partial<CodeSuggestion>);
  const hi = sug({ category: 'A', severity: 'high', file: 'src/api.rs', line: 173, confidence: 0.95, kind: 'call_graph_n_plus_one' } as Partial<CodeSuggestion>);
  const out = renderSuggestions([lo, hi], CTX)!;
  assert.match(out, /## ⚠️ Code suggestions \(1\)/);
  // The surviving row carries 95%; the 60% copy is dropped.
  const row = out.split('\n').find((l) => l.startsWith('|') && l.includes('`api.rs:173`'))!;
  assert.match(row, /\| 95% \|/);
  assert.doesNotMatch(out, /\| 60% \|/);
});
