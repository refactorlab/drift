// start-on-pr-comment additive contract: end-to-end verification that
// turning the flag on enables the /drift comment trigger WITHOUT disabling
// any of the standard pull_request event types (opened, synchronize,
// reopened, edited, ready_for_review). Companion to comment-gate-runtime.
//
// What this file proves:
//   1. For every pull_request event type, scan_gate (head_sha != '') passes
//      regardless of the start-on-pr-comment value — the additive promise.
//   2. The /drift comment-trigger flow still works on issue_comment events
//      with the flag on (gate active, SHAs from REST, scan_gate passes).
//   3. Comment-only steps (👀, parse-args, fork-safe checkout, 🚀/👎)
//      remain gated behind comment-gate.outputs.active, so they ONLY fire
//      on /drift comments — never on pull_request events.
//   4. A single workflow that wires `on: pull_request` + `on: issue_comment`
//      with `start-on-pr-comment: true` correctly handles BOTH events: a
//      push fires the scan; a /drift comment fires scan + reactions.
//
// Why a separate file: comment-gate-runtime.test.ts focuses on the gate's
// own correctness. This file focuses on the SYSTEM-level additive contract
// — what a consumer would actually observe when wiring the action two ways.

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

type StepSpec = {
  name?: string;
  id?: string;
  if?: string;
  run?: string;
  env?: Record<string, string>;
};
type ActionDoc = { inputs: Record<string, unknown>; runs: { steps: StepSpec[] } };

const ACTION: ActionDoc = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as ActionDoc;
const STEPS = ACTION.runs.steps;
function stepById(id: string): StepSpec {
  const s = STEPS.find((x) => x.id === id);
  if (!s) throw new Error(`step id=${id} not found`);
  return s;
}

// ─── runStep: execute a step's bash body with chosen env, capture
//     GITHUB_OUTPUT and GITHUB_ENV. Mock arbitrary commands so we can
//     replay an issue_comment REST fallback offline.
function runStep(
  scriptId: string,
  env: Record<string, string>,
  mocks: Record<string, string> = {},
): {
  code: number | null;
  stdout: string;
  stderr: string;
  outputs: Record<string, string>;
  envExports: Record<string, string>;
} {
  const script = stepById(scriptId).run!;
  const dir = mkdtempSync(join(tmpdir(), 'drift-additive-'));
  const gh = join(dir, 'GITHUB_OUTPUT');
  const ghEnv = join(dir, 'GITHUB_ENV');
  writeFileSync(gh, '');
  writeFileSync(ghEnv, '');
  const mockBin = mkdtempSync(join(tmpdir(), 'drift-additive-bin-'));
  for (const [name, body] of Object.entries(mocks)) {
    writeFileSync(join(mockBin, name), body, { mode: 0o755 });
  }
  const r = spawnSync('bash', ['-eo', 'pipefail', '-c', script], {
    env: {
      PATH: `${mockBin}:${process.env.PATH ?? ''}`,
      GITHUB_OUTPUT: gh,
      GITHUB_ENV: ghEnv,
      ...env,
    },
    encoding: 'utf8',
  });
  const parseKv = (text: string) =>
    Object.fromEntries(
      text
        .split('\n')
        .map((l) => {
          const i = l.indexOf('=');
          return i > 0 ? [l.slice(0, i), l.slice(i + 1)] : null;
        })
        .filter((x): x is [string, string] => x !== null),
    );
  return {
    code: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    outputs: parseKv(readFileSync(gh, 'utf8')),
    envExports: parseKv(readFileSync(ghEnv, 'utf8')),
  };
}

// ─── Cross-trigger matrix: for every supported pull_request event type
//     and for both flag values, the scan must run (head_sha preserved,
//     no comment-only step ever fires because no /drift gate is active).
//
// Why all five types: the canonical examples/drift.yml lists
// [opened, synchronize, reopened]. Real consumers also wire edited and
// ready_for_review. Behavior must be identical across all of them —
// pr-ctx only reads SHAs from the event payload, so the type is opaque
// to it, but a regression that started filtering by type would be silent
// without these cells.
const PR_EVENT_TYPES = [
  'opened',
  'synchronize',
  'reopened',
  'edited',
  'ready_for_review',
] as const;
const FLAG_VALUES = ['true', 'false'] as const;

for (const flag of FLAG_VALUES) {
  for (const action of PR_EVENT_TYPES) {
    test(`additive: pull_request[${action}] with start-on-pr-comment=${flag} → scan fires`, () => {
      // 1. comment-gate sees event=pull_request → active=false (no /drift).
      const gate = runStep('comment-gate', {
        START_ON_PR_COMMENT: flag,
        EVENT_NAME: 'pull_request',
        IS_PR_COMMENT: 'false',
        COMMENT_BODY: '',
        COMMENTER_TYPE: '',
      });
      assert.equal(gate.code, 0, gate.stderr);
      assert.equal(
        gate.outputs.active,
        'false',
        `pull_request[${action}] must never activate the /drift gate (no comment)`,
      );

      // 2. pr-ctx receives EVENT_* from the pull_request event payload.
      //    Additive contract: SHAs flow through, scan gate passes.
      const headSha = 'h'.repeat(40);
      const baseSha = 'b'.repeat(40);
      const ctx = runStep(
        'pr-ctx',
        {
          INPUT_PR_NUMBER: '',
          INPUT_BASE_SHA: '',
          INPUT_HEAD_SHA: '',
          INPUT_PR_TITLE: '',
          INPUT_PR_BODY: '',
          EVENT_PR_NUMBER: '321',
          EVENT_BASE_SHA: baseSha,
          EVENT_HEAD_SHA: headSha,
          EVENT_BASE_REF: 'main',
          EVENT_HEAD_REF: `feat/${action}`,
          EVENT_PR_TITLE: `wire ${action}`,
          EVENT_PR_BODY: '',
          EVENT_PR_HTML_URL: '',
          EVENT_PR_AUTHOR: 'alice',
          EVENT_ISSUE_PR_URL: '',
          COMMENT_MODE_ACTIVE: gate.outputs.active,
          GH_OWNER: 'acme',
          GH_REPO: 'widget',
          CID: '',
          GITHUB_TOKEN: 'fake',
        },
        {},
      );
      assert.equal(ctx.code, 0, ctx.stderr);
      // Scan gate is `head_sha != ''` everywhere downstream — this must pass.
      assert.equal(ctx.outputs.head_sha, headSha, 'head_sha must reach the scan');
      assert.equal(ctx.outputs.base_sha, baseSha);
      assert.equal(ctx.outputs.pr_number, '321');
      // No legacy "comment-only" skip — the additive contract forbids it.
      assert.doesNotMatch(
        ctx.stdout,
        /comment-only/i,
        `pull_request[${action}] must NOT log "comment-only" — flag is additive`,
      );
      // pr-ctx also exports DRIFT_* env vars for dist/index.js + dist/ai-suggest.js.
      assert.equal(ctx.envExports.DRIFT_HEAD_SHA, headSha, 'DRIFT_HEAD_SHA must reach the bundle');
      assert.equal(ctx.envExports.DRIFT_BASE_SHA, baseSha);
      assert.equal(ctx.envExports.DRIFT_PR_NUMBER, '321');
    });
  }
}

// ─── Comment-only steps stay gated: enumerate every step that exists
//     only for /drift comment mode and confirm each has the gate `if:`.
//     Without this, a pull_request event with start-on-pr-comment=true
//     could accidentally trip a comment-only step (e.g. POST a 👀
//     reaction to a non-existent comment).
const COMMENT_ONLY_STEP_NAMES = [
  'React 👀 on /drift',
  'Parse /drift args',
  'Checkout base repo (comment mode)',
  'Check out PR head by SHA (comment mode, fork-safe)',
  'React 🚀 on /drift success',
  'React 👎 on /drift failure',
] as const;

for (const name of COMMENT_ONLY_STEP_NAMES) {
  test(`comment-only step "${name}" stays gated on comment-gate.outputs.active`, () => {
    const step = STEPS.find((s) => s.name === name);
    assert.ok(step, `step "${name}" not found in action.yml`);
    const cond = step?.if ?? '';
    assert.match(
      cond,
      /steps\.comment-gate\.outputs\.active\s*==\s*'true'/,
      `step "${name}" must require comment-gate.outputs.active=='true' — else a push event would trip it`,
    );
  });
}

// ─── Comment-trigger flow still works: /drift on an open PR with the
//     flag set fires the gate, parse-args runs, and pr-ctx pulls SHAs
//     from REST. Scan gate passes; reactions fire.
test('additive: /drift comment on open PR → gate active, SHAs from REST, scan fires', () => {
  // 1. Gate.
  const gate = runStep('comment-gate', {
    START_ON_PR_COMMENT: 'true',
    EVENT_NAME: 'issue_comment',
    IS_PR_COMMENT: 'true',
    COMMENT_BODY: '/drift debug=true',
    COMMENTER_TYPE: 'User',
  });
  assert.equal(gate.outputs.active, 'true');

  // 2. parse-args (run as the action would — node + parse-comment.mjs).
  const argsDir = mkdtempSync(join(tmpdir(), 'drift-args-add-'));
  const argsOut = join(argsDir, 'GITHUB_OUTPUT');
  writeFileSync(argsOut, '');
  const argsRun = spawnSync(
    process.execPath,
    [join(REPO, 'action', 'scripts', 'parse-comment.mjs')],
    {
      env: { ...process.env, COMMENT_BODY: '/drift debug=true', GITHUB_OUTPUT: argsOut },
      encoding: 'utf8',
    },
  );
  assert.equal(argsRun.status, 0);
  const argsParsed = Object.fromEntries(
    readFileSync(argsOut, 'utf8')
      .split('\n')
      .map((l) => {
        const i = l.indexOf('=');
        return i > 0 ? [l.slice(0, i), l.slice(i + 1)] : null;
      })
      .filter((x): x is [string, string] => x !== null),
  );
  assert.equal(argsParsed.debug, 'true', 'debug=true override propagates');

  // 3. pr-ctx with a REST mock returning an open PR.
  const sha = 'a'.repeat(40);
  const bsha = 'b'.repeat(40);
  const payload = JSON.stringify({
    head: { sha, ref: 'feat/x' },
    base: { sha: bsha, ref: 'main' },
    title: 'add x',
    body: '',
    html_url: '',
    user: { login: 'alice' },
    state: 'open',
  });
  const curlMock = [
    '#!/usr/bin/env bash',
    'for arg in "$@"; do',
    '  case "$arg" in',
    `    *github.com/repos/*/pulls/[0-9]*) printf '%s' '${payload}'; exit 0 ;;`,
    '    *reactions*) exit 0 ;;',
    '  esac',
    'done',
    'exit 0',
    '',
  ].join('\n');
  const ctx = runStep(
    'pr-ctx',
    {
      INPUT_PR_NUMBER: '',
      INPUT_BASE_SHA: '',
      INPUT_HEAD_SHA: '',
      INPUT_PR_TITLE: '',
      INPUT_PR_BODY: '',
      EVENT_PR_NUMBER: '9',
      EVENT_BASE_SHA: '',
      EVENT_HEAD_SHA: '',
      EVENT_BASE_REF: '',
      EVENT_HEAD_REF: '',
      EVENT_PR_TITLE: '',
      EVENT_PR_BODY: '',
      EVENT_PR_HTML_URL: '',
      EVENT_PR_AUTHOR: '',
      EVENT_ISSUE_PR_URL: 'https://api.github.com/repos/acme/widget/pulls/9',
      COMMENT_MODE_ACTIVE: gate.outputs.active,
      GH_OWNER: 'acme',
      GH_REPO: 'widget',
      CID: '12345',
      GITHUB_TOKEN: 'fake',
    },
    { curl: curlMock },
  );
  assert.equal(ctx.code, 0, ctx.stderr);
  assert.equal(ctx.outputs.head_sha, sha, 'SHA from REST reaches the scan');
  assert.equal(ctx.outputs.base_sha, bsha);
  assert.equal(ctx.outputs.pr_state, 'open');
});

// ─── Closed-PR short-circuit is preserved in the additive design ─────
//     The closed-PR branch is the ONLY place pr-ctx clears SHAs, and it
//     fires only when comment-mode is active. A pull_request event on a
//     closed PR still scans (the closed-PR check is comment-mode-only).
test('additive: closed PR + /drift comment → 😕, SHAs cleared (preserved behavior)', () => {
  const payload = JSON.stringify({
    head: { sha: 'a'.repeat(40), ref: 'feat/x' },
    base: { sha: 'b'.repeat(40), ref: 'main' },
    title: 't',
    body: '',
    html_url: '',
    user: { login: 'alice' },
    state: 'closed',
  });
  const curlMock = [
    '#!/usr/bin/env bash',
    'for arg in "$@"; do',
    '  case "$arg" in',
    `    *github.com/repos/*/pulls/[0-9]*) printf '%s' '${payload}'; exit 0 ;;`,
    '    *reactions*) exit 0 ;;',
    '  esac',
    'done',
    'exit 0',
    '',
  ].join('\n');
  const ctx = runStep(
    'pr-ctx',
    {
      INPUT_PR_NUMBER: '',
      INPUT_BASE_SHA: '',
      INPUT_HEAD_SHA: '',
      INPUT_PR_TITLE: '',
      INPUT_PR_BODY: '',
      EVENT_PR_NUMBER: '9',
      EVENT_BASE_SHA: '',
      EVENT_HEAD_SHA: '',
      EVENT_BASE_REF: '',
      EVENT_HEAD_REF: '',
      EVENT_PR_TITLE: '',
      EVENT_PR_BODY: '',
      EVENT_PR_HTML_URL: '',
      EVENT_PR_AUTHOR: '',
      EVENT_ISSUE_PR_URL: 'https://api.github.com/repos/acme/widget/pulls/9',
      COMMENT_MODE_ACTIVE: 'true',
      GH_OWNER: 'acme',
      GH_REPO: 'widget',
      CID: '12345',
      GITHUB_TOKEN: 'fake',
    },
    { curl: curlMock },
  );
  assert.equal(ctx.code, 0);
  assert.equal(ctx.outputs.head_sha, '', 'closed-PR branch must clear head_sha');
  assert.equal(ctx.outputs.base_sha, '');
  assert.match(ctx.stdout, /only 'open' PRs are eligible/);
});

// ─── A pull_request event on a closed PR STILL scans — the closed-PR
//     branch only fires in comment mode. (Rare but legal: synchronize
//     after close.) Without this guarantee a re-opened-then-closed PR
//     would silently miss its final scan.
test('additive: pull_request event on closed PR still scans (closed check is comment-mode only)', () => {
  const headSha = 'h'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const ctx = runStep(
    'pr-ctx',
    {
      INPUT_PR_NUMBER: '',
      INPUT_BASE_SHA: '',
      INPUT_HEAD_SHA: '',
      INPUT_PR_TITLE: '',
      INPUT_PR_BODY: '',
      EVENT_PR_NUMBER: '42',
      EVENT_BASE_SHA: baseSha,
      EVENT_HEAD_SHA: headSha,
      EVENT_BASE_REF: 'main',
      EVENT_HEAD_REF: 'feat/x',
      EVENT_PR_TITLE: 't',
      EVENT_PR_BODY: '',
      EVENT_PR_HTML_URL: '',
      EVENT_PR_AUTHOR: 'a',
      EVENT_ISSUE_PR_URL: '', // pull_request → no REST call
      COMMENT_MODE_ACTIVE: 'false',
      GH_OWNER: 'acme',
      GH_REPO: 'widget',
      CID: '',
      GITHUB_TOKEN: 'fake',
    },
    {},
  );
  assert.equal(ctx.code, 0);
  assert.equal(ctx.outputs.head_sha, headSha);
  assert.equal(ctx.outputs.base_sha, baseSha);
  assert.doesNotMatch(ctx.stdout, /only 'open' PRs are eligible/);
});

// ─── Mixed-trigger single-workflow scenario: same job sees both event
//     types in different runs and produces the right behavior in each.
//     Today this is the canonical recommended wiring (see action.yml's
//     input description), but it only works because of the additive flag.
test('additive: mixed-trigger workflow — pull_request run scans, issue_comment run scans + reacts', () => {
  // Run A: pull_request[synchronize] (a push to the PR branch).
  const gateA = runStep('comment-gate', {
    START_ON_PR_COMMENT: 'true',
    EVENT_NAME: 'pull_request',
    IS_PR_COMMENT: 'false',
    COMMENT_BODY: '',
    COMMENTER_TYPE: '',
  });
  assert.equal(gateA.outputs.active, 'false');
  const ctxA = runStep(
    'pr-ctx',
    {
      INPUT_PR_NUMBER: '',
      INPUT_BASE_SHA: '',
      INPUT_HEAD_SHA: '',
      INPUT_PR_TITLE: '',
      INPUT_PR_BODY: '',
      EVENT_PR_NUMBER: '7',
      EVENT_BASE_SHA: 'b'.repeat(40),
      EVENT_HEAD_SHA: 'h'.repeat(40),
      EVENT_BASE_REF: 'main',
      EVENT_HEAD_REF: 'feat/x',
      EVENT_PR_TITLE: 'push to branch',
      EVENT_PR_BODY: '',
      EVENT_PR_HTML_URL: '',
      EVENT_PR_AUTHOR: 'alice',
      EVENT_ISSUE_PR_URL: '',
      COMMENT_MODE_ACTIVE: gateA.outputs.active,
      GH_OWNER: 'acme',
      GH_REPO: 'widget',
      CID: '',
      GITHUB_TOKEN: 'fake',
    },
    {},
  );
  assert.equal(ctxA.code, 0);
  assert.equal(ctxA.outputs.head_sha, 'h'.repeat(40), 'push run must reach scan');

  // Run B: /drift comment on the same PR.
  const gateB = runStep('comment-gate', {
    START_ON_PR_COMMENT: 'true',
    EVENT_NAME: 'issue_comment',
    IS_PR_COMMENT: 'true',
    COMMENT_BODY: '/drift',
    COMMENTER_TYPE: 'User',
  });
  assert.equal(gateB.outputs.active, 'true');
  const payload = JSON.stringify({
    head: { sha: 'a'.repeat(40), ref: 'feat/x' },
    base: { sha: 'c'.repeat(40), ref: 'main' },
    title: 'push to branch',
    body: '',
    html_url: '',
    user: { login: 'alice' },
    state: 'open',
  });
  const curlMock = [
    '#!/usr/bin/env bash',
    'for arg in "$@"; do',
    '  case "$arg" in',
    `    *github.com/repos/*/pulls/[0-9]*) printf '%s' '${payload}'; exit 0 ;;`,
    '    *reactions*) exit 0 ;;',
    '  esac',
    'done',
    'exit 0',
    '',
  ].join('\n');
  const ctxB = runStep(
    'pr-ctx',
    {
      INPUT_PR_NUMBER: '',
      INPUT_BASE_SHA: '',
      INPUT_HEAD_SHA: '',
      INPUT_PR_TITLE: '',
      INPUT_PR_BODY: '',
      EVENT_PR_NUMBER: '7',
      EVENT_BASE_SHA: '',
      EVENT_HEAD_SHA: '',
      EVENT_BASE_REF: '',
      EVENT_HEAD_REF: '',
      EVENT_PR_TITLE: '',
      EVENT_PR_BODY: '',
      EVENT_PR_HTML_URL: '',
      EVENT_PR_AUTHOR: '',
      EVENT_ISSUE_PR_URL: 'https://api.github.com/repos/acme/widget/pulls/7',
      COMMENT_MODE_ACTIVE: gateB.outputs.active,
      GH_OWNER: 'acme',
      GH_REPO: 'widget',
      CID: '12345',
      GITHUB_TOKEN: 'fake',
    },
    { curl: curlMock },
  );
  assert.equal(ctxB.code, 0);
  assert.equal(ctxB.outputs.head_sha, 'a'.repeat(40), 'comment run must scan a fresh SHA from REST');
  // Both runs reach the scan gate — the additive promise holds for the
  // single-workflow setup.
});

// ─── Input description regression: the documented contract must reflect
//     additive semantics. Previously the description said "ONLY run on
//     /drift comments" — that language must be GONE.
test('action.yml: start-on-pr-comment description documents additive semantics', () => {
  const desc = (ACTION.inputs['start-on-pr-comment'] as { description: string }).description;
  assert.match(
    desc,
    /addit/i,
    'description must explicitly mention the additive contract',
  );
  assert.doesNotMatch(
    desc,
    /ONLY run on\s*\/drift/i,
    'description must NOT claim the action is /drift-only — that contradicts additive',
  );
});

// ─── Scan gate audit: every step that depends on a successful scan
//     gates on `steps.pr-ctx.outputs.head_sha != ''`. After removing the
//     no-op SHA-clear, those gates ARE the entire downstream skip surface.
//     Confirm enough of them exist that we know the gate is the system
//     boundary (not just a stale fragment).
test('action.yml: head_sha-gated steps remain the downstream system boundary', () => {
  const yml = readFileSync(join(REPO, 'action.yml'), 'utf8');
  // Count every gate of the form `steps.pr-ctx.outputs.head_sha != ''`.
  const gates = yml.match(/steps\.pr-ctx\.outputs\.head_sha\s*!=\s*''/g) ?? [];
  // The action has the scan, the AI prep, the AI endpoint preflight, the
  // sticky PR comment, the AI inference loop, the post-AI step, the Piper
  // cache + install + voice + voice cache + audio synth + upload, and the
  // base/head checkout steps. >=10 is a loose-but-meaningful floor — if
  // someone deletes the gates en masse, this catches it.
  assert.ok(
    gates.length >= 10,
    `expected ≥10 head_sha-gated steps, found ${gates.length} — the scan gate is the system boundary, do not weaken it`,
  );
});
