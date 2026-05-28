// Architecture & reach: intro grammar, reach table (parsed counts), unreachable
// callout + dead-code note, nested diagrams/tables, inline-root fallback, and
// degradation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderArchitecture, type ArchitectureInput } from '../render/sections/architecture.ts';
import type { PrScope } from '../report.ts';
import type { PrContext } from '../render/context.ts';

const CTX: PrContext = { owner: 'acme', repo: 'shop', sha: 'cafe' };

function scope(over: Partial<PrScope> = {}): PrScope {
  return { changed_files: ['a.ts'], affected_roots: ['App'], unreachable_changes: [], ...over };
}

test('architecture: reach table parses "N root(s) reach this file", sorted desc', () => {
  const input: ArchitectureInput = {
    prScope: scope({ affected_roots: ['App', 'Worker'] }),
    keyFiles: {
      groups: [
        { name: 'g', files: [
          { path: 'src/Hot.tsx', why: '40 root(s) reach this file' },
          { path: 'src/Mid.ts', why: '21 roots reach' },
          { path: 'src/Cold.ts', why: 'no count here' },
        ] },
      ],
    },
    ctx: CTX,
  };
  const out = renderArchitecture(input)!;
  assert.match(out, /\*\*2\*\* entry points reach changes in this PR\. The files most callers depend on:/);
  assert.match(out, /\| File \| Roots reaching it \|/);
  // sorted by reach desc; unknown ("—") last
  const hot = out.indexOf('Hot.tsx');
  const mid = out.indexOf('Mid.ts');
  const cold = out.indexOf('Cold.ts');
  assert.ok(hot < mid && mid < cold, 'reach-sorted');
  assert.match(out, /\[`src\/Hot\.tsx`\]\(https:\/\/github\.com\/acme\/shop\/blob\/cafe\/src\/Hot\.tsx\) \| 40 \|/);
  assert.match(out, /Cold\.ts[^\n]*\| — \|/, 'unparseable reach → —');
});

test('architecture: singular subject-verb agreement ("1 entry point reaches")', () => {
  const out = renderArchitecture({ prScope: scope({ affected_roots: ['App'] }), ctx: CTX })!;
  assert.match(out, /\*\*1\*\* entry point reaches changes in this PR\./);
});

test('architecture: inline root list when there is no key-file data', () => {
  const out = renderArchitecture({ prScope: scope({ affected_roots: ['App', 'Worker', 'Cron'] }), ctx: CTX })!;
  assert.match(out, /\*\*3\*\* entry points reach changes in this PR\./);
  assert.match(out, /`App` · `Worker` · `Cron`/);
});

test('architecture: unreachable callout links files + notes dead-code match', () => {
  const out = renderArchitecture({
    prScope: scope({ unreachable_changes: ['src/components/Example.tsx', 'src/components/Hero.tsx'] }),
    deadCodeCount: 2,
    ctx: CTX,
  })!;
  assert.match(out, /\*\*2 changed files are unreachable\*\*/);
  assert.match(out, /\[`Example\.tsx`\]\(https:\/\/github\.com\/acme\/shop\/blob\/cafe\/src\/components\/Example\.tsx\)/);
  assert.match(out, /\(These match the dead-code suggestions above\.\)/);
});

test('architecture: unreachable callout omits dead-code note when none', () => {
  const out = renderArchitecture({ prScope: scope({ unreachable_changes: ['x.ts'] }), deadCodeCount: 0, ctx: CTX })!;
  assert.match(out, /\*\*1 changed file is unreachable\*\*/);
  assert.doesNotMatch(out, /match the dead-code suggestions/);
});

test('architecture: collapsible diagrams + data-structure table', () => {
  const out = renderArchitecture({
    prScope: scope(),
    arch: {
      combined_mermaid: 'flowchart TB\n a --> b',
      data_structures: [
        { name: 'OrderService', kind: 'modified', scope: 'python', description: '4 method(s) in scope' },
      ],
    },
    business: { mermaid: 'flowchart TB\n U --> r', summary: 'why this exists' },
    keyFiles: { mermaid: 'mindmap\n root((x))' },
    ctx: CTX,
  })!;
  assert.match(out, /<summary>🧭 Architecture flow diagram — before → after<\/summary>/);
  assert.match(out, /‹lambda@N›/, 'lambda note present');
  assert.match(out, /<summary>🧠 Business-logic reach diagram<\/summary>/);
  assert.match(out, /> \*\*Summary —\*\* why this exists/);
  assert.match(out, /<summary>📦 Data structures touched \(1\)<\/summary>/);
  assert.match(out, /\| `OrderService` \| modified \| python \| 4 \|/);
  assert.match(out, /<summary>🗂 Key files — hot-touch mindmap<\/summary>/);
  // sibling <details> separated by a blank line
  assert.doesNotMatch(out, /<\/details>\n<details>/, 'siblings need a blank line between them');
});

test('architecture: no context → code-span fallbacks, still valid', () => {
  const out = renderArchitecture({ prScope: scope({ unreachable_changes: ['x.ts'] }) })!;
  assert.doesNotMatch(out, /\]\(https:\/\/github\.com/, 'no permalinks without context');
  assert.match(out, /`x\.ts`/);
});

test('architecture: null when there is nothing to show', () => {
  assert.equal(renderArchitecture({ prScope: { changed_files: [], affected_roots: [], unreachable_changes: [] } }), null);
});
