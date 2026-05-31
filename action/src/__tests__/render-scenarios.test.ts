// Scenario matrix — the comment must stay well-formed across the full range of
// inputs a real PR produces: files / no files, every language, mixed / down /
// flat drift, missing blocks, with / without GitHub context. Each scenario is
// checked against universal invariants (marker, state blob, no stringified
// blanks, balanced fences, size) AND every Mermaid block is validated against
// the real parser when the validator deps are installed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOverview, STICKY_MARKER } from '../render/overview.ts';
import { validate, extractBlocks, isInstalled } from '../../scripts/validate-mermaid.mjs';
import type { ScanPrOutput, ValueAxis, ValueCard, CodeSuggestion, RiskItem } from '../report.ts';
import type { PrContext } from '../render/context.ts';

const CTX: PrContext = { owner: 'refactorlab', repo: 'andy', sha: 'sha123', prTitle: 'feat: x' };
const GOOD_FLOW = ['flowchart TB', '    n0["App"]', '    n1["useTheme.‹lambda@21›"]', '    n0 --> n1'].join('\n');
const GOOD_MIND = ['mindmap', '  root((Affected files))', '    src', '      A.tsx'].join('\n');

function base(over: Partial<ScanPrOutput> = {}): ScanPrOutput {
  return {
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.6.0' },
    pr_scope: { changed_files: ['a.ts'], affected_roots: ['main'], unreachable_changes: [] },
    ...over,
  };
}

function axis(name: ValueAxis['name'], delta: number, extra?: Partial<ValueAxis>): ValueAxis {
  return {
    name,
    label: { money: '💰 Money', customer: '👥 Customer value', runtime: '⚙️ Runtime', runtime_ux: '🎨 Runtime UX' }[name],
    delta_percent: delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
    confidence: 'low',
    inputs: name === 'money' ? { loc_added: 200, loc_deleted: 25 } : undefined,
    ...extra,
  };
}

function card(axes: ValueAxis[], over: Partial<ValueCard> = {}): ValueCard {
  return { axes, ...over };
}

function deadCode(file: string, fn: string, line: number): CodeSuggestion {
  return { category: 'A', category_label: 'Optimization — Dead code', kind: 'dead_code_in_changed_file', file, function: fn, line, confidence: 1, severity: 'low', why_it_matters: `${fn} is dead`, references: [{ url: 'https://refactoring.guru/smells/dead-code', title: 'ref' }] };
}

function risk(label: string, l: number, s: number, q: RiskItem['quadrant']): RiskItem {
  return { label, likelihood: l, severity: s, quadrant: q };
}

// ── the matrix ───────────────────────────────────────────────────────────────

const scenarios: { name: string; report: ScanPrOutput; ctx?: PrContext; expect?: (body: string) => void }[] = [
  {
    name: 'empty PR — no files, no review',
    report: base({ pr_scope: { changed_files: [], affected_roots: [], unreachable_changes: [] } }),
    expect: (b) => {
      assert.match(b, /Drift review/);
      assert.doesNotMatch(b, /📊 Business value/);
      assert.doesNotMatch(b, /🏗 Architecture/);
      assert.match(b, /Posted by/);
    },
  },
  {
    name: 'config-only — files changed, no value model',
    report: base({ pr_scope: { changed_files: ['a.yml', 'b.json'], affected_roots: [], unreachable_changes: ['a.yml'] } }),
    ctx: CTX,
    expect: (b) => {
      assert.match(b, /\[!NOTE\]/);
      assert.match(b, /<summary><strong>🏗 Architecture<\/strong> — /);
      assert.doesNotMatch(b, /📊 Business value/);
    },
  },
  {
    name: 'mixed axes (template-like) — typescript, dead code, risks, mermaid',
    report: base({
      pr_scope: { changed_files: ['src/A.tsx', 'src/B.tsx'], affected_roots: ['App', 'Worker'], unreachable_changes: ['src/Example.tsx'] },
      pr_review: {
        overall_drift: { percent: 10.3, direction: 'up', confidence: 'low' },
        counts: { features: { value: 3, label: 'f' }, new_test_files: { value: 0, label: 't' } },
        value_card: card([axis('money', -15.9), axis('customer', 60), axis('runtime', -3), axis('runtime_ux', 0)], { bars_mermaid: undefined, bottom_line: 'mixed.' }),
        code_suggestions: [deadCode('src/Example.tsx', 'Example', 6)],
        architecture_flow: { combined_mermaid: GOOD_FLOW, data_structures: [{ name: 'X', kind: 'modified', scope: 'typescript', description: '34 method(s)' }] },
        business_logic: { mermaid: GOOD_FLOW, summary: 'motion system' },
        visual_summary: {
          risks: { items: [risk('Untested', 0.6, 0.7, 'act_before_merge'), risk('PR size', 0.28, 0.44, 'acceptable')] },
          key_files: { mermaid: GOOD_MIND, groups: [{ name: 'src', files: [{ path: 'src/A.tsx', why: '40 root(s) reach this file' }] }] },
        },
      },
    }),
    ctx: CTX,
    expect: (b) => {
      assert.match(b, /\[!WARNING\]/, 'mixed → warn');
      assert.match(b, /<strong>mixed<\/strong>: a \+60\.0% customer gain masks a −15\.9% money regression/);
      assert.match(b, /Triage the .*💰 Money −15\.9%.* and .*⚙️ Runtime −3\.0%.* regressions/);
      assert.match(b, /Remove or wire up 1 dead export: \[`Example`\]/);
      assert.match(b, /<summary><strong>🛰 Risks<\/strong> — /);
    },
  },
  {
    name: 'all-down — net regression',
    report: base({
      pr_review: {
        overall_drift: { percent: -12, direction: 'down', confidence: 'medium' },
        value_card: card([axis('money', -12), axis('runtime', -8)]),
      },
    }),
    ctx: CTX,
    expect: (b) => {
      assert.match(b, /\[!WARNING\]/);
      assert.match(b, /net regression/);
      assert.match(b, /badge\/drift-.*-d1242f/);
    },
  },
  {
    name: 'all-flat — neutral',
    report: base({
      pr_review: {
        overall_drift: { percent: 0, direction: 'neutral', confidence: 'low' },
        value_card: card([axis('money', 0), axis('customer', 0)]),
      },
    }),
    ctx: CTX,
    expect: (b) => {
      assert.match(b, /Composite&nbsp; ⚪ 0\.0%/);
      assert.match(b, /░░░░░░░░░░/, 'empty bars for flat axes');
    },
  },
  {
    name: 'clean improvement with tests — TIP, no add-tests item',
    report: base({
      pr_review: {
        overall_drift: { percent: 9, direction: 'up', confidence: 'high' },
        counts: { new_test_files: { value: 5, label: 't' } },
        value_card: card([axis('customer', 9)]),
      },
    }),
    ctx: CTX,
    expect: (b) => {
      assert.match(b, /\[!TIP\]/);
      assert.match(b, /badge\/new_tests-5-2ea043/);
      assert.doesNotMatch(b, /Add tests/);
    },
  },
  {
    name: 'cat-C framework misuse → medium priority',
    report: base({
      pr_review: {
        value_card: card([axis('runtime', 4)]),
        code_suggestions: [{ category: 'C', category_label: 'Framework misuse — wrong hook', file: 'a.tsx', line: 3, confidence: 0.9, why_it_matters: 'x', references: [{ url: 'https://r' }] }],
      },
    }),
    ctx: CTX,
    expect: (b) => {
      assert.match(b, /<summary><strong>⚠️ Code suggestions \(1\)<\/strong> — /);
      assert.match(b, /🟡 Medium \| 🅒/);
      assert.doesNotMatch(b, /\[!CAUTION\]/, 'cat-C is not a product-correctness CAUTION');
    },
  },
  {
    name: 'risks mermaid-only, no items',
    report: base({ pr_review: { visual_summary: { risks: { mermaid: 'quadrantChart\n title Risk Map' } } } }),
    ctx: CTX,
    expect: (b) => assert.match(b, /<summary><strong>🛰 Risks<\/strong> — /),
  },
  {
    // Cross-language symbol/path stressor: Rust generics + a function name that
    // mermaid would reject if rendered unquoted, plus a Next.js-style dynamic
    // segment in the path. The scanner-side hardening (safe_label/safe_id) keeps
    // these from ever leaving the JSON unsafe; the TS layer then renders
    // permalinks + code spans around the raw paths without crashing.
    name: 'cross-language pathological symbols (Rust + Next.js paths)',
    report: base({
      pr_scope: {
        changed_files: ['crates/svc/src/lib.rs', 'src/app/[id]/page.tsx'],
        affected_roots: ['main', 'handler::<T>'],
        unreachable_changes: ['src/app/[id]/page.tsx'],
      },
      pr_review: {
        overall_drift: { percent: -4, direction: 'down', confidence: 'medium' },
        value_card: card([axis('runtime', -4), axis('customer', 8)]),
        code_suggestions: [
          {
            category: 'B',
            severity: 'high',
            category_label: 'Product correctness — operator==<T> ambiguity',
            kind: 'overload_ambiguity',
            file: 'crates/svc/src/lib.rs',
            function: 'impl<T> Foo<T>::operator==',
            line: 42,
            confidence: 0.86,
            why_it_matters: 'Generic equality may shadow Eq.',
            references: [{ url: 'https://doc.rust-lang.org/std/cmp/trait.Eq.html', title: 'Eq' }],
          },
        ],
        visual_summary: { risks: { items: [risk('Untested generic', 0.7, 0.8, 'act_before_merge')] } },
      },
    }),
    ctx: CTX,
    expect: (b) => {
      assert.match(b, /\[!WARNING\]/, 'mixed signs → warn');
      // pathological symbol from the suggestion's category_label survives verbatim
      assert.match(b, /operator==<T> ambiguity/);
      // Next.js-style dynamic path renders as a permalink without breaking the link
      assert.match(b, /https:\/\/github\.com\/refactorlab\/andy\/blob\/sha123\/src\/app\/%5Bid%5D\/page\.tsx/);
      // Rust qualified path in the file link too
      assert.match(b, /crates\/svc\/src\/lib\.rs#L42/);
    },
  },
  {
    // Volume stressor: many cat-A dead-code findings. Exercises the checklist
    // "dead exports" truncation (`MAX_DEAD_EXPORTS_LINKED = 5`) and the
    // Code-suggestions render cap (`DEFAULT_MAX_SUGGESTIONS = 10`) — the table
    // shows the top 10, the heading keeps the true total (25), and an overflow
    // note accounts for the rest — while keeping the comment under 60 KiB.
    name: 'high-volume dead-code (25 findings) — truncation + body cap',
    report: base({
      pr_review: {
        value_card: card([axis('customer', 4)]),
        code_suggestions: Array.from({ length: 25 }, (_, i) => ({
          category: 'A' as const,
          category_label: 'Optimization — Dead code in changed file',
          kind: 'dead_code_in_changed_file',
          file: `src/dead/${i}.tsx`,
          function: `unused${i}`,
          line: i + 1,
          confidence: 1,
          severity: 'low' as const,
          why_it_matters: `unused${i} is dead`,
          references: [{ url: 'https://refactoring.guru/smells/dead-code', title: 'r' }],
        })),
      },
    }),
    ctx: CTX,
    expect: (b) => {
      assert.match(b, /<summary><strong>⚠️ Code suggestions \(25\)<\/strong> — /, 'header shows full count');
      // Checklist truncates at MAX_DEAD_EXPORTS_LINKED = 5 with a more-tail.
      assert.match(b, /\*…\+20 more\*/, 'checklist truncation note');
      // Render cap = DEFAULT_MAX_SUGGESTIONS = 10 → 10 table rows + an overflow
      // note for the remaining 15.
      assert.match(b, /…\+15 more suggestions? not shown — rendering the top 10 by priority\./);
      const tableRows = (b.match(/^\| (?:🔴 High|🟡 Medium|⚪ Low) \|/gm) ?? []).length;
      assert.equal(tableRows, 10, `priority table must cap at 10 rows (got ${tableRows})`);
      assert.ok(b.length < 60_000, `body within budget: ${b.length}`);
    },
  },
  {
    // Markdown / HTML injection attempts in scanner-provided text. The renderer
    // must NOT break (no unclosed fences, no broken tables, no escaped weirdness
    // that disables the section). The text passes through as markdown — that's
    // intentional — but tables stay intact via `cell()`'s pipe escape.
    name: 'markdown-injection attempts in suggestion text',
    report: base({
      pr_review: {
        value_card: card([axis('runtime', 1)]),
        code_suggestions: [
          {
            category: 'B',
            severity: 'high',
            // Markdown + pipe + HTML-ish + reserved word all in one label.
            category_label: 'Product correctness — **bold** `code` <script>alert(1)</script> | end',
            file: 'src/x.ts',
            line: 1,
            confidence: 0.9,
            why_it_matters: 'Look: ```not a real fence``` and a | pipe and <b>html</b> — should not break the table.',
            references: [{ url: 'https://example.com', title: 'ref | with | pipes' }],
          },
        ],
      },
    }),
    ctx: CTX,
    expect: (b) => {
      // Markdown table row stays well-formed: exactly 4 cells (5 `|`s + a newline).
      const sugRow = b.split('\n').find((l) => l.startsWith('| 🔴 High'))!;
      assert.ok(sugRow, 'priority-table row present');
      // The `|` in the finding label is escaped so it doesn't add a column.
      assert.match(sugRow, /\\\|/, 'pipe in finding label is escaped');
      // ``` runs in why_it_matters don't unbalance the body's fences.
      const total = (b.match(/```/g) ?? []).length;
      assert.equal(total % 2, 0, `code fences balanced (${total} ticks)`);
    },
  },
  {
    // PR title with mermaid-hostile characters. The TS renderer puts the title
    // inside a backtick code span on the H2; a literal backtick in the title
    // would break the span. The header replaces backticks with `'`.
    name: "PR title with hostile chars (backticks, <>, |, reserved 'end') never reaches the H2",
    report: base({
      pr_review: {
        overall_drift: { percent: 5, direction: 'up', confidence: 'low' },
        value_card: card([axis('customer', 5)]),
      },
    }),
    ctx: { ...CTX, prTitle: 'feat: `code` <T> | end keyword fix' },
    expect: (b) => {
      // The PR title is no longer rendered, so hostile chars can't reach the H2.
      assert.match(b, /^## [▲▼—] Drift review$/m, 'clean H2 with no title suffix');
      assert.doesNotMatch(b, /Drift review —/, 'no PR-title suffix at all');
    },
  },
];

for (const sc of scenarios) {
  test(`scenario: ${sc.name} — well-formed`, () => {
    const body = renderOverview(sc.report, { ctx: sc.ctx });
    assert.ok(body.startsWith(STICKY_MARKER), 'marker first');
    assert.match(body, /<!-- drift:state \{[\s\S]*\} -->\s*$/, 'state blob last');
    assert.doesNotMatch(body, /undefined|\[object Object\]|NaN%/, 'no stringified blanks');
    assert.equal((body.match(/```/g) ?? []).length % 2, 0, 'balanced code fences');
    assert.ok(body.length < 65_536, `under hard cap (${body.length})`);
    sc.expect?.(body);
  });
}

test('scenarios: every Mermaid block validates against the real parser', async (t) => {
  if (!(await isInstalled())) return void t.skip('mermaid validator not installed');
  for (const sc of scenarios) {
    const body = renderOverview(sc.report, { ctx: sc.ctx });
    for (const block of await extractBlocks(body)) {
      const r = await validate(block);
      assert.ok(r.ok, `[${sc.name}] invalid mermaid: ${r.error}\n${block}`);
    }
  }
});

test('scenario: identical render with and without context (only links differ)', () => {
  // Includes an unreachable file so the (diagrams-only) Architecture section
  // still renders its dead-code callout — whose file links are ctx-dependent.
  const report = base({
    pr_scope: { changed_files: ['a.ts', 'src/dead.tsx'], affected_roots: ['main'], unreachable_changes: ['src/dead.tsx'] },
    pr_review: { value_card: card([axis('customer', 12)]), code_suggestions: [deadCode('src/A.tsx', 'A', 3)] },
  });
  const withCtx = renderOverview(report, { ctx: CTX });
  const noCtx = renderOverview(report);
  assert.match(withCtx, /\]\(https:\/\/github\.com\/refactorlab\/andy\/blob\/sha123\//, 'ctx → permalinks');
  assert.doesNotMatch(noCtx, /\]\(https:\/\/github\.com/, 'no ctx → no permalinks');
  // both must contain the same section headings
  for (const h of ['📊 Business value', '⚠️ Code suggestions', '🏗 Architecture']) {
    assert.ok(withCtx.includes(h) && noCtx.includes(h), `both render ${h}`);
  }
});

test('scenario: since-last-review delta appears with a prior snapshot', () => {
  const report = base({ pr_review: { value_card: card([axis('money', 2.9), axis('runtime', -3)]) } });
  const body = renderOverview(report, { ctx: CTX, priorState: { v: 1, axes: { money: 0.8, runtime: -2 } } });
  assert.match(body, /Since last review\*\* &nbsp; 💰 ▲ \+2\.1pp · ⚙️ ▼ −1\.0pp/);
});
