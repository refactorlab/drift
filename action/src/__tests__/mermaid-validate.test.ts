// End-to-end Mermaid validation for the action's render pipeline.
//
// The scanner pre-renders every diagram; the action only FRAMES the strings
// (overview.ts → sections/*). These tests prove two things against the REAL
// mermaid parser (via the shared scripts/validate-mermaid.mjs gate):
//
//   1. The validator actually works — it ACCEPTS our fixed (quoted) flowchart
//      and REJECTS the exact unquoted shape that caused the original
//      `got 'LINK_ID'` failure. Without the negative case, a rubber-stamping
//      validator would give false confidence.
//   2. The render pipeline (renderOverview → ```mermaid fences) preserves
//      validity: we load a real report, swap in known-good diagrams, render
//      the whole comment, extract every fenced block, and validate each.
//
// SKIP-UNTIL-INSTALLED: all of these skip (and pass) until
// `@zabaca/mermaid-validate` is installed — see validate-mermaid.mjs. That
// keeps `npm test` green offline; the gate activates automatically once the
// dep is in the lockfile.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { validate, extractBlocks, isInstalled } from '../../scripts/validate-mermaid.mjs';
import { renderOverview } from '../render/overview.ts';
import { loadReport, type ScanPrOutput } from '../report.ts';

const here = dirname(fileURLToPath(import.meta.url));

// Post-fix flowchart: quoted labels, `<`/`>` → guillemets, `@` inside quotes.
const GOOD_FLOWCHART = [
  'flowchart TB',
  '    n0["‹module›"]',
  '    n1["useTheme.‹lambda@21›"]',
  '    n0 --> n1',
].join('\n');

// The exact shape that broke: unquoted label, raw `<`/`>` and a bare `@`
// (tokenized as LINK_ID by mermaid v11).
const BAD_FLOWCHART = 'flowchart TB\n    a_n2[useTheme.<lambda@21>]\n';

test('validator ACCEPTS the fixed (quoted) flowchart', async (t) => {
  if (!(await isInstalled())) return void t.skip('mermaid validator not installed');
  const r = await validate(GOOD_FLOWCHART);
  assert.ok(r.ok, `expected valid, got: ${r.error}`);
});

test('validator REJECTS the original unquoted bug (gate has teeth)', async (t) => {
  if (!(await isInstalled())) return void t.skip('mermaid validator not installed');
  const r = await validate(BAD_FLOWCHART);
  assert.equal(r.ok, false, 'validator must reject the known-broken diagram');
});

test('renderOverview frames diagrams into valid, extractable mermaid', async (t) => {
  if (!(await isInstalled())) return void t.skip('mermaid validator not installed');

  // Start from a real, complete report so every section renders, then swap in
  // known-good diagrams — the test is about the framing pipeline, not the
  // fixture's vintage.
  const report = loadReport(join(here, '..', '..', '.dev', 'scan-pr-output.json')) as ScanPrOutput;
  const r = report.pr_review;
  if (r?.architecture_flow) {
    r.architecture_flow.combined_mermaid = GOOD_FLOWCHART;
    r.architecture_flow.before_mermaid = undefined;
    r.architecture_flow.after_mermaid = undefined;
  }
  if (r?.business_logic) r.business_logic.mermaid = GOOD_FLOWCHART;
  // Drop the other stored diagrams so the extracted blocks are exactly our
  // two known-good flowcharts — deterministic regardless of fixture vintage.
  // (The Rust suite validates quadrant/mindmap/xychart against the real
  // parser from the adversarial corpus.)
  if (r?.value_card) r.value_card.bars_mermaid = undefined;
  if (r) r.visual_summary = undefined;

  const md = renderOverview(report);
  const blocks = await extractBlocks(md);

  assert.ok(blocks.length >= 1, 'expected at least one ```mermaid block in the comment');
  for (const block of blocks) {
    const res = await validate(block);
    assert.ok(res.ok, `extracted mermaid block failed validation: ${res.error}\n---\n${block}`);
  }
});

// TWO-CHART full pipeline: feed the EXACT BEFORE/AFTER chart shapes the
// Rust scanner emits (captured verbatim from a real `scan-pr --diff-status`
// run — note the `🗑 removed` card, the muted/changed/removed classDefs, and
// the dashed removed stroke) through the REAL renderArchitecture → render the
// whole comment → extract every fenced block → validate each through the real
// mermaid parser. This crosses the language boundary the Rust tests can't:
// it proves a real scanner two-chart payload renders to a comment that
// (a) carries BOTH the 🔴 BEFORE and 🟢 AFTER headings, (b) emits TWO separate
// mermaid blocks, and (c) both blocks are valid mermaid. Pairs with the Rust
// `diff_status_real_git` test (real git → those exact strings).
test('two-chart: real scanner BEFORE/AFTER payload renders to two valid mermaid blocks', async (t) => {
  if (!(await isInstalled())) return void t.skip('mermaid validator not installed');

  // Verbatim shapes from a real `scan-pr --diff-status` run (mixed PR:
  // modified call graph + a deleted file → removed card).
  const BEFORE = [
    'flowchart LR',
    '    n0["create_order"]',
    '    n1["OrderService.validate"]',
    '    n2["OrderRepository.save"]',
    '    rm_0["🗑 removed — legacy_payments.py"]',
    '    n0 --> n1',
    '    n0 --> n2',
    '    classDef muted fill:#6e7681,stroke:#6e7681,color:#fff',
    '    classDef removed fill:#da3633,stroke:#f85149,color:#fff,stroke-width:2px,stroke-dasharray:4 3',
    '    class n0,n1,n2 muted',
    '    class rm_0 removed',
  ].join('\n');
  const AFTER = [
    'flowchart LR',
    '    n0["create_order"]',
    '    n1["OrderService.validate"]',
    '    n2["OrderRepository.save"]',
    '    n3["new_handler"]',
    '    n0 --> n1',
    '    n0 --> n2',
    '    n0 --> n3',
    '    classDef changed fill:#9e6a03,stroke:#d29922,color:#fff,stroke-width:2px',
    '    classDef added fill:#238636,stroke:#3fb950,color:#fff,stroke-width:2px',
    '    class n0,n1,n2 changed',
    '    class n3 added',
  ].join('\n');

  const report = loadReport(join(here, '..', '..', '.dev', 'scan-pr-output.json')) as ScanPrOutput;
  const r = report.pr_review;
  assert.ok(r?.architecture_flow, 'fixture must have an architecture_flow block');
  // The two-chart path: BOTH before+after present → renderer must prefer them
  // over combined and emit two blocks.
  r!.architecture_flow!.before_mermaid = BEFORE;
  r!.architecture_flow!.after_mermaid = AFTER;
  r!.architecture_flow!.combined_mermaid = 'flowchart TB\n    stale --> ignored'; // must be ignored
  // Silence the other diagrams so the extracted set is exactly our two charts.
  if (r?.business_logic) r.business_logic.mermaid = undefined;
  if (r?.value_card) r.value_card.bars_mermaid = undefined;
  if (r) r.visual_summary = undefined;

  const md = renderOverview(report);

  // (a) Both headings present, (b) the stale combined block is NOT emitted.
  assert.match(md, /🔴 BEFORE — what the code was:/, 'BEFORE heading missing');
  assert.match(md, /🟢 AFTER — what the code is now:/, 'AFTER heading missing');
  assert.doesNotMatch(md, /stale --> ignored/, 'combined_mermaid must not be emitted when before+after present');

  // (c) Exactly two mermaid blocks, both valid, one carrying the removed card.
  const blocks = await extractBlocks(md);
  assert.equal(blocks.length, 2, `expected exactly 2 mermaid blocks, got ${blocks.length}`);
  for (const block of blocks) {
    const res = await validate(block);
    assert.ok(res.ok, `two-chart block failed validation: ${res.error}\n---\n${block}`);
  }
  assert.ok(blocks.some((b) => b.includes('🗑 removed — legacy_payments.py')), 'BEFORE block must carry the removed card');
  assert.ok(blocks.some((b) => b.includes('classDef added')), 'AFTER block must carry the added palette');
});
