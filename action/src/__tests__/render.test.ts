// Full-comment integration snapshots for the sticky body. Exercises the real
// fixtures (python-fastapi · kotlin-ktor) and asserts the v7 template structure
// is present and well-formed end-to-end.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadReport, type ScanPrOutput } from '../report.ts';
import { renderOverview, STICKY_MARKER } from '../render/overview.ts';
import type { PrContext } from '../render/context.ts';

const fixtureDir = join(import.meta.dirname, '../../.dev');
const CTX: PrContext = { owner: 'refactorlab', repo: 'andy', sha: 'a1b2c3d4', prTitle: 'feat: modern motion system' };
const fixtures = [
  { name: 'python-fastapi', path: join(fixtureDir, 'scan-pr-output.json') },
  { name: 'kotlin-ktor', path: join(fixtureDir, 'scan-pr-output-kotlin-ktor.json') },
] as const;

for (const fix of fixtures) {
  const render = () => renderOverview(loadReport(fix.path), { ctx: CTX });

  test(`render(${fix.name}): sticky marker first, state blob last`, () => {
    const body = render();
    assert.ok(body.startsWith(STICKY_MARKER), 'marker must be first line');
    assert.match(body, /<!-- drift:state \{.*\} -->\s*$/, 'state blob is appended last');
  });

  test(`render(${fix.name}): body stays under the 60 KiB budget`, () => {
    assert.ok(render().length < 60_000, `body is ${render().length} bytes`);
  });

  test(`render(${fix.name}): confidence trend is persisted into the state blob (no longer rendered as a line)`, () => {
    // The trend SPARKLINE was removed from the rendered body, but renderOverview
    // STILL persists the merge-confidence history into the trailing state blob
    // (appendConfHistory(priorState, thisScore)) so the next push can diff it.
    // Exercise that whole wiring: a prior with 2 scores → 3 after the append.
    const withHistory = renderOverview(loadReport(fix.path), { ctx: CTX, priorState: { v: 1, confHistory: [2, 3] } });
    assert.doesNotMatch(withHistory, /Merge-confidence trend/, 'the trend line is no longer rendered');
    const m = withHistory.match(/<!-- drift:state (\{[\s\S]*?\}) -->\s*$/);
    assert.ok(m, 'state blob present');
    const persisted = JSON.parse(m![1]).confHistory as number[];
    assert.equal(persisted.length, 3, 'prior 2 scores + this push = 3 persisted points');
    assert.deepEqual(persisted.slice(0, 2), [2, 3], 'prior history is carried forward unchanged');
    assert.ok(Number.isInteger(persisted[2]) && persisted[2] >= 0 && persisted[2] <= 5, 'this push appended a 0–5 score');
    // First push (no prior) → only this push's score → a single-element history.
    const firstPush = renderOverview(loadReport(fix.path), { ctx: CTX });
    const m0 = firstPush.match(/<!-- drift:state (\{[\s\S]*?\}) -->\s*$/);
    assert.equal((JSON.parse(m0![1]).confHistory as number[]).length, 1, 'first push seeds a 1-element history');
  });

  test(`render(${fix.name}): every v7 section is present`, () => {
    const body = render();
    assert.match(body, /<img [^>]*alt="Drift review"[^>]*width="120"/, 'brand banner is the title, pinned small (120px)');
    assert.doesNotMatch(body, /^## [▲▼—]? ?Drift review/m, 'no duplicate H2 title');
    assert.match(body, /quickchart\.io\/chart[^"]*MERGE%20CONFIDENCE/, 'merge-confidence KPI gauge tile');
    assert.match(body, /## ✅ Before you merge/, 'merge checklist (now a section at the end)');
    assert.match(body, /> \*\*Merge readiness\*\*/, 'merge-readiness bar');
    // Sections are now collapsible: the title lives in a <details><summary>
    // with a one-line TLDR appended ("— …").
    assert.match(body, /<summary><strong>📊 Business value<\/strong> — /, 'business value collapsible + TLDR');
    // Business value is now a single per-axis drift chart image — the old HTML
    // dashboard table, composite row, and since-last-review line were removed.
    assert.match(body, /!\[PR value drift\]\(https:\/\/quickchart\.io\/chart/, 'business value drift chart image');
    assert.doesNotMatch(body, /<caption>PR value drift/, 'no HTML dashboard table');
    assert.doesNotMatch(body, /Composite&nbsp;/, 'no composite row');
    assert.doesNotMatch(body, /Since last review/, 'no since-last-review line in the value card');
    assert.match(body, /<summary><strong>⚠️ Code suggestions \(\d+\)<\/strong> — /, 'code suggestions collapsible + TLDR');
    assert.match(body, /\| Priority \| Finding \| Location \| Confidence \|/, 'priority table');
    assert.match(body, /<summary><strong>🛰 Risks<\/strong> — /, 'risks collapsible + TLDR');
    assert.match(body, /<summary><strong>🏗 Architecture<\/strong> — /, 'architecture collapsible + TLDR');
    assert.match(body, /<summary><strong>🧪 Extended findings<\/strong> — /, 'extended findings collapsible + TLDR');
    // The Reviewer's guide was removed from the overview entirely.
    assert.doesNotMatch(body, /Reviewer's guide|At-a-glance triage|🔑 Key issues to review/, 'reviewer guide removed');
    assert.doesNotMatch(body, /Legend &amp; methodology/, 'legend section removed');
    assert.match(body, /Posted by <a href="https:\/\/drift\.dev">Drift<\/a>/, 'footer');

    // Body order: Architecture leads, then Business value, then Code suggestions.
    const iArch = body.indexOf('🏗 Architecture');
    const iValue = body.indexOf('📊 Business value');
    const iSug = body.indexOf('⚠️ Code suggestions');
    assert.ok(
      iArch > 0 && iArch < iValue && iValue < iSug,
      `section order must be Architecture → Business value → Code suggestions (indices ${iArch}/${iValue}/${iSug})`,
    );
  });

  test(`render(${fix.name}): no broken-template artifacts`, () => {
    const body = render();
    assert.doesNotMatch(body, /undefined|\[object Object\]|NaN/, 'no stringified blanks');
    assert.doesNotMatch(body, /Bottom line —\s*Bottom line —/i, 'no doubled bottom-line prefix');
    const opens = (body.match(/```mermaid/g) ?? []).length;
    const total = (body.match(/```/g) ?? []).length;
    assert.ok(opens >= 1, 'has at least one mermaid block');
    assert.equal(total % 2, 0, `unbalanced code fences (${total} total)`);
  });

  test(`render(${fix.name}): permalinks are SHA-pinned to the head commit`, () => {
    const body = render();
    assert.match(body, /https:\/\/github\.com\/refactorlab\/andy\/blob\/a1b2c3d4\//, 'blob permalinks use the head SHA');
  });
}

test('render(kotlin-ktor): category-B → "Address before merge" verdict + CAUTION callout', () => {
  const body = renderOverview(loadReport(join(fixtureDir, 'scan-pr-output-kotlin-ktor.json')), { ctx: CTX });
  // The header [!WARNING] callout was removed; the verdict now lives in the
  // 3-badge row as "⚠ Address before merge".
  assert.match(body, /⚠ Address before merge/, 'header verdict badge is "Address before merge"');
  assert.doesNotMatch(body, /\[!WARNING\]/, 'no header WARNING callout anymore');
  assert.match(body, /\[!CAUTION\]/, 'suggestions CAUTION callout (still present)');
  assert.match(body, /product-correctness issue/, 'names the issue type');
  assert.match(body, /🅑 .*Product correctness|🅑 .*SQL/, 'category-B suggestion present as a table row');
});

test('render(python-fastapi): A-only suggestions → "Looks good" verdict, no CAUTION callout', () => {
  const body = renderOverview(loadReport(join(fixtureDir, 'scan-pr-output.json')), { ctx: CTX });
  // The header [!TIP] callout was removed; an all-up + no-cat-B PR now reads
  // "✓ Looks good" in the verdict badge row.
  assert.match(body, /✓ Looks good/, 'all-up + no cat-B → "Looks good" verdict badge');
  assert.doesNotMatch(body, /\[!TIP\]/, 'no header TIP callout anymore');
  assert.doesNotMatch(body, /\[!CAUTION\]/, 'no CAUTION without a product-correctness issue');
  assert.match(body, /🅐 .*[Dd]ead code/, 'category-A optimization labelled');
});

test('render(no suggestions): suggestions section omitted, checklist still sane', () => {
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.py'], affected_roots: ['main'], unreachable_changes: [] },
    pr_review: { code_suggestions: [] },
  });
  assert.doesNotMatch(body, /⚠️ Code suggestions/, 'no section without passing suggestions');
  // Architecture is diagrams-only now: this fixture has no diagrams and no
  // unreachable files, so the section is omitted entirely.
  assert.doesNotMatch(body, /🏗 Architecture/, 'no architecture without diagrams or a dead-code callout');
});

test('render(no pr_review): factual-only output', () => {
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.py'], affected_roots: ['main'], unreachable_changes: [] },
  });
  assert.match(body, /<img [^>]*alt="Drift review"/, 'brand banner present (no H2 text)');
  // The header [!NOTE] callout was removed; a factual-only report now reads
  // "ℹ Advisory" in the verdict badge row.
  assert.match(body, /ℹ Advisory/, 'Advisory verdict without a value model');
  assert.doesNotMatch(body, /\[!NOTE\]/, 'no header NOTE callout anymore');
  // Diagrams-only architecture: this factual-only fixture carries no diagrams
  // and no unreachable files, so the section is omitted.
  assert.doesNotMatch(body, /🏗 Architecture/, 'no architecture without diagrams or a dead-code callout');
  assert.doesNotMatch(body, /📊 Business value/, 'no value card without a value model');
  assert.doesNotMatch(body, /quickchart\.io\/chart[^"]*text%22%3A%22DRIFT/, 'no drift gauge tile without a value model');
});

test('render: guardSize collapses <details> innermost-first when over budget', () => {
  // The value card no longer renders a `formula` field, so the old bloat source
  // is gone. Use a huge risks-quadrant mermaid instead — it renders verbatim
  // inside the (non-exempt) Risks section, blowing the body past the budget so
  // the size guard fires and collapses a <details> to a tagless marker.
  const big = 'x'.repeat(70_000);
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] },
    pr_review: {
      visual_summary: {
        risks: {
          items: [{ label: 'R', likelihood: 0.5, severity: 0.5, quadrant: 'act_before_merge' }],
          mermaid: `quadrantChart\n title Risk Map\n%% ${big}`,
        },
      },
    },
  });
  assert.ok(body.length < 65_536, `guarded body too large: ${body.length}`);
  assert.match(body, /collapsed \(size guard\)/);
});

test('render: guardSize can collapse an outer <details> section and preserves its TLDR summary', () => {
  // A huge risk label lands DIRECTLY in the Risks table (the outer section
  // body), while the quadrant map is a nested <details>. So the only way under
  // budget is to collapse the OUTER `<details>` itself — the exact case the
  // pre-fix guardSize regex (which couldn't match an outer block holding nested
  // details) could never collapse. (The value card no longer renders a prose
  // field, so the old `bottom_line` bloat source is gone.) Also asserts the
  // section TLDR survives the collapse (the summary is preserved).
  const huge = 'y'.repeat(70_000);
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [] },
    pr_review: {
      visual_summary: {
        risks: {
          items: [{ label: `Big risk ${huge}`, likelihood: 1, severity: 1, quadrant: 'act_before_merge' }],
          mermaid: 'quadrantChart\n title Risk Map',
        },
      },
    },
  });
  assert.ok(body.length < 65_536, `guarded body too large: ${body.length}`);
  // The Risks section collapsed to a tagless marker — its TLDR text (carried in
  // the summary) must survive in that marker.
  assert.match(body, /🛰 Risks<\/strong> — 1 to address · 1 total[\s\S]*?collapsed \(size guard\)/, 'risks TLDR survives the collapse marker');
  // The 70 KB blob must be gone (the collapsed section's body was dropped).
  assert.doesNotMatch(body, /y{1000}/, 'huge body content was dropped');
});

test('render: guardSize exempts Architecture — its diagram survives while other sections collapse', () => {
  // A 70 KB risks-quadrant mermaid forces the body over budget (the value card
  // no longer renders a `formula`, so that old bloat source is gone). The size
  // guard must collapse the NON-exempt Risks section but leave the Architecture
  // color-coded diff diagram fully expanded.
  const bloat = 'x'.repeat(70_000);
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [] },
    pr_review: {
      architecture_flow: {
        diff_merged_mermaid: 'graph TD\n  ARCH_DIFF_NODE --> X',
      },
      visual_summary: {
        risks: {
          items: [{ label: 'R', likelihood: 1, severity: 1, quadrant: 'act_before_merge' }],
          mermaid: `quadrantChart\n title Risk Map\n%% ${bloat}`,
        },
      },
    },
  });

  assert.ok(body.length < 65_536, `guarded body too large: ${body.length}`);
  // The merged diff diagram renders in full — the exemption held.
  assert.match(body, /ARCH_DIFF_NODE/, 'diff diagram survived the size guard');
  // The Architecture diagram disclosure is still a real <details>, NOT folded to
  // a "collapsed (size guard)" marker.
  assert.match(body, /<summary>🧭 Call graph — color-coded diff<\/summary>/, 'architecture diagram disclosure intact');
  assert.doesNotMatch(body, /🧭 Call graph — color-coded diff[^\n]*collapsed \(size guard\)/, 'architecture diagram was not collapsed');
  // We got under budget by folding the NON-exempt Risks section instead.
  assert.match(body, /collapsed \(size guard\)/, 'a non-architecture section collapsed to claw back budget');
  assert.doesNotMatch(body, /x{1000}/, 'the risks bloat was dropped');
});

test('render: guardSize hard-truncate never slices into the exempt Architecture span', () => {
  // Pathological worst case: the Architecture diagram ALONE blows past the hard
  // cap and there is no other large section to collapse. The tail-cut must
  // refuse to slice into the protected span, so the whole diagram survives —
  // the body is then allowed to exceed the cap (the documented exemption cost).
  const hugeDiagram = `graph TD\n  ARCH_HEAD_NODE --> ${'N'.repeat(70_000)}\n  ARCH_TAIL_SENTINEL --> done`;
  const body = renderOverview({
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [] },
    pr_review: { architecture_flow: { combined_mermaid: hugeDiagram } },
  });
  // The diagram is intact end-to-end: both its head and its trailing sentinel
  // survive a hard-cut that would otherwise have sliced through the middle.
  assert.match(body, /ARCH_HEAD_NODE/, 'diagram head survived');
  assert.match(body, /ARCH_TAIL_SENTINEL/, 'diagram tail survived the hard-cut');
  assert.match(body, /<!-- \/drift:arch:nocollapse -->/, 'the close sentinel (span boundary) is preserved');
});
