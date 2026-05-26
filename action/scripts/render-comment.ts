#!/usr/bin/env node
// Render the PR-comment body that the action would post to GitHub, given
// a scan-pr JSON report. Writes the markdown to disk so you can preview
// the exact bytes the action sends to issues.createComment.
//
// Usage:
//   node --experimental-strip-types --no-warnings \
//     action/scripts/render-comment.ts <input.json> <output.md>

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { loadReport } from '../src/report.ts';
import { renderOverview } from '../src/render/overview.ts';

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) {
  console.error('usage: render-comment.ts <input.json> <output.md>');
  process.exit(2);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);

statSync(inputPath); // throws if missing — clearer than load() error
const report = loadReport(inputPath);
const body = renderOverview(report);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, body);

// Concise summary so a Makefile invocation has something useful to show.
const sectionCount = body.split(/\n---\n/).length;
const sigil = (cond: boolean) => (cond ? '✓' : '·');
const has = (s: string) => body.includes(s);
console.log(`✓ wrote ${outputPath} (${body.length} bytes / 65 536 cap)`);
console.log(`  sections: ${sectionCount}`);
console.log(`  ${sigil(/\[!(TIP|WARNING|NOTE)\]/.test(body))} banner       ${sigil(has('## 🏗 Architecture flow'))} architecture`);
console.log(`  ${sigil(has('## 🧭 Business logic'))} business     ${sigil(has('## 🎯 Affected entry points'))} affected roots`);
console.log(`  ${sigil(has('## 📊 Value card'))} value card   ${sigil(has('xychart-beta'))} bars chart`);
console.log(`  ${sigil(has('Visual summary'))} visual sum.  ${sigil(has('How these numbers were computed'))} axis details`);

const overBudget = body.length > 60_000;
if (overBudget) console.warn(`! body exceeds 60 KiB soft budget (cap is 65 536)`);
