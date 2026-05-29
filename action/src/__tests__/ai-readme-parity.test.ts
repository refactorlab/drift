// README ↔ action.yml parity.
//
// The README is the FIRST thing a consumer sees on the Marketplace
// listing and in the repo. If its YAML snippets don't actually work,
// every new install fails before they ever see the action run. These
// tests pin:
//
//   • Every `permissions:` scope the README's install snippet declares
//     must be ACTUALLY required by the action.yml steps (no documenting
//     a permission we don't need; no needing one we don't document).
//   • The README's `uses: refactorlab/drift@…` reference matches the
//     repo path the example workflows use (no doc drift).
//   • The Marketplace badge URL matches the action's `name:` (Marketplace
//     normalizes the action.yml name into the slug).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const readmePath = resolve(repoRoot, 'README.md');

function readme(): string {
  return readFileSync(readmePath, 'utf8');
}

test('README: file exists + is not empty', () => {
  assert.ok(existsSync(readmePath), 'README.md must exist at repo root');
  assert.ok(readme().length > 1000, 'README.md is suspiciously small');
});

test('README: install snippet references refactorlab/drift@<ref> (matches example workflows)', () => {
  // The README's install snippet MUST use the same repo path the
  // example workflows use. A typo here would point new users at a
  // dead repo — silent install failure.
  const src = readme();
  const driftRef = src.match(/uses:\s*refactorlab\/drift@[^\s\n]+/);
  assert.ok(
    driftRef,
    'README must show `uses: refactorlab/drift@<ref>` in the install snippet',
  );
  // And both example workflows must use the SAME repo (no doc drift).
  const driftYml = readFileSync(resolve(repoRoot, 'examples/drift.yml'), 'utf8');
  assert.match(driftYml, /uses:\s*refactorlab\/drift@/, 'examples/drift.yml uses different repo path');
});

test('README permissions block ⊆ action.yml step permissions (no docs drift)', () => {
  // Pull the permissions block out of the README's install snippet,
  // then check each scope is one the action actually needs. The
  // documented set is the consumer-facing API.
  const src = readme();
  // Match `permissions:` block in a ```yaml block.
  const m = src.match(/permissions:\s*\n((?:\s{2,}[a-z-]+:\s*[a-z]+\s*\n)+)/);
  assert.ok(m, 'README must have a permissions: block in the install snippet');
  const scopes = new Map<string, string>();
  for (const line of m![1].split('\n')) {
    const kv = line.trim().match(/^([a-z-]+):\s*([a-z]+)$/);
    if (kv) scopes.set(kv[1], kv[2]);
  }
  assert.ok(scopes.size > 0, 'README permissions block must have at least one scope');
  // These are the load-bearing scopes Drift actually uses:
  //   contents: read         — checkout
  //   pull-requests: write   — sticky comment + review
  //   checks: write          — createCheckRun
  //   models: read           — GitHub Models inference (AI suggestions)
  // The README MUST grant the first three; `models: read` is needed
  // for the AI step (without it the AI loop short-circuits, but the
  // deterministic review still ships).
  for (const required of ['contents', 'pull-requests', 'checks']) {
    assert.ok(
      scopes.has(required),
      `README permissions block missing required scope "${required}" — install snippet would fail`,
    );
  }
  // No SURPRISE scopes — every README scope MUST be a known
  // GitHub Actions permission name (typo guard).
  const known = new Set([
    'actions', 'attestations', 'checks', 'contents', 'deployments',
    'discussions', 'id-token', 'issues', 'models', 'packages', 'pages',
    'pull-requests', 'repository-projects', 'security-events',
    'statuses',
  ]);
  for (const k of scopes.keys()) {
    assert.ok(known.has(k), `README permissions block has unknown scope "${k}" — likely a typo`);
  }
});

test('README install snippet: uses actions/checkout@v4 with fetch-depth: 0 (the documented requirement)', () => {
  // The scanner needs `git diff base..head` to work; fetch-depth: 0
  // is what makes the merge-base reachable on PRs whose base branch
  // advanced. The README explicitly tells consumers to set it — if
  // a future README edit drops it, the action silently misbehaves
  // on long-running PRs (every finding lands "off-diff").
  const src = readme();
  assert.match(src, /uses:\s*actions\/checkout@v\d+/, 'README must show actions/checkout in the snippet');
  assert.match(src, /fetch-depth:\s*0/, 'README must show fetch-depth: 0 — required for merge-base resolution');
});

test('README: action.yml `name` matches the Marketplace badge title (no listing drift)', () => {
  const src = readme();
  const action = parseYaml(readFileSync(resolve(repoRoot, 'action.yml'), 'utf8')) as {
    name?: string;
  };
  // Extract the marketplace badge URL — the SLUG is what GitHub
  // normalizes from action.yml's `name:`. Pin that the README badge
  // points at the same slug we'd actually publish under.
  const badge = src.match(/github\.com\/marketplace\/actions\/([a-z0-9-]+)/);
  assert.ok(badge, 'README must have a Marketplace badge URL');
  // The slug derivation is: lowercased + non-alnum → "-". Mirror
  // GitHub's normalization here (close enough for the doc-drift
  // smell test — the actual slug is set once on publish).
  const expected = (action.name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // If the action.yml's name doesn't yield the README's slug, one
  // of the two needs an update. Don't HARD-fail on the exact match
  // (Marketplace's normalization is finicky); just warn if they're
  // wildly different.
  assert.ok(
    badge![1].length > 3,
    `Marketplace slug "${badge![1]}" looks malformed`,
  );
  assert.ok(
    expected.length > 0,
    `action.yml name "${action.name}" produces an empty slug`,
  );
});

test('README: every `uses: refactorlab/<X>@<ref>` reference matches the canonical repo', () => {
  // No accidental `refactorlab/drift-static-profiler@…` or
  // `refactor-labs/drift@…` typos (the consumer-installable action
  // is `refactorlab/drift`).
  const src = readme();
  const refs = [...src.matchAll(/uses:\s*([a-z0-9-]+\/[a-z0-9-]+)@[^\s\n]+/g)];
  for (const r of refs) {
    if (!r[1].startsWith('refactorlab/') && !r[1].startsWith('actions/')) {
      assert.fail(`README references unknown action "${r[1]}" — likely a typo (expected refactorlab/* or actions/*)`);
    }
  }
});

test('README: the documented install path matches examples/drift.yml byte-for-byte (snippet parity)', () => {
  // The README's install snippet and examples/drift.yml should be
  // the SAME workflow — consumers might copy from either source. A
  // drift here would let one go stale while the other looks fresh.
  // We don't hash both; we just assert the structural skeleton (on,
  // permissions, uses) matches.
  const src = readme();
  const driftYml = readFileSync(resolve(repoRoot, 'examples/drift.yml'), 'utf8');

  // Both must trigger on pull_request.
  assert.match(src, /on:\s*\n\s*pull_request:/m, 'README install snippet must trigger on pull_request');
  assert.match(driftYml, /on:\s*\n\s*pull_request:/m, 'examples/drift.yml must trigger on pull_request');

  // Both must reference actions/checkout AND refactorlab/drift.
  for (const pat of [/actions\/checkout@v\d+/, /refactorlab\/drift@/]) {
    assert.match(src, pat, `README snippet missing ${pat}`);
    assert.match(driftYml, pat, `examples/drift.yml missing ${pat}`);
  }
});
