// sticky-only suggestion surface — verify the SINGLE-COMMENT contract.
//
// When AI suggestions are enabled, ALL code suggestions (deterministic +
// AI-refined) live in ONE place: the Drift sticky comment's "Code suggestions"
// section. There is NO second inline-review thread. main.ts is told to skip its
// own inline review (DRIFT_DEFER_INLINE_REVIEW) and to defer the sticky comment
// (DRIFT_DEFER_STICKY_COMMENT) to step 12 (dist/ai-suggest.js), which merges the
// AI-refined suggestions into the report and re-renders that single comment.
//
// These are action.yml STRUCTURAL tests: action.yml is the integration surface,
// and if the env wiring drifts (e.g. someone forgets DRIFT_REPORT_PATH on step
// 12, or stops deferring) the single-comment contract silently regresses with no
// local signal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const ACTION_YML = readFileSync(join(REPO, 'action.yml'), 'utf8');
type StepSpec = { name?: string; id?: string; if?: string; env?: Record<string, string>; run?: string };
type ActionDoc = { runs: { steps: StepSpec[] } };
const ACTION: ActionDoc = parseYaml(ACTION_YML) as ActionDoc;
const STEPS = ACTION.runs.steps;

// The step that owns the single sticky comment when AI is on.
const STICKY_STEP = 'Post Drift sticky comment with AI suggestions';

function stepByName(name: string): StepSpec {
  const s = STEPS.find((x) => x.name === name);
  if (!s) throw new Error(`step "${name}" not found in action.yml`);
  return s;
}

// ─── action.yml structural ─────────────────────────────────────────────

test('action.yml: main.ts step receives DRIFT_DEFER_INLINE_REVIEW (true only when AI on)', () => {
  const step = stepByName('Post Drift PR review');
  const env = step.env ?? {};
  const expr = (env.DRIFT_DEFER_INLINE_REVIEW ?? '').toString();
  assert.ok(expr, 'DRIFT_DEFER_INLINE_REVIEW must be wired into main.ts env');
  // The expression must be "true" iff ai-suggestions resolves to true,
  // and empty otherwise — so main.ts skips its inline review when AI is on
  // (the sticky comment becomes the only suggestion surface).
  assert.match(
    expr,
    /ai-suggestions[\s\S]*==\s*'true'\s*&&\s*'true'\s*\|\|\s*''/,
    'DRIFT_DEFER_INLINE_REVIEW expression must resolve to "true" only when AI is enabled',
  );
});

test('action.yml: main.ts step defers the sticky comment (true only when AI on)', () => {
  const step = stepByName('Post Drift PR review');
  const env = step.env ?? {};
  const expr = (env.DRIFT_DEFER_STICKY_COMMENT ?? '').toString();
  assert.ok(expr, 'DRIFT_DEFER_STICKY_COMMENT must be wired into main.ts env');
  assert.match(
    expr,
    /ai-suggestions[\s\S]*==\s*'true'\s*&&\s*'true'\s*\|\|\s*''/,
    'sticky comment must be deferred to step 12 only when AI is enabled',
  );
});

test('action.yml: sticky-poster step gated on ai-suggestions, NOT on ai-loop success', () => {
  const step = stepByName(STICKY_STEP);
  const cond = step.if ?? '';
  assert.match(cond, /ai-suggestions[\s\S]*==\s*'true'/, 'must gate on ai-suggestions');
  assert.match(cond, /scan_ran\s*==\s*'true'/, 'must gate on scan_ran');
  assert.match(cond, /head_sha\s*!=\s*''/, 'must gate on head_sha resolved');
  assert.doesNotMatch(
    cond,
    /ai-loop\.outcome\s*==\s*'success'/,
    'must NOT require ai-loop success — render the deterministic-only sticky on AI failure',
  );
});

test('action.yml: sticky-poster reads BOTH DRIFT_REPORT_PATH AND AI_SUGGESTIONS_PATH', () => {
  const step = stepByName(STICKY_STEP);
  const env = step.env ?? {};
  assert.ok(
    (env.DRIFT_REPORT_PATH ?? '').toString().length > 0,
    'sticky poster needs DRIFT_REPORT_PATH to read deterministic suggestions + render the overview',
  );
  assert.ok(
    (env.AI_SUGGESTIONS_PATH ?? '').toString().length > 0,
    'sticky poster needs AI_SUGGESTIONS_PATH for the AI envelope',
  );
});

test('action.yml: sticky-poster owns the sticky comment (DRIFT_DEFER_STICKY_COMMENT wired in)', () => {
  const step = stepByName(STICKY_STEP);
  const env = step.env ?? {};
  assert.ok(
    (env.DRIFT_DEFER_STICKY_COMMENT ?? '').toString().length > 0,
    'sticky poster must receive DRIFT_DEFER_STICKY_COMMENT so it owns the single comment',
  );
});

test('action.yml: sticky-poster runs dist/ai-suggest.js', () => {
  const step = stepByName(STICKY_STEP);
  assert.match(
    step.run ?? '',
    /dist\/ai-suggest\.js/,
    'must invoke dist/ai-suggest.js — that bundle renders the single sticky comment',
  );
});

test('action.yml: no legacy inline-review step names linger', () => {
  for (const legacyName of ['Post AI suggestions', 'Post combined inline review']) {
    assert.equal(
      STEPS.find((s) => s.name === legacyName),
      undefined,
      `the legacy "${legacyName}" step must be replaced by "${STICKY_STEP}"`,
    );
  }
});

test('action.yml: main.ts step still gated as before (scan_ran + head_sha)', () => {
  const step = stepByName('Post Drift PR review');
  const cond = step.if ?? '';
  assert.match(cond, /scan_ran\s*==\s*'true'/);
  assert.match(cond, /head_sha\s*!=\s*''/);
});
