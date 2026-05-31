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
//
// Override the Code-suggestions render cap (default 10) with the flag
// `--max-suggestions=N` (or the `DRIFT_MAX_SUGGESTIONS` env var) — the flag
// wins. The cap is RENDER-ONLY: it trims how many findings the comment shows
// while keeping the true total in the heading; it never touches the report.

import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadReport } from '../src/report.ts';
import { renderOverview } from '../src/render/overview.ts';
import type { PrContext } from '../src/render/context.ts';

// Split argv into `--flag=value` options and bare positionals so the three
// positional args keep working regardless of where a flag is passed.
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
const [inputArg, outputArg, eventArg] = positionals;
if (!inputArg || !outputArg) {
  console.error('usage: render-comment.ts <input.json> <output.md> [<event.json>] [--max-suggestions=N]');
  process.exit(2);
}

// Render cap: --max-suggestions=N wins, then DRIFT_MAX_SUGGESTIONS, else the
// renderer's built-in default (10). A non-positive / non-numeric value is
// ignored so the renderer falls back to its default.
const maxSuggestions = parsePositiveInt(flags.get('max-suggestions') ?? process.env.DRIFT_MAX_SUGGESTIONS);

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);

statSync(inputPath); // throws if missing — clearer than load() error
const report = loadReport(inputPath);
const ctx = eventArg ? contextFromEvent(resolve(eventArg)) : undefined;
const body = renderOverview(report, { ctx, audioUrl: process.env.DRIFT_AUDIO_URL, maxSuggestions });

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, body);

// Concise summary so a Makefile invocation has something useful to show.
const sigil = (cond: boolean) => (cond ? '✓' : '·');
const has = (s: string) => body.includes(s);
console.log(`✓ wrote ${outputPath} (${body.length} bytes / 65 536 cap)${ctx ? ' [with PR context → permalinks]' : ''}`);
console.log(`  ${sigil(/\[!(TIP|WARNING|NOTE)\]/.test(body))} header verdict   ${sigil(has('### ✅ Before you merge'))} merge checklist`);
// Section titles are moved into <summary> by wrapSection, so match the title
// text (not the stripped `## ` heading).
console.log(`  ${sigil(has('📊 Business value'))} business value   ${sigil(has('Since last review'))} since-last-review`);
console.log(`  ${sigil(has('⚠️ Code suggestions'))} code suggestions ${sigil(has('🛰 Risks'))} risks`);
console.log(`  ${sigil(has('🏗 Architecture'))} architecture     ${sigil(has('🧪 Extended findings'))} extended findings`);
console.log(`  suggestions render cap: ${maxSuggestions ?? 'default (10)'}${has('more not shown — rendering the top') ? ' (overflow trimmed)' : ''}`);

if (body.length > 60_000) console.warn(`! body exceeds 60 KiB soft budget (cap is 65 536)`);

/** Parse a positive integer; returns undefined for empty/invalid/≤0 input. */
function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

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
