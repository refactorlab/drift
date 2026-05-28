#!/usr/bin/env node
// Render the PR-comment body that the action would post to GitHub, given a
// scan-pr JSON report. Writes the markdown to disk so you can preview the exact
// bytes the action sends to issues.createComment.
//
// Usage:
//   node --experimental-strip-types --no-warnings \
//     action/scripts/render-comment.ts <input.json> <output.md> [<event.json>]
//
// Pass an OPTIONAL event.json (a `pull_request` webhook payload, like
// action/.dev/event.json) to preview the title line + SHA-pinned permalinks the
// real action produces. Without it, the comment still renders — just with
// code-span fallbacks instead of links.

import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadReport } from '../src/report.ts';
import { renderOverview } from '../src/render/overview.ts';
import type { PrContext } from '../src/render/context.ts';

const [, , inputArg, outputArg, eventArg] = process.argv;
if (!inputArg || !outputArg) {
  console.error('usage: render-comment.ts <input.json> <output.md> [<event.json>]');
  process.exit(2);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);

statSync(inputPath); // throws if missing — clearer than load() error
const report = loadReport(inputPath);
const ctx = eventArg ? contextFromEvent(resolve(eventArg)) : undefined;
const body = renderOverview(report, { ctx, audioUrl: process.env.DRIFT_AUDIO_URL });

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, body);

// Concise summary so a Makefile invocation has something useful to show.
const sigil = (cond: boolean) => (cond ? '✓' : '·');
const has = (s: string) => body.includes(s);
console.log(`✓ wrote ${outputPath} (${body.length} bytes / 65 536 cap)${ctx ? ' [with PR context → permalinks]' : ''}`);
console.log(`  ${sigil(/\[!(TIP|WARNING|NOTE)\]/.test(body))} header verdict   ${sigil(has('### ✅ Before you merge'))} merge checklist`);
console.log(`  ${sigil(has('## 📊 Value card'))} value card       ${sigil(has('Since last review'))} since-last-review`);
console.log(`  ${sigil(has('## ⚠️ Suggestions'))} suggestions      ${sigil(has('## 🛰 Risks'))} risks`);
console.log(`  ${sigil(has('## 🏗 Architecture & reach'))} architecture     ${sigil(has('Legend &amp; methodology'))} legend`);

if (body.length > 60_000) console.warn(`! body exceeds 60 KiB soft budget (cap is 65 536)`);

// Build a PrContext from a `pull_request` webhook payload (best-effort).
function contextFromEvent(eventPath: string): PrContext {
  const ev = JSON.parse(readFileSync(eventPath, 'utf8')) as {
    pull_request?: { number?: number; title?: string; html_url?: string; head?: { sha?: string }; base?: { ref?: string }; user?: { login?: string } };
    repository?: { owner?: { login?: string }; name?: string };
  };
  const pr = ev.pull_request ?? {};
  // owner/repo: env GITHUB_REPOSITORY → event.repository → parse html_url.
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
