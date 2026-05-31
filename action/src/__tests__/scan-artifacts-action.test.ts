// scan-artifacts wiring: the load-bearing chain that puts the pr-scan.json +
// pr-scan-context.json links into the sticky comment —
//   stage (copy report + build context)
//     → upload×2 (archive:false, raw .json at the link)
//     → resolve URLs (two-source fallback for the upload-artifact@v7 empty-url quirk)
//     → render step env (DRIFT_SCAN_*_URL, read from the RESOLVER not the upload)
//     → dist/index.js reads the env and threads it into renderOverview.
// Each assertion guards a link that silently disappears if the wire is cut.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const yamlText = readFileSync(join(REPO, 'action.yml'), 'utf8');

type StepSpec = { id?: string; name?: string; run?: string };
const STEPS = (parseYaml(yamlText) as { runs: { steps: StepSpec[] } }).runs.steps;

/** Execute the resolver step's run: body with a controlled env + temp
 *  $GITHUB_OUTPUT, returning the scan_json_url / scan_context_url it wrote. The
 *  body reads only env vars (no GHA expressions), so it runs verbatim — this
 *  proves the two-source fallback works, not just that it's present in source. */
function runResolver(env: Record<string, string>): { json: string; context: string } {
  const step = STEPS.find((s) => s.id === 'scan-artifacts-url');
  assert.ok(step?.run, 'resolver step with id=scan-artifacts-url and a run: body exists');
  const dir = mkdtempSync(join(tmpdir(), 'drift-resolver-'));
  const script = join(dir, 'resolver.sh');
  const ghOut = join(dir, 'gh_output');
  writeFileSync(script, `#!/usr/bin/env bash\nset -uo pipefail\n${step!.run}`);
  writeFileSync(ghOut, '');
  const r = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '',
      GITHUB_OUTPUT: ghOut,
      SERVER_URL: 'https://github.com',
      REPO: 'acme/shop',
      RUN_ID: '999',
      JSON_DIRECT_URL: '',
      JSON_ARTIFACT_ID: '',
      CONTEXT_DIRECT_URL: '',
      CONTEXT_ARTIFACT_ID: '',
      ...env,
    },
  });
  assert.equal(r.status, 0, `resolver exited 0 (stderr: ${r.stderr})`);
  const out = readFileSync(ghOut, 'utf8');
  const grab = (key: string) => out.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? '';
  return { json: grab('scan_json_url'), context: grab('scan_context_url') };
}

test('action.yml: stage step copies the report and builds the context bundle', () => {
  const step = yamlText.match(/- name: Stage scan artifacts[\s\S]+?(?=\n {4}- name:)/);
  assert.ok(step, 'stage step is present');
  assert.match(step![0], /id: scan-artifacts\b/, 'has id=scan-artifacts');
  assert.match(step![0], /continue-on-error: true/, 'fail-soft');
  assert.match(step![0], /cp "\$REPORT_PATH" "\$STAGE_DIR\/pr-scan\.json"/, 'copies the report to pr-scan.json');
  assert.match(step![0], /build-scan-context\.mjs/, 'invokes the context builder');
  assert.match(step![0], /SCAN_CONTEXT_OUT="\$STAGE_DIR\/pr-scan-context\.json"/, 'sets the context out path');
  assert.match(step![0], /scan_json_ready=.*\n.*context_ready=/, 'writes both readiness outputs');
});

test('action.yml: both artifacts upload NON-ZIPPED with overwrite (re-run safe)', () => {
  const jsonUp = yamlText.match(/- name: Upload pr-scan\.json artifact[\s\S]+?(?=\n {4}- name:)/);
  const ctxUp = yamlText.match(/- name: Upload pr-scan-context\.json artifact[\s\S]+?(?=\n {4}- name:)/);
  assert.ok(jsonUp, 'pr-scan.json upload present');
  assert.ok(ctxUp, 'pr-scan-context.json upload present');
  for (const [label, step, file, gate] of [
    ['json', jsonUp![0], 'pr-scan.json', 'scan_json_ready'],
    ['context', ctxUp![0], 'pr-scan-context.json', 'context_ready'],
  ] as const) {
    assert.match(step, /uses: actions\/upload-artifact@v7/, `${label}: uses upload-artifact@v7`);
    assert.match(step, /archive: false/, `${label}: archive:false → raw .json at the link`);
    assert.match(step, /overwrite: true/, `${label}: overwrite for re-runs`);
    assert.match(step, new RegExp(`drift-scan-artifacts/${file.replace('.', '\\.')}`), `${label}: correct path`);
    assert.match(step, new RegExp(`steps\\.scan-artifacts\\.outputs\\.${gate} == 'true'`), `${label}: gated on readiness`);
  }
});

test('action.yml: resolver reconstructs both URLs and is the render step source', () => {
  const step = yamlText.match(/- name: Resolve scan artifact URLs[\s\S]+?(?=\n {4}- name:)/);
  assert.ok(step, 'resolver present');
  assert.match(step![0], /id: scan-artifacts-url\b/);
  assert.match(step![0], /continue-on-error: true/);
  assert.match(step![0], /steps\.scan-json-upload\.outputs\.artifact-url/, 'reads json direct url');
  assert.match(step![0], /steps\.scan-json-upload\.outputs\.artifact-id/, 'reads json artifact-id for reconstruction');
  assert.match(step![0], /steps\.scan-context-upload\.outputs\.artifact-url/, 'reads context direct url');
  assert.match(step![0], /steps\.scan-context-upload\.outputs\.artifact-id/, 'reads context artifact-id');
  assert.match(step![0], /\$\{SERVER_URL\}\/\$\{REPO\}\/actions\/runs\/\$\{RUN_ID\}\/artifacts\//, 'canonical URL shape');
  // Output writes must be REDIRECTED to $GITHUB_OUTPUT — a bare `echo key=…`
  // (no redirect) would set nothing at runtime. Assert both keys AND the redirect.
  assert.match(step![0], /echo "scan_json_url=\$\{json_url\}"/, 'echoes scan_json_url');
  assert.match(step![0], /echo "scan_context_url=\$\{context_url\}"/, 'echoes scan_context_url');
  assert.match(step![0], /\}\s*>> "\$GITHUB_OUTPUT"/, 'the output block redirects to $GITHUB_OUTPUT');
});

test('resolver (executed): direct artifact-url wins when present', () => {
  const { json, context } = runResolver({
    JSON_DIRECT_URL: 'https://direct/json',
    JSON_ARTIFACT_ID: '111',
    CONTEXT_DIRECT_URL: 'https://direct/ctx',
    CONTEXT_ARTIFACT_ID: '222',
  });
  assert.equal(json, 'https://direct/json', 'direct url preferred over reconstruction');
  assert.equal(context, 'https://direct/ctx');
});

test('resolver (executed): reconstructs canonical URL from artifact-id when direct is empty', () => {
  const { json, context } = runResolver({
    JSON_DIRECT_URL: '',
    JSON_ARTIFACT_ID: '111',
    CONTEXT_DIRECT_URL: '',
    CONTEXT_ARTIFACT_ID: '222',
  });
  assert.equal(json, 'https://github.com/acme/shop/actions/runs/999/artifacts/111', 'json reconstructed');
  assert.equal(context, 'https://github.com/acme/shop/actions/runs/999/artifacts/222', 'context reconstructed');
});

test('resolver (executed): both inputs empty → empty string (link omitted, no malformed /artifacts/ URL)', () => {
  const { json, context } = runResolver({});
  assert.equal(json, '', 'no direct + no id → empty, not a dangling …/artifacts/ URL');
  assert.equal(context, '');
});

test('resolver (executed): mixed — one link reconstructs, the other is absent', () => {
  const { json, context } = runResolver({ JSON_ARTIFACT_ID: '111' });
  assert.equal(json, 'https://github.com/acme/shop/actions/runs/999/artifacts/111');
  assert.equal(context, '', 'context upload absent → its link is correctly omitted');
});

test('action.yml: Cap step snapshots the UNCAPPED report before truncating in place', () => {
  const cap = STEPS.find((s) => s.id === 'cap-suggestions');
  assert.ok(cap?.run, 'cap step present');
  // The snapshot must run BEFORE the in-place `mv` that truncates the report,
  // so pr-scan.json carries every suggestion (not the comment's top-N).
  const snapIdx = cap!.run!.indexOf('SCAN_SNAPSHOT_DIR');
  const mvIdx = cap!.run!.indexOf('mv "$tmp" "$DRIFT_REPORT_PATH"');
  assert.ok(snapIdx > 0, 'cap step snapshots via SCAN_SNAPSHOT_DIR');
  assert.ok(mvIdx > 0 && snapIdx < mvIdx, 'snapshot happens before the in-place truncation');
  assert.match(cap!.run!, /drift-scan-artifacts/, 'snapshot targets the staging dir');
  // The snapshot must be unable to abort the step under `set -e` (the cap must
  // always run): it lives inside an `if` condition guarded on RUNNER_TEMP.
  assert.match(cap!.run!, /if \[ -n "\$\{RUNNER_TEMP:-\}" \]/, 'snapshot is guarded, never aborts the cap');
});

test('action.yml: render step reads BOTH URLs from the resolver (not the uploads)', () => {
  assert.match(
    yamlText,
    /DRIFT_SCAN_JSON_URL:\s+\$\{\{ steps\.scan-artifacts-url\.outputs\.scan_json_url \}\}/,
    'render reads scan_json_url from resolver',
  );
  assert.match(
    yamlText,
    /DRIFT_SCAN_CONTEXT_URL:\s+\$\{\{ steps\.scan-artifacts-url\.outputs\.scan_context_url \}\}/,
    'render reads scan_context_url from resolver',
  );
  assert.doesNotMatch(
    yamlText,
    /DRIFT_SCAN_JSON_URL:\s+\$\{\{ steps\.scan-json-upload\.outputs\.artifact-url \}\}/,
    'render must NEVER read the upload artifact-url directly — that bypasses the fallback',
  );
});

test('action.yml: stage/upload/resolve all precede the Post step', () => {
  const postIdx = yamlText.indexOf('name: Post Drift PR review');
  for (const name of [
    'name: Stage scan artifacts',
    'name: Upload pr-scan.json artifact',
    'name: Upload pr-scan-context.json artifact',
    'name: Resolve scan artifact URLs',
  ]) {
    const idx = yamlText.indexOf(name);
    assert.ok(idx > 0 && idx < postIdx, `${name} must come before Post Drift PR review`);
  }
});

test('build-scan-context.mjs exists and is zero-dep (node:* imports only)', () => {
  const path = join(REPO, 'action', 'scripts', 'build-scan-context.mjs');
  assert.ok(existsSync(path), 'builder script present');
  const src = readFileSync(path, 'utf8');
  for (const m of src.matchAll(/^import\s+.*\bfrom\s+'([^']+)'/gm)) {
    assert.match(m[1], /^node:/, `import must be a node: builtin, got '${m[1]}' (script runs with bare node, no node_modules)`);
  }
});

test('dist/index.js threads DRIFT_SCAN_*_URL into the renderer', () => {
  const dist = readFileSync(join(REPO, 'dist/index.js'), 'utf8');
  assert.match(dist, /DRIFT_SCAN_JSON_URL/, 'bundle reads DRIFT_SCAN_JSON_URL');
  assert.match(dist, /DRIFT_SCAN_CONTEXT_URL/, 'bundle reads DRIFT_SCAN_CONTEXT_URL');
  assert.match(dist, /scanJsonUrl/, 'bundle threads scanJsonUrl');
  assert.match(dist, /scanContextUrl/, 'bundle threads scanContextUrl');
  assert.match(dist, /Scan artifacts \(JSON\)/, 'bundle ships the accordion summary');
});
