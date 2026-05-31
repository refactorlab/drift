// "✅ Before you merge" — the actionable checklist, now its own section at the
// END of the comment (moved out of the header). These assertions used to live
// in the header test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadReport, type ScanPrOutput, type ValueAxis } from '../report.ts';
import { renderBeforeMerge } from '../render/sections/before_merge.ts';
import { extractFacts } from '../render/lib/facts.ts';
import type { PrContext } from '../render/context.ts';

const fixtureDir = join(import.meta.dirname, '../../.dev');
const CTX: PrContext = { owner: 'acme', repo: 'shop', sha: 'cafe1234', prTitle: 'feat: x' };

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
    inputs: name === 'money' ? { loc_added: 100, loc_deleted: 20 } : undefined,
  };
}

test('beforeMerge(python): heading, task boxes, test-gap item, readiness bar', () => {
  const out = renderBeforeMerge(extractFacts(loadReport(join(fixtureDir, 'scan-pr-output.json'))), CTX);
  assert.match(out, /^## ✅ Before you merge/, 'H2 section heading (top-level, not H3)');
  assert.match(out, /- \[ \] /, 'task boxes');
  assert.match(out, /Add tests/, 'test-gap item');
  assert.match(out, /> \*\*Merge readiness\*\*/, 'readiness bar');
  assert.match(out, /\*\*0 \/ \d+\*\*/, 'readiness x/N');
});

test('beforeMerge(kotlin): product-correctness item is first, with a permalink', () => {
  const out = renderBeforeMerge(extractFacts(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json'))), CTX);
  assert.match(out, /Fix the product-correctness issue at \[`OrdersRepository\.kt:17`\]/);
});

test('beforeMerge: a clean PR (no gating items) gets the reassuring note', () => {
  const r = makeReport({
    overall_drift: { percent: 8, direction: 'up', confidence: 'high' },
    value_card: { axes: [axis('customer', 8)] },
    counts: { new_test_files: { value: 4, label: 'New test files' } },
  });
  const out = renderBeforeMerge(extractFacts(r), CTX);
  assert.match(out, /^## ✅ Before you merge/);
  assert.match(out, /Nothing blocking/, 'empty checklist → positive note');
  assert.doesNotMatch(out, /- \[ \] /, 'no task boxes when nothing is gating');
});
