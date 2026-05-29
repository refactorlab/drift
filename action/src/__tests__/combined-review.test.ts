// combined-review: verify the SINGLE-REVIEW contract end-to-end.
//
// Two layers:
//   1. mergeAndDedupe(det, ai) — pure helper exported from ai-index.ts.
//      The dedupe rule (AI wins on path:line collision; order preserves
//      deterministic-first) is the rule that lets one createReview call
//      carry both sets without duplicating an inline comment at the same
//      anchor.
//   2. action.yml structural — main.ts gets DRIFT_DEFER_INLINE_REVIEW
//      ONLY when ai-suggestions is true; the combined-poster step (12)
//      runs ONLY when ai-suggestions is true; main.ts has access to the
//      env var; the post step reads BOTH DRIFT_REPORT_PATH AND
//      AI_SUGGESTIONS_PATH; the step is NOT gated on ai-loop success
//      anymore (so a failed AI loop still posts the deterministic
//      review).
//
// Why structural for layer 2: action.yml is the integration surface; if
// the env wiring drifts (e.g., someone forgets to add
// DRIFT_REPORT_PATH to step 12) the combined poster silently falls
// back to AI-only and reviewers lose deterministic inline comments
// without any local signal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { mergeAndDedupe } from '../ai-index.ts';
import type { ReviewComment } from '../contract/github.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const ACTION_YML = readFileSync(join(REPO, 'action.yml'), 'utf8');
type StepSpec = { name?: string; id?: string; if?: string; env?: Record<string, string>; run?: string };
type ActionDoc = { runs: { steps: StepSpec[] } };
const ACTION: ActionDoc = parseYaml(ACTION_YML) as ActionDoc;
const STEPS = ACTION.runs.steps;

function stepByName(name: string): StepSpec {
  const s = STEPS.find((x) => x.name === name);
  if (!s) throw new Error(`step "${name}" not found in action.yml`);
  return s;
}

// ─── mergeAndDedupe ────────────────────────────────────────────────────

function comment(path: string, line: number, body = 'x'): ReviewComment {
  return { path, line, side: 'RIGHT', body };
}

test('mergeAndDedupe: disjoint sets concatenate (deterministic first)', () => {
  const det = [comment('a.ts', 1, 'det-a'), comment('a.ts', 2, 'det-b')];
  const ai = [comment('b.ts', 1, 'ai-a')];
  const merged = mergeAndDedupe(det, ai);
  assert.deepEqual(merged.map((c) => `${c.path}:${c.line}`), ['a.ts:1', 'a.ts:2', 'b.ts:1']);
  // Deterministic entries unchanged.
  assert.equal(merged[0].body, 'det-a');
  assert.equal(merged[1].body, 'det-b');
  assert.equal(merged[2].body, 'ai-a');
});

test('mergeAndDedupe: path:line collision — AI wins', () => {
  const det = [comment('a.ts', 5, 'DET-VERSION')];
  const ai = [comment('a.ts', 5, 'AI-VERSION')];
  const merged = mergeAndDedupe(det, ai);
  assert.equal(merged.length, 1, 'duplicate must collapse to one entry');
  assert.equal(merged[0].body, 'AI-VERSION', 'AI body wins on collision');
});

test('mergeAndDedupe: partial overlap — keep non-overlapping det, AI replaces matching', () => {
  const det = [comment('a.ts', 1, 'D1'), comment('a.ts', 2, 'D2'), comment('b.ts', 1, 'D3')];
  const ai = [comment('a.ts', 2, 'A2'), comment('c.ts', 9, 'A9')];
  const merged = mergeAndDedupe(det, ai);
  // a.ts:1 (det, no collision), b.ts:1 (det, no collision), a.ts:2 (AI wins), c.ts:9 (AI only).
  assert.deepEqual(
    merged.map((c) => `${c.path}:${c.line}=${c.body}`),
    ['a.ts:1=D1', 'b.ts:1=D3', 'a.ts:2=A2', 'c.ts:9=A9'],
  );
});

test('mergeAndDedupe: line differs by 1 → no collision', () => {
  const det = [comment('a.ts', 5, 'D')];
  const ai = [comment('a.ts', 6, 'A')];
  const merged = mergeAndDedupe(det, ai);
  assert.equal(merged.length, 2, 'different lines are distinct anchors');
});

test('mergeAndDedupe: path case-sensitive', () => {
  const det = [comment('A.ts', 1, 'D')];
  const ai = [comment('a.ts', 1, 'A')];
  const merged = mergeAndDedupe(det, ai);
  assert.equal(merged.length, 2, 'GitHub paths are case-sensitive — must not collapse');
});

test('mergeAndDedupe: empty det → AI only; empty AI → det only', () => {
  const a = mergeAndDedupe([], [comment('x.ts', 1, 'A')]);
  assert.equal(a.length, 1);
  assert.equal(a[0].body, 'A');
  const d = mergeAndDedupe([comment('x.ts', 1, 'D')], []);
  assert.equal(d.length, 1);
  assert.equal(d[0].body, 'D');
  assert.deepEqual(mergeAndDedupe([], []), []);
});

test('mergeAndDedupe: stable — det entries keep their original order', () => {
  // Even with collisions in the middle, the surviving det entries stay in
  // input order. This matters because the scanner already emits them in
  // severity_rank DESC + confidence DESC order, and that's the right
  // display priority.
  const det = [
    comment('a.ts', 1, 'D1'),
    comment('a.ts', 2, 'D2'), // collides with AI
    comment('a.ts', 3, 'D3'),
    comment('a.ts', 4, 'D4'), // collides with AI
    comment('a.ts', 5, 'D5'),
  ];
  const ai = [comment('a.ts', 2, 'A2'), comment('a.ts', 4, 'A4')];
  const merged = mergeAndDedupe(det, ai);
  assert.deepEqual(
    merged.map((c) => `${c.line}=${c.body}`),
    ['1=D1', '3=D3', '5=D5', '2=A2', '4=A4'],
    'surviving det entries preserve their relative order; AI appended at the end',
  );
});

// ─── action.yml structural ─────────────────────────────────────────────

test('action.yml: main.ts step receives DRIFT_DEFER_INLINE_REVIEW (true only when AI on)', () => {
  const step = stepByName('Post Drift PR review');
  const env = step.env ?? {};
  const expr = (env.DRIFT_DEFER_INLINE_REVIEW ?? '').toString();
  assert.ok(expr, 'DRIFT_DEFER_INLINE_REVIEW must be wired into main.ts env');
  // The expression must be "true" iff ai-suggestions resolves to true,
  // and empty otherwise. The shape we want:
  //   ${{ (...ai-suggestions...) == 'true' && 'true' || '' }}
  assert.match(
    expr,
    /ai-suggestions[\s\S]*==\s*'true'\s*&&\s*'true'\s*\|\|\s*''/,
    'DRIFT_DEFER_INLINE_REVIEW expression must resolve to "true" only when AI is enabled',
  );
});

test('action.yml: combined-poster step gated on ai-suggestions, NOT on ai-loop success', () => {
  const step = stepByName('Post combined inline review');
  const cond = step.if ?? '';
  assert.match(cond, /ai-suggestions[\s\S]*==\s*'true'/, 'must gate on ai-suggestions');
  assert.match(cond, /scan_ran\s*==\s*'true'/, 'must gate on scan_ran');
  assert.match(cond, /head_sha\s*!=\s*''/, 'must gate on head_sha resolved');
  assert.doesNotMatch(
    cond,
    /ai-loop\.outcome\s*==\s*'success'/,
    'must NOT require ai-loop success — fallback to deterministic-only on AI failure',
  );
});

test('action.yml: combined-poster reads BOTH DRIFT_REPORT_PATH AND AI_SUGGESTIONS_PATH', () => {
  const step = stepByName('Post combined inline review');
  const env = step.env ?? {};
  assert.ok(
    (env.DRIFT_REPORT_PATH ?? '').toString().length > 0,
    'combined poster needs DRIFT_REPORT_PATH to read deterministic suggestions',
  );
  assert.ok(
    (env.AI_SUGGESTIONS_PATH ?? '').toString().length > 0,
    'combined poster needs AI_SUGGESTIONS_PATH for the AI envelope',
  );
});

test('action.yml: combined-poster runs dist/ai-suggest.js (same bundle, expanded role)', () => {
  const step = stepByName('Post combined inline review');
  assert.match(
    step.run ?? '',
    /dist\/ai-suggest\.js/,
    'must invoke dist/ai-suggest.js — that bundle now reads both sources',
  );
});

test('action.yml: no legacy "Post AI suggestions" step name (renamed to combined)', () => {
  const legacy = STEPS.find((s) => s.name === 'Post AI suggestions');
  assert.equal(
    legacy,
    undefined,
    'the legacy "Post AI suggestions" step must be replaced by "Post combined inline review"',
  );
});

test('action.yml: main.ts step still gated as before (scan_ran + head_sha)', () => {
  const step = stepByName('Post Drift PR review');
  const cond = step.if ?? '';
  assert.match(cond, /scan_ran\s*==\s*'true'/);
  assert.match(cond, /head_sha\s*!=\s*''/);
});
