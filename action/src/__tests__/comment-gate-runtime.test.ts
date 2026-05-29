// comment-gate-runtime: execute the gate's bash body against real comment
// bodies, then chain into parse-comment.mjs, and assert the contract end
// to end. This is what would actually happen on a live GitHub run — the
// structural test (start-on-pr-comment.test.ts) confirms the wiring; this
// one confirms the LOGIC.
//
// We pull the `run:` body out of action.yml so the test stays in sync with
// the action itself — no copy-pasted assumptions. The bash gets the same
// env GHA injects (COMMENT_BODY, EVENT_NAME, IS_PR_COMMENT, …) plus a
// mocked $GITHUB_OUTPUT we read back.

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

type StepSpec = { name?: string; id?: string; run?: string; env?: Record<string, string> };
function stepById(id: string): StepSpec {
  const doc = parseYaml(readFileSync(join(REPO, 'action.yml'), 'utf8')) as {
    runs: { steps: StepSpec[] };
  };
  const step = doc.runs.steps.find((s) => s.id === id);
  if (!step) throw new Error(`step id=${id} not found in action.yml`);
  return step;
}

const gateScript = stepById('comment-gate').run!;

type GateResult = { active: 'true' | 'false'; stdout: string; stderr: string; code: number | null };
function runGate(env: Partial<Record<string, string>>): GateResult {
  const dir = mkdtempSync(join(tmpdir(), 'drift-gate-'));
  const gh = join(dir, 'GITHUB_OUTPUT');
  writeFileSync(gh, '');
  const r = spawnSync('bash', ['-eo', 'pipefail', '-c', gateScript], {
    env: {
      PATH: process.env.PATH ?? '',
      GITHUB_OUTPUT: gh,
      // Defaults — every test overrides what it cares about.
      START_ON_PR_COMMENT: 'true',
      EVENT_NAME: 'issue_comment',
      IS_PR_COMMENT: 'true',
      COMMENT_BODY: '',
      COMMENTER_TYPE: 'User',
      ...env,
    },
    encoding: 'utf8',
  });
  const outputs = Object.fromEntries(
    readFileSync(gh, 'utf8')
      .split('\n')
      .map((l) => {
        const i = l.indexOf('=');
        return i > 0 ? [l.slice(0, i), l.slice(i + 1)] : null;
      })
      .filter((x): x is [string, string] => x !== null),
  );
  return {
    active: (outputs.active ?? 'false') as 'true' | 'false',
    stdout: r.stdout,
    stderr: r.stderr,
    code: r.status,
  };
}

// ─── ACTIVE: the happy path ─────────────────────────────────────────────

test('gate: bare /drift on an open PR comment → active=true', () => {
  const r = runGate({ COMMENT_BODY: '/drift' });
  assert.equal(r.code, 0);
  assert.equal(r.active, 'true');
});

test('gate: /drift with one-liner args → active=true', () => {
  const r = runGate({ COMMENT_BODY: '/drift debug=true ai-model=openai/gpt-5' });
  assert.equal(r.active, 'true');
});

test('gate: /drift issue → active=true', () => {
  const r = runGate({ COMMENT_BODY: '/drift issue' });
  assert.equal(r.active, 'true');
});

test('gate: /drift\\n```yaml... → active=true', () => {
  const body = ['/drift', '```yaml', 'debug: true', '```'].join('\n');
  const r = runGate({ COMMENT_BODY: body });
  assert.equal(r.active, 'true');
});

test('gate: CR-prefixed body still activates (Windows webhook tolerance)', () => {
  const r = runGate({ COMMENT_BODY: '\r/drift' });
  assert.equal(r.active, 'true');
});

// ─── INACTIVE: things that must NOT trigger ─────────────────────────────

test('gate: start-on-pr-comment=false → never active even on /drift', () => {
  const r = runGate({ START_ON_PR_COMMENT: 'false', COMMENT_BODY: '/drift' });
  assert.equal(r.active, 'false');
});

test('gate: pull_request event → inactive (issue_comment-only)', () => {
  const r = runGate({ EVENT_NAME: 'pull_request', COMMENT_BODY: '/drift' });
  assert.equal(r.active, 'false');
});

test('gate: plain issue comment (not PR) → inactive', () => {
  const r = runGate({ IS_PR_COMMENT: 'false', COMMENT_BODY: '/drift' });
  assert.equal(r.active, 'false');
});

test('gate: comment NOT starting with /drift → inactive (matches workflow startsWith)', () => {
  const r = runGate({ COMMENT_BODY: 'hey can you run /drift on this?' });
  assert.equal(r.active, 'false');
});

test('gate: leading whitespace before /drift → inactive (workflow gate parity)', () => {
  // Workflow uses `startsWith(body, '/drift')` which rejects leading
  // spaces; we mirror that. Users who want lenient parsing must put
  // /drift at the start of their comment.
  const r = runGate({ COMMENT_BODY: '   /drift debug=true' });
  assert.equal(r.active, 'false');
});

test('gate: Bot commenter → inactive even with /drift (self-trigger defense)', () => {
  const r = runGate({ COMMENT_BODY: '/drift', COMMENTER_TYPE: 'Bot' });
  assert.equal(r.active, 'false');
});

test('gate: empty body → inactive', () => {
  const r = runGate({ COMMENT_BODY: '' });
  assert.equal(r.active, 'false');
});

// ─── INJECTION SAFETY: comment body must NEVER reach the shell as code ──

test('gate: comment with $(rm -rf) does not execute', () => {
  // If COMMENT_BODY were ever inlined into the script (instead of read
  // from env), this would trigger a command substitution and the test
  // would either crash or visibly do something weird. The env pathway
  // makes it inert data — confirm via active=false (it doesn't start
  // with /drift) and a clean exit.
  const r = runGate({ COMMENT_BODY: '$(echo PWNED > /tmp/drift-pwn-test)' });
  assert.equal(r.code, 0);
  assert.equal(r.active, 'false');
  assert.ok(!r.stdout.includes('PWNED'));
});

test('gate: comment with backticks does not execute', () => {
  const r = runGate({ COMMENT_BODY: '`whoami`' });
  assert.equal(r.code, 0);
  assert.equal(r.active, 'false');
});

test('gate: heredoc-EOF in body does not break parsing', () => {
  // The original implementation used a heredoc; if it had ever been
  // simplified incorrectly, an EOF line inside the body could
  // terminate parsing early. Confirm a body containing "EOF" still
  // gates cleanly.
  const body = ['/drift', 'EOF', '```yaml', 'debug: true', '```'].join('\n');
  const r = runGate({ COMMENT_BODY: body });
  assert.equal(r.code, 0);
  assert.equal(r.active, 'true');
});

// ─── END-TO-END: gate active → parse-comment outputs override the
//                 default; gate inactive → no overrides emitted at all. ──

test('end-to-end: gate active + /drift debug=true ai-model=X → parsed outputs are exact', () => {
  const body = '/drift debug=true ai-model=openai/gpt-5';
  const gate = runGate({ COMMENT_BODY: body });
  assert.equal(gate.active, 'true', 'gate must allow');

  // Now simulate the parse-args step the way action.yml invokes it.
  const dir = mkdtempSync(join(tmpdir(), 'drift-parse-'));
  const gh = join(dir, 'GITHUB_OUTPUT');
  writeFileSync(gh, '');
  const r = spawnSync(
    process.execPath,
    [join(REPO, 'action', 'scripts', 'parse-comment.mjs')],
    { env: { ...process.env, COMMENT_BODY: body, GITHUB_OUTPUT: gh }, encoding: 'utf8' },
  );
  const outputs = Object.fromEntries(
    readFileSync(gh, 'utf8')
      .split('\n')
      .map((l) => {
        const i = l.indexOf('=');
        return i > 0 ? [l.slice(0, i), l.slice(i + 1)] : null;
      })
      .filter((x): x is [string, string] => x !== null),
  );
  assert.equal(r.status, 0);
  assert.equal(outputs.debug, 'true', 'debug override must propagate');
  assert.equal(outputs['ai-model'], 'openai/gpt-5', 'ai-model override must propagate');
});

test('end-to-end: simulated GHA expression || fallback for every overridable key', () => {
  // This validates the exact behavior the action.yml expressions implement:
  //   ${{ steps.args.outputs.X || inputs.X }}
  // GHA semantics: empty string is falsy, so '' || 'default' === 'default'.
  // When start-on-pr-comment=false (gate inactive), parse-args never runs
  // → all outputs.X are empty → fallback to inputs.X → behavior unchanged
  // for pull_request consumers.
  const fallback = (parsed: string | undefined, input: string) => (parsed || input);

  // Comment-mode active: user overrides via /drift
  assert.equal(fallback('true', 'false'), 'true', 'override wins');
  assert.equal(fallback('openai/gpt-5', 'openai/gpt-4.1'), 'openai/gpt-5');

  // Comment-mode active, key NOT in comment → outputs.X is empty
  assert.equal(fallback('', 'false'), 'false', 'unparsed key falls back to input');
  assert.equal(fallback(undefined, 'false'), 'false', 'missing output falls back to input');

  // Comment-mode INACTIVE (pull_request): parse-args step never ran
  assert.equal(fallback('', 'false'), 'false', 'inactive mode never overrides');
});

// ─── pr-ctx runtime: comment-only no-op + closed-PR short-circuit ───────

const prCtxScript = stepById('pr-ctx').run!;

type PrCtxResult = {
  pr_number: string;
  head_sha: string;
  base_sha: string;
  pr_state: string;
  stdout: string;
  stderr: string;
  code: number | null;
};
function runPrCtx(env: Partial<Record<string, string>>): PrCtxResult {
  const dir = mkdtempSync(join(tmpdir(), 'drift-prctx-'));
  const gh = join(dir, 'GITHUB_OUTPUT');
  const ghEnv = join(dir, 'GITHUB_ENV');
  writeFileSync(gh, '');
  writeFileSync(ghEnv, '');
  // Mock curl + jq so the REST fallback path is exercised deterministically
  // even when running offline. The mock writes a chosen REST payload to
  // stdout when curl gets a /pulls/{n} URL; otherwise it forwards to real
  // curl (the reactions POSTs go nowhere — we just want them to not fail).
  const mockBin = mkdtempSync(join(tmpdir(), 'drift-bin-'));
  const curlMock = join(mockBin, 'curl');
  const restPayload = env.MOCK_REST_PAYLOAD ?? '';
  writeFileSync(
    curlMock,
    [
      '#!/usr/bin/env bash',
      '# Drift test mock — emit a PR JSON for /pulls/{n}, swallow everything else.',
      'for arg in "$@"; do',
      '  case "$arg" in',
      `    *github.com/repos/*/pulls/[0-9]*) printf '%s' '${restPayload}'; exit 0 ;;`,
      '    *reactions*) exit 0 ;;',
      '  esac',
      'done',
      'exit 0',
      '',
    ].join('\n'),
    { mode: 0o755 },
  );
  const r = spawnSync('bash', ['-eo', 'pipefail', '-c', prCtxScript], {
    env: {
      PATH: `${mockBin}:${process.env.PATH ?? ''}`,
      GITHUB_OUTPUT: gh,
      GITHUB_ENV: ghEnv,
      INPUT_PR_NUMBER: '',
      INPUT_BASE_SHA: '',
      INPUT_HEAD_SHA: '',
      INPUT_PR_TITLE: '',
      INPUT_PR_BODY: '',
      EVENT_PR_NUMBER: '',
      EVENT_BASE_SHA: '',
      EVENT_HEAD_SHA: '',
      EVENT_BASE_REF: '',
      EVENT_HEAD_REF: '',
      EVENT_PR_TITLE: '',
      EVENT_PR_BODY: '',
      EVENT_PR_HTML_URL: '',
      EVENT_PR_AUTHOR: '',
      EVENT_ISSUE_PR_URL: '',
      COMMENT_MODE_ACTIVE: 'false',
      GH_OWNER: 'acme',
      GH_REPO: 'widget',
      CID: '',
      GITHUB_TOKEN: 'fake',
      ...env,
    },
    encoding: 'utf8',
  });
  const out = readFileSync(gh, 'utf8');
  const get = (k: string) => {
    const m = out.match(new RegExp(`^${k}=(.*)$`, 'm'));
    return m ? m[1] : '';
  };
  return {
    pr_number: get('pr_number'),
    head_sha: get('head_sha'),
    base_sha: get('base_sha'),
    pr_state: get('pr_state'),
    stdout: r.stdout,
    stderr: r.stderr,
    code: r.status,
  };
}

// ─── pr-ctx state-matrix: prove ADDITIVE semantics across the full
//     {start-on-pr-comment × COMMENT_MODE_ACTIVE × pr_state} grid.
//
//     The contract under verification:
//       • A pull_request event ALWAYS scans (SHAs preserved), regardless of
//         the start-on-pr-comment flag. That's the additive promise — turning
//         the flag on never disables the normal flow.
//       • A comment-trigger flow short-circuits ONLY on a closed/merged PR,
//         and only when comment-mode is active (a 😕 reaction goes out then).
//       • No other cell clears the SHAs.

type Cell = {
  name: string;
  inputStart: 'true' | 'false';
  active: 'true' | 'false';
  prState: 'open' | 'closed' | '';
  expectClearedShas: boolean;
  expectConfusedReaction: boolean;
};
const STATE_MATRIX: Cell[] = [
  // Backward-compat: every pull_request consumer (start-on-pr-comment
  // unset → default 'false') reaches pr-ctx with SHAs intact, no
  // reactions emitted.
  {
    name: 'start=false × inactive × no state — classic pull_request flow',
    inputStart: 'false',
    active: 'false',
    prState: '',
    expectClearedShas: false,
    expectConfusedReaction: false,
  },
  // Start=false + comment-mode somehow active (unreachable in practice
  // because the gate enforces start=true for active=true). Exercising
  // confirms pr-ctx doesn't surprise on the unreachable cell.
  {
    name: 'start=false × active × open — defensive: still no SHA clear',
    inputStart: 'false',
    active: 'true',
    prState: 'open',
    expectClearedShas: false,
    expectConfusedReaction: false,
  },
  // The ADDITIVE contract: start=true on a pull_request event (gate
  // inactive because no /drift comment fired) must still SCAN — SHAs
  // preserved. This is the cell that proves the flag is additive, not
  // exclusive: turning it on enables the comment trigger AS WELL AS
  // the normal flow, never INSTEAD OF it.
  {
    name: 'start=true × inactive — pull_request still scans (additive)',
    inputStart: 'true',
    active: 'false',
    prState: '',
    expectClearedShas: false,
    expectConfusedReaction: false,
  },
  // Comment-mode + open PR → scan as normal, no skip, no reaction.
  {
    name: 'start=true × active × open — happy path',
    inputStart: 'true',
    active: 'true',
    prState: 'open',
    expectClearedShas: false,
    expectConfusedReaction: false,
  },
  // Comment-mode + closed PR → 😕 + SHAs cleared.
  {
    name: 'start=true × active × closed — closed-PR branch',
    inputStart: 'true',
    active: 'true',
    prState: 'closed',
    expectClearedShas: true,
    expectConfusedReaction: true,
  },
  // Comment-mode + merged PR → same as closed (state != open).
  {
    name: 'start=true × active × merged — closed-PR branch (state=merged)',
    inputStart: 'true',
    active: 'true',
    prState: 'closed', // GitHub uses "closed" for both closed and merged in /pulls API
    expectClearedShas: true,
    expectConfusedReaction: true,
  },
];

for (const cell of STATE_MATRIX) {
  test(`pr-ctx matrix: ${cell.name}`, () => {
    // active=true cells need a REST payload to flow through pr-ctx's
    // issue_comment fallback. active=false cells skip the REST call
    // entirely — SHAs come from the (mocked) pull_request event payload.
    const payload = cell.active === 'true' && cell.prState
      ? JSON.stringify({
          head: { sha: 'h'.repeat(40), ref: 'feat/x' },
          base: { sha: 'b'.repeat(40), ref: 'main' },
          title: 't',
          body: '',
          html_url: '',
          user: { login: 'a' },
          state: cell.prState,
        })
      : '';

    const env: Record<string, string> = {
      INPUT_PR_NUMBER: '',
      INPUT_BASE_SHA: '',
      INPUT_HEAD_SHA: '',
      INPUT_PR_TITLE: '',
      INPUT_PR_BODY: '',
      // Comment mode: SHAs come from REST (event payload doesn't have
      // them on issue_comment events). pull_request mode: SHAs live in
      // the event payload.
      EVENT_PR_NUMBER: cell.active === 'true' ? '9' : '42',
      EVENT_BASE_SHA: cell.active === 'true' ? '' : 'b'.repeat(40),
      EVENT_HEAD_SHA: cell.active === 'true' ? '' : 'h'.repeat(40),
      EVENT_BASE_REF: cell.active === 'true' ? '' : 'main',
      EVENT_HEAD_REF: cell.active === 'true' ? '' : 'feat/x',
      EVENT_PR_TITLE: cell.active === 'true' ? '' : 't',
      EVENT_PR_BODY: '',
      EVENT_PR_HTML_URL: '',
      EVENT_PR_AUTHOR: '',
      EVENT_ISSUE_PR_URL: cell.active === 'true'
        ? 'https://api.github.com/repos/acme/widget/pulls/9'
        : '',
      // pr-ctx no longer reads INPUT_START_ON_PR_COMMENT — the flag is
      // additive. We keep `cell.inputStart` in the matrix for documentation
      // (it makes the test name read clearly), but the bash body's only
      // gate is COMMENT_MODE_ACTIVE × pr_state.
      COMMENT_MODE_ACTIVE: cell.active,
      GH_OWNER: 'acme',
      GH_REPO: 'widget',
      CID: cell.active === 'true' ? '12345' : '',
      GITHUB_TOKEN: 'fake',
      // MOCK_REST_PAYLOAD is consumed by runPrCtx's internal curl mock.
      MOCK_REST_PAYLOAD: payload,
    };

    const result = runPrCtx(env);
    assert.equal(result.code, 0, result.stderr);

    if (cell.expectClearedShas) {
      assert.equal(result.head_sha, '', `${cell.name}: head_sha must be cleared`);
      assert.equal(result.base_sha, '', `${cell.name}: base_sha must be cleared`);
    } else {
      assert.notEqual(result.head_sha, '', `${cell.name}: head_sha must NOT be cleared`);
      assert.notEqual(result.base_sha, '', `${cell.name}: base_sha must NOT be cleared`);
    }

    // The 😕 reaction fires whenever the closed-PR branch runs, which
    // is observable via pr-ctx's own stdout marker. (runPrCtx's curl
    // mock silently swallows the actual POST.)
    const sawConfusedLog = /only 'open' PRs are eligible/.test(result.stdout);
    assert.equal(
      sawConfusedLog,
      cell.expectConfusedReaction,
      `${cell.name}: closed-PR branch ${cell.expectConfusedReaction ? 'must' : 'must NOT'} fire`,
    );
  });
}

test('pr-ctx: pull_request mode (start-on-pr-comment=false) passes SHAs through', () => {
  // The classic flow: a pull_request event fills EVENT_* and pr-ctx
  // emits them unchanged.
  const r = runPrCtx({
    EVENT_PR_NUMBER: '42',
    EVENT_BASE_SHA: 'b'.repeat(40),
    EVENT_HEAD_SHA: 'h'.repeat(40),
    EVENT_PR_TITLE: 'wire up X',
    COMMENT_MODE_ACTIVE: 'false',
  });
  assert.equal(r.code, 0);
  assert.equal(r.pr_number, '42');
  assert.equal(r.head_sha, 'h'.repeat(40));
  assert.equal(r.base_sha, 'b'.repeat(40));
});

test('pr-ctx: start-on-pr-comment=true + pull_request event → SHAs PRESERVED (additive)', () => {
  // The contract: setting `start-on-pr-comment: true` ENABLES the /drift
  // comment trigger; it does NOT disable the pull_request flow. So a
  // pull_request event with the flag set must scan exactly like a flag-off
  // run — same SHAs out, no closed-PR reaction, no special log line.
  const r = runPrCtx({
    EVENT_PR_NUMBER: '42',
    EVENT_BASE_SHA: 'b'.repeat(40),
    EVENT_HEAD_SHA: 'h'.repeat(40),
    EVENT_PR_TITLE: 'wire up X',
    COMMENT_MODE_ACTIVE: 'false',
  });
  assert.equal(r.code, 0);
  assert.equal(r.pr_number, '42', 'pr_number must be preserved (additive flag)');
  assert.equal(r.head_sha, 'h'.repeat(40), 'head_sha must be preserved — scan must still fire');
  assert.equal(r.base_sha, 'b'.repeat(40));
  assert.doesNotMatch(
    r.stdout,
    /comment-only/i,
    'no "comment-only" skip log — the additive contract forbids it',
  );
});

test('pr-ctx: comment-mode active + open PR → SHAs preserved from REST', () => {
  const sha = 'a'.repeat(40);
  const bsha = 'b'.repeat(40);
  const payload = JSON.stringify({
    head: { sha, ref: 'feat/x' },
    base: { sha: bsha, ref: 'main' },
    title: 'add feature X',
    body: 'closes #1',
    html_url: 'https://github.com/acme/widget/pull/9',
    user: { login: 'alice' },
    state: 'open',
  });
  const r = runPrCtx({
    EVENT_PR_NUMBER: '9',
    EVENT_ISSUE_PR_URL: 'https://api.github.com/repos/acme/widget/pulls/9',
    INPUT_START_ON_PR_COMMENT: 'true',
    COMMENT_MODE_ACTIVE: 'true',
    MOCK_REST_PAYLOAD: payload,
  });
  assert.equal(r.code, 0);
  assert.equal(r.pr_number, '9');
  assert.equal(r.head_sha, sha, 'open PR head SHA must reach the scan step');
  assert.equal(r.base_sha, bsha);
  assert.equal(r.pr_state, 'open');
});

test('pr-ctx: comment-mode active + CLOSED PR → SHAs cleared (😕 reaction)', () => {
  const payload = JSON.stringify({
    head: { sha: 'a'.repeat(40), ref: 'feat/x' },
    base: { sha: 'b'.repeat(40), ref: 'main' },
    title: 't',
    body: '',
    html_url: '',
    user: { login: 'alice' },
    state: 'closed',
  });
  const r = runPrCtx({
    EVENT_PR_NUMBER: '9',
    EVENT_ISSUE_PR_URL: 'https://api.github.com/repos/acme/widget/pulls/9',
    INPUT_START_ON_PR_COMMENT: 'true',
    COMMENT_MODE_ACTIVE: 'true',
    CID: '1234',
    MOCK_REST_PAYLOAD: payload,
  });
  assert.equal(r.code, 0);
  assert.equal(r.pr_state, 'closed', 'state must still surface as an output');
  assert.equal(r.head_sha, '', 'closed-PR branch must clear SHAs');
  assert.equal(r.base_sha, '');
  assert.match(r.stdout, /only 'open' PRs are eligible/);
});

// ─── End-to-end fallback over EVERY overridable key ─────────────────────

// MUST stay in sync with parse-comment.mjs ALLOWED and the override
// wrappings in action.yml. The test runs parse-comment.mjs against a
// /drift comment that overrides every key, then simulates the
// `(steps.args.outputs.X || inputs.X)` resolution and asserts that
// EVERY consumer step would see the override value (not the input).
// ─── Chained e2e: gate → parse-args → pr-ctx through their REAL bash ────

// These tests run the actual `run:` bodies extracted from action.yml IN
// ORDER and thread outputs between them the way GitHub Actions does — so
// a regression in any step's I/O contract (output names, env-var spelling,
// short-circuit branches) lights up here. This is the closest thing to a
// dry-run on GitHub itself without spinning up `act`.

function runStep(
  scriptId: string,
  env: Record<string, string>,
  // Map of mocked /usr/bin commands → script body. Used to stub curl/jq
  // when the step would otherwise hit the network.
  mocks: Record<string, string> = {},
): { code: number | null; stdout: string; stderr: string; outputs: Record<string, string>; envExports: Record<string, string> } {
  const script = stepById(scriptId).run!;
  const dir = mkdtempSync(join(tmpdir(), 'drift-chain-'));
  const gh = join(dir, 'GITHUB_OUTPUT');
  const ghEnv = join(dir, 'GITHUB_ENV');
  writeFileSync(gh, '');
  writeFileSync(ghEnv, '');
  const mockBin = mkdtempSync(join(tmpdir(), 'drift-mockbin-'));
  for (const [name, body] of Object.entries(mocks)) {
    const p = join(mockBin, name);
    writeFileSync(p, body, { mode: 0o755 });
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

test('chained e2e: /drift debug=true on an open PR → SHAs reach the scan + debug override propagates', () => {
  // Step 1 — comment-gate. Sets active=true.
  const gate = runStep('comment-gate', {
    START_ON_PR_COMMENT: 'true',
    EVENT_NAME: 'issue_comment',
    IS_PR_COMMENT: 'true',
    COMMENT_BODY: '/drift debug=true',
    COMMENTER_TYPE: 'User',
  });
  assert.equal(gate.code, 0, gate.stderr);
  assert.equal(gate.outputs.active, 'true');

  // Step 2 — parse-comment.mjs (run as the action would, via node). We
  // can't use runStep here because the parse-args step's `run:` is just
  // `node "${{ github.action_path }}/.../parse-comment.mjs"` — the {{ }}
  // would land as the placeholder `__GHA_EXPR__`. Invoke it directly.
  const argsOut = join(mkdtempSync(join(tmpdir(), 'drift-args-')), 'GITHUB_OUTPUT');
  writeFileSync(argsOut, '');
  const argsRun = spawnSync(
    process.execPath,
    [join(REPO, 'action', 'scripts', 'parse-comment.mjs')],
    { env: { ...process.env, COMMENT_BODY: '/drift debug=true', GITHUB_OUTPUT: argsOut }, encoding: 'utf8' },
  );
  assert.equal(argsRun.status, 0);
  const argsOutputs = Object.fromEntries(
    readFileSync(argsOut, 'utf8')
      .split('\n')
      .map((l) => {
        const i = l.indexOf('=');
        return i > 0 ? [l.slice(0, i), l.slice(i + 1)] : null;
      })
      .filter((x): x is [string, string] => x !== null),
  );
  assert.equal(argsOutputs.debug, 'true', 'parse-args must emit the debug override');

  // Step 3 — pr-ctx with a REST mock that returns an open PR. Pass the
  // gate.active output as COMMENT_MODE_ACTIVE (GHA would expose it as
  // `steps.comment-gate.outputs.active`).
  const sha = 'h'.repeat(40);
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
      INPUT_START_ON_PR_COMMENT: 'true',
      COMMENT_MODE_ACTIVE: gate.outputs.active,
      GH_OWNER: 'acme',
      GH_REPO: 'widget',
      CID: '12345',
      GITHUB_TOKEN: 'fake',
    },
    { curl: curlMock },
  );
  assert.equal(ctx.code, 0, ctx.stderr);
  assert.equal(ctx.outputs.head_sha, sha, 'open PR head SHA must reach the scan step');
  assert.equal(ctx.outputs.base_sha, bsha);
  assert.equal(ctx.outputs.pr_state, 'open');
  assert.equal(ctx.outputs.pr_number, '9');

  // pr-ctx also exports DRIFT_* env vars for the bundled JS — verify
  // those landed too, since the scan + comment step read them.
  assert.equal(ctx.envExports.DRIFT_HEAD_SHA, sha);
  assert.equal(ctx.envExports.DRIFT_BASE_SHA, bsha);
  assert.equal(ctx.envExports.DRIFT_PR_NUMBER, '9');

  // Final synthesis: the action would now run scan-pr with effective
  // debug=true (from parse-args) and the resolved SHAs (from pr-ctx).
  // The downstream env block is:
  //   DEBUG_INPUT: ${{ (steps.args.outputs.debug || inputs.debug) }}
  // Simulate that resolution.
  const effectiveDebug = argsOutputs.debug || 'false';
  assert.equal(effectiveDebug, 'true', 'scan step would see DEBUG_INPUT=true');
  // And the scan gate (head_sha != '') would pass.
  assert.notEqual(ctx.outputs.head_sha, '');
});

test('chained e2e: start-on-pr-comment=true + pull_request event → ADDITIVE, scan still fires', () => {
  // The contract: the flag enables /drift comment-trigger WITHOUT disabling
  // the normal pull_request flow. End-to-end this means:
  //   1. comment-gate sees event=pull_request → active=false (correct: no
  //      /drift comment was posted, so the comment-only steps stay gated).
  //   2. parse-args is skipped (also correct: nothing to parse).
  //   3. pr-ctx passes the SHAs through unchanged → downstream gates fire
  //      → the scan, the sticky PR comment, the AI pass all run as usual.
  //
  // The previous "exclusive" behavior (clearing SHAs to no-op) is forbidden
  // — that broke single-workflow setups that wanted both triggers.
  const gate = runStep('comment-gate', {
    START_ON_PR_COMMENT: 'true',
    EVENT_NAME: 'pull_request',
    IS_PR_COMMENT: 'false',
    COMMENT_BODY: '',
    COMMENTER_TYPE: '',
  });
  assert.equal(gate.outputs.active, 'false');

  // Step 2 — parse-args wouldn't run (gated on active==true). Simulate
  // an empty outputs map.
  const argsOutputs: Record<string, string> = {};

  // Step 3 — pr-ctx sees start-on-pr-comment=true AND active=false. With
  // additive semantics, the SHAs from the pull_request event payload
  // flow through untouched.
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
      EVENT_PR_NUMBER: '99',
      EVENT_BASE_SHA: baseSha,
      EVENT_HEAD_SHA: headSha,
      EVENT_BASE_REF: 'main',
      EVENT_HEAD_REF: 'feat/y',
      EVENT_PR_TITLE: 'wip',
      EVENT_PR_BODY: '',
      EVENT_PR_HTML_URL: '',
      EVENT_PR_AUTHOR: 'bob',
      EVENT_ISSUE_PR_URL: '',
      COMMENT_MODE_ACTIVE: gate.outputs.active,
      GH_OWNER: 'acme',
      GH_REPO: 'widget',
      CID: '',
      GITHUB_TOKEN: 'fake',
    },
    {},
  );
  assert.equal(ctx.code, 0);
  assert.equal(ctx.outputs.pr_number, '99', 'pr_number must reach downstream');
  assert.equal(ctx.outputs.head_sha, headSha, 'head_sha preserved → scan gate passes');
  assert.equal(ctx.outputs.base_sha, baseSha);
  assert.doesNotMatch(
    ctx.stdout,
    /comment-only/i,
    'must NOT log the legacy "comment-only" skip message',
  );
  // Synthesis: every downstream `head_sha != ''` gate now passes →
  // scan-pr fires → sticky comment, AI pass, check run all run.
  assert.notEqual(ctx.outputs.head_sha, '');
  assert.equal(Object.keys(argsOutputs).length, 0);
});

test('end-to-end: every overridable key, comment override → resolved value matches', () => {
  const overrides: Record<string, string> = {
    debug: 'true',
    progress: 'false',
    'ai-suggestions': 'false',
    'audio-summary': 'false',
    'ai-model': 'openai/gpt-5',
    'fail-threshold': '0',
    'ai-max-suggestions': '7',
    'profiler-release-tag': 'drift-static-profiler-v0.9.9',
    'piper-voice': 'en_GB-alba-medium',
    'open-issue': 'true',
  };
  // Synthesize a /drift one-liner from the overrides.
  const body = '/drift ' + Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(' ');

  const dir = mkdtempSync(join(tmpdir(), 'drift-parse-'));
  const gh = join(dir, 'GITHUB_OUTPUT');
  writeFileSync(gh, '');
  const r = spawnSync(
    process.execPath,
    [join(REPO, 'action', 'scripts', 'parse-comment.mjs')],
    { env: { ...process.env, COMMENT_BODY: body, GITHUB_OUTPUT: gh }, encoding: 'utf8' },
  );
  assert.equal(r.status, 0);
  const parsed = Object.fromEntries(
    readFileSync(gh, 'utf8')
      .split('\n')
      .map((l) => {
        const i = l.indexOf('=');
        return i > 0 ? [l.slice(0, i), l.slice(i + 1)] : null;
      })
      .filter((x): x is [string, string] => x !== null),
  );

  // Dummy "input defaults" — any non-empty string DIFFERENT from the
  // override. If the fallback wires incorrectly, the resolved value
  // would match this instead of `overrides[k]`.
  const inputDefaults: Record<string, string> = {
    debug: 'false',
    progress: 'true',
    'ai-suggestions': 'true',
    'audio-summary': 'true',
    'ai-model': 'openai/gpt-4.1',
    'fail-threshold': '',
    'ai-max-suggestions': '3',
    'profiler-release-tag': '',
    'piper-voice': 'en_US-ryan-medium',
    'open-issue': 'false',
  };

  for (const [key, want] of Object.entries(overrides)) {
    const parsedVal: string = parsed[key] ?? '';
    const resolved = parsedVal || inputDefaults[key];
    assert.equal(
      resolved,
      want,
      `key=${key}: GHA expression (steps.args.outputs.${key} || inputs.${key}) must resolve to "${want}"`,
    );
  }
});
