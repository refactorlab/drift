// AI suggestions in the sticky "Code suggestions" section.
//
// Covers the three new pieces of the AI-suggestion-in-sticky feature:
//   1. ai/to-code-suggestion.ts — reconstruct a faithful red/green diff from
//      the PR patch (the `-` side) + the model's after_code (the `+` side),
//      with surrounding context; fail-soft to after-only with no patch.
//   2. render/sections/suggestions.ts — AI findings render as expanded
//      "code suggestion" blocks (narrative + diff) separate from the
//      deterministic priority table, and never get capped out of view.
//   3. action.yml — the sticky comment is deferred to the combined poster
//      when AI is on, with the footer/artifact env threaded through.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { aiToCodeSuggestion, reconstructDiff, mergeAiSuggestionsIntoReport } from '../ai/to-code-suggestion.ts';
import { renderSuggestions } from '../render/sections/suggestions.ts';
import type { AISuggestion } from '../ai/schema.ts';
import type { CodeSuggestion, ScanPrOutput } from '../report.ts';
import type { PrContext } from '../render/context.ts';

const CTX: PrContext = { owner: 'acme', repo: 'shop', sha: 'cafe1234' };

// A header-less per-file patch (the shape GitHub's pulls.listFiles returns).
// New-file lines: 10 ctxA · 11 ctxB · 12 oldA(+) · 13 oldB(+) · 14 ctxC.
const PATCH = [
  '@@ -10,3 +10,5 @@',
  ' ctxA',
  ' ctxB',
  '+oldA',
  '+oldB',
  ' ctxC',
].join('\n');

function ai(over: Partial<AISuggestion> = {}): AISuggestion {
  return {
    file: 'src/auth.ts',
    line: 13,
    start_line: 12,
    category: 'A',
    confidence: 0.9,
    summary: 'Replace the two lines with the new pair.',
    why_it_matters: 'because the old pair is wrong in a way that matters',
    references: [{ url: 'https://ref.example', title: 'Ref' }],
    after_code: 'newA\nnewB',
    ...over,
  };
}

// ── 1. reconstructDiff ────────────────────────────────────────────────────────

test('reconstructDiff: context + red (current lines) + green (after_code)', () => {
  const r = reconstructDiff(PATCH, 12, 13, 'newA\nnewB');
  assert.equal(
    r.unified,
    ['  ctxA', '  ctxB', '- oldA', '- oldB', '+ newA', '+ newB', '  ctxC'].join('\n'),
  );
  // before_lines are the replaced current lines, line-numbered (for the agent
  // prompt's CURRENT CODE + permalink range).
  assert.deepEqual(
    r.beforeLines,
    [
      { code: 'oldA', kind: 'del', line_number: 12 },
      { code: 'oldB', kind: 'del', line_number: 13 },
    ],
  );
  assert.deepEqual(r.afterLines, [
    { code: 'newA', kind: 'add' },
    { code: 'newB', kind: 'add' },
  ]);
});

test('reconstructDiff: no patch → after-only (green) diff, no red side', () => {
  const r = reconstructDiff(undefined, 12, 13, 'newA\nnewB');
  assert.equal(r.unified, '+ newA\n+ newB');
  assert.deepEqual(r.beforeLines, []);
  assert.equal(r.afterLines.length, 2);
});

test('reconstructDiff: range not materialised in any hunk → after-only', () => {
  // Lines 900-901 are nowhere in PATCH → cannot anchor the red side.
  const r = reconstructDiff(PATCH, 900, 901, 'x');
  assert.equal(r.unified, '+ x');
  assert.deepEqual(r.beforeLines, []);
});

test('reconstructDiff: single-line suggestion (start == end)', () => {
  const r = reconstructDiff(PATCH, 12, 12, 'onlyNew');
  assert.match(r.unified, /- oldA/);
  assert.ok(!r.unified.includes('- oldB'), 'only line 12 is replaced');
  assert.match(r.unified, /\+ onlyNew/);
});

// ── 2. aiToCodeSuggestion ─────────────────────────────────────────────────────

test('aiToCodeSuggestion: tags source/summary/model + derives label & language', () => {
  const s = aiToCodeSuggestion(ai(), PATCH, 'openai/gpt-4.1');
  assert.equal(s.source, 'ai');
  assert.equal(s.model, 'openai/gpt-4.1');
  assert.equal(s.summary, 'Replace the two lines with the new pair.');
  assert.equal(s.category_label, 'Optimization');
  assert.equal(s.language, 'typescript');
  assert.equal(s.file, 'src/auth.ts');
  assert.equal(s.line, 13);
  assert.ok(s.diff?.unified?.includes('- oldA'));
  assert.ok(s.diff?.after_lines?.length === 2);
});

test('aiToCodeSuggestion: start_line defaults to line for single-line findings', () => {
  const s = aiToCodeSuggestion(ai({ start_line: undefined, line: 12 }), PATCH, 'm');
  assert.match(s.diff!.unified!, /- oldA/);
  assert.ok(!s.diff!.unified!.includes('- oldB'));
});

test('aiToCodeSuggestion: blank summary collapses to undefined', () => {
  const s = aiToCodeSuggestion(ai({ summary: '   ' }), PATCH, 'm');
  assert.equal(s.summary, undefined);
});

// ── 3. renderSuggestions with AI findings ─────────────────────────────────────

function det(over: Partial<CodeSuggestion> = {}): CodeSuggestion {
  return {
    category: 'A',
    file: 'src/d.ts',
    line: 6,
    confidence: 1,
    why_it_matters: 'dead code lives here',
    references: [{ url: 'https://ref', title: 'Ref' }],
    ...over,
  };
}

test('renderSuggestions: AI finding renders an expanded "code suggestion" block', () => {
  const out = renderSuggestions([aiToCodeSuggestion(ai(), PATCH, 'openai/gpt-4.1')], CTX)!;
  assert.match(out, /## ⚠️ Code suggestions \(1\)/);
  assert.match(out, /### 🤖 AI-refined code suggestions \(1\)/);
  assert.match(out, /<details open>/);
  assert.match(out, /🤖 <strong>code suggestion<\/strong>/);
  assert.match(out, /<code>openai\/gpt-4\.1<\/code>/);
  assert.match(out, /\*\*What\*\* — Replace the two lines/);
  assert.match(out, /\*\*Why it matters\*\* — because/);
  // the red/green diff with context
  assert.match(out, /- oldA\n- oldB\n\+ newA\n\+ newB/);
  // AI-only ⇒ NO deterministic priority table
  assert.ok(!out.includes('| Priority | Finding | Location | Confidence |'), 'no table when AI-only');
});

test('renderSuggestions: mixed det + AI — table for det, block for AI, count spans both', () => {
  const out = renderSuggestions(
    [det({ severity: 'high' } as Partial<CodeSuggestion>), aiToCodeSuggestion(ai(), PATCH, 'm')],
    CTX,
  )!;
  assert.match(out, /## ⚠️ Code suggestions \(2\)/);
  assert.match(out, /\| Priority \| Finding \| Location \| Confidence \|/); // det table present
  assert.match(out, /### 🤖 AI-refined code suggestions \(1\)/); // AI block present
  // deterministic detail block uses the closed <details>, AI uses <details open>
  assert.match(out, /<details open>/);
});

test('renderSuggestions: AI block is never capped out by the deterministic table cap', () => {
  // 12 deterministic (cap defaults to 10) + 1 AI. The AI block must still show.
  const many = Array.from({ length: 12 }, (_, i) => det({ file: `src/f${i}.ts`, line: i + 1 }));
  const out = renderSuggestions([...many, aiToCodeSuggestion(ai(), PATCH, 'm')], CTX)!;
  assert.match(out, /## ⚠️ Code suggestions \(13\)/);
  assert.match(out, /_…\+2 more suggestion/); // 12 det − 10 shown = 2 overflow (det only)
  assert.match(out, /### 🤖 AI-refined code suggestions \(1\)/); // AI still rendered
});

test('renderSuggestions: AI <summary> HTML-escapes a PR-controlled file path', () => {
  const evil = aiToCodeSuggestion(ai({ file: 'src/<img>.ts' }), undefined, 'm');
  const out = renderSuggestions([evil], CTX)!;
  // The structural <summary> line must carry the ESCAPED path — a raw `<img>`
  // there would close <summary>/<code> early and inject a tag. (The path also
  // appears verbatim inside the agent-prompt ```text fence, where GitHub
  // renders it literally — that's safe, so we scope the check to <summary>.)
  const summaryLine = out.split('\n').find((l) => l.includes('code suggestion') && l.startsWith('<summary>'))!;
  assert.match(summaryLine, /src\/&lt;img&gt;\.ts/);
  assert.ok(!summaryLine.includes('<img>'), 'raw tag must not survive into the <summary>');
});

// ── 3b. mergeAiSuggestionsIntoReport (the deferred-sticky merge) ──────────────

function baseReport(detSuggestions: CodeSuggestion[] = []): ScanPrOutput {
  return {
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift', version: '0' },
    pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    pr_review: { overall_drift: { percent: 5, direction: 'up', confidence: 'low' }, code_suggestions: detSuggestions },
  };
}

test('merge: empty AI → deterministic suggestions unchanged, input not mutated', () => {
  const detList = [det({ file: 'src/d.ts', line: 6 })];
  const report = baseReport(detList);
  const merged = mergeAiSuggestionsIntoReport(report, [], new Map(), 'm');
  assert.deepEqual(merged.pr_review!.code_suggestions, detList);
  assert.notEqual(merged, report, 'returns a new report object');
  assert.equal(report.pr_review!.code_suggestions!.length, 1, 'input report not mutated');
  // unrelated pr_review fields survive the merge
  assert.equal(merged.pr_review!.overall_drift!.percent, 5);
});

test('merge: AI wins on path:line collision; non-colliding det kept', () => {
  const report = baseReport([
    det({ file: 'src/auth.ts', line: 13, why_it_matters: 'deterministic version here' }),
    det({ file: 'src/other.ts', line: 99 }),
  ]);
  const merged = mergeAiSuggestionsIntoReport(report, [ai()], new Map([['src/auth.ts', PATCH]]), 'm');
  const cs = merged.pr_review!.code_suggestions!;
  // the colliding deterministic src/auth.ts:13 is dropped; the AI one replaces it
  const authEntries = cs.filter((s) => s.file === 'src/auth.ts' && s.line === 13);
  assert.equal(authEntries.length, 1);
  assert.equal(authEntries[0].source, 'ai');
  // the non-colliding deterministic entry survives
  assert.ok(cs.some((s) => s.file === 'src/other.ts' && s.line === 99 && s.source !== 'ai'));
});

test('merge: null patches → AI diff degrades to after-only (no crash, no red side)', () => {
  const merged = mergeAiSuggestionsIntoReport(baseReport(), [ai()], null, 'm');
  const aiEntry = merged.pr_review!.code_suggestions!.find((s) => s.source === 'ai')!;
  assert.ok(aiEntry.diff?.unified?.startsWith('+ '), 'after-only diff');
  assert.ok(!aiEntry.diff!.unified!.includes('- '), 'no red side without a patch');
});

test('merge: absent pr_review → fresh pr_review carrying just the AI suggestions', () => {
  const report = baseReport();
  delete report.pr_review;
  const merged = mergeAiSuggestionsIntoReport(report, [ai()], new Map([['src/auth.ts', PATCH]]), 'm');
  assert.equal(merged.pr_review!.code_suggestions!.length, 1);
  assert.equal(merged.pr_review!.code_suggestions![0].source, 'ai');
});

// ── 4. action.yml defer wiring ────────────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url));
const ACTION = parseYaml(readFileSync(resolve(here, '..', '..', '..', 'action.yml'), 'utf8'));
const STEPS: Array<Record<string, unknown>> = ACTION.runs.steps;

function stepByName(name: string): Record<string, unknown> | undefined {
  return STEPS.find((s) => s.name === name);
}

test('action.yml: step 9 defers the sticky comment only when AI is on', () => {
  const env = stepByName('Post Drift PR review')!.env as Record<string, string>;
  assert.ok('DRIFT_DEFER_STICKY_COMMENT' in env, 'step 9 sets the defer flag');
  assert.match(env.DRIFT_DEFER_STICKY_COMMENT, /ai-suggestions.*== 'true'.*'true'.*''/s);
});

test('action.yml: combined poster receives the defer flag + footer/artifact env', () => {
  const env = stepByName('Post combined inline review')!.env as Record<string, string>;
  for (const key of [
    'DRIFT_DEFER_STICKY_COMMENT',
    'DRIFT_AUDIO_URL',
    'DRIFT_AUDIO_MP4_URL',
    'DRIFT_SCAN_JSON_URL',
    'DRIFT_SCAN_CONTEXT_URL',
  ]) {
    assert.ok(key in env, `combined poster step must receive ${key}`);
  }
});
