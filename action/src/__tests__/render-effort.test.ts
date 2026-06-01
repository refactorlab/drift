// Review-effort model: the deterministic 1–5 "how much careful review does this
// need" score, its time band, and its drivers — plus the header element it now
// feeds: the REVIEW EFFORT KPI gauge tile (and the risk/review-time TL;DR badge).
// The old prose hero "bottom line" and "Look here first" pointer were removed, so
// the effort signal lives in the gauge dashboard, not prose. These are the
// principal-engineer TLDR additions, so they're pinned.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadReport, type ScanPrOutput, type ValueAxis } from '../report.ts';
import { reviewEffort } from '../render/lib/effort.ts';
import { extractFacts } from '../render/lib/facts.ts';
import { renderHeader } from '../render/sections/header.ts';
import type { PrContext } from '../render/context.ts';

const fixtureDir = join(import.meta.dirname, '../../.dev');
const CTX: PrContext = { owner: 'acme', repo: 'shop', sha: 'cafe1234', prTitle: 'feat: thing' };

function makeReport(over: Partial<ScanPrOutput['pr_review']>, scope?: Partial<ScanPrOutput['pr_scope']>): ScanPrOutput {
  return {
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: 't' },
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [], ...scope },
    pr_review: over,
  };
}

function axis(name: ValueAxis['name'], delta: number): ValueAxis {
  return {
    name,
    label: { money: '💰 Money', customer: '👥 Customer value', runtime: '⚙️ Runtime', runtime_ux: '🎨 Runtime UX' }[name],
    delta_percent: delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
    confidence: 'low',
    inputs: name === 'money' ? { loc_added: 40, loc_deleted: 5 } : undefined,
  };
}

// The KPI dashboard is a table of quickchart radialGauge tiles; this returns the
// one `<picture>` whose ALL-CAPS title matches, so a test can assert its arc
// colour (dark `backgroundColor` hex, percent-encoded as `%23<hex>`).
function tile(html: string, title: string): string {
  const cell = html.split('</picture>').find((c) => c.includes(`alt="${title} `));
  return cell ? `${cell}</picture>` : '';
}

// The header's first block is a centered 3-badge TL;DR: verdict · merge-confidence
// · risk + review-time band. This returns that `<p align="center">…</p>` row so a
// test can assert the risk/review-time badge the effort score feeds.
function badgeRow(html: string): string {
  return html.split('\n').find((l) => l.startsWith('<p align="center">')) ?? '';
}

// ── effort scoring ────────────────────────────────────────────────────────────

test('effort: a tiny clean PR scores 1/5 with an honest driver', () => {
  const e = reviewEffort(extractFacts(makeReport({})));
  assert.equal(e.score, 1);
  assert.equal(e.label, 'trivial');
  assert.match(e.minutes, /min/);
  assert.ok(e.drivers.length >= 1, 'always names at least one driver');
});

test('effort: a big, complex, untested, regressed PR scores 5/5', () => {
  const big = makeReport(
    {
      overall_drift: { percent: -8, direction: 'down', confidence: 'low' },
      value_card: { axes: [{ ...axis('money', -8), inputs: { loc_added: 2200, loc_deleted: 80 } }, axis('runtime', -3)] },
      counts: { new_test_files: { value: 0, label: 't' } },
      code_suggestions: [
        { category: 'B', category_label: 'Product correctness — bad', file: 'a.ts', line: 1, confidence: 0.9, why_it_matters: 'x', references: [{ url: 'https://r' }] },
      ],
    },
    { changed_files: Array.from({ length: 45 }, (_, i) => `f${i}.ts`), affected_roots: Array.from({ length: 35 }, (_, i) => `r${i}`), unreachable_changes: [] },
  );
  const e = reviewEffort(extractFacts(big));
  assert.equal(e.score, 5);
  assert.equal(e.label, 'demanding');
  assert.match(e.minutes, /60/);
  assert.ok(e.drivers.some((d) => /correctness/.test(d)), 'correctness leads the drivers');
});

test('effort: monotonic — more findings never lowers the score', () => {
  const base = reviewEffort(extractFacts(makeReport({ value_card: { axes: [axis('money', 2)] } }))).score;
  const withBug = reviewEffort(
    extractFacts(
      makeReport({
        value_card: { axes: [axis('money', 2)] },
        code_suggestions: [{ category: 'B', category_label: 'Product correctness — bad', file: 'a.ts', line: 1, confidence: 0.9, why_it_matters: 'x', references: [{ url: 'https://r' }] }],
      }),
    ),
  ).score;
  assert.ok(withBug >= base, `adding a correctness finding should not reduce effort (${base} → ${withBug})`);
});

// ── header surface ──────────────────────────────────────────────────────────

test('header: the TL;DR badge row leads with the verdict recommendation', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  // The verdict (the "move") now leads the header as the first centered badge —
  // the prose hero bottom-line was removed. The header opens with the badge row.
  assert.ok(h.startsWith('<p align="center">'), 'header opens with the centered TL;DR badge row');
  const row = badgeRow(h);
  const firstBadge = row.match(/<img alt="([^"]+)"/)?.[1] ?? '';
  assert.match(firstBadge, /^(✓ Looks good|⚠ Address before merge|ℹ Advisory)$/, 'first badge is the verdict recommendation');
  assert.match(firstBadge, /⚠ Address before merge/, 'kotlin-ktor → "⚠ Address before merge"');
});

test('header: dashboard carries both 0–5 gauge tiles (confidence + effort), no prose signal line', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  // The gauges live ONLY as tiles now — no prose "signal line" duplicating them.
  assert.doesNotMatch(h, /🛡️ \*\*Merge confidence/, 'no prose merge-confidence signal line');
  assert.match(tile(h, 'MERGE CONFIDENCE'), /alt="MERGE CONFIDENCE \d\/5"/, 'merge-confidence gauge tile (N/5)');
  assert.match(tile(h, 'REVIEW EFFORT'), /alt="REVIEW EFFORT \d\/5"/, 'review-effort gauge tile (N/5)');
});

// (Removed) "confidence trend sparkline" — the `🛡️ Merge-confidence trend …`
// sub-line was deleted from the header; the confidence signal now lives solely in
// the MERGE CONFIDENCE gauge tile (covered above). No badge equivalent exists, so
// the test has nothing to re-point at.

test('header: effort + confidence KPI gauge tiles render in the dashboard', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  assert.notEqual(tile(h, 'REVIEW EFFORT'), '', 'review-effort tile present');
  assert.notEqual(tile(h, 'MERGE CONFIDENCE'), '', 'merge-confidence tile present');
});

test('header: the effort score feeds the risk + review-time TL;DR badge', () => {
  // The old prose "Look here first" pointer was removed; the effort model's
  // header surface is now the third TL;DR badge — "<risk> risk · <time> review".
  // A small, low-effort PR (1/5) → "Low risk · … review", coloured green.
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  assert.match(badgeRow(h), /<img alt="Low risk · \d+ min review" src="https:\/\/img\.shields\.io\/badge\/[^"]*-2ea043\?style=flat-square"/, 'green "Low risk · N min review" badge from a 1–2/5 effort');
});

// (Removed) "callout TL;DR no longer restates the recommendation" — both the GFM
// callout (`[!WARNING]` + `**TL;DR —**`) and the advisory sub-line were deleted
// from the header. The recommendation now appears exactly once, as the first
// TL;DR badge (asserted by "the TL;DR badge row leads with the verdict
// recommendation" above), so there is no callout/sub-line surface left to test.

test('header: clean improvement → green "✓ Looks good" badge, 1/5 green effort tile', () => {
  const r = makeReport({
    overall_drift: { percent: 8, direction: 'up', confidence: 'high' },
    value_card: { axes: [axis('customer', 8)] },
    counts: { new_test_files: { value: 4, label: 'New test files' } },
  });
  const h = renderHeader(r, CTX);
  // Clean improvement → the verdict badge is green "✓ Looks good" (was the green
  // hero dot + "ship it" prose).
  assert.match(badgeRow(h), /<img alt="✓ Looks good" src="https:\/\/img\.shields\.io\/badge\/[^"]*-2ea043\?style=flat-square"/, 'green "✓ Looks good" verdict badge for a clean improvement');
  assert.match(tile(h, 'REVIEW EFFORT'), /alt="REVIEW EFFORT 1\/5"/, '1/5 effort tile');
  assert.match(tile(h, 'REVIEW EFFORT'), /%234ae3b0/, '1/5 effort → green');
});
