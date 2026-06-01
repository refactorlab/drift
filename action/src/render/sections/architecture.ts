// 🏗 Architecture — the diagrams that answer "what does this PR touch?".
// Renders the scanner's pre-rendered, theme-matched diagrams and nothing else
// (the dead-code callout and the before/after prose were dropped — the colours
// are self-explanatory):
//
//   <details> — color-coded diff graph · business-logic reach · data structures · mindmap
//
// Every Mermaid block is framed verbatim. The section is omitted entirely when
// there are no diagrams or tables to show.

import type { PrScope, ArchitectureFlow, BusinessLogic, KeyFilesBlock, DataStructureEntry } from '../../report.ts';
import type { PrContext } from '../context.ts';
import { int, escapeHtml } from '../lib/format.ts';

export type ArchitectureInput = {
  prScope: PrScope;
  arch?: ArchitectureFlow;
  business?: BusinessLogic;
  keyFiles?: KeyFilesBlock;
  ctx?: PrContext;
};

export function renderArchitecture(input: ArchitectureInput): string | null {
  const { arch, business, keyFiles } = input;
  const dataStructures = arch?.data_structures ?? [];
  const diagram = primaryDiagram(arch);

  const nothing =
    dataStructures.length === 0 &&
    !diagram &&
    !business?.mermaid &&
    !keyFiles?.mermaid;
  if (nothing) return null;

  const lines: string[] = ['## 🏗 Architecture', ''];

  // collapsible diagrams + tables (blank line between siblings so each renders)
  const details: string[] = [];
  if (diagram) {
    // ONE color-coded diff graph: the call graph at HEAD with every node tinted
    // by its file's diff status (🟩 added · 🟧 changed · 🔴 removed) plus a red
    // `🗑 removed` card per deletion. Self-explanatory — no prose legend.
    details.push(
      detailsBlock('🧭 Call graph — color-coded diff', [
        '```mermaid',
        diagram,
        '```',
        '',
        '[Mermaid flowchart reference](https://mermaid.js.org/syntax/flowchart.html)',
      ]),
    );
  }

  if (business?.mermaid) {
    const inner: string[] = [];
    if (business.summary) inner.push(`> **Summary —** ${business.summary}`, '');
    inner.push('```mermaid', business.mermaid, '```');
    details.push(detailsBlock('🧠 Business-logic reach diagram', inner));
  }

  if (dataStructures.length > 0) {
    details.push(detailsBlock(`📦 Data structures touched (${dataStructures.length})`, dataStructureTable(dataStructures)));
  }

  if (keyFiles?.mermaid) {
    details.push(detailsBlock('🗂 Key files — hot-touch mindmap', ['```mermaid', keyFiles.mermaid, '```']));
  }

  if (details.length > 0) lines.push(details.join('\n\n'));

  return lines.join('\n').trimEnd();
}

// ── data structures ──────────────────────────────────────────────────────────

function dataStructureTable(ds: DataStructureEntry[]): string[] {
  const lines = ['| Name | Kind | Language | Methods in scope |', '|---|:--:|---|---:|'];
  for (const d of ds) {
    const methods = methodCount(d.description);
    lines.push(`| \`${escapeHtml(d.name)}\` | ${d.kind} | ${d.scope ?? '—'} | ${methods === null ? '—' : int(methods)} |`);
  }
  return lines;
}

function methodCount(desc?: string): number | null {
  const m = (desc ?? '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Pick the single diagram to render, newest shape first:
 *   `diff_merged_mermaid` (the color-coded BEFORE+AFTER merge) → `combined_mermaid`
 *   (legacy three-subgraph) → `after_mermaid` → `before_mermaid`.
 * The fallbacks only matter for older-scanner reports that predate the merged
 * diagram. Trimming guards against the scanner emitting a literal "" (abstain),
 * which would otherwise pass the existence check and emit an empty mermaid fence.
 */
function primaryDiagram(arch?: ArchitectureFlow): string | null {
  return (
    arch?.diff_merged_mermaid?.trim() ||
    arch?.combined_mermaid?.trim() ||
    arch?.after_mermaid?.trim() ||
    arch?.before_mermaid?.trim() ||
    null
  );
}

function detailsBlock(summary: string, inner: string[]): string {
  return ['<details>', `<summary>${summary}</summary>`, '', ...inner, '', '</details>'].join('\n');
}
