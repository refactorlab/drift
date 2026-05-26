// Contract conformance tests — TypeScript mirror of
// drift-static-profiler/tests/pr_scope_schema.rs T1-T5.
//
//   T1. ScanPrInput schema loads and the validator compiles.
//   T2. ScanPrOutput schema loads and the validator compiles.
//   T3. Our fixture (.dev/report.json) validates against ScanPrOutput.
//   T4. A synthesized ScanPrOutput with all `pr_review` sub-blocks
//       populated validates against ScanPrOutput.
//   T5. A synthesized ScanPrInput mirroring what the GitHub Action
//       wrapper sends validates against ScanPrInput.
//   T6. Negative: an invalid ScanPrInput (missing `path` on a
//       ChangedFile) is rejected — confirms the validator is real.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inputValidator, outputValidator } from '../contract/validator.ts';
import { buildScanPrInput } from '../contract/input.ts';
import { loadReport, passesQualityBar } from '../report.ts';

const fixtureReport = join(import.meta.dirname, '../../.dev/report.json');

// ─── T1 ─────────────────────────────────────────────────────────────────
test('T1: ScanPrInput schema loads + validator compiles', () => {
  const v = inputValidator();
  // Trivially-valid minimum to confirm the compiled validator works.
  const minimum = { project_root: '.', changed_files: [] };
  const result = v(minimum);
  assert.equal(result.ok, true, `validator must accept minimum: ${'errors' in result ? result.errors.join('\n') : ''}`);
});

// ─── T2 ─────────────────────────────────────────────────────────────────
test('T2: ScanPrOutput schema loads + validator compiles', () => {
  const v = outputValidator();
  // ScanPrOutput is the SLIM envelope as of the OM1/OM2 reshape — no
  // summary/entries/frames/string_table. Required fields are now just
  // schema_version, mode, generator, pr_scope.
  const minimum = {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.6.0' },
    pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
  };
  const result = v(minimum);
  assert.equal(result.ok, true, `validator must accept minimum: ${'errors' in result ? result.errors.join('\n') : ''}`);
});

// ─── T3 ─────────────────────────────────────────────────────────────────
test('T3: .dev/report.json fixture validates against ScanPrOutput', () => {
  const fixture = JSON.parse(readFileSync(fixtureReport, 'utf8'));
  const v = outputValidator();
  const result = v(fixture);
  assert.equal(
    result.ok,
    true,
    `fixture must validate as ScanPrOutput. Errors:\n${'errors' in result ? result.errors.join('\n') : ''}`,
  );
});

// ─── T4 ─────────────────────────────────────────────────────────────────
test('T4: synthesized FULL ScanPrOutput (with pr_review) validates', () => {
  // Minimum-viable but fully-populated pr_review — every sub-block has
  // at least one field, just to keep this test compact.
  const synthesized = {
    schema_version: '1.0',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.6.0' },
    pr_scope: {
      changed_files: ['a.py'],
      affected_roots: ['module.entry'],
      unreachable_changes: [],
    },
    pr_review: {
      generated_at: '2026-05-26T10:00:00Z',
      overall_drift: { percent: 0, direction: 'neutral', confidence: 'low' },
      counts: {
        features: { value: 0, label: 'New features' },
      },
      architecture_flow: { before_mermaid: 'flowchart LR\n  A-->B', after_mermaid: 'flowchart LR\n  A-->C' },
      business_logic: { mermaid: 'flowchart TD\n  X-->Y' },
      value_card: {
        axes: [
          { name: 'runtime', label: '⚙️ Software runtime', delta_percent: 10, direction: 'up', confidence: 'medium' },
        ],
      },
      code_suggestions: [
        {
          category: 'A',
          file: 'a.py',
          confidence: 0.9,
          why_it_matters: 'reason',
          references: [{ url: 'https://example.com' }],
        },
      ],
      visual_summary: {
        risks: { items: [{ label: 'r', likelihood: 0.5, severity: 0.5 }] },
      },
    },
  };
  const v = outputValidator();
  const result = v(synthesized);
  assert.equal(
    result.ok,
    true,
    `synthesized ScanPrOutput must validate. Errors:\n${'errors' in result ? result.errors.join('\n') : ''}`,
  );
});

// ─── T5 ─────────────────────────────────────────────────────────────────
test('T5: synthesized Action-shaped ScanPrInput validates', () => {
  // Mirrors what an Action wrapper would build from
  // github.event.pull_request + a `git diff --name-only` listing.
  const input = buildScanPrInput({
    projectRoot: '/runner/work/drift/drift',
    changedPaths: ['src/db.py', 'src/cache.py'],
    pr: {
      number: 36,
      repo: 'refactorlab/drift',
      base_sha: 'deadbeef0000000000000000000000000000000',
      head_sha: 'cafebabe0000000000000000000000000000000',
      base_ref: 'main',
      head_ref: 'feat/cache',
      title: 'Cache user orders',
      author: 'octocat',
      labels: ['perf'],
    },
    discover: { min_reach: 2 },
    analyze: { max_depth: 12 },
  });

  const v = inputValidator();
  const result = v(input);
  assert.equal(
    result.ok,
    true,
    `built ScanPrInput must validate. Errors:\n${'errors' in result ? result.errors.join('\n') : ''}`,
  );
});

// ─── T5b: an enriched ChangedFile (REST API "Diff Entry" shape) validates ─
test('T5b: enriched ChangedFile (status + additions + deletions + sha) validates', () => {
  // Matches the shape returned by GET /repos/{owner}/{repo}/pulls/{n}/files.
  // The Action's enriched mode populates these fields; the CLI-minimal
  // mode does not. Both must validate.
  const enriched = {
    project_root: '.',
    changed_files: [
      {
        path: 'src/db.py',
        status: 'modified',
        additions: 12,
        deletions: 4,
        changes: 16,
        sha: '0abc1230000000000000000000000000000abc12',
        blob_url: 'https://github.com/x/y/blob/abc/src/db.py',
      },
      {
        path: 'src/orders.py',
        previous_filename: 'src/order_utils.py',
        status: 'renamed',
      },
    ],
  };
  const v = inputValidator();
  const result = v(enriched);
  assert.equal(
    result.ok,
    true,
    `enriched ScanPrInput must validate. Errors:\n${'errors' in result ? result.errors.join('\n') : ''}`,
  );
});

// ─── T6 (negative) ──────────────────────────────────────────────────────
test('T6: invalid ScanPrInput (missing required path) is REJECTED', () => {
  const bad = {
    project_root: '.',
    changed_files: [
      { status: 'modified' }, // missing required `path`
    ],
  };
  const v = inputValidator();
  const result = v(bad);
  assert.equal(result.ok, false, 'missing-path ChangedFile must be rejected');
});

// ─── Wrapper behavior tests ─────────────────────────────────────────────
test('loadReport parses the fixture and exposes pr_scope', () => {
  const r = loadReport(fixtureReport);
  assert.equal(r.schema_version, '1.0');
  assert.deepEqual(r.pr_scope.affected_roots, ['create_order']);
  assert.equal(r.pr_scope.unreachable_changes.length, 1);
  assert.ok(r.pr_review?.code_suggestions, 'pr_review.code_suggestions present in fixture');
});

test('passesQualityBar filters A/B/C category + confidence + reference link', () => {
  const r = loadReport(fixtureReport);
  const suggestions = r.pr_review?.code_suggestions ?? [];
  const passing = suggestions.filter(passesQualityBar);
  // Fixture has 3 dead-code suggestions, all Category A with confidence 1.0
  // and real references — all 3 clear the bar.
  assert.equal(passing.length, 3);
  assert.deepEqual(
    [...new Set(passing.map((s) => s.category))],
    ['A'],
  );
});

test('loadReport rejects schema_version 1 (number) — must be "1.0"/"1.1"/"1.2" string', () => {
  // Cross-check against the bug we'd have shipped if we hadn't realigned:
  // the old report.ts used `schema_version: 1` as a number, but the
  // canonical contract is a STRING enum.
  const tmp = mkdtempSync(join(tmpdir(), 'drift-bad-'));
  const p = join(tmp, 'bad.json');
  writeFileSync(
    p,
    JSON.stringify({
      schema_version: 1,
      mode: 'static',
      generator: {},
      summary: {},
      entries: [],
      pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    }),
  );
  assert.throws(() => loadReport(p), /Unsupported schema_version/);
});
