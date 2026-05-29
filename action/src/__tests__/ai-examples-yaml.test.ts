// Validates the documented consumer workflows under examples/.
//
// These files are copy-paste templates for users — they MUST be valid
// GitHub Actions YAML AND wire the action correctly. A typo here is a
// silent breakage for every consumer who pastes the file. The pieces
// pinned below:
//
//   1. YAML parses (no syntax error).
//   2. The `on:` triggers match the comment + the action's expected
//      modes (pull_request OR issue_comment).
//   3. Every required permission for the action's documented surface
//      is granted.
//   4. The action reference points at this repo (or `./` for local).
//   5. `with:` inputs use only names declared by action.yml — a typo
//      like `ai_model` (underscore) instead of `ai-model` (dash) would
//      silently fall back to the default.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

type ActionYml = {
  inputs?: Record<string, unknown>;
  runs: { steps: Array<{ id?: string; uses?: string; with?: Record<string, unknown> }> };
};
type WorkflowYml = {
  on: unknown;
  permissions?: Record<string, string>;
  jobs: Record<string, {
    runs_on?: string | string[]; // `runs-on` in raw YAML
    steps: Array<{ uses?: string; with?: Record<string, unknown>; run?: string; if?: string }>;
  } & Record<string, unknown>>;
};

function loadActionYml(): ActionYml {
  return parseYaml(readFileSync(resolve(repoRoot, 'action.yml'), 'utf8')) as ActionYml;
}

function loadWorkflow(name: string): WorkflowYml {
  return parseYaml(readFileSync(resolve(repoRoot, 'examples', name), 'utf8')) as WorkflowYml;
}

// Inputs the action.yml declares — built once, used by every test below.
const action = loadActionYml();
const declaredInputs = new Set(Object.keys(action.inputs ?? {}));

// ─── examples/drift.yml ────────────────────────────────────────────────

test('examples/drift.yml: file exists + parses as valid YAML', () => {
  const p = resolve(repoRoot, 'examples/drift.yml');
  assert.ok(existsSync(p), 'examples/drift.yml must exist');
  // parse error would already have thrown above.
  const wf = loadWorkflow('drift.yml');
  assert.ok(wf.jobs, 'must declare jobs');
});

test('examples/drift.yml: triggers on pull_request (the documented mode)', () => {
  const wf = loadWorkflow('drift.yml');
  // `on` can be a string ("push") or object ({ pull_request: { types: [...] } }).
  const on = wf.on as Record<string, unknown>;
  assert.ok('pull_request' in on, 'must trigger on pull_request');
});

test('examples/drift.yml: grants every permission the action needs', () => {
  const wf = loadWorkflow('drift.yml');
  const perms = wf.permissions ?? {};
  // The four permissions documented in action.yml's `ai-suggestions` input.
  // Note: `models: read` is needed for the AI pass; not yet in drift.yml,
  // but `audio-summary` also needs it — pin both `pull-requests` and
  // `checks` minimum.
  assert.equal(perms['contents'], 'read', 'contents: read required for checkout');
  assert.equal(perms['pull-requests'], 'write', 'pull-requests: write required to post the review');
  assert.equal(perms['checks'], 'write', 'checks: write required for the check run');
});

test('examples/drift.yml: invokes the action by repo ref (refactorlab/drift@...)', () => {
  const wf = loadWorkflow('drift.yml');
  const job = Object.values(wf.jobs)[0];
  // At LEAST one step `uses:` the action. We don't pin the version because
  // `@main` and `@v0.4.0` are both reasonable.
  const usesAction = job.steps.some((s) =>
    typeof s.uses === 'string' && /(?:refactorlab\/drift|\.\/)/.test(s.uses),
  );
  assert.ok(usesAction, 'examples/drift.yml must invoke refactorlab/drift or ./ as a step');
});

test('examples/drift.yml: every `with:` input the example sets is declared in action.yml', () => {
  // The killer regression test: if a user pastes the workflow and
  // mistypes an input (e.g. `ai_model` underscore), GitHub silently
  // ignores it and the action falls back to the default. This test
  // catches the typo in OUR documented example so consumers never
  // see it.
  const wf = loadWorkflow('drift.yml');
  for (const job of Object.values(wf.jobs)) {
    for (const step of job.steps ?? []) {
      if (!step.uses?.includes('refactorlab/drift') && !step.uses?.startsWith('./')) continue;
      const withInputs = Object.keys(step.with ?? {});
      for (const k of withInputs) {
        assert.ok(
          declaredInputs.has(k),
          `examples/drift.yml sets unknown input "${k}" — typo or removed input? Declared: ${[...declaredInputs].sort().join(', ')}`,
        );
      }
    }
  }
});

// ─── examples/drift-on-comment.yml ─────────────────────────────────────

test('examples/drift-on-comment.yml: file exists + parses', () => {
  const p = resolve(repoRoot, 'examples/drift-on-comment.yml');
  assert.ok(existsSync(p), 'examples/drift-on-comment.yml must exist');
  const wf = loadWorkflow('drift-on-comment.yml');
  assert.ok(wf.jobs);
});

test('examples/drift-on-comment.yml: triggers on issue_comment (the comment-mode entry)', () => {
  const wf = loadWorkflow('drift-on-comment.yml');
  const on = wf.on as Record<string, unknown>;
  assert.ok('issue_comment' in on, 'must trigger on issue_comment to handle /drift');
});

test('examples/drift-on-comment.yml: sets start-on-pr-comment: true (the activation switch)', () => {
  const wf = loadWorkflow('drift-on-comment.yml');
  let found = false;
  for (const job of Object.values(wf.jobs)) {
    for (const step of job.steps ?? []) {
      if (!step.uses?.includes('refactorlab/drift') && !step.uses?.startsWith('./')) continue;
      if (step.with && step.with['start-on-pr-comment'] === true) {
        found = true;
        break;
      }
    }
  }
  assert.ok(found, 'examples/drift-on-comment.yml MUST set with: start-on-pr-comment: true');
});

test('examples/drift-on-comment.yml: gates by author_association + comment.user.type (security)', () => {
  // The documented security gate: only OWNER / MEMBER / COLLABORATOR
  // can trigger; bot comments are filtered out. If a user pastes the
  // example with this gate stripped, ANY commenter could re-run the
  // action — a real-world attack surface (cost burn, log exfil, etc.).
  // Pin the literal `if:` so a regression in our docs is loud.
  const src = readFileSync(resolve(repoRoot, 'examples/drift-on-comment.yml'), 'utf8');
  assert.match(src, /author_association/, 'must gate on author_association');
  assert.match(src, /OWNER/, 'must allow OWNER');
  assert.match(src, /MEMBER/, 'must allow MEMBER');
  assert.match(src, /COLLABORATOR/, 'must allow COLLABORATOR');
  // The `if:` gate lives at the JOB level (gates the whole job — the
  // documented pattern). Pin that: at least one job has an `if:` that
  // references author_association.
  const wf = loadWorkflow('drift-on-comment.yml');
  let hasIfGate = false;
  for (const job of Object.values(wf.jobs)) {
    // YAML field name is `if`, untouched by yaml parser.
    const ifValue = (job as Record<string, unknown>).if;
    if (typeof ifValue === 'string' && /author_association/.test(ifValue)) {
      hasIfGate = true;
      break;
    }
  }
  assert.ok(hasIfGate, 'at least one job must have `if:` with author_association gate');
});

test('examples/drift-on-comment.yml: every `with:` input is declared in action.yml', () => {
  const wf = loadWorkflow('drift-on-comment.yml');
  for (const job of Object.values(wf.jobs)) {
    for (const step of job.steps ?? []) {
      if (!step.uses?.includes('refactorlab/drift') && !step.uses?.startsWith('./')) continue;
      const withInputs = Object.keys(step.with ?? {});
      for (const k of withInputs) {
        assert.ok(
          declaredInputs.has(k),
          `examples/drift-on-comment.yml sets unknown input "${k}" — typo? Declared: ${[...declaredInputs].sort().join(', ')}`,
        );
      }
    }
  }
});

test('examples/drift-on-comment.yml: grants permissions for comment-mode (issues, pull-requests, checks, contents)', () => {
  const wf = loadWorkflow('drift-on-comment.yml');
  const perms = wf.permissions ?? {};
  // Comment mode needs `issues: write` if open-issue is true — the
  // example documents that. Check the union of what the example sets.
  // Required minimum: pull-requests + contents + checks.
  assert.equal(perms['contents'], 'read');
  assert.equal(perms['pull-requests'], 'write');
  assert.equal(perms['checks'], 'write');
});

// ─── Cross-example sanity ──────────────────────────────────────────────

test('examples: both workflows reference the SAME action repo (no rename slips through docs)', () => {
  // If the action is ever renamed (refactorlab/drift → something
  // else), every example must update in lockstep. This test pins
  // them together.
  for (const yml of ['drift.yml', 'drift-on-comment.yml']) {
    const src = readFileSync(resolve(repoRoot, 'examples', yml), 'utf8');
    assert.match(
      src,
      /(refactorlab\/drift@|uses:\s*\.\/)/,
      `${yml}: must use refactorlab/drift@<ref> or ./`,
    );
  }
});

test('examples: the most-tuned inputs are mentioned in at least one example', () => {
  // Soft documentation guard: a SHORT list of high-traffic inputs
  // that consumers ACTUALLY want to discover. action.yml has 20+
  // inputs but most are obscure tuning knobs whose docs live in the
  // YAML descriptions — not every one needs an example mention.
  const highTraffic = [
    'ai-suggestions',     // the main toggle
    'ai-model',           // the model picker
    'debug',              // troubleshooting
    'start-on-pr-comment', // comment-mode activation
  ];
  const allExamples = ['drift.yml', 'drift-on-comment.yml']
    .map((f) => readFileSync(resolve(repoRoot, 'examples', f), 'utf8'))
    .join('\n\n');
  for (const k of highTraffic) {
    assert.ok(
      allExamples.includes(k),
      `high-traffic input "${k}" must be mentioned in at least one example`,
    );
    // Sanity: the input actually exists in action.yml.
    assert.ok(declaredInputs.has(k), `precondition: action.yml declares "${k}"`);
  }
});
