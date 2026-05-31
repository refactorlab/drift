#!/usr/bin/env node
// Render the "merge-confidence card" SVG from a scan-pr JSON report — the
// single-image alternative to the shields.io badge dashboard + KPI ledger in
// the PR comment. Writes a standalone .svg you can open in any browser.
//
// Usage:
//   node --experimental-strip-types --no-warnings \
//     action/scripts/render-card-svg.ts <input.json> <output.svg> [<event.json>]
//
// Pass an OPTIONAL event.json (a `pull_request` webhook payload, like
// action/.dev/event.json or the self-scan's synthesized one) to title the card
// `PR #N — branch` with a real number/branch. Without it the card titles itself
// from the branch/commit it can infer, or falls back to "Drift review".
//
// EMBEDDING NOTE: the resulting SVG cannot be inlined into a PR comment —
// GitHub's markdown sanitiser strips `<svg>`. To show it in a comment you must
// host it at a public HTTPS URL served as image/svg+xml (raw.githubusercontent
// on a public branch, gh-pages, or an external host) and reference it as
// `![card](URL)`, exactly like the shields.io badges. See action/src/render/
// svg/card.ts for the full rationale.

import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadReport } from '../src/report.ts';
import { renderConfidenceCardSvg, type CardOptions } from '../src/render/svg/card.ts';

const [inputArg, outputArg, eventArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!inputArg || !outputArg) {
  console.error('usage: render-card-svg.ts <input.json> <output.svg> [<event.json>]');
  process.exit(2);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);

statSync(inputPath); // throws with a clear message if the report is missing
const report = loadReport(inputPath);
const opts: CardOptions = eventArg ? optsFromEvent(resolve(eventArg)) : {};

const svg = renderConfidenceCardSvg(report, opts);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, svg);

console.log(`✓ wrote ${outputPath} (${svg.length} bytes)`);
console.log(`  open it in a browser to preview — or host it and reference the URL with ![card](URL).`);

/** Pull just the title-line inputs (number/branch/title) from a webhook payload. */
function optsFromEvent(eventPath: string): CardOptions {
  const ev = JSON.parse(readFileSync(eventPath, 'utf8')) as {
    pull_request?: { number?: number; title?: string; head?: { ref?: string } };
  };
  const pr = ev.pull_request ?? {};
  return { prNumber: pr.number, branch: pr.head?.ref, title: pr.title };
}
