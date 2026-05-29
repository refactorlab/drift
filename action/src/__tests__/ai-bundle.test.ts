// Bundle smoke tests. The Action runs the bundled `dist/ai-infer-one.js`
// (and friends) directly via `node dist/<bundle>.js` — composite Action
// steps cannot consume the TS source. If a future esbuild/treeshake
// configuration change drops the scanner-window path, the diagnostic
// logs, or the focal-point filter, the unit tests would still pass
// (they import the TS) while consumers would silently regress.
//
// These tests load the SHIPPED bundles and assert that the load-bearing
// strings + identifiers are still present, mirroring the CI guard that
// verifies the bundle is in sync with src/. Together they bracket the
// "src changed but bundle didn't get rebuilt / minified-out" failure
// mode end-to-end.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const inferBundle = resolve(repoRoot, 'dist/ai-infer-one.js');
const ctxBundle = resolve(repoRoot, 'dist/ai-context.js');

test('bundle: dist/ai-infer-one.js exists and is non-empty', () => {
  assert.ok(existsSync(inferBundle), `expected ${inferBundle} to exist — run \`npm run build\``);
  const stat = readFileSync(inferBundle);
  assert.ok(stat.length > 100_000, 'bundle suspiciously small — build likely failed silently');
});

test('bundle: ai-infer-one carries the scanner-window decision path', () => {
  const src = readFileSync(inferBundle, 'utf8');
  // The renderer's identifying label that goes into every prompt that
  // uses the scanner's pre-baked window. If this string is gone, the
  // scanner-window path was tree-shaken out or replaced.
  assert.ok(
    src.includes('code window (scanner '),
    'scanner-window label missing from bundle — Fix B not shipped',
  );
  // The fallback label is paired with the scanner one — both must
  // survive so the runtime can choose between them per finding.
  assert.ok(
    src.includes('code window (HEAD '),
    'HEAD fallback label missing from bundle',
  );
});

test('bundle: ai-infer-one carries the diagnostic outcomes', () => {
  const src = readFileSync(inferBundle, 'utf8');
  // Every diagnostic outcome the user might encounter must be present
  // in the bundle so the runtime log is actionable.
  for (const needle of [
    'cohort ',
    'anchorable',
    'prompt built',
    'window=',
    'index out of range',
    'PR diff unavailable',
    'file not present on the PR diff',
    'has zero commentable lines',
  ]) {
    assert.ok(src.includes(needle), `bundle missing diagnostic substring: ${JSON.stringify(needle)}`);
  }
});

test('bundle: ai-infer-one carries the suffix-match bridge (lookupCommentable)', () => {
  const src = readFileSync(inferBundle, 'utf8');
  // The path-base bridge is part of the file-level filter; if it gets
  // dropped, scanner paths that don't byte-match `git diff` paths will
  // silently filter out. There's no human-readable label to grep, but
  // the function name survives esbuild's minification setting (we use
  // default minify=false), so identifier-presence is a safe sentinel.
  assert.ok(
    src.includes('lookupCommentable'),
    'lookupCommentable missing from bundle — path-base mismatches will silently drop findings',
  );
});

test('bundle: ai-context.js shares the same renderer (single source of truth)', () => {
  assert.ok(existsSync(ctxBundle), 'expected dist/ai-context.js to exist');
  const src = readFileSync(ctxBundle, 'utf8');
  // ai-context.js uses buildAIContext → renderFocalPoint → scanner
  // window. The same labels must surface here so the deterministic
  // review (which also calls into renderFocalPoint) stays consistent
  // with the per-suggestion AI loop.
  assert.ok(
    src.includes('code window (scanner '),
    'scanner-window label missing from ai-context.js',
  );
  assert.ok(
    src.includes('code window (HEAD '),
    'HEAD fallback label missing from ai-context.js',
  );
});

// ─── ai-suggest.js (the POST step that turns the envelope into a review) ─

const suggestBundle = resolve(repoRoot, 'dist/ai-suggest.js');

test('bundle: dist/ai-suggest.js exists and reads the same envelope path', () => {
  assert.ok(existsSync(suggestBundle), 'expected dist/ai-suggest.js to exist');
  const src = readFileSync(suggestBundle, 'utf8');
  // ai-index.ts reads `AI_SUGGESTIONS_PATH` — if the bundle ever
  // tree-shakes that env-var lookup, the post step gets nothing.
  assert.ok(
    src.includes('AI_SUGGESTIONS_PATH'),
    'AI_SUGGESTIONS_PATH env-var lookup missing from ai-suggest.js',
  );
  // The dry-run path is a load-bearing safety net for staging /
  // local runs — protect it by name.
  assert.ok(
    src.includes('DRIFT_DRY_RUN'),
    'DRIFT_DRY_RUN handling missing from ai-suggest.js',
  );
  // The model identifier surfaces in the review body — its env var
  // must survive in the bundle.
  assert.ok(
    src.includes('DRIFT_AI_MODEL'),
    'DRIFT_AI_MODEL env-var lookup missing from ai-suggest.js',
  );
});

test('bundle: ai-suggest carries the filter+cap chain identifiers', () => {
  const src = readFileSync(suggestBundle, 'utf8');
  // These three functions are the load-bearing pipeline:
  //   parseAIOutput → filterByDiff → buildReviewComments
  // If any drops out (a refactor renames it, a tree-shake misses
  // it), the post step silently produces an empty review.
  for (const fn of ['parseAIOutput', 'filterByDiff', 'buildReviewComments']) {
    assert.ok(src.includes(fn), `ai-suggest.js missing pipeline function: ${fn}`);
  }
});

// ─── index.js (the deterministic-review bundle — sticky comment + check run) ─

const mainBundle = resolve(repoRoot, 'dist/index.js');

test('bundle: dist/index.js exists, non-empty, and carries the sticky-comment marker', () => {
  assert.ok(existsSync(mainBundle), 'expected dist/index.js to exist');
  const stat = readFileSync(mainBundle);
  assert.ok(stat.length > 200_000, 'main bundle suspiciously small');
  const src = stat.toString('utf8');
  // The sticky comment uses an HTML marker to dedupe between runs.
  // If this string moves, the deterministic review starts posting
  // duplicate comments — a noisy, hard-to-undo regression.
  assert.ok(
    src.includes('<!-- drift:sticky-comment -->'),
    'main bundle missing the sticky-comment dedupe marker',
  );
  // The state blob (used for since-last-review deltas) also has an
  // HTML-comment marker — protect it too.
  assert.ok(
    src.includes('drift:state'),
    'main bundle missing the state-blob marker — since-last-review deltas will reset every run',
  );
});

test('bundle: index.js carries the load-bearing render sections that ship the sticky comment', () => {
  const src = readFileSync(mainBundle, 'utf8');
  // These section names surface as headings in the sticky comment;
  // every consumer expects them in the README workflow output. A
  // future refactor that renames or drops one of these would break
  // user-facing UX silently (the bundle would still POST, but with
  // a section missing).
  for (const heading of [
    'Posted by',     // footer attribution
    'Drift',         // brand label appears in every section header
    'suggestion',    // suggestions section (case-insensitive in source)
  ]) {
    assert.ok(src.includes(heading), `main bundle missing user-facing string: ${heading}`);
  }
  // The footer's attribute-escape helper must survive — its absence
  // would turn the audio link into an XSS vector (covered in detail
  // by audio-footer.test.ts; here we just guarantee the FUNCTION
  // shipped, no tree-shake regression).
  assert.ok(
    src.includes('&quot;'),
    'main bundle missing the attribute-escape glyph (footer escapeAttr) — XSS guard not shipped',
  );
});

// ─── Regression guards: the bugs we just fixed must NOT reappear ────────

test('bundle: the OLD "no anchorable focal point at this index" message is GONE from every bundle', () => {
  // The bug we just fixed: the old per-focal handler emitted this
  // opaque one-liner whenever the exact-line filter dropped a finding
  // (which was always, for `def`-anchored dead-code findings). The new
  // code emits structured diagnostics (cohort N/N, file not present,
  // zero commentable lines, …). If this string EVER reappears in any
  // bundle, the diagnostics regression is back.
  const needle = 'no anchorable focal point at this index';
  for (const b of ['ai-infer-one.js', 'ai-suggest.js', 'ai-context.js', 'index.js']) {
    const p = resolve(repoRoot, 'dist', b);
    if (!existsSync(p)) continue;
    const src = readFileSync(p, 'utf8');
    assert.ok(
      !src.includes(needle),
      `dist/${b} reintroduced the OLD opaque "${needle}" log — the diagnostics regressed`,
    );
  }
});

test('bundle: ai-suggest.js carries the suffix-match bridge (bug #2 fix)', () => {
  // The second filter layer (filterByDiff in ai-index.ts) used to do
  // exact-key matching against `commentableByFile.get(s.file)`. That
  // dropped any suggestion whose model-echoed path didn't byte-match
  // GitHub's normalized path. The fix routes through `lookupCommentable`
  // (the same suffix-match the first filter uses). Its absence in the
  // bundle means the post step is back to the silent-drop regression.
  const src = readFileSync(suggestBundle, 'utf8');
  assert.ok(
    src.includes('lookupCommentable'),
    'lookupCommentable missing from ai-suggest.js — bug #2 (post-step path-base mismatch) regressed',
  );
});

test('bundle: ai-suggest.js emits per-finding drop reasons (the new diagnostic surface)', () => {
  // The post-filter used to just name the count of dropped findings.
  // The new code names the REASON for each drop ("file not in PR
  // diff", "line(s) N not on diff", …) so a 0-post run is fully
  // diagnosable from the log.
  const src = readFileSync(suggestBundle, 'utf8');
  assert.ok(
    src.includes('per-finding reasons'),
    'ai-suggest.js missing per-finding-reasons log — drop diagnostics regressed',
  );
  assert.ok(
    src.includes('file not in PR diff'),
    'ai-suggest.js missing "file not in PR diff" reason string',
  );
});

test('bundle: all four shipped bundles are tracked + their tree is consistent', () => {
  // Sanity that mirrors the CI sync guard in .github/workflows/ci.yml.
  // The guard checks `git diff --quiet dist/*.js`; this lower-level
  // assertion catches a missing FILE the moment npm test runs
  // locally, well before CI.
  for (const f of ['index.js', 'ai-context.js', 'ai-suggest.js', 'ai-infer-one.js']) {
    const p = resolve(repoRoot, 'dist', f);
    assert.ok(existsSync(p), `dist/${f} missing — run 'cd action && npm run build'`);
  }
});
