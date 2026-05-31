// Scan-artifacts accordion: a collapsed-by-default <details> at the bottom of
// the sticky comment linking the run's machine-readable JSON artifacts —
// pr-scan.json (raw scanner report) + pr-scan-context.json (scan context). The
// action threads the artifact URLs in via DRIFT_SCAN_JSON_URL /
// DRIFT_SCAN_CONTEXT_URL → renderOverview opts → renderScanArtifacts. Absent
// URLs → the block (or the individual link) is omitted (fully fail-soft).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderScanArtifacts } from '../render/sections/artifacts.ts';
import { renderOverview } from '../render/overview.ts';
import type { ScanPrOutput } from '../report.ts';

const JSON_URL = 'https://github.com/acme/shop/actions/runs/26514602459/artifacts/7241682200';
const CTX_URL = 'https://github.com/acme/shop/actions/runs/26514602459/artifacts/7241682201';

const REPORT: ScanPrOutput = {
  schema_version: '1.2',
  mode: 'static',
  generator: { tool: 'drift-static-profiler', version: '0.6.0' },
  pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [] },
};

test('artifacts: collapsed <details> with both JSON links + smallest text', () => {
  const out = renderScanArtifacts({ scanJsonUrl: JSON_URL, scanContextUrl: CTX_URL });
  // Collapsed by default — never `<details open>`.
  assert.match(out, /^<details>\n<summary>/);
  assert.doesNotMatch(out, /<details open>/);
  // Smallest text: the summary AND the link body are wrapped in <sub>.
  assert.match(out, /<summary><sub>📎 Scan artifacts \(JSON\)<\/sub><\/summary>/);
  assert.match(out, /\n\n<sub><a href="https/, 'body opens with a <sub>-wrapped link');
  assert.match(out, /<\/sub>\n\n<\/details>$/, 'body closes the <sub> before </details>');
  // Both links, with the consumer-facing filenames.
  assert.match(out, /<a href="[^"]*7241682200">pr-scan\.json<\/a>/);
  assert.match(out, /<a href="[^"]*7241682201">pr-scan-context\.json<\/a>/);
  // Honest UX: artifact URLs 404 for unauthenticated viewers.
  assert.match(out, /Sign in to GitHub to download/);
});

test('artifacts: only the report URL → only the pr-scan.json link', () => {
  const out = renderScanArtifacts({ scanJsonUrl: JSON_URL });
  assert.match(out, /pr-scan\.json<\/a>/);
  assert.doesNotMatch(out, /pr-scan-context\.json/);
});

test('artifacts: only the context URL → only the pr-scan-context.json link', () => {
  const out = renderScanArtifacts({ scanContextUrl: CTX_URL });
  assert.match(out, /pr-scan-context\.json<\/a>/);
  // The report link text must not appear (allow the substring inside context filename).
  assert.doesNotMatch(out, />pr-scan\.json</);
});

test('artifacts: no URLs (or blank) → empty string, block omitted', () => {
  assert.equal(renderScanArtifacts({}), '');
  assert.equal(renderScanArtifacts({ scanJsonUrl: '', scanContextUrl: '   ' }), '');
});

test('artifacts: hostile URL cannot escape the href attribute (XSS defense)', () => {
  const hostile = 'https://x/y" onclick="alert(1)';
  const out = renderScanArtifacts({ scanJsonUrl: hostile });
  const href = out.match(/<a href="([^"]*)">pr-scan\.json/);
  assert.ok(href, 'href attribute is well-formed and closes correctly');
  assert.ok(!href![1].includes('"'), 'no raw `"` inside the href value');
  assert.match(href![1], /&quot;/, 'the embedded `"` was HTML-encoded');
  // Exactly ONE attribute on the <a> — the injected `onclick=` cannot break out
  // of the (encoded) href value into a real attribute. Mirrors the footer's XSS
  // guard: split on a raw `"` followed by `name=`; a clean tag yields one piece.
  const tagBody = out.match(/<a ([^>]*)>pr-scan\.json/)![1];
  assert.equal(tagBody.split(/"\s+\w+=/).length, 1, `exactly ONE attribute on the <a>, got: ${tagBody}`);
});

test('renderOverview threads scanJsonUrl + scanContextUrl into the accordion', () => {
  const withArtifacts = renderOverview(REPORT, { scanJsonUrl: JSON_URL, scanContextUrl: CTX_URL });
  assert.match(withArtifacts, /📎 Scan artifacts \(JSON\)/);
  assert.match(withArtifacts, /pr-scan\.json<\/a>/);
  assert.match(withArtifacts, /pr-scan-context\.json<\/a>/);

  const without = renderOverview(REPORT);
  assert.doesNotMatch(without, /📎 Scan artifacts/);
});

test('renderOverview: accordion sits before the Andy sign-off (Andy stays last visible)', () => {
  const body = renderOverview(REPORT, { scanJsonUrl: JSON_URL });
  const artifactsIdx = body.indexOf('📎 Scan artifacts');
  const andyIdx = body.indexOf('Andy — your PR handoff assistant');
  assert.ok(artifactsIdx > 0, 'accordion present');
  assert.ok(andyIdx > artifactsIdx, 'Andy sign-off comes after the artifacts accordion');
});
