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
  assert.match(out, /🔊 <a href="https:\/\/github\.com\/acme\/shop\/actions\/runs\/26514602459\/artifacts\/7241682155">Listen \(WAV\)<\/a>/);
  // Footer wording must (a) state the GitHub login requirement honestly
  // and (b) when an MP4 sibling is provided, mention the drag-drop
  // affordance that gives logged-in reviewers a real inline player.
  assert.match(out, /Listen \(WAV\)/, 'WAV link present with disambiguating label');
  assert.match(out, /sign in to GitHub to download/, 'login requirement stated up-front');
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
  assert.match(withAudio, /🔊 <a href="[^"]*7241682155">Listen \(WAV\)<\/a>/);

  const without = renderOverview(report);
  assert.doesNotMatch(without, /🔊/);
});

test('footer: when MP4 sibling URL is provided, both links surface + drag-drop hint appears', () => {
  // The MP4 affordance is the ONLY within-permissions way to get a real
  // inline player in PR comments (GitHub auto-embeds <video> for
  // user-attachments URLs only; a logged-in reviewer drag-dropping the
  // MP4 into a reply produces that). Without this hint a reviewer would
  // not know to do it.
  const MP4 = 'https://github.com/acme/shop/actions/runs/26514602459/artifacts/7241682156';
  const out = renderFooter(GEN, URL, MP4);
  assert.match(out, /Listen \(WAV\)/, 'WAV link present');
  assert.match(out, /<a href="[^"]*7241682156">MP4<\/a>/, 'MP4 link present with the right href');
  assert.match(
    out,
    /drop the MP4 into a reply for an inline player/,
    'drag-drop hint present so reviewers know how to get the inline player',
  );
});

test('footer: WAV without MP4 → only WAV link + simpler hint (no MP4 mention)', () => {
  const out = renderFooter(GEN, URL);
  assert.match(out, /Listen \(WAV\)/);
  assert.doesNotMatch(out, /MP4/, 'no MP4 mention when not provided');
  assert.match(out, /sign in to GitHub to download/, 'login hint still present');
  assert.doesNotMatch(out, /drop the MP4/, 'no drag-drop hint without MP4');
});

test('footer: no audio at all → no audio segment, no hints', () => {
  const out = renderFooter(GEN);
  assert.doesNotMatch(out, /🔊/);
  assert.doesNotMatch(out, /sign in to GitHub/);
  assert.doesNotMatch(out, /MP4/);
});

test('renderOverview threads BOTH audioUrl + audioMp4Url into the footer', () => {
  const MP4 = 'https://github.com/acme/shop/actions/runs/26514602459/artifacts/7241682156';
  const report: ScanPrOutput = {
    schema_version: '1.2',
    mode: 'static',
    generator: GEN,
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [] },
  };
  const withBoth = renderOverview(report, { audioUrl: URL, audioMp4Url: MP4 });
  assert.match(withBoth, /Listen \(WAV\)/);
  assert.match(withBoth, /<a href="[^"]*7241682156">MP4<\/a>/);
});

test('footer: hostile audio URL cannot escape the href attribute (XSS defense)', () => {
  const hostile = 'https://x/y" onclick="alert(1)';
  const out = renderFooter(GEN, hostile);
  // The href attribute must close on the NEXT literal `"` after the opener —
  // any `"` inside the URL must be HTML-encoded as `&quot;`.
  const hrefMatch = out.match(/<a href="([^"]*)">Listen \(WAV\)/);
  assert.ok(hrefMatch, 'href attribute is well-formed and closes correctly');
  assert.ok(!hrefMatch![1].includes('"'), 'no raw `"` inside the href value');
  assert.match(hrefMatch![1], /&quot;/, 'the embedded `"` was HTML-encoded');
  // Confirm only ONE attribute on the <a> tag (no injected `onclick=`, etc.).
  const tagBody = out.match(/<a ([^>]*)>Listen \(WAV\)/)![1];
  const attrCount = tagBody.split(/"\s+\w+=/).length;
  assert.equal(attrCount, 1, `exactly ONE attribute on the <a>, got: ${tagBody}`);
});

test('footer: hostile tool/version strings are HTML-escaped in <code>', () => {
  const out = renderFooter({ tool: 'evil</code><script>x</script>', version: 'v<1>' });
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /&lt;script&gt;/);
  assert.match(out, /v&lt;1&gt;/);
});
