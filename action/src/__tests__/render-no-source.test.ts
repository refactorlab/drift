// The "no code to analyze" sticky comment — Drift's graceful answer to a
// docs/config-only PR (no file in a language the scanner understands). These
// tests pin the contract that step "7a" in action.yml relies on:
//   • the body opens with the shared STICKY_MARKER so it UPSERTS the same
//     comment surface the full report uses (replacing a stale full report);
//   • it's badge-forward (3 shields), explains WHY there's no report, lists the
//     changed files tagged by category, and closes with the shared footer;
//   • it carries a hidden `drift:status state=no-source` marker so a CI gate
//     reads a benign neutral state, never a missing snapshot;
//   • it degrades to valid markdown with no PR context and zero changed files;
//   • untrusted file paths are HTML-escaped (defense-in-depth).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNoSource } from '../render/no_source.ts';
import { STICKY_MARKER } from '../render/overview.ts';
import type { PrContext } from '../render/context.ts';

const CTX: PrContext = {
  owner: 'refactorlab',
  repo: 'drift',
  sha: '2bc2a99a2143012a79c6800221eb02961102ed65',
  prNumber: 73,
  prTitle: 'ci(chrome-ext): preflight Chrome Web Store auth',
};

const FILES = [
  '.github/workflows/drift-chrome-extension-release.yml',
  'drift-chrome-extension/README.md',
];

test('opens with the shared sticky marker so it upserts the same comment', () => {
  const body = renderNoSource({ ctx: CTX, changedFiles: FILES });
  assert.ok(body.startsWith(STICKY_MARKER), 'body must start with STICKY_MARKER');
});

test('is badge-forward: three centered shields, no hero prose', () => {
  const body = renderNoSource({ ctx: CTX, changedFiles: FILES });
  assert.match(body, /<p align="center">/, 'badges are wrapped in a centered <p>');
  const badgeCount = (body.match(/img\.shields\.io\/badge\//g) ?? []).length;
  assert.equal(badgeCount, 3, 'exactly three shields in the TL;DR row');
  assert.match(body, /No code to analyze/);
  assert.match(body, /Docs%20%26%20config%20only/, 'category badge text is shields-encoded (space → %20, & → %26)');
});

test('the file-count badge agrees with the changed-file list', () => {
  const one = renderNoSource({ ctx: CTX, changedFiles: ['README.md'] });
  assert.match(one, /1 file changed/);
  const two = renderNoSource({ ctx: CTX, changedFiles: FILES });
  assert.match(two, /2 files changed/);
});

test('explains WHY there is no report in a NOTE callout', () => {
  const body = renderNoSource({ ctx: CTX, changedFiles: FILES });
  assert.match(body, /> \[!NOTE\]/);
  // Wording must be accurate for the WHOLE has_source=false set (docs/config
  // AND non-analyzed source like .rb/.cpp), so it must NOT claim "only docs/config".
  assert.match(body, /no files in a language Drift analyzes/i);
  assert.doesNotMatch(body, /only documentation and configuration/i);
  // Names the analyzed languages so a reviewer knows what WOULD trigger a report.
  assert.match(body, /Python/);
  assert.match(body, /Rust/);
});

test('lists changed files in a collapsed table, tagged by category', () => {
  const body = renderNoSource({ ctx: CTX, changedFiles: FILES });
  assert.match(body, /<details>/);
  assert.match(body, /Files changed \(2\)/);
  // .yml → config, .md → docs.
  assert.match(body, /drift-chrome-extension-release\.yml.*\| config \|/s);
  assert.match(body, /README\.md.*\| docs \|/s);
});

test('file rows are SHA-pinned permalinks when PR context is present', () => {
  const body = renderNoSource({ ctx: CTX, changedFiles: ['drift-chrome-extension/README.md'] });
  assert.match(
    body,
    /https:\/\/github\.com\/refactorlab\/drift\/blob\/2bc2a99a2143012a79c6800221eb02961102ed65\/drift-chrome-extension\/README\.md/,
  );
});

test('carries a hidden no-source status marker for CI gates', () => {
  const body = renderNoSource({ ctx: CTX, changedFiles: FILES });
  assert.match(body, /<!-- drift:status v=1 state=no-source confidence=na effort=0 changed=2 -->/);
});

test('closes with the shared footer + Andy sign-off', () => {
  const body = renderNoSource({ ctx: CTX, changedFiles: FILES });
  assert.match(body, /Posted by <a href="https:\/\/drift\.dev">Drift<\/a>/);
  assert.match(body, /andy\.png/);
});

test('degrades to valid markdown with no context and zero changed files', () => {
  const body = renderNoSource();
  assert.ok(body.startsWith(STICKY_MARKER));
  assert.match(body, /No code to analyze/);
  // No file list → the collapsed table is omitted entirely (no empty <details>).
  assert.doesNotMatch(body, /<details>/);
  assert.match(body, /0 files changed/);
  assert.match(body, /changed=0/);
  // Without ctx, no permalinks — file cells (when present) fall back to code spans.
  assert.doesNotMatch(body, /github\.com\/[^/]+\/[^/]+\/blob\//);
});

test('renders untrusted file paths inside a code span (no raw HTML execution)', () => {
  const evil = 'docs/<img src=x onerror=alert(1)>.md';
  const body = renderNoSource({ changedFiles: [evil] });
  // fileLink (the shared permalink helper) wraps the path in a markdown code
  // span, so GitHub renders the content literally — the <img> never becomes an
  // HTML element. Same escaping behaviour as every other Drift file-path table.
  assert.match(body, /`docs\/<img src=x onerror=alert\(1\)>\.md`/);
});

test('category badge never claims docs/config for binary/asset or non-analyzed-source PRs', () => {
  // Binary/asset.
  let body = renderNoSource({ ctx: CTX, changedFiles: ['assets/logo.png'] });
  assert.match(body, /alt="No analyzed source"/);
  assert.doesNotMatch(body, /alt="Docs &amp; config only"/);
  // Real source in a language Drift does NOT analyze (Ruby) — must NOT be
  // mislabeled "docs/config" or "non-code"; it's simply not analyzed.
  body = renderNoSource({ ctx: CTX, changedFiles: ['lib/widget.rb', 'src/main.cpp'] });
  assert.match(body, /alt="No analyzed source"/);
  assert.doesNotMatch(body, /documentation and configuration/i);
});

test('category badge is accurate for docs-only and config-only PRs', () => {
  assert.match(renderNoSource({ changedFiles: ['README.md', 'docs/x.md'] }), /alt="Docs only"/);
  assert.match(renderNoSource({ changedFiles: ['.github/ci.yml'] }), /alt="Config only"/);
});

test('surfaces the 🔊 audio banner + footer link when an audio URL is present', () => {
  const audioUrl = 'https://github.com/refactorlab/drift/actions/runs/123/artifacts/456';
  const body = renderNoSource({ ctx: CTX, changedFiles: FILES, audioUrl });
  // Clickable banner.
  assert.match(body, /summary-audio\.png/);
  assert.match(body, new RegExp(`<a href="${audioUrl.replace(/\//g, '\\/')}"`));
  // Footer text link.
  assert.match(body, /Listen \(WAV\)/);
});

test('omits all audio affordances when no audio URL is given', () => {
  const body = renderNoSource({ ctx: CTX, changedFiles: FILES });
  assert.doesNotMatch(body, /summary-audio\.png/);
  assert.doesNotMatch(body, /Listen \(WAV\)/);
});

test('caps the file table and summarizes the overflow', () => {
  const many = Array.from({ length: 120 }, (_, i) => `docs/page-${i}.md`);
  const body = renderNoSource({ changedFiles: many, maxFiles: 50 });
  assert.match(body, /Files changed \(120\)/, 'heading shows the TRUE total');
  assert.match(body, /and 70 more files not shown/);
});
