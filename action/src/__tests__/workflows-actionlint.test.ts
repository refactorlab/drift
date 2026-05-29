// workflows-actionlint: lint the example workflow files with rhysd/actionlint.
//
// What this catches that the other tests don't:
//   • Invalid GHA expressions in `if:` / `with:` blocks (e.g. typoed
//     context refs like `github.event.repostiory.name`).
//   • Wrong event filter names (`issue_comments` instead of `issue_comment`).
//   • Missing/invalid permission scopes.
//   • Deprecated action versions, deprecated input names.
//   • Mismatched `needs:` references, unreachable steps.
//   • Concurrency-group expression errors.
//
// Skips silently when actionlint isn't on PATH — like the shellcheck
// guardrail, this is opt-in: contributors who have actionlint installed
// get the extra coverage; CI without it still passes.
//
// We DON'T run actionlint on action.yml — actionlint is a WORKFLOW linter
// (validates `on:` / `jobs:` schema) and doesn't understand composite
// action files. Structural tests + shellcheck cover action.yml.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

const haveActionlint = (() => {
  const r = spawnSync('actionlint', ['-version'], { encoding: 'utf8' });
  return r.status === 0;
})();

const WORKFLOWS = [
  'examples/drift.yml',
  'examples/drift-on-comment.yml',
];

for (const file of WORKFLOWS) {
  test(
    `${file}: passes actionlint`,
    { skip: !haveActionlint && 'actionlint not on PATH' },
    () => {
      const r = spawnSync('actionlint', ['-no-color', file], {
        cwd: REPO,
        encoding: 'utf8',
      });
      assert.equal(
        r.status,
        0,
        `actionlint flagged ${file}:\n${r.stdout || r.stderr}`,
      );
    },
  );
}
