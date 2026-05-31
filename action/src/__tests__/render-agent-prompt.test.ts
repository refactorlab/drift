// Fix-with-AI handoff prompts — the per-finding copy-paste prompt and the
// batched Fix-All. Asserts the prompt is self-contained (file/line restated),
// category-keyed constraints, and the confidence-keyed STOP guardrail.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CodeSuggestion } from '../report.ts';
import { buildAgentPrompt, buildFixAllPrompt } from '../render/lib/agent_prompt.ts';
import type { PrContext } from '../render/context.ts';

const CTX: PrContext = { owner: 'acme', repo: 'shop', sha: 'cafe1234' };

function sug(over: Partial<CodeSuggestion> = {}): CodeSuggestion {
  return {
    category: 'B',
    category_label: 'Product correctness — Raw SQL concatenation',
    file: 'src/Repo.kt',
    line: 17,
    confidence: 0.78,
    why_it_matters: 'Possible SQL injection — a keyword sits next to string interpolation.',
    remediation_hint: 'Use parameterized queries / bind parameters.',
    references: [{ url: 'https://example.com' }],
    diff: { before_lines: [{ code: 'val q = "SELECT " + name', line_number: 17 }] },
    ...over,
  };
}

test('buildAgentPrompt: self-contained — restates file/line, problem, do-this, constraints, acceptance', () => {
  const p = buildAgentPrompt(sug(), CTX);
  assert.match(p, /^You are fixing ONE finding/);
  assert.match(p, /FILE: src\/Repo\.kt/, 'file path restated (agent cannot see the PR)');
  assert.match(p, /PROBLEM:/);
  assert.match(p, /SQL injection/);
  assert.match(p, /DO THIS:/);
  assert.match(p, /parameterized queries/);
  assert.match(p, /CONSTRAINTS:/);
  assert.match(p, /ACCEPTANCE:/);
  assert.match(p, /github\.com\/acme\/shop\/blob\/cafe1234/, 'permalink when ctx present');
});

test('buildAgentPrompt: confidence < 0.85 appends the STOP guardrail; >= 0.85 does not', () => {
  const low = buildAgentPrompt(sug({ confidence: 0.78 }));
  assert.match(low, /~78% confident.*STOP and explain why/s, 'guardrail at low confidence');
  const high = buildAgentPrompt(sug({ confidence: 0.95 }));
  assert.doesNotMatch(high, /STOP and explain why/, 'no guardrail at high confidence');
});

test('buildAgentPrompt: category-keyed constraints differ (B preserves behaviour, A is dead-code)', () => {
  const b = buildAgentPrompt(sug({ category: 'B' }));
  assert.match(b, /Preserve the public signature/);
  const a = buildAgentPrompt(sug({ category: 'A', category_label: 'Optimization — Dead code', remediation_hint: undefined }));
  assert.match(a, /genuinely unused/);
});

test('buildAgentPrompt: degrades without ctx (no permalink) and without a diff (no CURRENT CODE)', () => {
  const p = buildAgentPrompt(sug({ diff: undefined }));
  assert.doesNotMatch(p, /CURRENT CODE:/, 'no code block without a diff');
  assert.doesNotMatch(p, /https:\/\/github\.com/, 'no permalink without ctx');
  assert.match(p, /FILE: src\/Repo\.kt:17/);
});

test('buildFixAllPrompt: null for a lone finding, numbered tasklist for two+', () => {
  assert.equal(buildFixAllPrompt([sug()], CTX), null, 'a batch of one is just the single prompt');
  const all = buildFixAllPrompt([sug({ file: 'a.kt' }), sug({ file: 'b.kt', confidence: 0.95 })], CTX)!;
  assert.match(all, /resolving the 2 findings/);
  assert.match(all, /^1\. \[/m);
  assert.match(all, /^2\. \[/m);
  assert.match(all, /GLOBAL CONSTRAINTS:/);
  assert.match(all, /false positive, STOP/);
});
