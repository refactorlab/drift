// Contract tests between action.yml and the AI bundles it invokes.
//
// action.yml is the seam between the user's workflow and the bundled
// JS that does the work — a regression on either side is silent at
// build time and only shows up on a real PR run. These tests parse
// the YAML, find the AI inference + AI post steps, and assert:
//
//   • Every env var the bundles READ (per source comments in
//     `ai/infer-one-core.ts` and `ai-index.ts`) is SET by action.yml.
//   • The bash for-loop calls `node dist/ai-infer-one.js "$i"` with
//     `i` ranging 0..limit-1 (not 1..limit, not inclusive-N).
//   • The intermediate file path is the SAME between the writer
//     (ai-infer-one.js → AI_OUT) and the reader (ai-suggest.js →
//     AI_SUGGESTIONS_PATH). A typo on either side silently breaks
//     the post step.
//   • The bundle file paths action.yml references actually exist
//     under `dist/` and are tracked by git (the CI sync guard
//     already checks the contents are in sync; we check the paths
//     here so a rename can't slip through unnoticed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

type Step = {
  name?: string;
  id?: string;
  env?: Record<string, string>;
  run?: string;
};
type ActionYml = {
  runs: { steps: Step[] };
};

function loadActionYml(): ActionYml {
  const src = readFileSync(resolve(repoRoot, 'action.yml'), 'utf8');
  return parseYaml(src) as ActionYml;
}

function findStep(action: ActionYml, predicate: (s: Step) => boolean): Step {
  const s = action.runs.steps.find(predicate);
  assert.ok(s, 'expected step not found in action.yml — has it been renamed?');
  return s!;
}

test('contract: AI inference step sets EVERY env var the bundle reads', () => {
  const action = loadActionYml();
  const step = findStep(action, (s) => s.id === 'ai-loop');
  // The full list is documented in ai-infer-one.ts's header comment
  // and consumed in ai/infer-one-core.ts's `main()` (via env in
  // ai-infer-one.ts). Keep this list in lockstep with that file.
  const required = [
    'AI_OUT',
    'DRIFT_REPORT_PATH',
    'AI_ENDPOINT',
    'AI_MODEL',
    'AI_BASE_SHA',
    'AI_HEAD_SHA',
    'GITHUB_TOKEN',
    // AI_MAX_OUTPUT_TOKENS has a default, but action.yml sets it explicitly
    // so reasoning models get enough room. Treat as required for the
    // contract — a missing value here would tighten the budget silently.
    'AI_MAX_OUTPUT_TOKENS',
  ];
  for (const k of required) {
    assert.ok(
      step.env && Object.prototype.hasOwnProperty.call(step.env, k),
      `ai-loop step is missing env var "${k}" — the bundle reads it but action.yml doesn't set it`,
    );
  }
});

test('contract: AI loop iterates 0..limit-1 (NOT 1..limit) and calls the right bundle path', () => {
  const action = loadActionYml();
  const step = findStep(action, (s) => s.id === 'ai-loop');
  assert.ok(step.run, 'ai-loop step must have a `run` block');

  // Bash loop initializes i=0 and continues while i<limit. A future
  // refactor that changes either to i=1 / i<=limit would shift the
  // index range the bundle sees and either skip finding #0 or call
  // out-of-range. Pin the loop shape.
  assert.match(step.run!, /\bi=0\b/, 'bash loop must start at i=0');
  assert.match(step.run!, /\[\s*"\$i"\s*-lt\s*"\$limit"\s*\]/, 'bash loop must compare i<limit');

  // The exact CLI shape the bundle expects: `node <path> "$i"`.
  assert.match(
    step.run!,
    /node "\$\{\{\s*github\.action_path\s*\}\}\/dist\/ai-infer-one\.js" "\$i"/,
    'ai-loop must invoke dist/ai-infer-one.js with the index as the single positional arg',
  );

  // limit = min(total, AI_MAX) — protects the per-PR budget. A
  // regression that drops this cap would burn the user's Models
  // quota on a noisy report.
  assert.match(
    step.run!,
    /\[\s*"\$total"\s*-gt\s*"\$AI_MAX"\s*\]\s*2>\/dev\/null\s*&&\s*limit="\$AI_MAX"/,
    'ai-loop must cap limit to AI_MAX when total exceeds it',
  );
});

test('contract: ai-infer-one writes the SAME path that ai-suggest reads', () => {
  const action = loadActionYml();
  const inferStep = findStep(action, (s) => s.id === 'ai-loop');
  // Find the post step by its bundle reference (its id changes more
  // often than the file it invokes).
  // Match the step that INVOKES ai-suggest.js (not just mentions it in a
  // comment) — `node "…/dist/ai-suggest.js"` is the unambiguous shape.
  const postStep = findStep(action, (s) =>
    typeof s.run === 'string' && /node\s+"[^"]*\/dist\/ai-suggest\.js"/.test(s.run),
  );

  const writerPath = inferStep.env?.AI_OUT;
  const readerPath = postStep.env?.AI_SUGGESTIONS_PATH;
  assert.ok(writerPath, 'ai-loop must define AI_OUT');
  assert.ok(readerPath, 'ai-suggest step must define AI_SUGGESTIONS_PATH');
  assert.equal(
    writerPath,
    readerPath,
    'AI_OUT (writer) and AI_SUGGESTIONS_PATH (reader) MUST be the same path — ' +
      'a mismatch silently produces a "no suggestions to post" outcome.',
  );
});

test('contract: every bundle path action.yml references exists on disk', () => {
  const action = loadActionYml();
  const referenced = new Set<string>();
  for (const step of action.runs.steps) {
    if (typeof step.run !== 'string') continue;
    // Match `dist/<file>.js` references in any `run` block. We DON'T
    // try to evaluate ${{ github.action_path }} — that's covered by
    // CI when the action is actually invoked. The relevant invariant
    // is "the file the YAML names exists under dist/".
    for (const m of step.run.matchAll(/dist\/([a-z0-9_-]+\.js)/g)) {
      referenced.add(m[1]);
    }
  }
  assert.ok(referenced.size > 0, 'expected at least one dist/*.js reference in action.yml');
  for (const f of referenced) {
    const p = resolve(repoRoot, 'dist', f);
    assert.ok(existsSync(p), `action.yml references dist/${f} but ${p} does not exist`);
  }
});

test('contract: ai-loop is a NO-OP when the scanner produced zero findings', () => {
  // The user explicitly requested: "if there aren't code suggestions
  // it not suppose to run." The bash loop guards this via
  //   total=$(jq '(.pr_review.code_suggestions // []) | length' …)
  //   limit=$total; [ $total -gt $AI_MAX ] && limit=$AI_MAX
  //   while [ $i -lt $limit ]; do …
  // → total=0 → limit=0 → loop body never executes; no inference
  // calls are made and the envelope stays {"suggestions":[]}. Pin
  // every load-bearing line so a future refactor can't silently lose
  // the guard.
  const action = loadActionYml();
  const step = findStep(action, (s) => s.id === 'ai-loop');
  assert.ok(step.run, 'ai-loop step must have a `run` block');
  const body = step.run!;

  // 1. The scanner-count source MUST be the canonical `pr_review.code_suggestions` array
  //    (so a scan with no findings yields total=0). The `// []` fallback handles
  //    a scan that didn't even produce a pr_review block.
  assert.match(
    body,
    /jq\s+'\(\.pr_review\.code_suggestions\s*\/\/\s*\[\]\)\s*\|\s*length'/,
    'total must come from (.pr_review.code_suggestions // []) | length',
  );
  // 2. The `|| echo 0` jq fallback means an unreadable/missing report → 0 → no inference.
  assert.match(
    body,
    /\|\|\s*echo\s+0\)?/,
    'jq pipeline must fall back to 0 on error so a broken report does NOT inference',
  );
  // 3. The loop condition is `[ $i -lt $limit ]` — when limit=0 the body never runs.
  assert.match(
    body,
    /while\s+\[\s*"\$i"\s*-lt\s*"\$limit"\s*\]\s*;\s*do/,
    'while-loop must short-circuit when limit=0',
  );
});

test('contract: AI_MAX_INPUT_TOKENS in action.yml is below the 8000-token cap (documented invariant)', () => {
  const action = loadActionYml();
  const step = findStep(action, (s) => s.id === 'ai-loop');
  const val = step.env?.AI_MAX_INPUT_TOKENS;
  assert.ok(val, 'ai-loop should set AI_MAX_INPUT_TOKENS so the prompt budget is explicit');
  const n = Number.parseInt(val, 10);
  assert.ok(Number.isFinite(n) && n > 0, `AI_MAX_INPUT_TOKENS must be a positive integer, got: ${val}`);
  // The Free/low GitHub Models tier caps INPUT at 8000 tokens (system
  // + user + chat envelope, server-side counted). We leave headroom
  // by sitting under it. A regression to ≥ 8000 would re-introduce
  // the 413 the per-suggestion loop was built to prevent.
  assert.ok(n < 8000, `AI_MAX_INPUT_TOKENS must be < 8000 (headroom for the chat envelope), got ${n}`);
});
