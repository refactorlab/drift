// Suggestions: priority table, CAUTION callout, severity→priority mapping,
// detail blocks (snippet permalink vs code-span fallback vs diff), table-cell
// escaping, quality-bar filtering, and ordering.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSuggestions } from '../render/sections/suggestions.ts';
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

test('suggestions detail: bare snippet permalink with context, plain fallback without', () => {
  const s = sug({
    category: 'B',
    severity: 'high',
    file: 'r.kt',
    line: 17,
    diff: {
      before_lines: [
        { line_number: 16, code: 'val a = 1', kind: 'ctx' },
        { line_number: 17, code: 'sql = "..." + x', kind: 'del' },
      ],
      after_lines: [],
    },
  });
  const withCtx = renderSuggestions([s], CTX)!;
  assert.match(withCtx, /\*\*Current code\*\* — a bare commit-pinned permalink/);
  assert.match(withCtx, /https:\/\/github\.com\/acme\/shop\/blob\/cafe1234\/r\.kt#L16-L17/);

  const noCtx = renderSuggestions([s])!;
  assert.doesNotMatch(noCtx, /blob\/cafe1234/, 'no permalink without context');
  assert.match(noCtx, /```\nval a = 1\nsql = "\.\.\." \+ x\n```/, 'falls back to a fenced code block with both lines');
});

test('suggestions detail: red/green diff when after_lines present', () => {
  const s = sug({
    category: 'B',
    severity: 'high',
    diff: {
      before_lines: [{ line_number: 1, code: 'old()', kind: 'del' }],
      after_lines: [{ line_number: 1, code: 'new()', kind: 'add' }],
    },
  });
  const out = renderSuggestions([s], CTX)!;
  assert.match(out, /\*\*Suggested fix:\*\*/);
  assert.match(out, /```diff\n- old\(\)\n\+ new\(\)\n```/);
});

test('suggestions: current-code fence widens past backticks in the code', () => {
  const s = sug({
    category: 'A',
    severity: 'low',
    language: 'python',
    diff: { before_lines: [{ line_number: 1, code: 'doc = """see ```ex``` """', kind: 'ctx' }], after_lines: [] },
  });
  const out = renderSuggestions([s])!; // no ctx → code-block fallback
  // inner ``` run of 3 → fence must be at least 4 backticks
  assert.match(out, /````python\ndoc = """see ```ex``` """\n````/);
});

test('suggestions: table cell escapes pipe in the finding label', () => {
  const out = renderSuggestions([sug({ category: 'A', category_label: 'Opt — a | b' })], CTX)!;
  assert.match(out, /🅐 a \\\| b/);
});

test('suggestions: detail <summary> HTML-escapes PR-controlled file path + label (no tag injection)', () => {
  // File paths can legally contain `<`/`>` on Linux/macOS. A hostile path must
  // NOT be able to close the <summary> early or inject a phantom <details> in
  // the per-finding disclosure (the summary is a STRUCTURAL HTML context, not
  // a markdown code span).
  const evil = sug({
    category: 'B',
    category_label: 'Raw SQL',
    file: 'src/</summary><details>evil.ts',
    line: 1,
    confidence: 0.9,
  });
  const out = renderSuggestions([evil], CTX)!;
  const summaryLine = out.split('\n').find((l) => l.startsWith('<summary>') && l.includes('evil'))!;
  // The hostile chars are escaped inside the <code> element of the summary.
  assert.match(summaryLine, /&lt;\/summary&gt;&lt;details&gt;evil\.ts/, 'path is HTML-escaped in the summary');
  // No RAW </summary> or <details> leaked into the summary line beyond its own
  // single closing tag.
  assert.equal((summaryLine.match(/<\/summary>/g) ?? []).length, 1, 'exactly one real </summary>');
  assert.doesNotMatch(summaryLine, /<details>/, 'no raw <details> injected into the summary');
});

test('suggestions: null when nothing clears the quality bar', () => {
  assert.equal(renderSuggestions(undefined), null);
  assert.equal(renderSuggestions([]), null);
  assert.equal(renderSuggestions([sug({ confidence: 0.5 })]), null, 'below confidence threshold');
  assert.equal(renderSuggestions([sug({ references: [] })]), null, 'no reference link');
});
