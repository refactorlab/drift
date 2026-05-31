// Reviewer's guide — the deterministic Qodo-beating triage panel — plus the
// cohort-grouping lib it stands on. Covers: file→cohort classification, the
// focused/spread verdict, the at-a-glance severity line, Baz-style clean
// checks, the curated key-issues table (must-fix vs advisory fallback), the
// cross-push regression tripwire, table-cell escaping, and ctx degradation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ScanPrOutput, ValueAxis, CodeSuggestion } from '../report.ts';
import { extractFacts } from '../render/lib/facts.ts';
import { groupCohorts } from '../render/lib/cohorts.ts';
import { renderReviewersGuide } from '../render/sections/reviewers_guide.ts';
import { stateFromReport, type DriftState } from '../render/state.ts';
import type { PrContext } from '../render/context.ts';

const CTX: PrContext = { owner: 'acme', repo: 'shop', sha: 'sha123', prTitle: 'feat: thing' };

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

function correctness(file: string, line: number, conf: number, why: string, label = 'Product correctness — Raw SQL concatenation'): CodeSuggestion {
  return { category: 'B', category_label: label, file, line, confidence: conf, why_it_matters: why, references: [{ url: 'https://r' }] };
}

const guide = (report: ScanPrOutput, opts: { ctx?: PrContext; prior?: DriftState | null } = {}): string =>
  renderReviewersGuide({
    facts: extractFacts(report),
    changedFiles: report.pr_scope.changed_files,
    unreachable: report.pr_scope.unreachable_changes,
    ctx: opts.ctx,
    priorState: opts.prior ?? null,
    currentState: stateFromReport(report),
  }) ?? '';

// ── cohort grouping ───────────────────────────────────────────────────────────

test('cohorts: classify by role (source / tests / docs / config), source areas drive spread', () => {
  const s = groupCohorts(
    ['src/render/a.ts', 'src/render/b.ts', 'src/__tests__/x.test.ts', 'README.md', 'package.json', '.github/workflows/ci.yml'],
    [],
  );
  const byLabel = Object.fromEntries(s.cohorts.map((c) => [c.label, c]));
  assert.ok(byLabel['src/render'], 'source area keyed by 2-segment dir');
  assert.equal(byLabel['src/render'].files.length, 2);
  assert.equal(byLabel['Tests'].role, 'tests');
  assert.equal(byLabel['Docs'].role, 'docs');
  assert.equal(byLabel['Config & CI'].role, 'config');
  assert.equal(s.sourceAreas, 1, 'only src/render counts as a source area');
  assert.equal(s.spread, 'focused');
  assert.equal(s.totalFiles, 6);
});

test('cohorts: 4+ source areas → spread; unreachable files counted per cohort', () => {
  const s = groupCohorts(
    ['src/a/x.ts', 'src/b/y.ts', 'src/c/z.ts', 'src/d/w.ts', 'src/a/dead.ts'],
    ['src/a/dead.ts'],
  );
  assert.equal(s.sourceAreas, 4);
  assert.equal(s.spread, 'spread');
  const a = s.cohorts.find((c) => c.label === 'src/a')!;
  assert.equal(a.unreachable, 1, 'dead file counted in its cohort');
});

test('cohorts: source cohorts sort before tests/docs/config', () => {
  const s = groupCohorts(['package.json', 'README.md', 'src/app/main.ts'], []);
  assert.equal(s.cohorts[0].role, 'source', 'source leads regardless of input order');
});

// ── guide: must-fix path ──────────────────────────────────────────────────────

test('guide: a correctness finding drives the key-issues table + at-a-glance + focused verdict', () => {
  const r = makeReport(
    {
      value_card: { axes: [axis('money', 3), axis('customer', 12)] },
      code_suggestions: [correctness('src/app/repo.ts', 17, 0.78, 'Possible SQL injection at src/app/repo.ts:17 — a SQL keyword sits next to interpolation.')],
    },
    { changed_files: ['src/app/repo.ts', 'src/app/svc.ts'], affected_roots: ['main'], unreachable_changes: [] },
  );
  const g = guide(r, { ctx: CTX });
  assert.match(g, /## 🧭 Reviewer’s guide/);
  assert.match(g, /\*\*At a glance:\*\* 🔴 \*\*1\*\* correctness/);
  assert.match(g, /### 🔑 Key issues to review \(1\)/);
  assert.match(g, /Raw SQL concatenation/, 'label suffix used');
  assert.match(g, /\[`repo\.ts:17`\]\(https:\/\/github\.com\/acme\/shop\/blob\/sha123\//, 'where is a permalink');
  assert.match(g, /a SQL keyword sits next to interpolation\./, 'why prefers the post-em-dash reason clause');
  assert.doesNotMatch(g.split('Why it matters')[1] ?? '', /Possible SQL injection at/, 'why drops the redundant location prefix');
  assert.match(g, /\(78% — verify\)/, 'sub-0.85 finding flagged for verification');
  assert.match(g, /🎯 \*\*Focused PR\*\*/, 'single source area → focused');
});

// ── guide: all-clear path ─────────────────────────────────────────────────────

test('guide: no findings → all-clear key-issues line + Baz-style clean checks', () => {
  const r = makeReport({
    overall_drift: { percent: 8, direction: 'up', confidence: 'high' },
    value_card: { axes: [axis('customer', 8)] },
    counts: { new_test_files: { value: 3, label: 'New test files' } },
  });
  const g = guide(r, { ctx: CTX });
  assert.match(g, /✅ No must-review code issues flagged/);
  assert.match(g, /✅ \*\*Clean:\*\*/);
  assert.match(g, /no product-correctness issues/);
  assert.match(g, /no value-axis regressions/);
  assert.match(g, /3 new test files added/);
});

// ── guide: advisory fallback when there are suggestions but no correctness ─────

test('guide: suggestions present but no correctness → advisory key-issues fallback', () => {
  const r = makeReport({
    value_card: { axes: [axis('customer', 5)] },
    code_suggestions: [
      { category: 'A', category_label: 'Optimization — Dead code', kind: 'dead_code', file: 'a.ts', line: 6, confidence: 1, why_it_matters: 'Unreferenced.', references: [{ url: 'https://r' }] },
    ],
  });
  const g = guide(r, { ctx: CTX });
  assert.match(g, /Key issues to review <sub>\(no must-fix — top advisory items\)<\/sub>/);
  assert.match(g, /Optimization|Dead code/);
});

// ── guide: spread verdict ─────────────────────────────────────────────────────

test('guide: a PR spanning 4 source areas suggests splitting', () => {
  const r = makeReport(
    { value_card: { axes: [axis('customer', 5)] } },
    { changed_files: ['src/a/x.ts', 'src/b/y.ts', 'src/c/z.ts', 'src/d/w.ts'], affected_roots: ['main'], unreachable_changes: [] },
  );
  const g = guide(r, { ctx: CTX });
  assert.match(g, /🔀 \*\*Consider splitting\*\* — this PR spans \*\*4\*\* source areas/);
});

// ── guide: regression tripwire (cross-push state) ─────────────────────────────

test('guide: tripwire fires when overall drift dropped vs the last push', () => {
  const r = makeReport({ overall_drift: { percent: 2, direction: 'up', confidence: 'low' }, value_card: { axes: [axis('customer', 2)] } });
  const prior: DriftState = { v: 1, overall: 10, confHistory: [4] };
  const g = guide(r, { prior, ctx: CTX });
  assert.match(g, /\[!CAUTION\]/);
  assert.match(g, /got riskier since the last review/);
  assert.match(g, /overall drift \*\*\+10\.0% → \+2\.0%\*\*/);
});

test('guide: tripwire fires when merge confidence dropped vs the last push', () => {
  const r = makeReport({
    value_card: { axes: [axis('money', -3)] },
    code_suggestions: [correctness('a.ts', 1, 0.9, 'Bug at a.ts:1 — broken.')],
  });
  const prior: DriftState = { v: 1, confHistory: [5] };
  const g = guide(r, { prior, ctx: CTX });
  assert.match(g, /\[!CAUTION\]/);
  assert.match(g, /merge confidence \*\*5 → \d\/5\*\*/);
});

test('guide: NO tripwire on the first run (no prior history)', () => {
  const r = makeReport({
    value_card: { axes: [axis('money', -3)] },
    code_suggestions: [correctness('a.ts', 1, 0.9, 'Bug at a.ts:1 — broken.')],
  });
  assert.doesNotMatch(guide(r, { ctx: CTX }), /\[!CAUTION\]/);
});

// ── guide: robustness ─────────────────────────────────────────────────────────

test('guide: a pipe in the why text cannot break the key-issues table', () => {
  const r = makeReport({ code_suggestions: [correctness('a.ts', 1, 0.9, 'Bad | pipe — a | b | c regex here.')] });
  const g = guide(r, { ctx: CTX });
  const issueRow = g.split('\n').find((l) => l.includes('a.ts') && l.startsWith('|')) ?? '';
  assert.equal((issueRow.match(/(?<!\\)\|/g) ?? []).length, 4, 'exactly 4 unescaped pipes — one table row, 3 columns');
});

test('guide: degrades without ctx — code spans, no permalinks', () => {
  const r = makeReport({ code_suggestions: [correctness('a.ts', 9, 0.9, 'X at a.ts:9 — bad.')] });
  const g = guide(r);
  assert.match(g, /`a\.ts:9`/, 'location is a code span');
  assert.doesNotMatch(g, /\]\(https:\/\/github\.com/, 'no permalinks without ctx');
});

// ── regression: review-confirmed table-safety holes ───────────────────────────

test('guide: a pipe in the file PATH cannot break the key-issues "Where" cell', () => {
  const r = makeReport({ code_suggestions: [correctness('src/weird|name.ts', 3, 0.9, 'X at p — broken.')] });
  const g = guide(r, { ctx: CTX });
  const row = g.split('\n').find((l) => l.includes('weird') && l.startsWith('|')) ?? '';
  assert.equal((row.match(/(?<!\\)\|/g) ?? []).length, 4, 'one 3-column row — pipe in path escaped');
});

test('guide: a pipe in a changed-file path cannot break the Changes walkthrough row', () => {
  const r = makeReport(
    { value_card: { axes: [axis('customer', 5)] } },
    { changed_files: ['src/app/we|rd.ts', 'src/app/ok.ts'], affected_roots: ['main'], unreachable_changes: [] },
  );
  const g = guide(r, { ctx: CTX });
  const row = g.split('\n').find((l) => l.startsWith('| **src/app**')) ?? '';
  assert.ok(row, 'cohort row present');
  assert.equal((row.match(/(?<!\\)\|/g) ?? []).length, 4, 'one 3-column cohort row');
});

test('guide: a backtick in a source dir cannot unbalance the split-PR verdict code spans', () => {
  const r = makeReport(
    { value_card: { axes: [axis('customer', 5)] } },
    {
      changed_files: ['src/a`x/m.ts', 'src/b/m.ts', 'src/c/m.ts', 'src/d/m.ts'],
      affected_roots: ['main'],
      unreachable_changes: [],
    },
  );
  const verdictLine = guide(r, { ctx: CTX }).split('\n').find((l) => /Consider splitting/.test(l)) ?? '';
  assert.equal((verdictLine.match(/`/g) ?? []).length % 2, 0, 'balanced backticks in the verdict line');
});

test('cohorts: a source file whose name starts with a doc keyword stays source (anchored DOCS_RE)', () => {
  const s = groupCohorts(['src/licenseManager.ts', 'lib/readme_parser.ts', 'CHANGELOG.md', 'README.md'], []);
  const filesIn = (role: string) => s.cohorts.filter((c) => c.role === role).flatMap((c) => c.files);
  assert.ok(filesIn('source').includes('src/licenseManager.ts'), 'licenseManager.ts → source');
  assert.ok(filesIn('source').includes('lib/readme_parser.ts'), 'readme_parser.ts → source');
  assert.ok(filesIn('docs').includes('CHANGELOG.md') && filesIn('docs').includes('README.md'), 'real docs still docs');
  assert.equal(s.sourceAreas, 2, 'src + lib are the two source areas');
});

test('guide: the why cell is not truncated at an "e.g." abbreviation', () => {
  const r = makeReport({ code_suggestions: [correctness('a.ts', 1, 0.9, 'Wrapping a column (e.g. LOWER) defeats the index.')] });
  const row = guide(r, { ctx: CTX }).split('\n').find((l) => l.includes('a.ts:1') && l.startsWith('|')) ?? '';
  assert.match(row, /defeats the index/, 'kept the actual reason, not just the "(e.g." fragment');
});
