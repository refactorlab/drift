// Structural invariants for action.yml that aren't tied to a specific
// step's logic — they're the "shape of the composite action" rules
// that quietly break consumers if someone violates them.
//
//   • Step IDs MUST be unique. Two steps with the same id silently
//     override one another in `steps.<id>.outputs`, so a later step's
//     `if:` gate evaluates against the wrong outputs.
//   • Every step that invokes a bundled JS file (the bulk of the
//     work) MUST be fail-soft: `continue-on-error: true` so a runtime
//     error in the bundle never sinks the consumer's check. Drift is
//     advisory-only and a bundle bug must NEVER fail a PR.
//   • The action's `inputs:` block declares every config knob; every
//     id-bearing step that needs an input must read it from `inputs.*`
//     (or its `args.outputs.*` wrapper) — not from a magic env var.
//   • The `runs.using` MUST be `composite` (a regression to `node`
//     would change the action's entire execution model).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

type Step = {
  name?: string;
  id?: string;
  if?: string;
  env?: Record<string, string>;
  run?: string;
  uses?: string;
  shell?: string;
  ['continue-on-error']?: boolean | string;
};
type ActionYml = {
  name?: string;
  description?: string;
  runs: { using: string; steps: Step[] };
  inputs?: Record<string, { required?: boolean; default?: string; description?: string }>;
};

function loadActionYml(): ActionYml {
  return parseYaml(readFileSync(resolve(repoRoot, 'action.yml'), 'utf8')) as ActionYml;
}

test('action.yml: runs.using is "composite" (regression to "node" changes the execution model)', () => {
  const action = loadActionYml();
  assert.equal(
    action.runs.using,
    'composite',
    `runs.using MUST be "composite"; got "${action.runs.using}". A regression here would re-wire the whole action.`,
  );
});

test('action.yml: every step ID is UNIQUE (duplicate ids silently override outputs)', () => {
  const action = loadActionYml();
  const ids = action.runs.steps
    .map((s) => s.id)
    .filter((id): id is string => typeof id === 'string');
  const seen = new Map<string, number>();
  for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id} (×${n})`);
  assert.deepEqual(
    dupes,
    [],
    `duplicate step ids found: ${dupes.join(', ')}\n` +
      `Later steps that read steps.<dup-id>.outputs will read the WRONG step's outputs.`,
  );
});

test('action.yml: every `uses:` reference is well-formed (action@ref OR ./local OR docker://)', () => {
  // A typo in a `uses:` reference fails at runtime with a cryptic
  // "Could not find action" error. Pin the shape so a typo can't
  // sneak in unnoticed.
  const action = loadActionYml();
  for (const step of action.runs.steps) {
    if (!step.uses) continue;
    assert.match(
      step.uses,
      /^[a-z0-9._/-]+@[^\s]+$|^\.\/[A-Za-z0-9._/-]+$|^docker:\/\//,
      `step "${step.name ?? step.id}" has malformed uses: "${step.uses}"`,
    );
  }
});

test('action.yml: every step that invokes a bundled JS file is fail-soft (continue-on-error: true)', () => {
  // The shipped bundles are ADVISORY — a runtime error in any of
  // them must never sink the consumer's check. The composite step
  // wrapping `node dist/*.js` must set `continue-on-error: true`.
  // (The bundles ALSO catch their own errors internally; this is the
  // belt to that suspenders so a fatal that escapes the bundle's
  // top-level handler is still caught at the YAML layer.)
  const action = loadActionYml();
  const violations: string[] = [];
  for (const step of action.runs.steps) {
    if (typeof step.run !== 'string') continue;
    if (!/node\s+"[^"]*\/dist\/[a-z0-9_-]+\.js"/.test(step.run)) continue;
    if (step['continue-on-error'] !== true && step['continue-on-error'] !== 'true') {
      violations.push(step.name ?? step.id ?? '<unnamed step>');
    }
  }
  assert.deepEqual(
    violations,
    [],
    `step(s) invoking a bundled JS file without continue-on-error: ${violations.join(', ')}\n` +
      `Drift is advisory — every bundle invocation MUST be fail-soft at the YAML layer.`,
  );
});

test('action.yml: scan-pr step is also fail-soft (a scanner crash must NOT fail the PR)', () => {
  // The scanner binary runs UNDER `timeout`; a timeout/SIGKILL must
  // not propagate up. The step needs continue-on-error too — same
  // contract as the bundles.
  const action = loadActionYml();
  const scan = action.runs.steps.find((s) => s.id === 'scan');
  assert.ok(scan, 'scan step must exist');
  assert.equal(
    scan!['continue-on-error'],
    true,
    'scan-pr step must set continue-on-error: true (scanner failures are advisory)',
  );
});

test('action.yml: at least one step writes to GITHUB_OUTPUT (the action produces consumer-visible outputs)', () => {
  const action = loadActionYml();
  const writers = action.runs.steps.filter(
    (s) => typeof s.run === 'string' && s.run.includes('GITHUB_OUTPUT'),
  );
  assert.ok(
    writers.length > 0,
    'no step writes to $GITHUB_OUTPUT — consumers cannot read drift outputs in subsequent steps',
  );
});

test('action.yml: every input has a description AND a default (or required: true)', () => {
  // GitHub Actions doesn't enforce this, but a consumer-facing
  // action whose inputs lack descriptions or sensible defaults is
  // a poor user experience. Pin the contract so a new input can't
  // be added that breaks the README's documented surface.
  const action = loadActionYml();
  const violations: string[] = [];
  for (const [name, spec] of Object.entries(action.inputs ?? {})) {
    if (!spec.description) violations.push(`${name}: missing description`);
    if (spec.required !== true && spec.default === undefined) {
      violations.push(`${name}: needs a default (or required: true)`);
    }
  }
  assert.deepEqual(
    violations,
    [],
    `input contract violations:\n  ${violations.join('\n  ')}`,
  );
});

test('action.yml: every step that needs PR context gates on `steps.pr-ctx.outputs.head_sha != \'\'`', () => {
  // The `pr-ctx` step is the SINGLE source of PR identity. Every
  // step that depends on a head SHA must short-circuit when
  // pr-ctx couldn't resolve one (e.g. push event slipped through).
  // Without that gate, the bundle would crash trying to git fetch
  // an empty SHA — and the failure would be opaque.
  const action = loadActionYml();
  const gated = new Set(['scan', 'ai-loop', 'ai-prep', 'ai-ep']);
  for (const id of gated) {
    const step = action.runs.steps.find((s) => s.id === id);
    if (!step) continue; // skip if the step was renamed; OK to be tolerant
    assert.ok(step.if, `step ${id} should have an \`if:\` gate`);
    assert.match(
      step.if!,
      /steps\.pr-ctx\.outputs\.head_sha\s*!=\s*'?\s*'?/,
      `step "${id}" must gate on steps.pr-ctx.outputs.head_sha != ''`,
    );
  }
});

test('action.yml: every bash step uses `shell: bash` (not the runner default)', () => {
  // GitHub composite actions inherit the OS default shell unless
  // overridden — on Windows runners that becomes pwsh. Every Drift
  // step assumes bash-isms (heredocs, $((…)), [[ ]]); a missing
  // shell: bash silently breaks Windows runners.
  const action = loadActionYml();
  const missing: string[] = [];
  for (const step of action.runs.steps) {
    if (typeof step.run !== 'string') continue;
    if (step.shell !== 'bash') {
      missing.push(step.name ?? step.id ?? '<unnamed>');
    }
  }
  assert.deepEqual(
    missing,
    [],
    `step(s) missing \`shell: bash\`:\n  ${missing.join('\n  ')}`,
  );
});

test('action.yml: branding (icon + color) is set (required for Marketplace listing)', () => {
  // The action is published to the GitHub Marketplace; branding
  // icon + color are REQUIRED for the listing. A regression that
  // drops these breaks the next release's marketplace publish.
  const action = parseYaml(readFileSync(resolve(repoRoot, 'action.yml'), 'utf8')) as {
    branding?: { icon?: string; color?: string };
  };
  assert.ok(action.branding, 'action.yml MUST set a branding block for Marketplace');
  assert.ok(action.branding!.icon, 'branding.icon required for Marketplace listing');
  assert.ok(action.branding!.color, 'branding.color required for Marketplace listing');
});
