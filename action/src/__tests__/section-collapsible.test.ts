// Tests for the collapsible-section framing: the lib/section.ts helpers in
// isolation, plus the end-to-end structure they produce in renderOverview —
// every detail section is an expandable <details> with a "Title — TLDR"
// summary, the header stays visible, and primary sections default to open.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { splitHeading, collapsibleSection, wrapSection } from '../render/lib/section.ts';
import { renderOverview } from '../render/overview.ts';
import type { ScanPrOutput, ValueAxis, ValueCard, CodeSuggestion, RiskItem } from '../report.ts';

// ── unit: splitHeading ───────────────────────────────────────────────────────

test('splitHeading: extracts a leading ## heading and returns the rest as body', () => {
  const { title, body } = splitHeading('## 📊 Value card\n\nrow1\nrow2');
  assert.equal(title, '📊 Value card');
  assert.equal(body, 'row1\nrow2');
});

test('splitHeading: tolerates leading blank lines before the heading', () => {
  const { title, body } = splitHeading('\n\n### 🧪 Extended findings\nx');
  assert.equal(title, '🧪 Extended findings');
  assert.equal(body, 'x');
});

test('splitHeading: no heading → title null, body unchanged', () => {
  const md = '<details>\n<summary>already collapsible</summary>\n</details>';
  const { title, body } = splitHeading(md);
  assert.equal(title, null);
  assert.equal(body, md);
});

// ── unit: collapsibleSection ─────────────────────────────────────────────────

test('collapsibleSection: builds a <details> with escaped title + TLDR', () => {
  const out = collapsibleSection({ title: '🏗 Architecture & reach', tldr: 'before vs after', body: 'B' });
  assert.match(out, /^<details>\n<summary><strong>🏗 Architecture &amp; reach<\/strong> — before vs after<\/summary>\n\nB\n\n<\/details>$/);
});

test('collapsibleSection: open flag emits <details open>', () => {
  const out = collapsibleSection({ title: 'T', body: 'B', open: true });
  assert.match(out, /^<details open>/);
});

test('collapsibleSection: TLDR is optional (no dash when absent/blank)', () => {
  assert.match(collapsibleSection({ title: 'T', body: 'B' }), /<summary><strong>T<\/strong><\/summary>/);
  assert.match(collapsibleSection({ title: 'T', tldr: '   ', body: 'B' }), /<summary><strong>T<\/strong><\/summary>/);
});

test('collapsibleSection: TLDR is HTML-escaped (no injection via < or &)', () => {
  const out = collapsibleSection({ title: 'T', tldr: 'a & <b>', body: 'B' });
  assert.match(out, /— a &amp; &lt;b&gt;<\/summary>/);
});

// ── unit: wrapSection ────────────────────────────────────────────────────────

test('wrapSection: moves the section heading into the summary and drops it from the body', () => {
  const out = wrapSection('## 🛰 Risks\n\n| a | b |', { tldr: '2 to address' });
  assert.match(out, /<summary><strong>🛰 Risks<\/strong> — 2 to address<\/summary>/);
  assert.doesNotMatch(out, /## 🛰 Risks/, 'redundant heading must be stripped');
  assert.match(out, /\| a \| b \|/);
});

test('wrapSection: headingless input wraps whole under fallbackTitle', () => {
  const out = wrapSection('just a body', { tldr: 't', fallbackTitle: 'Misc' });
  assert.match(out, /<summary><strong>Misc<\/strong> — t<\/summary>/);
  assert.match(out, /just a body/);
});

// ── integration: structure of renderOverview ─────────────────────────────────

const CTX = { owner: 'o', repo: 'r', sha: 'sha123', prTitle: 'feat: x' };
function axis(name: ValueAxis['name'], delta: number): ValueAxis {
  return {
    name,
    label: { money: '💰 Money', customer: '👥 Customer value', runtime: '⚙️ Runtime', runtime_ux: '🎨 Runtime UX' }[name],
    delta_percent: delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
    confidence: 'low',
    inputs: name === 'money' ? { loc_added: 120, loc_deleted: 10 } : undefined,
  };
}
function card(axes: ValueAxis[]): ValueCard {
  return { axes };
}
function deadCode(file: string, fn: string, line: number): CodeSuggestion {
  return { category: 'A', category_label: 'Optimization — Dead code', kind: 'dead_code_in_changed_file', file, function: fn, line, confidence: 1, severity: 'low', why_it_matters: `${fn} is dead`, references: [{ url: 'https://refactoring.guru/smells/dead-code', title: 'ref' }] };
}
function risk(label: string, q: RiskItem['quadrant']): RiskItem {
  return { label, likelihood: 0.5, severity: 0.7, quadrant: q };
}

function fullReport(): ScanPrOutput {
  return {
    schema_version: '1.2',
    mode: 'static',
    generator: { tool: 'drift-static-profiler', version: '0.0.0-test' },
    pr_scope: { changed_files: ['src/a.ts'], affected_roots: ['main'], unreachable_changes: [] },
    pr_review: {
      overall_drift: { percent: 18, direction: 'up', confidence: 'medium' },
      counts: { new_test_files: { value: 0, label: 't' } },
      value_card: card([axis('money', 3), axis('customer', 30), axis('runtime', -4)]),
      code_suggestions: [deadCode('src/a.ts', 'unused', 5)],
      architecture_flow: {
        before_mermaid: 'flowchart LR\n    n0["x"]\n    classDef muted fill:#6e7681,stroke:#6e7681,color:#fff\n    class n0 muted',
        after_mermaid: 'flowchart LR\n    n0["x"]\n    classDef changed fill:#9e6a03,stroke:#d29922,color:#fff,stroke-width:2px\n    class n0 changed',
      },
      visual_summary: { risks: { items: [risk('R1', 'act_before_merge'), risk('R2', 'acceptable')] } },
    },
  };
}

test('overview: every detail section is an expandable <details> with a TLDR summary', () => {
  const body = renderOverview(fullReport(), { ctx: CTX });

  // The header (verdict + checklist) stays OUTSIDE any <details> — its task
  // boxes must be visible for GitHub to tally merge-readiness.
  assert.match(body, /### ✅ Before you merge/);
  const beforeFirstDetails = body.slice(0, body.indexOf('<details'));
  assert.match(beforeFirstDetails, /### ✅ Before you merge/, 'checklist is above the first <details>');

  // Each detail section is a collapsible carrying a TLDR (the "— …" suffix).
  // Risks auto-opens here because the fixture has 1 act-before-merge item.
  for (const re of [
    /<details open>\n<summary><strong>📊 Value card<\/strong> — Overall drift \+18\.0% ▲/,
    /<details open>\n<summary><strong>⚠️ Suggestions \(1\)<\/strong> — 1 suggestion/,
    /<details open>\n<summary><strong>🛰 Risks<\/strong> — 1 to address · 2 total<\/summary>/,
    /<details>\n<summary><strong>🏗 Architecture &amp; reach<\/strong> — Before vs after · 1 entry point reaches it<\/summary>/,
  ]) {
    assert.match(body, re, `missing collapsible/TLDR: ${re}`);
  }
});

test('overview: regressed-axis TLDR names the regression count', () => {
  const r = fullReport();
  r.pr_review!.value_card = card([axis('money', -12), axis('runtime', -3), axis('customer', 5)]);
  r.pr_review!.overall_drift = { percent: -4, direction: 'down', confidence: 'low' };
  const body = renderOverview(r, { ctx: CTX });
  assert.match(body, /<summary><strong>📊 Value card<\/strong> — Overall drift −4\.0% ▼ · 2 axes regressed/);
});

test('overview: primary sections open; architecture stays collapsed', () => {
  const body = renderOverview(fullReport(), { ctx: CTX });
  // value + suggestions always open; architecture is reference → always closed.
  assert.match(body, /<details open>\n<summary><strong>📊 Value card/);
  assert.match(body, /<details open>\n<summary><strong>⚠️ Suggestions/);
  assert.match(body, /<details>\n<summary><strong>🏗 Architecture/);
});

test('overview: Risks auto-opens iff there are items to address before merge', () => {
  // fixture has 1 act_before_merge risk → Risks opens.
  const open = renderOverview(fullReport(), { ctx: CTX });
  assert.match(open, /<details open>\n<summary><strong>🛰 Risks<\/strong> — 1 to address/);

  // No act_before_merge items → Risks stays collapsed.
  const r = fullReport();
  r.pr_review!.visual_summary = { risks: { items: [risk('R1', 'acceptable'), risk('R2', 'monitor_closely')] } };
  const closed = renderOverview(r, { ctx: CTX });
  assert.match(closed, /<details>\n<summary><strong>🛰 Risks<\/strong> — 2 risks · none gating<\/summary>/);
  assert.doesNotMatch(closed, /<details open>\n<summary><strong>🛰 Risks/);
});

test('overview: the two before/after mermaid charts survive inside the nested architecture <details>', () => {
  const body = renderOverview(fullReport(), { ctx: CTX });
  // Architecture is now an OUTER <details>; the BEFORE/AFTER charts are inner.
  assert.match(body, /🔴 BEFORE — what the code was:/);
  assert.match(body, /🟢 AFTER — what the code is now:/);
  const fences = (body.match(/```mermaid/g) ?? []).length;
  assert.ok(fences >= 2, `expected ≥2 mermaid fences (before+after), got ${fences}`);
});
