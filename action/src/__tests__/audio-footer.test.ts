// Audio-summary footer: the footer section appends a "🔊 Listen" link to the
// spoken-summary WAV when the action threads in its artifact URL (DRIFT_AUDIO_URL
// → renderOverview opts → footer). Absent/blank → omitted (fully fail-soft).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFooter } from '../render/sections/footer.ts';
import { renderOverview } from '../render/overview.ts';
import type { ScanPrOutput } from '../report.ts';

const GEN = { tool: 'drift-static-profiler', version: '0.6.0' };
const URL = 'https://github.com/acme/shop/actions/runs/26514602459/artifacts/7241682155';

test('footer: appends a Listen link when an audio URL is provided', () => {
  const out = renderFooter(GEN, URL);
  assert.match(out, /Posted by <a href="https:\/\/drift\.dev">Drift<\/a>/);
  assert.match(out, /<code>drift-static-profiler<\/code> v0\.6\.0/);
  assert.match(out, /🔊 <a href="https:\/\/github\.com\/acme\/shop\/actions\/runs\/26514602459\/artifacts\/7241682155">Listen to the spoken summary<\/a>/);
  assert.match(out, /\(Piper TTS · WAV\)/);
});

test('footer: no audio link when URL is absent or blank', () => {
  assert.doesNotMatch(renderFooter(GEN), /🔊/);
  assert.doesNotMatch(renderFooter(GEN, ''), /🔊/);
  assert.doesNotMatch(renderFooter(GEN, '   '), /🔊/);
});

test('renderOverview threads the audio URL into the footer', () => {
  const report: ScanPrOutput = {
    schema_version: '1.2',
    mode: 'static',
    generator: GEN,
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [] },
  };
  const withAudio = renderOverview(report, { audioUrl: URL });
  assert.match(withAudio, /🔊 <a href="[^"]*7241682155">Listen to the spoken summary<\/a>/);

  const without = renderOverview(report);
  assert.doesNotMatch(without, /🔊/);
});

test('footer: hostile audio URL cannot escape the href attribute (XSS defense)', () => {
  const hostile = 'https://x/y" onclick="alert(1)';
  const out = renderFooter(GEN, hostile);
  // The href attribute must close on the NEXT literal `"` after the opener —
  // any `"` inside the URL must be HTML-encoded as `&quot;`.
  const hrefMatch = out.match(/<a href="([^"]*)">Listen/);
  assert.ok(hrefMatch, 'href attribute is well-formed and closes correctly');
  assert.ok(!hrefMatch![1].includes('"'), 'no raw `"` inside the href value');
  assert.match(hrefMatch![1], /&quot;/, 'the embedded `"` was HTML-encoded');
  // Confirm only ONE attribute on the <a> tag (no injected `onclick=`, etc.).
  const tagBody = out.match(/<a ([^>]*)>Listen/)![1];
  const attrCount = tagBody.split(/"\s+\w+=/).length;
  assert.equal(attrCount, 1, `exactly ONE attribute on the <a>, got: ${tagBody}`);
});

test('footer: hostile tool/version strings are HTML-escaped in <code>', () => {
  const out = renderFooter({ tool: 'evil</code><script>x</script>', version: 'v<1>' });
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /&lt;script&gt;/);
  assert.match(out, /v&lt;1&gt;/);
});
