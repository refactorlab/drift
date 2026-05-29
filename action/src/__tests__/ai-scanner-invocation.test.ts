// Scanner-invocation contract for action.yml's `Run scan-pr` step.
//
// The way the action runs the Rust scanner binary is load-bearing for
// several failure modes that have hit users before:
//
//   • A PR title/body starting with `-` (markdown bullet, `---`)
//     would be parsed by clap as a flag and abort with exit 2 before
//     scanning. Fix: `--flag=value` form (hyphen-immune).
//   • Older scanner binaries that predate `--max-rss-mb` would abort
//     clap with "unknown argument". Fix: probe `--help` and gate the
//     flag on its presence.
//   • Runaway memory → kernel SIGKILL → opaque "operation canceled".
//     Fix: `timeout` wall + the in-binary `--max-rss-mb` backstop.
//   • A true hang → `timeout` SIGTERMs at the deadline, SIGKILLs 15s
//     later. Self-inflicted timeout exits 124.
//   • Scan failures must NEVER fail the PR — exit codes are decoded
//     into named warnings, not propagated.
//
// All of these are encoded in the inline bash. A future "tidy-up"
// could silently regress any of them; these tests pin the contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

type Step = { name?: string; id?: string; env?: Record<string, string>; run?: string };
type ActionYml = { runs: { steps: Step[] } };

function loadActionYml(): ActionYml {
  return parseYaml(readFileSync(resolve(repoRoot, 'action.yml'), 'utf8')) as ActionYml;
}

function findScanStep(): Step {
  const action = loadActionYml();
  const step = action.runs.steps.find(
    (s) =>
      s.id === 'scan' ||
      (typeof s.name === 'string' && /Run scan-pr/i.test(s.name)),
  );
  assert.ok(step, 'scan-pr step not found in action.yml');
  return step!;
}

test('scanner invocation: pr-title and pr-body use the hyphen-immune `--flag=value` form', () => {
  // The space form (`--pr-title "$X"`) lets clap interpret a leading
  // `-` in the value as a flag. Real PR titles starting with `-` (a
  // markdown bullet) routinely tripped this — pin the fix.
  const step = findScanStep();
  assert.ok(step.run, 'scan-pr step must have a `run` block');
  const run = step.run!;
  assert.match(
    run,
    /--pr-title="\$PR_TITLE"/,
    'pr-title must use --pr-title="$PR_TITLE" (hyphen-immune)',
  );
  assert.match(
    run,
    /--pr-body="\$PR_BODY"/,
    'pr-body must use --pr-body="$PR_BODY" (hyphen-immune)',
  );
  // And the SPACE form must NOT appear — would be a regression even
  // if both were present (clap takes the last value).
  assert.ok(
    !/--pr-title "\$PR_TITLE"/.test(run),
    'pr-title MUST NOT use the space form (regresses the hyphen guard)',
  );
});

test('scanner invocation: --max-rss-mb is gated on a --help probe (backwards-compat)', () => {
  // Consumers pin older releases; --max-rss-mb is recent. The flag
  // must NEVER be passed unconditionally or older binaries clap-abort
  // (exit 2) before scanning. The probe is the only safe way.
  const run = findScanStep().run!;
  // The PROBE — `drift-static-profiler scan-pr --help | grep --max-rss-mb`.
  assert.match(
    run,
    /drift-static-profiler\s+scan-pr\s+--help[^\n]*\|\s*grep\s+-q\s+--\s+'--max-rss-mb'/,
    'scan-pr step must probe --help for --max-rss-mb before passing it',
  );
  // The default value (5000 MB) MUST be overridable via DRIFT_MAX_RSS_MB env.
  assert.match(
    run,
    /--max-rss-mb\s+"\$\{DRIFT_MAX_RSS_MB:-5000\}"/,
    'memory backstop must default to 5000 MB and respect DRIFT_MAX_RSS_MB',
  );
});

test('scanner invocation: `timeout` wraps the binary with TERM+KILL deadlines', () => {
  // The OOM-killer / hang failure modes can take down the whole job.
  // `timeout --signal=TERM --kill-after=15s Xs drift-static-profiler …`
  // is the LAST wall — `continue-on-error` doesn't neutralize signals.
  const run = findScanStep().run!;
  assert.match(
    run,
    /timeout\s+--signal=TERM\s+--kill-after=15s\s+"\$\{DRIFT_SCAN_TIMEOUT:-240\}s"/,
    'scan-pr must be wrapped in `timeout --signal=TERM --kill-after=15s ${DRIFT_SCAN_TIMEOUT:-240}s`',
  );
  // The DEFAULT timeout is 240s. A regression that raises it without
  // bumping the job's overall timeout would let a hanging scan eat
  // the whole 360s job budget; a regression that lowers it could
  // false-positive on a legit big scan. 240s is the calibrated value.
  assert.match(run, /DRIFT_SCAN_TIMEOUT:-240/);
});

test('scanner invocation: rc 124 / 137 / 139 each get a NAMED warning (no opaque cancel)', () => {
  // The case statement in action.yml maps these exit codes to a
  // human-readable warning so the user can act on the failure mode.
  // If a future refactor consolidates them, the user is back to
  // staring at "The operation was canceled." — exactly the failure
  // mode this code was written to prevent.
  const run = findScanStep().run!;
  assert.match(run, /case\s+"\$scan_rc"\s+in/, 'scan-pr step must decode exit codes via `case`');
  // Each load-bearing branch:
  assert.match(run, /124\)[^;]*timeout/, 'rc=124 branch must name the timeout');
  assert.match(run, /137\)[^;]*OOM/, 'rc=137 branch must name OOM as the likely cause');
  assert.match(run, /139\)[^;]*segfault/, 'rc=139 branch must name segfault');
  // Catch-all branch surfaces the raw rc for a generic failure.
  assert.match(run, /\*\)[^;]*scan_rc/, 'wildcard branch must surface scan_rc');
  // Every branch uses `::warning::` (advisory), not `::error::` or `exit 1`.
  // The grep below catches a regression that flipped one to `::error::`.
  assert.ok(
    !/::error::/.test(run),
    'no scan-failure branch may emit ::error::; advisory only',
  );
});

test('scanner invocation: input variables come from env, not from `${{ … }}` interpolation', () => {
  // PR titles/bodies are USER-controlled text. If action.yml
  // interpolated them with `${{ inputs.pr-title }}` directly into
  // the bash script, a hostile title like `"; rm -rf $HOME #` would
  // run arbitrary code on the runner. Threading them through `env:`
  // makes them inert string DATA. Pin both.
  const step = findScanStep();
  assert.ok(step.env, 'scan-pr step must have an env block');
  // Title/body must be set via env (the ${{ }} substitution happens
  // BEFORE bash parses, so values inside env: are still safe — bash
  // sees them as variable expansions of inert env strings).
  assert.ok(step.env!.PR_TITLE !== undefined, 'PR_TITLE must be passed via env');
  assert.ok(step.env!.PR_BODY !== undefined, 'PR_BODY must be passed via env');
  // The bash body MUST read from $PR_TITLE / $PR_BODY (the env-bound
  // names) — never from the raw ${{ inputs.pr-title }} expression.
  const run = step.run!;
  assert.match(run, /\$PR_TITLE/, 'bash body must reference $PR_TITLE (env, not inputs)');
  assert.match(run, /\$PR_BODY/, 'bash body must reference $PR_BODY (env, not inputs)');
});

test('scanner invocation: rc=0 produces a positive log line (so a clean scan is visible)', () => {
  // The success path must announce itself, not be silent. Useful for
  // both humans reading the action log AND any downstream automation
  // that grep'd the log for the "completed" line.
  const run = findScanStep().run!;
  assert.match(run, /0\)\s+echo\s+["']✅\s+scan-pr completed/, 'rc=0 branch must log a success line');
});

// ─── Cargo.toml sanity ─────────────────────────────────────────────────

test('scanner Cargo.toml: package version is present and well-formed (catches a malformed bump)', () => {
  // The version line in drift-static-profiler/Cargo.toml drives both
  // the release tags and the dist binary the Action downloads. A
  // malformed bump (e.g. trailing whitespace, missing quotes, leading
  // `v`) would break the release workflow. Pin the shape.
  const cargoToml = readFileSync(
    resolve(repoRoot, 'drift-static-profiler/Cargo.toml'),
    'utf8',
  );
  const m = cargoToml.match(/^version\s*=\s*"([^"]+)"\s*$/m);
  assert.ok(m, 'drift-static-profiler/Cargo.toml MUST declare `version = "X.Y.Z"` at the top level');
  const version = m![1];
  // semver-ish: X.Y.Z, no `v` prefix, no spaces.
  assert.match(
    version,
    /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.]+)?$/,
    `Cargo.toml version "${version}" must be semver (no v-prefix, no spaces, optional -pre tag)`,
  );
});

test('scanner Cargo.toml: package name matches the binary the Action downloads', () => {
  // The Action's install script downloads `drift-static-profiler-<target>`.
  // If the Cargo `name` ever drifted from `drift-static-profiler`, the
  // release artifacts would be named differently and consumers would
  // fail to find the binary.
  const cargoToml = readFileSync(
    resolve(repoRoot, 'drift-static-profiler/Cargo.toml'),
    'utf8',
  );
  const m = cargoToml.match(/^\s*name\s*=\s*"([^"]+)"\s*$/m);
  assert.ok(m, 'Cargo.toml must declare a [package] name');
  assert.equal(
    m![1],
    'drift-static-profiler',
    'Cargo.toml name MUST remain "drift-static-profiler" — the release artifact name + Action download depend on it',
  );
});
