// start-on-pr-comment: end-to-end contract for the /drift comment-trigger mode.
//
// These tests are STRUCTURAL: they parse action.yml + examples/drift-on-comment.yml
// and assert the contract the new mode promises:
//
//   1. action.yml declares `start-on-pr-comment` (default 'false') so the
//      pull_request consumers in examples/drift.yml are unaffected.
//   2. A `/drift comment trigger gate` step is the single source of truth
//      for "is comment-mode ACTIVE?" — every comment-mode-only step keys
//      off `steps.comment-gate.outputs.active`.
//   3. `Resolve PR context` (pr-ctx) extracts `pr_state` and short-circuits
//      on a closed/merged PR (cleared SHAs → downstream gates skip).
//   4. The PR-head checkout is fork-safe (refs/pull/<n>/head + checkout by
//      IMMUTABLE SHA), gated on comment-mode-active AND head_sha resolved.
//   5. Every overridable input (debug, ai-model, …) is referenced through
//      the `steps.args.outputs.X || inputs.X` fallback — so a /drift comment
//      override actually reaches the env block of the step that consumes it.
//   6. Terminal reactions (🚀 / 👎) fire only in comment mode, gated on
//      success() / failure() respectively.
//   7. The companion workflow examples/drift-on-comment.yml is the minimal
//      surface: `start-on-pr-comment: true` is the ONLY input. The previous
//      sparse-checkout of parse-comment.mjs is GONE — the action now reads
//      it from $GITHUB_ACTION_PATH.
//
// Why structural tests, not an `act` run: act doesn't model issue_comment
// payloads faithfully (event.comment, event.issue.pull_request), and the
// action's later steps shell out to the profiler binary which isn't built
// in CI. The contract above is what callers depend on; if any of it
// regresses, a real GitHub run would silently misbehave (wrong override
// merged in, closed PR scanned, fork checkout swapping mid-flight).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

const actionYml = readFileSync(join(REPO, 'action.yml'), 'utf8');
const exampleYml = readFileSync(join(REPO, 'examples', 'drift-on-comment.yml'), 'utf8');

// Overridable input names — DERIVED from action/scripts/parse-comment.mjs
// at test time. The parser's ALLOWED set is the canonical source of truth
// for "which inputs can a /drift comment override"; mirroring it as a
// hand-maintained list here would let the two drift apart. We extract the
// set directly so adding/removing a key in parse-comment.mjs automatically
// updates the assertions below.
const parseCommentSource = readFileSync(
  join(REPO, 'action', 'scripts', 'parse-comment.mjs'),
  'utf8',
);
const allowedBlock = parseCommentSource.match(/const ALLOWED = new Set\(\[([\s\S]*?)\]\);/);
if (!allowedBlock) {
  throw new Error('parse-comment.mjs: ALLOWED set not found — did the format change?');
}
const OVERRIDABLE = [...allowedBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (OVERRIDABLE.length === 0) {
  throw new Error('parse-comment.mjs: ALLOWED set parsed as empty — extraction regex is broken');
}

test('action.yml: declares start-on-pr-comment input with default false', () => {
  // The declaration block — we match liberally on whitespace but require
  // exact key + default so an accidental rename is caught.
  assert.match(
    actionYml,
    /\n {2}start-on-pr-comment:\n[\s\S]*?\n {4}required: false\n {4}default: 'false'\n/,
    'start-on-pr-comment input missing or default not false',
  );
});

test('action.yml: comment-gate step is the active-flag source of truth', () => {
  assert.match(actionYml, /id: comment-gate\b/, 'comment-gate step id not declared');
  assert.match(
    actionYml,
    /active="true"/,
    'comment-gate must explicitly set active=true on /drift match',
  );
  // The gate must require ALL of: input=true, event=issue_comment, body /drift, not Bot
  assert.match(actionYml, /START_ON_PR_COMMENT.*=.*"true"/);
  assert.match(actionYml, /EVENT_NAME.*=.*"issue_comment"/);
  assert.match(actionYml, /\/drift\*/, 'comment body must be matched against /drift prefix');
  assert.match(
    actionYml,
    /COMMENTER_TYPE.*!=.*"Bot"/,
    'Bot guard missing from comment-gate — defense-in-depth against self-trigger',
  );
});

test('action.yml: react 👀 / parse-args / terminal 🚀 / 👎 all gated on comment-gate.active', () => {
  const occurrences = actionYml.match(/steps\.comment-gate\.outputs\.active == 'true'/g) ?? [];
  // gate-keyed steps (counts): react eyes (1) + parse args (1) + base checkout (1)
  // + head checkout (1) + terminal rocket (1) + terminal thumbsdown (1) = 6 minimum.
  assert.ok(
    occurrences.length >= 6,
    `expected ≥6 active-gate checks, found ${occurrences.length}`,
  );
});

test('action.yml: parse-args step reads parse-comment.mjs from $GITHUB_ACTION_PATH', () => {
  // No sparse-checkout anymore — the action repo is on disk via the
  // composite action's own checkout, so action_path resolves the script.
  assert.match(
    actionYml,
    /node "\$\{\{ github\.action_path \}\}\/action\/scripts\/parse-comment\.mjs"/,
    'parse-args must invoke parse-comment.mjs via github.action_path',
  );
});

test('action.yml: pr-ctx extracts pr_state and short-circuits closed PRs in comment mode', () => {
  // pr_state emitted as both a local var and a step output
  assert.match(actionYml, /pr_state="\$\(printf '%s' "\$resp" \| jq -r '\.state \/\/ empty'\)"/);
  assert.match(actionYml, /\n {10}echo "pr_state=\$pr_state"\n/);
  // Comment-mode + non-open state ⇒ react 😕 + clear SHAs so head_sha-gated
  // downstream steps skip naturally.
  assert.match(actionYml, /COMMENT_MODE_ACTIVE/);
  assert.match(actionYml, /\{"content":"confused"\}/);
  assert.match(
    actionYml,
    /pr_number=""; head_sha=""; base_sha=""/,
    'closed-PR branch must clear SHAs to disable downstream scan',
  );
});

test('action.yml: start-on-pr-comment is ADDITIVE — no exclusive no-op branch', () => {
  // The contract: `start-on-pr-comment: true` ENABLES the /drift comment
  // trigger WITHOUT disabling the normal pull_request flow. A single
  // workflow can wire both `on: pull_request` and `on: issue_comment` and
  // get both behaviors from one job. So pr-ctx must NOT clear SHAs solely
  // because the flag is true and the comment gate is inactive — that would
  // silently no-op every push and break the additive contract.
  //
  // The defunct no-op branch (commit "feat(action): /drift comment workflow")
  // used to AND `INPUT_START_ON_PR_COMMENT=true` with `COMMENT_MODE_ACTIVE!=true`.
  // Both of these structural markers must be GONE — neither in env wiring
  // nor in the bash body.
  assert.doesNotMatch(
    actionYml,
    /INPUT_START_ON_PR_COMMENT:/,
    'start-on-pr-comment is additive; pr-ctx must NOT surface it to bash anymore',
  );
  assert.doesNotMatch(
    actionYml,
    /\[\s*"\$\{INPUT_START_ON_PR_COMMENT:-false\}"\s*=\s*"true"\s*\]/,
    'pr-ctx must NOT contain the legacy comment-only no-op branch',
  );
  assert.doesNotMatch(
    actionYml,
    /comment-only when this flag is true/,
    'legacy "comment-only" log line must be gone — the flag is additive now',
  );
});

test('action.yml: PR-head checkout is fork-safe (refs/pull/<n>/head + checkout by SHA)', () => {
  assert.match(
    actionYml,
    /git fetch --no-tags origin "refs\/pull\/\$\{PR_NUMBER\}\/head"/,
    'must fetch via refs/pull/<n>/head — the only fork-safe head ref',
  );
  assert.match(
    actionYml,
    /git checkout --detach "\$HEAD_SHA"/,
    'must check out by IMMUTABLE SHA (defeats force-push race)',
  );
  // Gated on comment-mode active AND head_sha non-empty (closed-PR clear above).
  assert.match(
    actionYml,
    /Check out PR head by SHA \(comment mode, fork-safe\)[\s\S]*?if: >-\s*\n\s*steps\.comment-gate\.outputs\.active == 'true' &&\s*\n\s*steps\.pr-ctx\.outputs\.head_sha != ''/,
    'PR-head checkout must be gated on comment-mode + resolved head_sha',
  );
});

test('action.yml: every overridable input is wrapped with steps.args.outputs.X fallback', () => {
  for (const key of OVERRIDABLE) {
    // No bare ${{ inputs.<key> ... }} that ISN'T wrapped in the fallback.
    // The wrapped form is `(steps.args.outputs.<key> || inputs.<key>)` so
    // any bare `inputs.<key>` NOT preceded by `steps.args.outputs.<key> || ` is a bug.
    const bareRe = new RegExp(
      String.raw`(?<!steps\.args\.outputs\.${escapeForRegex(key)} \|\| )inputs\.${escapeForRegex(key)}\b`,
      'g',
    );
    const matches = actionYml.match(bareRe) ?? [];
    assert.equal(
      matches.length,
      0,
      `inputs.${key} is referenced WITHOUT the parse-args fallback — /drift overrides won't reach this consumer`,
    );
  }
});

test('three-way invariant: parse-comment ALLOWED ⇔ action.yml override wrappings', () => {
  // The contract: every key that parse-comment.mjs accepts MUST be wrapped
  // in action.yml with `(steps.args.outputs.X || inputs.X)`. Conversely,
  // every wrapping in action.yml MUST correspond to a key the parser
  // accepts — otherwise a developer added a wrapping for a key the parser
  // will never emit (dead code, silent footgun for the next person
  // wondering why their /drift override doesn't work).
  //
  // Without this test, a rename in parse-comment.mjs (e.g. ai-model →
  // model) would silently break overrides for that key, since action.yml
  // would still reference the old name and parse-args would emit nothing
  // under either name.
  //
  // We strip YAML comments first so docstrings containing the literal
  // pattern as PSEUDO-CODE (e.g. "the steps.args.outputs.X || inputs.X
  // fallback resolves to inputs.X") don't trip the invariant. Live GHA
  // expressions are never inside `#` comments.
  const actionYmlCode = actionYml
    .split('\n')
    .map((line) => line.replace(/(^|[^"'])#.*$/, '$1'))
    .join('\n');

  // (a) every ALLOWED key is wrapped in live YAML at least once
  for (const key of OVERRIDABLE) {
    const wrappedRe = new RegExp(
      `steps\\.args\\.outputs\\.${escapeForRegex(key)}\\s*\\|\\|\\s*inputs\\.${escapeForRegex(key)}`,
    );
    assert.match(
      actionYmlCode,
      wrappedRe,
      `parse-comment ALLOWED contains "${key}" but action.yml has no fallback wrapping for it — overrides for this key would be silently dropped`,
    );
  }

  // (b) every wrapping in live YAML corresponds to an ALLOWED key
  const wrappedKeys = new Set(
    [...actionYmlCode.matchAll(/steps\.args\.outputs\.([\w-]+)\s*\|\|\s*inputs\.\1\b/g)].map((m) => m[1]),
  );
  const allowed = new Set(OVERRIDABLE);
  for (const key of wrappedKeys) {
    assert.ok(
      allowed.has(key),
      `action.yml wraps "${key}" but parse-comment.mjs doesn't accept it — the wrapping is dead code and the next dev will be confused why /drift ${key}=... doesn't work`,
    );
  }

  // (c) symmetry: wrapped set === allowed set
  assert.deepEqual(
    [...wrappedKeys].sort(),
    [...allowed].sort(),
    'parse-comment ALLOWED and action.yml wrapped keys must be identical',
  );
});

test('action.yml: terminal reactions gate on success()/failure() in comment mode', () => {
  assert.match(
    actionYml,
    /React 🚀 on \/drift success[\s\S]*?if: steps\.comment-gate\.outputs\.active == 'true' && success\(\)/,
  );
  assert.match(
    actionYml,
    /React 👎 on \/drift failure[\s\S]*?if: steps\.comment-gate\.outputs\.active == 'true' && failure\(\)/,
  );
  // Both must be fail-soft on the reaction POST itself.
  assert.match(
    actionYml,
    /React 🚀 on \/drift success[\s\S]*?continue-on-error: true/,
  );
  assert.match(
    actionYml,
    /React 👎 on \/drift failure[\s\S]*?continue-on-error: true/,
  );
});

test('drift-on-comment.yml: minimal workflow — only start-on-pr-comment: true under with:', () => {
  // The single `uses:` step.
  assert.match(
    exampleYml,
    /steps:\s*\n\s*-\s*uses: refactorlab\/drift@main\s*[\s\S]*?with:\s*\n\s*start-on-pr-comment: true/,
    'example must invoke the action with start-on-pr-comment: true',
  );

  // None of the in-workflow plumbing should be left over. Each entry is
  // a discriminator that ONLY appears in actual orchestration (an API
  // path, a CLI invocation, a shell expansion) — not the noun in a
  // descriptive comment. So `/reactions"` (the trailing URL segment in
  // a curl call) is dead, but the bare word "reactions" in a doc line
  // explaining what the action does is fine.
  const dead = [
    'parse-comment.mjs',
    'sparse-checkout',
    'refs/pull/${PR_NUMBER}',
    '/reactions"',
    'jq -r \'.head.sha\'',
  ];
  for (const phrase of dead) {
    assert.ok(
      !exampleYml.includes(phrase),
      `example still contains "${phrase}" — that plumbing should now live inside action.yml`,
    );
  }

  // Security gates remain at the workflow level (cheapest place to enforce).
  assert.match(exampleYml, /github\.event\.issue\.pull_request != null/);
  assert.match(exampleYml, /OWNER.*MEMBER.*COLLABORATOR/);
  assert.match(exampleYml, /github\.event\.comment\.user\.type != 'Bot'/);

  // Permissions still include issues: write for /drift issue.
  assert.match(exampleYml, /\n {2}issues: write\n/);
});

test('drift-on-comment.yml: permissions block covers every scope the action needs', () => {
  // GHA permissions are a deny-by-default-when-declared model: declaring a
  // `permissions:` block sets every UNLISTED scope to `none`. A workflow
  // that grants `pull-requests: write` but forgets `issues: write` will
  // silently 403 every reaction POST under continue-on-error, and the
  // user sees no 👀 / 🚀 / 👎 — diagnosing that is painful.
  //
  // This test pins the COMPLETE permission surface the comment-trigger
  // workflow needs, derived from what the action actually does:
  //   contents:read      → actions/checkout (base + PR-head fetch)
  //   pull-requests:write → sticky comment, inline review, suggestions
  //   checks:write        → "Drift / PR review" check run
  //   issues:write        → `/drift issue` (open/refresh), reactions
  //   models:read         → AI suggestions + audio briefing (GitHub Models)
  //
  // If any of these go missing from the example, the corresponding
  // feature silently fails. Adding NEW required scopes here makes the
  // requirement load-bearing.
  const required = {
    'contents': 'read',
    'pull-requests': 'write',
    'checks': 'write',
    'issues': 'write',
    'models': 'read',
  } as const;
  for (const [scope, level] of Object.entries(required)) {
    const re = new RegExp(`\\n {2}${escapeForRegex(scope)}:\\s*${level}\\s*\\n`);
    assert.match(
      exampleYml,
      re,
      `drift-on-comment.yml is missing required permission scope: ${scope}: ${level}`,
    );
  }
});

test('drift-on-comment.yml: stays minimal — under ~120 lines including comments', () => {
  // Loose ceiling: 120 lines of comment+yaml. The OLD form was 231 lines.
  // The ceiling exists to catch a regression toward in-workflow plumbing
  // (parse-comment shell, REST resolves, sparse-checkouts of the parser)
  // — anything that should now live inside action.yml. Comments
  // documenting the additive-mode option are exempt by design: they're
  // user-facing explanation, not plumbing.
  const lines = exampleYml.split('\n').length;
  assert.ok(
    lines < 120,
    `drift-on-comment.yml grew to ${lines} lines — the comment-trigger workflow should stay minimal (was 231 before, target <120)`,
  );
});

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
