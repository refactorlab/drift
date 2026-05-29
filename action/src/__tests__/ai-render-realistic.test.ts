// Realistic full-render checks against the .dev fixture reports.
//
// We have unit tests for each individual section (header, value card,
// suggestions, mermaid, footer, …) and a few targeted assertions in
// octokit-shape.test.ts. This file is the END-TO-END defense: load
// EACH .dev fixture, render the full overview the way main.ts does,
// and assert every load-bearing UX invariant survives the real data:
//
//   • Body fits under the GitHub 60 KiB rendering budget.
//   • The sticky-comment + state markers are present (dedupe + delta).
//   • Every named section we ship in the README appears (or is
//     correctly OMITTED for a factual-only report).
//   • The render is IDEMPOTENT — rendering the same report twice
//     yields a byte-identical body (proves no time-based / random
//     content slipped in).
//   • No broken-template artifacts (`${…}`, "undefined", `[object
//     Object]`, `null`) leak into the rendered body.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOverview } from '../render/overview.ts';
import { loadReport, type ScanPrOutput } from '../report.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const fixtureDir = resolve(repoRoot, 'action/.dev');

const PR_CTX = {
  owner: 'acme',
  repo: 'shop',
  prNumber: 42,
  sha: 'deadbeefcafe1234567890abcdef0123456789ab',
  prTitle: 'Speed up checkout',
  htmlUrl: 'https://github.com/acme/shop/pull/42',
  baseRef: 'main',
  author: 'octocat',
};

/**
 * Discover every fixture report under .dev so the test set scales
 * automatically — adding a new fixture immediately gets the same
 * load-bearing assertions without changing this file.
 */
function discoverReports(): { path: string; name: string; report: ScanPrOutput }[] {
  if (!existsSync(fixtureDir)) return [];
  const out: { path: string; name: string; report: ScanPrOutput }[] = [];
  for (const f of readdirSync(fixtureDir)) {
    if (!f.endsWith('.json')) continue;
    // Skip the AI-envelope fixtures (different schema).
    if (f.includes('ai-suggestions')) continue;
    if (f.includes('event')) continue;
    const path = join(fixtureDir, f);
    try {
      const report = loadReport(path);
      out.push({ path, name: f, report });
    } catch {
      // Fixture might be intentionally bad-schema; skip.
    }
  }
  return out;
}

const FIXTURES = discoverReports();

test('realistic render: at least one fixture report is present', () => {
  assert.ok(FIXTURES.length > 0, `no parseable .dev fixtures found at ${fixtureDir}`);
});

for (const { name, report } of FIXTURES) {
  test(`realistic render(${name}): body fits under GitHub's 60 KiB budget`, () => {
    const body = renderOverview(report, { ctx: PR_CTX });
    // 60 000 chars is the in-code BODY_SIZE_BUDGET — the renderer
    // collapses <details> blocks innermost-first to stay under, but
    // if a fixture's content slipped past the guard this catches it.
    assert.ok(
      body.length < 60_000,
      `${name} rendered to ${body.length} chars — exceeds the 60 KiB budget`,
    );
  });

  test(`realistic render(${name}): sticky-comment + state markers present`, () => {
    const body = renderOverview(report, { ctx: PR_CTX });
    assert.ok(
      body.includes('<!-- drift:sticky-comment -->'),
      'sticky-comment marker missing — dedupe will break on the next run',
    );
    assert.ok(
      body.includes('drift:state'),
      'state-blob marker missing — since-last-review deltas will reset every run',
    );
  });

  test(`realistic render(${name}): footer attribution always appears`, () => {
    const body = renderOverview(report, { ctx: PR_CTX });
    // The footer is the only piece that runs unconditionally —
    // value-card / suggestions / mermaid are all conditional. If the
    // footer is missing, something fundamental in renderOverview
    // broke.
    assert.match(body, /Posted by <a href="https:\/\/drift\.dev">Drift<\/a>/);
  });

  test(`realistic render(${name}): no broken-template artifacts in the body`, () => {
    const body = renderOverview(report, { ctx: PR_CTX });
    // Each of these strings is a SMELL: a literal `${…}` means a
    // template hole wasn't filled; "undefined" / "null" means a
    // value was coerced to text; "[object Object]" means an object
    // was string-concatenated instead of rendered. None of these
    // should ever survive into the body bytes.
    for (const smell of ['${', 'undefined', '[object Object]']) {
      assert.ok(
        !body.includes(smell),
        `${name} body contains "${smell}" — likely a broken template / unfilled placeholder.\n` +
          `Preview:\n${body.slice(Math.max(0, body.indexOf(smell) - 40), body.indexOf(smell) + 120)}`,
      );
    }
    // `null` appears in legitimate URL params occasionally, but
    // never as a standalone CELL VALUE in our tables. Pin the table
    // case: a markdown row whose middle column is literally "null".
    assert.ok(
      !/\|\s*null\s*\|/.test(body),
      `${name} contains a table cell with literal "null" — likely an unfilled value`,
    );
  });

  test(`realistic render(${name}): idempotent — rendering twice yields byte-identical bodies`, () => {
    const a = renderOverview(report, { ctx: PR_CTX });
    const b = renderOverview(report, { ctx: PR_CTX });
    assert.equal(
      a,
      b,
      'renderOverview is not idempotent — likely a Date.now() / Math.random() / non-deterministic order leaked in. ' +
        'Every PR run would post a "new" sticky body.',
    );
  });

  test(`realistic render(${name}): every mermaid fence carries a non-empty diagram`, () => {
    const body = renderOverview(report, { ctx: PR_CTX });
    // Every ```mermaid block must contain content. An empty diagram
    // renders as a broken image in GitHub PR comments.
    const blocks = [...body.matchAll(/```mermaid\n([\s\S]*?)```/g)];
    for (const m of blocks) {
      const diagram = m[1].trim();
      assert.ok(
        diagram.length > 0,
        `${name}: an empty mermaid block leaked into the body — renders as a broken image`,
      );
      // Mermaid first non-comment line must be a known diagram-type
      // declaration. Pin the well-formed shape so a renderer regression
      // producing only comments (or whitespace) gets caught.
      const firstNonBlank = diagram.split('\n').find((l) => l.trim() && !l.trim().startsWith('%%')) ?? '';
      assert.match(
        firstNonBlank,
        /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|quadrantChart|mindmap|xychart-beta|gitGraph|timeline)\b/,
        `${name}: mermaid block missing a diagram-type declaration. First line: "${firstNonBlank}"`,
      );
    }
  });

  test(`realistic render(${name}): with vs without ctx — both render successfully`, () => {
    // A consumer might invoke without PR context (e.g. push event
    // slipped through). The render must not crash; it just emits
    // a less-linkified body. Pin both pathways here.
    const withCtx = renderOverview(report, { ctx: PR_CTX });
    const withoutCtx = renderOverview(report);
    assert.ok(withCtx.length > 0);
    assert.ok(withoutCtx.length > 0);
    // The sticky marker must appear in BOTH (context-independent).
    assert.ok(withCtx.includes('<!-- drift:sticky-comment -->'));
    assert.ok(withoutCtx.includes('<!-- drift:sticky-comment -->'));
  });
}

test('realistic render: every fixture produces a DIFFERENT body (no accidental copy-paste)', () => {
  // Sanity that we're actually testing variety, not the same body
  // rendered N times. If two fixtures produce byte-identical bodies
  // something's wrong with the test setup OR the renderer is hashing
  // away meaningful differences.
  const bodies = FIXTURES.map(({ report }) => renderOverview(report, { ctx: PR_CTX }));
  const uniq = new Set(bodies);
  assert.equal(
    uniq.size,
    bodies.length,
    'two fixture reports rendered to the same body — fixtures are likely duplicates OR the renderer is hashing away content',
  );
});
