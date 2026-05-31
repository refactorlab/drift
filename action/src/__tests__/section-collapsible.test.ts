// Tests for the collapsible-section framing: the lib/section.ts helpers in
// isolation, plus the end-to-end structure they produce in renderOverview —
// every detail section is an expandable <details> with a "Title — TLDR"
// summary, the header stays visible, and every section defaults to collapsed.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { splitHeading, collapsibleSection, wrapSection } from '../render/lib/section.ts';
import { renderOverview } from '../render/overview.ts';
import type { ScanPrOutput, ValueAxis, ValueCard, CodeSuggestion, RiskItem } from '../report.ts';

// ── unit: splitHeading ───────────────────────────────────────────────────────

test('splitHeading: extracts a leading ## heading and returns the rest as body', () => {
  const { title, body } = splitHeading('## 📊 Business value\n\nrow1\nrow2');
  assert.equal(title, '📊 Business value');
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
  const out = collapsibleSection({ title: 'Risks & mitigations', tldr: 'before vs after', body: 'B' });
  assert.match(out, /^<details>\n<summary><strong>Risks &amp; mitigations<\/strong> — before vs after<\/summary>\n\nB\n\n<\/details>$/);
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

  // The "✅ Before you merge" checklist now CLOSES the comment — it stays
  // OUTSIDE any <details> (task boxes must be visible for GitHub to tally
  // merge-readiness), and sits AFTER the last collapsible section.
  assert.match(body, /## ✅ Before you merge/);
  const afterLastDetails = body.slice(body.lastIndexOf('</details>'));
  assert.match(afterLastDetails, /## ✅ Before you merge/, 'checklist is after the last <details>');

  // Each detail section is a collapsed collapsible carrying a TLDR (the "— …"
  // suffix). Every section defaults to closed — the comment is a scannable
  // list of TLDRs the reviewer expands on demand.
  for (const re of [
    /<details>\n<summary><strong>📊 Business value<\/strong> — Overall drift \+18\.0% ▲/,
    /<details>\n<summary><strong>⚠️ Code suggestions \(1\)<\/strong> — 1 suggestion/,
    /<details>\n<summary><strong>🛰 Risks<\/strong> — 1 to address · 2 total<\/summary>/,
    /<details>\n<summary><strong>🏗 Architecture<\/strong> — Before vs after diagrams<\/summary>/,
  ]) {
    assert.match(body, re, `missing collapsible/TLDR: ${re}`);
  }
  // No section is open-by-default anymore.
  assert.doesNotMatch(body, /<details open>/, 'every section defaults to collapsed');
});

test('overview: official section screenshots precede the major sections (fail-soft to alt text)', () => {
  const body = renderOverview(fullReport(), { ctx: CTX });
  const SHOT = 'https://raw.githubusercontent.com/refactorlab/andy/main/docs/screenshots';
  for (const file of ['drift-review.png', 'architecture.png', 'business-value.png', 'code-suggestions.png']) {
    assert.ok(body.includes(`<img src="${SHOT}/${file}"`), `${file} section image present`);
  }
  // The header screenshot leads the comment, right after the sticky marker.
  assert.match(body, /drift:sticky-comment -->\n<p><img src="[^"]*\/drift-review\.png"/);
  // Each banner sits ABOVE its section (architecture image precedes the heading).
  assert.ok(body.indexOf('architecture.png') < body.indexOf('🏗 Architecture'), 'image precedes its section');
  // The Andy sign-off banner closes the comment: present, and pinned AFTER the
  // attribution line so it stays stuck to the very end.
  assert.ok(body.includes('andy.png'), 'andy sign-off banner is present');
  assert.ok(body.indexOf('andy.png') > body.indexOf('Posted by'), 'andy sign-off sits after the attribution');
  // It is the LAST visible element — nothing but the invisible state markers
  // (HTML comments) may follow it.
  const afterAndy = body.slice(body.indexOf('andy.png'));
  assert.doesNotMatch(afterAndy, /<img|<details|<table/, 'nothing visible renders after the Andy sign-off');
});

test('overview: section banners are decorative <p> images ABOVE the <details>, never inside the <summary>', () => {
  // An image can't toggle a GitHub <details>: clicking an image opens the
  // image, not the disclosure. So each section banner stays OUTSIDE the
  // collapsible — a standalone <p> above it — and the clean text <summary>
  // row (which GitHub renders with a ▸/▾ arrow) is the toggle. This guards
  // against regressing to a banner inside <summary>, which hijacks the click.
  const body = renderOverview(fullReport(), { ctx: CTX });
  const SHOT = 'https://raw.githubusercontent.com/refactorlab/andy/main/docs/screenshots';
  for (const file of ['architecture.png', 'business-value.png', 'code-suggestions.png']) {
    assert.ok(body.includes(`<p><img src="${SHOT}/${file}"`), `${file} banner is a standalone <p> above its section`);
  }
  // No <summary> anywhere may contain an <img> — the banner never sits in the toggle.
  for (const m of body.matchAll(/<summary>([\s\S]*?)<\/summary>/g)) {
    assert.ok(!m[1].includes('<img'), 'a <summary> must not contain an image (it would hijack the toggle click)');
  }
  // The header banner is a decorative <p> image; the footer carries one too
  // (the small Andy sign-off at the very end).
  assert.ok(body.includes(`<p><img src="${SHOT}/drift-review.png"`), 'header banner is a <p>');
  assert.ok(body.includes(`<p><img src="${SHOT}/andy.png"`), 'andy sign-off is a standalone <p> image');
});

test('overview: audio summary button banner renders only when there is an audio URL', () => {
  const SHOT = 'https://raw.githubusercontent.com/refactorlab/andy/main/docs/screenshots';
  const withAudio = renderOverview(fullReport(), { ctx: CTX, audioUrl: 'https://github.com/o/r/actions/runs/1/artifacts/2?x=1&y=2' });
  // A clickable banner linked to the artifact, with the href safely escaped.
  assert.match(withAudio, /<a href="https:\/\/github\.com\/o\/r\/actions\/runs\/1\/artifacts\/2\?x=1&amp;y=2"><img src="[^"]*\/summary-audio\.png"/);
  // The audio button lands "before the end": it precedes the Andy sign-off,
  // which stays pinned to the very end of the comment.
  assert.ok(withAudio.indexOf('summary-audio.png') < withAudio.indexOf('andy.png'), 'audio banner precedes the Andy sign-off');
  const noAudio = renderOverview(fullReport(), { ctx: CTX });
  assert.doesNotMatch(noAudio, /summary-audio\.png/, 'no audio banner without an audio URL');
});

test('overview: regressed-axis TLDR names the regression count', () => {
  const r = fullReport();
  r.pr_review!.value_card = card([axis('money', -12), axis('runtime', -3), axis('customer', 5)]);
  r.pr_review!.overall_drift = { percent: -4, direction: 'down', confidence: 'low' };
  const body = renderOverview(r, { ctx: CTX });
  assert.match(body, /<summary><strong>📊 Business value<\/strong> — Overall drift −4\.0% ▼ · 2 axes regressed/);
});

test('overview: all detail sections default to collapsed', () => {
  const body = renderOverview(fullReport(), { ctx: CTX });
  // Every section is reference content the reviewer expands on demand — none
  // is open-by-default, including value, suggestions, and architecture.
  assert.match(body, /<details>\n<summary><strong>📊 Business value/);
  assert.match(body, /<details>\n<summary><strong>⚠️ Code suggestions/);
  assert.match(body, /<details>\n<summary><strong>🏗 Architecture/);
});

test('overview: Risks stays collapsed regardless of act-before-merge items', () => {
  // fixture has 1 act_before_merge risk → still collapsed.
  const withGating = renderOverview(fullReport(), { ctx: CTX });
  assert.match(withGating, /<details>\n<summary><strong>🛰 Risks<\/strong> — 1 to address/);
  assert.doesNotMatch(withGating, /<details open>\n<summary><strong>🛰 Risks/);

  // No act_before_merge items → also collapsed.
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
