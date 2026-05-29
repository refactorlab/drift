// action-bash-shellcheck: lint every `run:` bash block embedded in
// action.yml. Skips silently if shellcheck isn't on PATH — local devs
// + CI without shellcheck still pass; devs WITH shellcheck installed
// get static-analysis coverage on the inline bash that runtime tests
// can't reach (quoting bugs, unset-var sloppiness, SC2086 footguns…).
//
// The test extracts each `run:` block to a tempdir with a small header
// that:
//   • stubs every variable the step declares in its `env:` block plus
//     a few GHA-injected globals (GITHUB_OUTPUT, RUNNER_TEMP, …) so
//     shellcheck doesn't flag SC2154 "referenced but not assigned" —
//     these are filled by the runner at runtime, not by the script.
//   • turns `${{ … }}` GHA expressions into the placeholder
//     `__GHA_EXPR__` so shellcheck can parse the surrounding shell.
//     We're not validating the expressions here; the structural and
//     runtime tests cover those.
//
// Severity is `warning` to flag real footguns (unquoted "$var" → word
// splitting; SC2207-style array misuse; etc.) without nagging about
// style preferences. We tolerate `--include` exclusions only when they
// have a documented reason in this file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

type StepSpec = { name?: string; id?: string; shell?: string; run?: string; env?: Record<string, string> };
type ActionDoc = { runs: { steps: StepSpec[] } };

// SC2050 — fires on `[ "literal" = "constant" ]`. We strip GHA expressions
// to `__GHA_EXPR__` for shellcheck-ability, which trips this on a
// genuine `if [ "${{ steps.X.outputs.tag }}" = "none" ]` pattern. The
// expression IS dynamic at runtime; shellcheck just can't see it.
// SC1091 — sourced file not found (irrelevant, no `source` in any block).
const TOLERATED_SC = new Set(['SC2050', 'SC1091']);

const haveShellcheck = (() => {
  const r = spawnSync('shellcheck', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
})();

test('action.yml: every inline bash block passes shellcheck (warning level)', { skip: !haveShellcheck && 'shellcheck not on PATH' }, () => {
  const doc = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as ActionDoc;
  const dir = mkdtempSync(join(tmpdir(), 'drift-shellcheck-'));

  const ghaGlobals = [
    'GITHUB_OUTPUT', 'GITHUB_ENV', 'GITHUB_ACTION_PATH',
    'RUNNER_TEMP', 'RUNNER_OS', 'RUNNER_ARCH', 'RUNNER_TOOL_CACHE',
    'GITHUB_REPOSITORY', 'GITHUB_SHA', 'GITHUB_EVENT_NAME',
  ];

  const failures: Array<{ step: string; output: string }> = [];

  for (const [i, step] of doc.runs.steps.entries()) {
    if (typeof step.run !== 'string') continue;
    if ((step.shell ?? 'bash') !== 'bash') continue;

    const stubs = [...new Set([...ghaGlobals, ...Object.keys(step.env ?? {})])]
      .map((k) => `: "\${${k}:=}"`)
      .join('\n');
    const body = step.run.replace(/\$\{\{[^}]*\}\}/g, '__GHA_EXPR__');
    const script = [
      '#!/usr/bin/env bash',
      '# shellcheck shell=bash',
      'set -euo pipefail',
      stubs,
      body,
      '',
    ].join('\n');
    const path = join(dir, `${String(i).padStart(2, '0')}.sh`);
    writeFileSync(path, script);

    const args = ['--severity=warning', '--shell=bash'];
    if (TOLERATED_SC.size > 0) args.push(`--exclude=${[...TOLERATED_SC].join(',')}`);
    args.push(path);
    const r = spawnSync('shellcheck', args, { encoding: 'utf8' });
    if (r.status !== 0) {
      failures.push({
        step: step.name || step.id || `step ${i}`,
        output: r.stdout + r.stderr,
      });
    }
  }

  if (failures.length > 0) {
    const detail = failures
      .map((f) => `─── ${f.step} ───\n${f.output}`)
      .join('\n');
    assert.fail(`shellcheck found issues in ${failures.length} step(s):\n\n${detail}`);
  }
});
