// Review-effort model: the deterministic 1–5 "how much careful review does this
// need" score, its time band, and its drivers — plus the header elements it
// feeds (the hero "bottom line", the "Look here first" pointer, the effort
// badge). These are the principal-engineer TLDR additions, so they're pinned.

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

test('header: hero bottom-line leads with a verdict dot and the move', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  const heroLine = h.split('\n').find((l) => /Address before merge|Looks good|Advisory/.test(l)) ?? '';
  assert.match(heroLine, /^> (🟢|🟡|🔴|🔵) /, 'hero line opens with a status dot');
});

test('header: signal line carries both 0–5 gauges (confidence + effort) and the time band', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  const signal = h.split('\n').find((l) => /Merge confidence/.test(l)) ?? '';
  assert.match(signal, /🛡️ \*\*Merge confidence \d\/5\*\*/, 'confidence gauge present');
  assert.match(signal, /🧮 \*\*Review effort \d\/5\*\*/, 'effort gauge present');
  assert.match(signal, /min<\/sub>/, 'time band present');
});

test('header: confidence trend sparkline renders only with ≥2 pushes of history', () => {
  const report = loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json'));
  const first = renderHeader(report, CTX, { confTrend: [3] });
  assert.doesNotMatch(first, /trend `/, 'no sparkline on the first push');
  const later = renderHeader(report, CTX, { confTrend: [2, 3, 4] });
  assert.match(later, /trend `[▁▂▃▄▅▆▇█]+`/, 'sparkline after multiple pushes');
});

test('header: effort + confidence KPI badges render next to the verdict badge', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  assert.match(h, /badge\/review_effort-\d%2F5-/, 'review-effort badge present');
  assert.match(h, /badge\/merge_confidence-\d%2F5-/, 'merge-confidence badge present');
});

test('header: "Look here first" points at the top correctness finding with a permalink', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  assert.match(h, /👉 \*\*Look here first:\*\* \[`OrdersRepository\.kt:17`\]/);
  assert.match(h, /raw SQL concatenation · \d+% confidence/);
});

test('header: callout TL;DR no longer restates the recommendation (hero owns it)', () => {
  const h = renderHeader(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), CTX);
  // The "address before merge" call appears exactly once (the hero line), not
  // duplicated inside the [!WARNING] TL;DR paragraph.
  const inCallout = h.split('[!WARNING]')[1] ?? '';
  const tldrPara = inCallout.split('\n').find((l) => /\*\*TL;DR/.test(l)) ?? '';
  assert.doesNotMatch(tldrPara, /address before merge/i, 'TL;DR paragraph does not echo the recommendation');
  assert.match(tldrPara, /Advisory — does not fail the check/, 'advisory note rides in the TL;DR');
});

test('header: clean improvement → green dot, "ship it", effort badge still present', () => {
  const r = makeReport({
    overall_drift: { percent: 8, direction: 'up', confidence: 'high' },
    value_card: { axes: [axis('customer', 8)] },
    counts: { new_test_files: { value: 4, label: 'New test files' } },
  });
  const h = renderHeader(r, CTX);
  const heroLine = h.split('\n').find((l) => /Looks good/.test(l)) ?? '';
  assert.match(heroLine, /^> 🟢 /, 'green dot for a clean improvement');
  assert.match(heroLine, /ship it/i);
  assert.match(h, /badge\/review_effort-1%2F5-2ea043/, '1/5 effort, green');
});
