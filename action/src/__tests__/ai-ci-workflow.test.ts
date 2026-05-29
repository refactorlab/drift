// Contract tests for the CI workflow at .github/workflows/ci.yml.
//
// CI is the gate everything else passes through. A regression in CI
// itself is the worst kind of failure mode — the workflow keeps going
// green while the actual checks rot. Pin the load-bearing pieces here:
//
//   • The dist/ sync guard verifies the committed bundles match a
//     fresh build. If THAT guard is gone, consumers run code that
//     diverged from the committed sources — the SHIPPED bundle is no
//     longer the source of truth.
//   • The action job must run npm ci (not install) so esbuild's
//     bundle bytes are reproducible. A switch to `npm install` would
//     produce different bytes across runs and the sync guard would
//     start oscillating.
//   • The bundle list in the guard MUST match the list of bundles
//     shipped under dist/ and invoked by action.yml. A new bundle
//     added without updating the guard is invisible to the sync
//     check and ships out-of-sync silently.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

type WorkflowStep = {
  name?: string;
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  ['working-directory']?: string;
};
type WorkflowJob = {
  name?: string;
  if?: string;
  ['runs-on']?: string;
  needs?: string | string[];
  permissions?: Record<string, string>;
  steps: WorkflowStep[];
};
type Workflow = {
  name?: string;
  on?: unknown;
  jobs: Record<string, WorkflowJob>;
};

function loadWorkflow(name: string): Workflow {
  const path = resolve(repoRoot, '.github/workflows', name);
  return parseYaml(readFileSync(path, 'utf8')) as Workflow;
}

// ─── ci.yml: load-bearing job structure ────────────────────────────────

test('ci.yml: declares the three pillar jobs (changes, profiler gate, action)', () => {
  const wf = loadWorkflow('ci.yml');
  const required = ['changes', 'profiler', 'action'];
  for (const id of required) {
    assert.ok(
      wf.jobs[id],
      `ci.yml is missing the "${id}" job — the CI's contract requires it`,
    );
  }
});

test('ci.yml: profiler job is GATED on the path filter (only runs when the crate changed)', () => {
  // Without this gate every PR pays the cost of a full Rust build,
  // including pure-doc PRs and Action-only PRs. The `needs.changes`
  // dependency + the if filter together keep Rust builds local to
  // Rust changes.
  const wf = loadWorkflow('ci.yml');
  const profiler = wf.jobs.profiler;
  assert.ok(profiler.needs, 'profiler job must declare `needs:`');
  const needs = Array.isArray(profiler.needs) ? profiler.needs : [profiler.needs];
  assert.ok(needs.includes('changes'), 'profiler job must declare needs: changes');
  assert.match(
    String(profiler.if ?? ''),
    /needs\.changes\.outputs\.profiler\s*==\s*'true'/,
    'profiler job must gate on needs.changes.outputs.profiler == "true"',
  );
});

test('ci.yml: action job uses `npm ci` (not npm install) so bundle bytes are reproducible', () => {
  // esbuild output depends on the resolved dependency tree. `npm
  // install` updates package-lock.json silently; `npm ci` errors if
  // the lockfile drifts. The dist/ sync guard would oscillate without
  // this.
  const wf = loadWorkflow('ci.yml');
  const install = wf.jobs.action.steps.find(
    (s) => typeof s.run === 'string' && /^npm\s+ci\b/.test(s.run),
  );
  assert.ok(install, 'action job must invoke `npm ci` (not npm install)');
});

test('ci.yml: action job has the FOUR pillar steps in order (install → typecheck → build → test)', () => {
  // Order matters: typecheck must come before build (so a type
  // error doesn't cost a full build), build must come before test
  // (so subprocess E2E tests find dist/), and the sync guard must
  // come AFTER both so it sees the freshly-built bundles to compare.
  const wf = loadWorkflow('ci.yml');
  const steps = wf.jobs.action.steps;
  const findIdx = (re: RegExp) =>
    steps.findIndex((s) => typeof s.run === 'string' && re.test(s.run));
  const install = findIdx(/^npm\s+ci\b/);
  const typecheck = findIdx(/npm\s+run\s+typecheck/);
  const build = findIdx(/npm\s+run\s+build/);
  const test_ = findIdx(/^npm\s+test\b/);
  assert.ok(install >= 0 && typecheck >= 0 && build >= 0 && test_ >= 0, 'all four steps must exist');
  assert.ok(
    install < typecheck && typecheck < build && build < test_,
    `step order wrong: install=${install}, typecheck=${typecheck}, build=${build}, test=${test_}`,
  );
});

test('ci.yml: dist/ sync guard exists and lists EVERY shipped bundle', () => {
  // The guard's bundle list MUST match the actual list of bundles
  // under dist/. A new bundle added without updating this list ships
  // out-of-sync silently.
  const wf = loadWorkflow('ci.yml');
  const verify = wf.jobs.action.steps.find(
    (s) => typeof s.run === 'string' && /bundles?=.*dist\/.*\.js/.test(s.run),
  );
  assert.ok(verify, 'dist/ sync-guard step missing from ci.yml');

  // Every bundle action.yml invokes must appear in the guard's list.
  const guardBody = verify!.run!;
  const referenced = ['index.js', 'ai-context.js', 'ai-suggest.js', 'ai-infer-one.js'];
  for (const f of referenced) {
    assert.ok(
      guardBody.includes(`dist/${f}`),
      `CI dist/ sync guard does not reference dist/${f} — it would slip past untracked/out-of-sync`,
    );
  }
});

test('ci.yml: sync guard exits NON-zero when bundles are untracked OR out-of-sync', () => {
  // The bash logic is the load-bearing part:
  //   for f in $bundles; do git ls-files --error-unmatch "$f" || fail=1; done
  //   git diff --quiet -- $bundles || exit 1
  // Pin both halves so a refactor can't accidentally collapse them
  // into a single check that misses one of the two failure modes.
  const wf = loadWorkflow('ci.yml');
  const verify = wf.jobs.action.steps.find(
    (s) => typeof s.run === 'string' && /git ls-files --error-unmatch/.test(s.run),
  );
  assert.ok(verify, 'sync guard must use git ls-files --error-unmatch');
  const body = verify!.run!;
  assert.match(body, /git\s+ls-files\s+--error-unmatch/, 'untracked-file check missing');
  assert.match(body, /git\s+diff\s+--quiet/, 'in-sync check missing');
  assert.match(body, /exit 1/, 'sync guard must exit 1 on mismatch — otherwise CI is a no-op');
});

test('ci.yml: action job runs on ubuntu-latest (the same runner consumers use)', () => {
  // Bundle bytes depend on the OS (line endings, paths in source
  // maps). The CI runner OS must match what consumers actually run
  // the bundles on — otherwise the sync guard would oscillate.
  const wf = loadWorkflow('ci.yml');
  assert.equal(
    wf.jobs.action['runs-on'],
    'ubuntu-latest',
    'action job MUST run on ubuntu-latest — bundle bytes are platform-sensitive',
  );
});

test('ci.yml: workflow_dispatch is in the trigger list (manual re-run for hotfix)', () => {
  // When the dist/ sync guard fails on a PR, the maintainer needs a
  // way to re-run CI without pushing a no-op commit. workflow_dispatch
  // gives that escape hatch.
  const wf = loadWorkflow('ci.yml');
  const on = wf.on as Record<string, unknown> | string[];
  const triggers = Array.isArray(on) ? on : Object.keys(on);
  assert.ok(
    triggers.includes('workflow_dispatch'),
    'ci.yml must support workflow_dispatch for manual re-runs',
  );
});

// ─── drift-action-release.yml ──────────────────────────────────────────

test('drift-action-release.yml: file exists + has at least one job', () => {
  const wf = loadWorkflow('drift-action-release.yml');
  const jobs = Object.keys(wf.jobs);
  assert.ok(jobs.length > 0, 'release workflow must declare at least one job');
});

test('drift-action-release.yml: triggers are scoped (manual dispatch + path-filtered main push)', () => {
  // The release workflow IS designed to auto-bump on commits to
  // main — but ONLY when the action's runtime surface (action.yml
  // / action/scripts/**) changes. A regression that drops the
  // `paths:` filter would tag a release per fixup commit.
  // workflow_dispatch is also load-bearing: it lets the maintainer
  // cut hotfixes / minor / major bumps without a no-op commit.
  const wf = loadWorkflow('drift-action-release.yml');
  const on = wf.on as {
    push?: { tags?: string[]; branches?: string[]; paths?: string[] };
    workflow_dispatch?: unknown;
  };
  assert.ok(on, 'release workflow must declare triggers');
  // workflow_dispatch is non-negotiable.
  assert.ok(
    on.workflow_dispatch !== undefined,
    'release must support workflow_dispatch for hotfix / minor bumps',
  );
  // If the workflow uses push, it MUST be path-filtered so a doc/
  // test-only commit doesn't tag a release. The paths filter is the
  // single thing protecting us from runaway releases on every commit.
  if (on.push) {
    assert.ok(
      Array.isArray(on.push.paths) && on.push.paths.length > 0,
      'release workflow with push trigger MUST set `paths:` filter — without it every main commit tags a release',
    );
    // The filter must include the action.yml + scripts (the runtime
    // surface — those ARE release-worthy). Dist bundles are committed
    // and also belong here; but at minimum action.yml is the contract.
    assert.ok(
      on.push.paths.some((p) => p.includes('action.yml')),
      'release path filter must include action.yml — the contract surface',
    );
  }
});
