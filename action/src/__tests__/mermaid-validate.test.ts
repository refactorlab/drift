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
