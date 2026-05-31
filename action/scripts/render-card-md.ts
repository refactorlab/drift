#!/usr/bin/env node
// Render an INLINE-SVG markdown test harness for the merge-confidence card — a
// single .md that embeds the same card three ways so you can see exactly where
// each one renders.
//
// Usage:
//   node --experimental-strip-types --no-warnings \
//     action/scripts/render-card-md.ts <input.json> <output.md> [<event.json>]
//
// WHY this exists: people reasonably assume an SVG can be pasted inline into a
// PR comment. It CAN'T — GitHub's markdown sanitiser strips the <svg> element
// (and data: image URIs) for security; the ONLY embed that renders on github.com
// is an <img> pointing at a hosted .svg file (exactly how shields.io badges
// work). This harness makes that empirically checkable: open it in VS Code
// (inline SVG renders) vs paste it into a GitHub comment (inline SVG vanishes).

import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { loadReport } from '../src/report.ts';
import { renderConfidenceCardSvg, type CardOptions } from '../src/render/svg/card.ts';

const [inputArg, outputArg, eventArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!inputArg || !outputArg) {
  console.error('usage: render-card-md.ts <input.json> <output.md> [<event.json>]');
  process.exit(2);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);

statSync(inputPath);
const report = loadReport(inputPath);
const opts: CardOptions = eventArg ? optsFromEvent(resolve(eventArg)) : {};

const svg = renderConfidenceCardSvg(report, opts);
const b64 = Buffer.from(svg, 'utf8').toString('base64');
// The relative <img> points at the sibling .svg (same basename, .svg extension).
const svgSibling = basename(outputPath).replace(/\.md$/, '') + '.svg';

const md = harness(svg, b64, svgSibling);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, md);

console.log(`✓ wrote ${outputPath} (${md.length} bytes)`);
console.log(`  inline-SVG renders in VS Code preview; on GitHub use the hosted <img> (approach 2).`);

function harness(svg: string, b64: string, svgSibling: string): string {
  return `# Drift merge-confidence card — inline-SVG embedding test

> Generated from the scan report by \`make action-render-card-self\`. This file
> is a **test harness**: it embeds the same card three ways so you can see where
> each renders.
>
> **Short answer (verified):** GitHub's markdown renderer **strips the inline
> \`<svg>\` element** in PR comments *and* READMEs (a security rule — inline SVG
> can carry CSS/JS/\`<foreignObject>\` payloads). The **only** way an SVG shows on
> github.com is an \`<img>\` pointing at a **hosted** \`.svg\` file. Inline \`<svg>\`
> *does* render in VS Code's preview and most local viewers — so approach 1 is
> for local design review, not for a GitHub comment.

---

## 1 · Inline \`<svg>\`  — ✅ VS Code / local preview · ❌ stripped on GitHub

${svg}

---

## 2 · \`<img>\` → relative \`.svg\` file  — ✅ both, *if the file is hosted/committed*

On github.com this renders **only** when \`${svgSibling}\` is reachable at a public
\`image/svg+xml\` URL (committed to a public branch and referenced by its
\`raw.githubusercontent.com\` URL). Locally it resolves the relative path.

<img src="./${svgSibling}" alt="Drift merge-confidence card" width="1080">

---

## 3 · \`<img>\` → base64 \`data:\` URI  — ✅ many local viewers · ❌ blocked on GitHub

GitHub's sanitiser blocks \`data:\` image URIs in markdown, so this is local-only.

<img src="data:image/svg+xml;base64,${b64}" alt="Drift merge-confidence card" width="1080">

---

## What renders where

| Embed approach | VS Code preview | GitHub comment / README |
| --- | :---: | :---: |
| 1 · Inline \`<svg>…</svg>\` | ✅ | ❌ stripped |
| 2 · \`<img src="./card.svg">\` | ✅ (path resolves) | ✅ **only** via a public hosted URL |
| 3 · \`<img src="data:…base64">\` | ✅ (most) | ❌ blocked |

**Takeaway:** to put this card in a real PR comment, render the SVG
(\`make action-render-card-self\`), **host it** at a public URL, and embed
**approach 2** — exactly how the shields.io badges already render. Approaches 1
and 3 are local-preview only.

<sub>Sources: github/markup strips \`<svg>\`; SVGs render on GitHub only via an
\`<img>\` to a hosted file — alexwlchan.net/notes/2024/how-to-render-svgs-on-github
· github.com/orgs/community/discussions/5546</sub>
`;
}

/** Pull the title-line inputs (number/branch/title) from a webhook payload. */
function optsFromEvent(eventPath: string): CardOptions {
  const ev = JSON.parse(readFileSync(eventPath, 'utf8')) as {
    pull_request?: { number?: number; title?: string; head?: { ref?: string } };
  };
  const pr = ev.pull_request ?? {};
  return { prNumber: pr.number, branch: pr.head?.ref, title: pr.title };
}
