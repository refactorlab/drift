// action-step-refs: structural integrity of step-ID references in action.yml.
//
// Composite actions chain steps via `steps.<id>.outputs.<name>` and
// `steps.<id>.outcome` expressions. None of GitHub's tooling validates that
// the referenced step ID actually exists, is defined BEFORE the reference,
// and that the output the expression reads is one the step actually writes.
// A typo'd `steps.pr-cxt.outputs.head_sha` (note the swap) evaluates to the
// empty string at runtime and silently turns every downstream `head_sha != ''`
// gate into a skip — the whole action becomes a no-op, with no error.
//
// This test enforces the three invariants statically:
//
//   (a) EXISTENCE — every `steps.X.outputs.Y` / `steps.X.outcome` references
//       an X that's defined as `id: X` in runs.steps.
//   (b) ORDER — every reference appears AFTER the step that owns X (no
//       forward refs; GHA evaluates left-to-right and an unset step output
//       evaluates to empty).
//   (c) OUTPUT-NAME — every `steps.X.outputs.Y` reads a Y that the step
//       with id=X actually writes to `$GITHUB_OUTPUT` somewhere in its
//       `run:` body. Catches the typo'd-output-name footgun.
//
// (c) is heuristic — we scan for `echo "Y=..."` / `Y=$X` / `printf 'Y=%s'`
// patterns in the step's shell body. If a step writes outputs in some
// other way (e.g. a redirected jq stream) and we miss them, the test
// will false-positive: fix is to add the output name to the step's
// declared/known set below, or refactor the step to write outputs in
// the standard form.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

type StepSpec = {
  name?: string;
  id?: string;
  shell?: string;
  run?: string;
  uses?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
};

const doc = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as {
  runs: { steps: StepSpec[] };
};
const STEPS = doc.runs.steps;

// Per-step index → step id. Anonymous steps (no id) can never be referenced
// from `steps.X.*`, so we omit them.
const ID_TO_INDEX = new Map<string, number>();
STEPS.forEach((s, i) => {
  if (s.id) ID_TO_INDEX.set(s.id, i);
});

// Some step outputs are written by 3rd-party actions (e.g. actions/cache
// writes `cache-hit`, actions/upload-artifact writes `artifact-url`). We
// can't see their internals — declare them here so the OUTPUT-NAME check
// doesn't false-positive. Keyed by `<step-id>.<output-name>`.
const KNOWN_FROM_UPSTREAM = new Set([
  'cache.cache-hit',
  'sherpa-bin-cache.cache-hit',
  'kokoro-model-cache.cache-hit',
  'audio-upload.artifact-url',
]);

// The `args` step delegates output writing to action/scripts/parse-comment.mjs
// (Node, not inline bash) — the heuristic can't see those writes. Derive the
// set from parse-comment.mjs's ALLOWED, the SAME authoritative source the
// three-way invariant test uses. Anything readable from steps.args.outputs.X
// is exactly what parse-comment can emit.
const PARSE_COMMENT_SRC = readFileSync(
  join(REPO, 'action', 'scripts', 'parse-comment.mjs'),
  'utf8',
);
const ALLOWED_MATCH = PARSE_COMMENT_SRC.match(/const ALLOWED = new Set\(\[([\s\S]*?)\]\);/);
const PARSE_COMMENT_ALLOWED = ALLOWED_MATCH
  ? new Set([...ALLOWED_MATCH[1].matchAll(/'([^']+)'/g)].map((m) => `args.${m[1]}`))
  : new Set<string>();
for (const k of PARSE_COMMENT_ALLOWED) KNOWN_FROM_UPSTREAM.add(k);

// Collect every step.<id>.outputs.<name> reference from a step's serialized
// form (the if: condition + env: values + run: body + with: block). We
// stringify the WHOLE step to one blob so we don't miss anything.
function stepText(s: StepSpec): string {
  return [
    s.if ?? '',
    Object.values(s.env ?? {}).join('\n'),
    Object.values(s.with ?? {}).join('\n'),
    s.run ?? '',
  ].join('\n');
}

const OUTPUT_REF_RE = /steps\.([A-Za-z0-9_-]+)\.outputs\.([A-Za-z0-9_-]+)/g;
const OUTCOME_REF_RE = /steps\.([A-Za-z0-9_-]+)\.outcome/g;

test('action.yml: every steps.X.outputs.Y references a real, prior step', () => {
  const failures: string[] = [];
  for (const [i, step] of STEPS.entries()) {
    const text = stepText(step);
    for (const m of text.matchAll(OUTPUT_REF_RE)) {
      const [, refId, _refOutput] = m;
      const refIndex = ID_TO_INDEX.get(refId);
      if (refIndex === undefined) {
        failures.push(
          `step #${i} (${step.name || step.id || 'unnamed'}) → reads steps.${refId}.outputs.${_refOutput} but no step has id=${refId}`,
        );
      } else if (refIndex >= i) {
        failures.push(
          `step #${i} (${step.name || step.id || 'unnamed'}) → reads steps.${refId}.outputs.${_refOutput} but step ${refId} is defined LATER (forward ref → always empty at runtime)`,
        );
      }
    }
  }
  if (failures.length > 0) {
    assert.fail(`step-ID reference integrity failed:\n  ${failures.join('\n  ')}`);
  }
});

test('action.yml: every steps.X.outcome references a real, prior step', () => {
  const failures: string[] = [];
  for (const [i, step] of STEPS.entries()) {
    const text = stepText(step);
    for (const m of text.matchAll(OUTCOME_REF_RE)) {
      const [, refId] = m;
      const refIndex = ID_TO_INDEX.get(refId);
      if (refIndex === undefined) {
        failures.push(
          `step #${i} (${step.name || step.id || 'unnamed'}) → reads steps.${refId}.outcome but no step has id=${refId}`,
        );
      } else if (refIndex >= i) {
        failures.push(
          `step #${i} (${step.name || step.id || 'unnamed'}) → reads steps.${refId}.outcome but step ${refId} is defined LATER`,
        );
      }
    }
  }
  if (failures.length > 0) {
    assert.fail(`step-outcome reference integrity failed:\n  ${failures.join('\n  ')}`);
  }
});

// Extract the set of output names a step writes by scanning its `run:` body
// for the canonical `$GITHUB_OUTPUT` write forms:
//   echo "name=value" >> "$GITHUB_OUTPUT"
//   printf 'name=%s\n' "$x" >> "$GITHUB_OUTPUT"
//   { echo "a=1"; echo "b=2"; } >> "$GITHUB_OUTPUT"
//   echo "name=foo"   ← when the entire block redirects to $GITHUB_OUTPUT
//   printf 'name<<%s\n%s\n%s\n' ...    ← multi-line heredoc form
//
// We over-match on candidate `name=` lines and confirm by checking that
// the SAME step's body also redirects to $GITHUB_OUTPUT somewhere. That's
// the heuristic; it works for every step in the current action.yml.
function declaredOutputs(step: StepSpec): Set<string> {
  const out = new Set<string>();
  const body = step.run ?? '';
  if (!/\$GITHUB_OUTPUT/.test(body)) return out;
  // Canonical key=value lines from echo or printf, where the key is the
  // first capture group.
  for (const m of body.matchAll(/(?:^|[;{(\s])(?:echo|printf)\s+[^|<>]*?["']?([a-zA-Z_][a-zA-Z0-9_-]*)<<[A-Z]/g)) {
    out.add(m[1]);
  }
  for (const m of body.matchAll(/(?:^|[;{(\s])echo\s+"([a-zA-Z_][a-zA-Z0-9_-]*)=/g)) {
    out.add(m[1]);
  }
  for (const m of body.matchAll(/(?:^|[;{(\s])echo\s+([a-zA-Z_][a-zA-Z0-9_-]*)=/g)) {
    out.add(m[1]);
  }
  for (const m of body.matchAll(/printf\s+['"]([a-zA-Z_][a-zA-Z0-9_-]*)=/g)) {
    out.add(m[1]);
  }
  // printf with multi-line heredoc form: printf 'name<<DELIM\n…'
  for (const m of body.matchAll(/printf\s+['"]([a-zA-Z_][a-zA-Z0-9_-]*)<</g)) {
    out.add(m[1]);
  }
  return out;
}

test('action.yml: every steps.X.outputs.Y reads an output the step actually writes', () => {
  const failures: string[] = [];
  for (const [i, step] of STEPS.entries()) {
    const text = stepText(step);
    for (const m of text.matchAll(OUTPUT_REF_RE)) {
      const [, refId, refOutput] = m;
      const refIndex = ID_TO_INDEX.get(refId);
      if (refIndex === undefined) continue; // covered by the existence test
      const ownerStep = STEPS[refIndex];
      const key = `${refId}.${refOutput}`;
      if (KNOWN_FROM_UPSTREAM.has(key)) continue;
      // Upstream actions write their own outputs; we tolerate any reference
      // to a `uses:` step that isn't in our known set IF the step body is
      // empty (no `run:` to scan).
      if (ownerStep.uses && !ownerStep.run) continue;
      const declared = declaredOutputs(ownerStep);
      if (!declared.has(refOutput)) {
        failures.push(
          `step #${i} (${step.name || step.id || 'unnamed'}) reads steps.${refId}.outputs.${refOutput}, but step ${refId} (#${refIndex}, ${ownerStep.name || refId}) doesn't appear to write '${refOutput}' (declared: {${[...declared].join(', ')}})`,
        );
      }
    }
  }
  if (failures.length > 0) {
    assert.fail(`step-output write/read mismatch:\n  ${failures.join('\n  ')}`);
  }
});

// ─── input refs: every (steps.args.outputs.X || inputs.X) AND every bare
//                 inputs.X must reference a key declared in the `inputs:`
//                 block of action.yml. Catches the symmetric typo: a
//                 step env: that reads `inputs.ai-modle` would otherwise
//                 silently resolve to empty. ──────────────────────────────

const INPUTS = (
  parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as {
    inputs: Record<string, unknown>;
  }
).inputs;
const INPUT_KEYS = new Set(Object.keys(INPUTS));

test('action.yml: every inputs.X reference names a real input', () => {
  const actionYmlSource = readFileSync(join(REPO, 'action.yml'), 'utf8')
    .split('\n')
    .map((line) => line.replace(/(^|[^"'])#.*$/, '$1'))
    .join('\n');
  const seen = new Set<string>();
  for (const m of actionYmlSource.matchAll(/\binputs\.([a-zA-Z0-9_-]+)\b/g)) {
    seen.add(m[1]);
  }
  const missing = [...seen].filter((k) => !INPUT_KEYS.has(k));
  assert.deepEqual(
    missing,
    [],
    `action.yml references inputs that aren't declared: ${missing.join(', ')}`,
  );
});
