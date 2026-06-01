// Architecture (diagrams-only): the single color-coded diff diagram, the
// supporting business/data-structure/mindmap blocks, the newest-shape-first
// fallback chain, and degradation to null when there's nothing to draw. The
// dead-code callout and the BEFORE/AFTER prose were removed — the diagram's
// colours are self-explanatory.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderArchitecture } from '../render/sections/architecture.ts';
import type { PrScope } from '../report.ts';
import type { PrContext } from '../render/context.ts';

const CTX: PrContext = { owner: 'acme', repo: 'shop', sha: 'cafe' };

function scope(over: Partial<PrScope> = {}): PrScope {
  return { changed_files: ['a.ts'], affected_roots: ['App'], unreachable_changes: [], ...over };
}

test('architecture: diagrams-only — no reach prose, table, or root list ever rendered', () => {
  // Even with a full key-file block and multiple roots, the section emits only
  // the mindmap diagram — never the old "N entry points reach…" prose or table.
  const out = renderArchitecture({
    prScope: scope({ affected_roots: ['App', 'Worker'] }),
    keyFiles: {
      mermaid: 'mindmap\n root((files))',
      groups: [{ name: 'g', files: [{ path: 'src/Hot.tsx', why: '40 root(s) reach this file' }] }],
    },
    ctx: CTX,
  })!;
  assert.doesNotMatch(out, /entry points? reach/i, 'no reach prose');
  assert.doesNotMatch(out, /files most callers depend on/i, 'no reach-intro sentence');
  assert.match(out, /## 🏗 Architecture\b/, 'header');
  assert.match(out, /<summary>🗂 Key files — hot-touch mindmap<\/summary>/, 'mindmap diagram kept');
});

test('architecture: null when only roots / unreachable exist (no diagrams, no callout)', () => {
  // Roots or unreachable files alone produce no diagram — and the dead-code
  // callout was removed — so the diagrams-only section is omitted entirely.
  assert.equal(renderArchitecture({ prScope: scope({ affected_roots: ['App', 'Worker'] }), ctx: CTX }), null);
  assert.equal(renderArchitecture({ prScope: scope({ unreachable_changes: ['x.ts'] }), ctx: CTX }), null);
});

test('architecture: the verbose prose is gone (no callout, no BEFORE/AFTER legend, no anon note)', () => {
  const out = renderArchitecture({
    prScope: scope({ unreachable_changes: ['types.rs'] }),
    arch: { diff_merged_mermaid: 'flowchart LR\n n0["foo"]\n class n0 changed' },
    ctx: CTX,
  })!;
  assert.doesNotMatch(out, /unreachable/i, 'no dead-code callout');
  assert.doesNotMatch(out, /🔴 BEFORE/, 'no BEFORE legend');
  assert.doesNotMatch(out, /🟢 AFTER/, 'no AFTER legend');
  assert.doesNotMatch(out, /reconstructs the call graph/, 'no before/after explanation');
  assert.doesNotMatch(out, /anonymous functions\/callbacks/, 'no anon-node note');
});

test('architecture: the merged diff diagram renders as ONE color-coded block (prefers diff_merged)', () => {
  const out = renderArchitecture({
    prScope: scope(),
    arch: {
      diff_merged_mermaid: 'flowchart LR\n n0["foo"]\n class n0 changed',
      // before/after/combined are accepted but MUST NOT win over diff_merged.
      after_mermaid: 'flowchart LR\n a0["after"]',
      before_mermaid: 'flowchart LR\n b0["before"]',
      combined_mermaid: 'flowchart TB\n stale --> ignored',
    },
    ctx: CTX,
  })!;
  assert.match(out, /<summary>🧭 Call graph — color-coded diff<\/summary>/);
  assert.match(out, /```mermaid\nflowchart LR\n n0\["foo"\]\n class n0 changed\n```/);
  // Only the merged diagram renders — the fallbacks must not also appear.
  assert.doesNotMatch(out, /b0\["before"\]/);
  assert.doesNotMatch(out, /a0\["after"\]/);
  assert.doesNotMatch(out, /stale --> ignored/);
  const fenceCount = (out.match(/```mermaid/g) ?? []).length;
  assert.equal(fenceCount, 1, `exactly ONE call-graph mermaid fence, got ${fenceCount}:\n${out}`);
});

test('architecture: collapsible diagrams + data-structure table', () => {
  const out = renderArchitecture({
    prScope: scope(),
    arch: {
      diff_merged_mermaid: 'flowchart TB\n a --> b',
      data_structures: [
        { name: 'OrderService', kind: 'modified', scope: 'python', description: '4 method(s) in scope' },
      ],
    },
    business: { mermaid: 'flowchart TB\n U --> r', summary: 'why this exists' },
    keyFiles: { mermaid: 'mindmap\n root((x))' },
    ctx: CTX,
  })!;
  assert.match(out, /<summary>🧭 Call graph — color-coded diff<\/summary>/);
  assert.match(out, /<summary>🧠 Business-logic reach diagram<\/summary>/);
  assert.match(out, /> \*\*Summary —\*\* why this exists/);
  assert.match(out, /<summary>📦 Data structures touched \(1\)<\/summary>/);
  assert.match(out, /\| `OrderService` \| modified \| python \| 4 \|/);
  assert.match(out, /<summary>🗂 Key files — hot-touch mindmap<\/summary>/);
  // sibling <details> separated by a blank line
  assert.doesNotMatch(out, /<\/details>\n<details>/, 'siblings need a blank line between them');
});

test('architecture: fallback chain — combined → after → before when diff_merged absent', () => {
  // Legacy/older-scanner reports still produce a single block.
  const combined = renderArchitecture({ prScope: scope(), arch: { combined_mermaid: 'flowchart TB\n a --> b' }, ctx: CTX })!;
  assert.match(combined, /```mermaid\nflowchart TB\n a --> b\n```/);
  assert.equal((combined.match(/```mermaid/g) ?? []).length, 1);

  const after = renderArchitecture({ prScope: scope(), arch: { after_mermaid: 'flowchart LR\n a0["x"]' }, ctx: CTX })!;
  assert.match(after, /```mermaid\nflowchart LR\n a0\["x"\]\n```/);

  const before = renderArchitecture({ prScope: scope(), arch: { before_mermaid: 'flowchart LR\n b0["y"]' }, ctx: CTX })!;
  assert.match(before, /```mermaid\nflowchart LR\n b0\["y"\]\n```/);
});

test('architecture: whitespace-only diagrams fall through (no empty fence)', () => {
  const out = renderArchitecture({
    prScope: scope(),
    arch: {
      diff_merged_mermaid: '   \n',
      after_mermaid: '',
      combined_mermaid: 'flowchart TB\n a --> b',
    },
    ctx: CTX,
  })!;
  assert.match(out, /```mermaid\nflowchart TB\n a --> b\n```/);
  assert.equal((out.match(/```mermaid/g) ?? []).length, 1);
});

test('architecture: null when there is nothing to show', () => {
  assert.equal(renderArchitecture({ prScope: { changed_files: [], affected_roots: [], unreachable_changes: [] } }), null);
});
