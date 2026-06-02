#!/usr/bin/env node
// Render the "no code to analyze" sticky comment the action posts for a
// docs/config-only PR. Writes the exact markdown bytes to disk so you can
// preview the comment locally (VS Code ⇧⌘V) without running the action.
//
// Usage:
//   node --experimental-strip-types --no-warnings \
//     action/scripts/render-no-source.ts <output.md> [<event.json>] [--files=a,b,c]
//
// • <event.json> — OPTIONAL `pull_request` webhook payload (e.g.
//   action/.dev/event.json) to preview SHA-pinned file permalinks; without it
//   the file table degrades to plain `code spans`.
// • --files=...  — OPTIONAL comma-separated changed-file list. Defaults to a
//   representative docs/config sample so the preview is never empty.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { renderNoSource } from '../src/render/no_source.ts';
import type { PrContext } from '../src/render/context.ts';

const rawArgs = process.argv.slice(2);
const flags = new Map<string, string>();
const positionals: string[] = [];
for (const arg of rawArgs) {
  if (arg.startsWith('--')) {
    const [key, ...rest] = arg.slice(2).split('=');
    flags.set(key, rest.join('=') || 'true');
  } else {
    positionals.push(arg);
  }
}
const [outputArg, eventArg] = positionals;
if (!outputArg) {
  console.error('usage: render-no-source.ts <output.md> [<event.json>] [--files=a,b,c]');
  process.exit(2);
}

// A representative docs/config sample so the preview shows the file table even
// when no --files / no diff is supplied. Mirrors the real PR #73 shape.
const DEFAULT_FILES = [
  '.github/workflows/drift-chrome-extension-release.yml',
  'drift-chrome-extension/README.md',
  'docs/architecture.md',
  'Makefile',
  '.gitignore',
];
const changedFiles = (flags.get('files') ?? '')
  .split(',')
  .map((f) => f.trim())
  .filter(Boolean);

const outputPath = resolve(outputArg);
const ctx = eventArg ? contextFromEvent(resolve(eventArg)) : undefined;
const body = renderNoSource({
  ctx,
  changedFiles: changedFiles.length > 0 ? changedFiles : DEFAULT_FILES,
  // Preview the 🔊 affordance with `--audio=<url>` or DRIFT_AUDIO_URL.
  audioUrl: flags.get('audio') ?? process.env.DRIFT_AUDIO_URL,
  audioMp4Url: process.env.DRIFT_AUDIO_MP4_URL,
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, body);

const has = (s: string) => body.includes(s);
const sigil = (cond: boolean) => (cond ? '✓' : '·');
console.log(`✓ wrote ${outputPath} (${body.length} bytes)${ctx ? ' [with PR context → permalinks]' : ''}`);
console.log(`  ${sigil(has('<!-- drift:sticky-comment -->'))} sticky marker   ${sigil(has('No code to analyze'))} verdict badge`);
console.log(`  ${sigil(has('[!NOTE]'))} note callout    ${sigil(has('Files changed ('))} file table`);
console.log(`  ${sigil(has('drift:status'))} status marker   ${sigil(has('Posted by'))} footer`);

// Build a PrContext from a `pull_request` webhook payload (best-effort).
function contextFromEvent(eventPath: string): PrContext {
  const ev = JSON.parse(readFileSync(eventPath, 'utf8')) as {
    pull_request?: { number?: number; title?: string; html_url?: string; head?: { sha?: string }; base?: { ref?: string }; user?: { login?: string } };
    repository?: { owner?: { login?: string }; name?: string };
  };
  const pr = ev.pull_request ?? {};
  let owner: string | undefined;
  let repo: string | undefined;
  const envSlug = process.env.GITHUB_REPOSITORY;
  if (envSlug?.includes('/')) [owner, repo] = envSlug.split('/');
  else if (ev.repository?.owner?.login && ev.repository?.name) {
    owner = ev.repository.owner.login;
    repo = ev.repository.name;
  } else if (pr.html_url) {
    const m = pr.html_url.match(/github\.com\/([^/]+)\/([^/]+)\//);
    if (m) [, owner, repo] = m;
  }
  return {
    owner,
    repo,
    sha: pr.head?.sha,
    prNumber: pr.number,
    prTitle: pr.title,
    htmlUrl: pr.html_url,
    baseRef: pr.base?.ref,
    author: pr.user?.login,
  };
}
