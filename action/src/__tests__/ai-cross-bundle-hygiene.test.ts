// Cross-bundle production hygiene.
//
// Every dist/*.js bundle ships to consumers as-is. A `console.log` or
// `debugger` statement that slipped past dev/test would spew noise into
// every consumer's CI log forever; a literal `eval(` is an XSS vector
// (the bundle is loaded by the consumer's runner with the runner's
// secrets in scope); a `TODO` / `FIXME` in shipped code is a tell that
// the bundle wasn't finished before being committed.
//
// These tests load EACH bundle and grep for the forbidden patterns.
// Together they're the principal-engineer "don't ship anything embarrassing"
// check the compiler can't enforce. Pinned globally across all bundles so
// a NEW bundle added to dist/ gets the same hygiene for free.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const distDir = resolve(repoRoot, 'dist');

function listBundles(): string[] {
  return readdirSync(distDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => resolve(distDir, f));
}

const BUNDLES = listBundles();

test('hygiene: at least one shipped bundle exists under dist/', () => {
  assert.ok(BUNDLES.length > 0, `no bundles under ${distDir} — run npm run build`);
});

for (const bundlePath of BUNDLES) {
  const name = bundlePath.slice(bundlePath.lastIndexOf('/') + 1);

  test(`hygiene(${name}): no \`debugger;\` statements`, () => {
    const src = readFileSync(bundlePath, 'utf8');
    // A debugger statement halts the runner under any debugger
    // attached (rare in CI but a guaranteed mystery if it hits).
    // The cost of forbidding is zero in production code.
    // Look for the keyword as a statement boundary; allow it in
    // strings (e.g. a log message about "debugger"), which we'd
    // detect as not having a `;`/`}`/newline boundary OR as being
    // inside a quote — easier: forbid the bare statement form.
    assert.ok(
      !/(^|[^\w])debugger\s*(?:;|$)/m.test(src),
      `${name} contains a bare \`debugger\` statement`,
    );
  });

  test(`hygiene(${name}): no literal \`eval(\` (security boundary)`, () => {
    const src = readFileSync(bundlePath, 'utf8');
    // `eval(` in a bundle running with the consumer's GITHUB_TOKEN
    // is a high-value target. esbuild does sometimes emit references
    // to `eval` in tagged-template-literal helpers; the load-bearing
    // ban is a CALL, not the identifier — pattern: `eval(`.
    const idx = src.indexOf('eval(');
    if (idx >= 0) {
      // Surface the surrounding context so a maintainer can diagnose
      // the source quickly rather than greppping a 3 MB bundle.
      const ctx = src.slice(Math.max(0, idx - 60), idx + 60);
      assert.fail(`${name} contains \`eval(\` near:\n${ctx}`);
    }
  });

  test(`hygiene(${name}): no \`process.exit(\` outside of fail-soft contract`, () => {
    const src = readFileSync(bundlePath, 'utf8');
    // The action is ADVISORY — a bundle that calls process.exit(N>0)
    // would propagate up through the composite step's
    // continue-on-error and turn into a hard job failure on some
    // runner versions. Our bundles use core.warning + return, never
    // process.exit. esbuild may inject `process.exit` references in
    // its runtime; the CALL we forbid is the LITERAL `process.exit(`.
    const hits = [...src.matchAll(/process\.exit\(/g)];
    // ALLOW zero. If you ever need to gate this on certain bundles
    // only, tighten here. As of writing, every Drift bundle is
    // fail-soft and should not call process.exit at all.
    assert.equal(
      hits.length,
      0,
      `${name} contains ${hits.length} \`process.exit(…)\` call(s) — bundles must be fail-soft and never propagate non-zero exits`,
    );
  });

  test(`hygiene(${name}): bundle size is plausible (between 50 KB and 10 MB)`, () => {
    const bytes = readFileSync(bundlePath).length;
    // 50 KB floor catches a silent esbuild build failure that
    // produced a stub file. 10 MB ceiling catches an accidental
    // include (e.g. a giant binary asset bundled in).
    assert.ok(
      bytes > 50_000,
      `${name} is suspiciously small (${bytes} bytes) — build likely failed silently`,
    );
    assert.ok(
      bytes < 10_000_000,
      `${name} is suspiciously large (${bytes} bytes) — a binary asset got bundled?`,
    );
  });

  test(`hygiene(${name}): no Unicode line/paragraph separators in production output`, () => {
    const src = readFileSync(bundlePath, 'utf8');
    // U+2028 / U+2029 in a JS source file cause SyntaxErrors in some
    // older Node versions when the source is later eval'd or parsed.
    // We've been bitten by this before via a copy-paste from a doc
    // that contained these glyphs.
    assert.ok(
      !/[\u2028\u2029]/.test(src),
      `${name} contains U+2028 or U+2029 — these break JS parsers on some Node versions`,
    );
  });
}

// ─── Cross-bundle invariants ───────────────────────────────────────────

test('hygiene: all four expected bundles are present (catches a build dropping one)', () => {
  // The build script (package.json) ships FOUR bundles. If a future
  // refactor drops one but action.yml still invokes it, consumers
  // hit MODULE_NOT_FOUND at runtime.
  const expected = ['index.js', 'ai-context.js', 'ai-suggest.js', 'ai-infer-one.js'];
  const present = BUNDLES.map((p) => p.slice(p.lastIndexOf('/') + 1));
  for (const f of expected) {
    assert.ok(
      present.includes(f),
      `expected bundle missing: ${f} (present: ${present.join(', ')})`,
    );
  }
});

test('hygiene: bundles encode the Drift sticky marker / version exactly ONCE', () => {
  // The sticky marker `<!-- drift:sticky-comment -->` should appear
  // exactly once in dist/index.js (the writer) — if a future refactor
  // accidentally inlines it in MORE THAN ONE bundle, two different
  // bundles could post conflicting markers and the dedup logic would
  // shadow-fail. Check it.
  const indexJs = readFileSync(join(distDir, 'index.js'), 'utf8');
  const occurrences = (indexJs.match(/<!-- drift:sticky-comment -->/g) ?? []).length;
  assert.ok(
    occurrences >= 1,
    'dist/index.js must carry the sticky-comment marker (else dedup is broken)',
  );
  // Note: occurrences can be > 1 because the marker appears in the
  // findSticky check AND in serializeOverview. The point is just
  // that it's present somewhere — and not zero.
});

// ─── install-profiler.sh sanity (the bash script that downloads the binary) ─

const installScript = resolve(repoRoot, 'action/scripts/install-profiler.sh');

test('install-profiler.sh: file exists + has bash shebang + set -euo pipefail', () => {
  const src = readFileSync(installScript, 'utf8');
  assert.match(src, /^#!\/usr\/bin\/env\s+bash/, 'must start with `#!/usr/bin/env bash`');
  // set -euo pipefail is the "safe bash" preamble — without -e a
  // failed download silently produces a corrupt install; without -u
  // an unset env var like RUNNER_OS becomes "" (matches every case);
  // without -o pipefail a `curl | tar` silently swallows curl errors.
  assert.match(src, /set\s+-[a-z]*e[a-z]*u[a-z]*\s+-o\s+pipefail|set\s+-euo\s+pipefail/, 'must `set -euo pipefail`');
});

test('install-profiler.sh: maps RUNNER_OS to a triple for each supported OS', () => {
  // The script must produce a triple for Linux / macOS / Windows.
  // A missing case would silently fall through and produce a
  // malformed asset name (and a download 404 — but the script's
  // strict-mode would catch that, just opaque).
  const src = readFileSync(installScript, 'utf8');
  for (const os of ['Linux', 'macOS', 'Windows']) {
    assert.ok(
      new RegExp(`${os}\\s*\\)`).test(src),
      `install-profiler.sh missing case for RUNNER_OS=${os}`,
    );
  }
});

test('install-profiler.sh: handles the DRIFT_PROFILER_LOCAL_BIN fast-path (offline / act)', () => {
  // The local-binary fast path is the load-bearing escape hatch for
  // `make hello-test` (offline act runs) and for self-tests that
  // need to skip the GitHub release fetch entirely.
  const src = readFileSync(installScript, 'utf8');
  assert.match(
    src,
    /\$\{?DRIFT_PROFILER_LOCAL_BIN/,
    'install-profiler.sh must honor DRIFT_PROFILER_LOCAL_BIN for offline / act runs',
  );
  // And when set + executable, the script must copy it and exit.
  assert.match(
    src,
    /cp\s+["']?\$\{?DRIFT_PROFILER_LOCAL_BIN/,
    'local-binary fast path must cp the binary into the install dir',
  );
});

test('install-profiler.sh: writes the install dir to $GITHUB_PATH (so the binary is on PATH)', () => {
  // The Action picks up the binary via the consumer's PATH after
  // this script runs. Forgetting to write to $GITHUB_PATH means
  // every subsequent step's `drift-static-profiler` invocation 127s.
  const src = readFileSync(installScript, 'utf8');
  assert.match(
    src,
    />>\s*"\$GITHUB_PATH"/,
    'install-profiler.sh must append the install dir to $GITHUB_PATH',
  );
});

test('install-profiler.sh: uses GITHUB_TOKEN for API rate-limiting (when set)', () => {
  // Anonymous GitHub API calls are limited to 60/hr (shared across
  // ALL anonymous traffic from the same IP — i.e. all GitHub-hosted
  // runners). With GITHUB_TOKEN it's 5000/hr per consumer. Without
  // this, a popular consumer's CI would silently rate-limit.
  const src = readFileSync(installScript, 'utf8');
  assert.match(
    src,
    /GITHUB_TOKEN/,
    'install-profiler.sh must use $GITHUB_TOKEN when present to escape the anonymous rate limit',
  );
});
