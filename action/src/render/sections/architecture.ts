// 🏗 Architecture — the diagrams that answer "what does this PR touch?".
// Renders the scanner's pre-rendered, theme-matched diagrams (plus a dead-code
// callout) and nothing else — the reach prose/table was dropped in favour of a
// diagrams-only section:
//
//   callout   — changed files unreachable from any entry point (likely dead)
//   <details> — flow diagram · business-logic reach · data structures · mindmap
//
// Every Mermaid block is framed verbatim. The section is omitted entirely when
// there are no diagrams and no unreachable files to call out.

import type { PrScope, ArchitectureFlow, BusinessLogic, KeyFilesBlock, DataStructureEntry } from '../../report.ts';
import type { PrContext } from '../context.ts';
import { fileLink } from '../context.ts';
import { int, plural, escapeHtml } from '../lib/format.ts';

const MAX_UNREACHABLE_LINKED = 8;

export type ArchitectureInput = {
  prScope: PrScope;
  arch?: ArchitectureFlow;
  business?: BusinessLogic;
  keyFiles?: KeyFilesBlock;
  /** When > 0, the unreachable callout notes these match the dead-code findings. */
  deadCodeCount?: number;
  ctx?: PrContext;
};

export function renderArchitecture(input: ArchitectureInput): string | null {
  const { prScope, arch, business, keyFiles, ctx } = input;
  const unreachable = prScope.unreachable_changes;
  const dataStructures = arch?.data_structures ?? [];

  const nothing =
    unreachable.length === 0 &&
    dataStructures.length === 0 &&
    !archMermaid(arch) &&
    !business?.mermaid &&
    !keyFiles?.mermaid;
  if (nothing) return null;

  const lines: string[] = ['## 🏗 Architecture', ''];

  // unreachable callout
  if (unreachable.length > 0) {
    const links = unreachable.slice(0, MAX_UNREACHABLE_LINKED).map((f) => fileLink(ctx, f, undefined, basenameOf(f)));
    const more = unreachable.length > MAX_UNREACHABLE_LINKED ? `, *…+${unreachable.length - MAX_UNREACHABLE_LINKED} more*` : '';
    const note = (input.deadCodeCount ?? 0) > 0 ? ' (These match the dead-code suggestions below.)' : '';
    lines.push(
      `> **${int(unreachable.length)} changed ${plural(unreachable.length, 'file')} ${unreachable.length === 1 ? 'is' : 'are'} unreachable** ` +
        `from any entry point — likely dead code, config, or tests: ${links.join(', ')}${more}.${note}`,
      '',
    );
  }

  // collapsible diagrams + tables (blank line between siblings so each renders)
  const details: string[] = [];
  const pair = beforeAfterPair(arch);
  if (pair) {
    // Two separate mermaid blocks (BEFORE + AFTER) is the post-fix layout:
    // each diagram is a small, self-contained graph instead of one combined
    // chart with cross-subgraph edges that GitHub's mermaid frequently
    // fails to lay out. The legacy `combined_mermaid` is still accepted as
    // a single-block fallback for older scanner builds.
    const anonNote =
      '> Nodes labelled `anon ‹file:line›` are anonymous functions/callbacks (arrows, lambdas, closures) the profiler could not name; the `file:line` marks where each is defined. A file-level entry shows as its filename.';
    const inner: string[] = [];
    if ('combined' in pair) {
      // Legacy single-chart shape — no "two charts" preamble (that would
      // be a lie). Just the anonymous-callable note and the diagram.
      inner.push(anonNote, '', '```mermaid', pair.combined, '```');
    } else {
      inner.push(
        '> **🔴 BEFORE** reconstructs the call graph as it existed pre-PR (`status=added` files skipped, `status=removed` files appear as red placeholder cards). **🟢 AFTER** shows the current call graph with file-status colouring (🟩 added, 🟧 modified/renamed).',
        anonNote,
        '',
        '**🔴 BEFORE — what the code was:**',
        '',
        '```mermaid',
        pair.before,
        '```',
        '',
        '**🟢 AFTER — what the code is now:**',
        '',
        '```mermaid',
        pair.after,
        '```',
      );
    }
    inner.push('', '[Mermaid flowchart reference](https://mermaid.js.org/syntax/flowchart.html)');
    details.push(detailsBlock('🧭 Architecture flow diagram — before vs after', inner));
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

function archMermaid(arch?: ArchitectureFlow): string | null {
  return arch?.combined_mermaid ?? arch?.after_mermaid ?? arch?.before_mermaid ?? null;
}

/**
 * Pick how to render the architecture flow:
 *   • If BOTH `before_mermaid` AND `after_mermaid` are non-empty
 *     (post-fix scanner output), return them as a {before, after}
 *     pair → renderer emits TWO mermaid blocks.
 *   • Otherwise fall back to whatever single diagram is available
 *     (`combined_mermaid` first, then either standalone) →
 *     renderer emits ONE block. The discriminator (`'combined' in pair`)
 *     keeps the rendering logic branch-free.
 *
 * Trimming guards against the scanner emitting a literal "" (no
 * diagram) which would otherwise pass the existence check and emit
 * an empty mermaid fence.
 */
function beforeAfterPair(
  arch?: ArchitectureFlow,
): { before: string; after: string } | { combined: string } | null {
  const before = arch?.before_mermaid?.trim();
  const after = arch?.after_mermaid?.trim();
  if (before && after) return { before, after };
  const combined = arch?.combined_mermaid?.trim() ?? after ?? before;
  if (combined) return { combined };
  return null;
}

function detailsBlock(summary: string, inner: string[]): string {
  return ['<details>', `<summary>${summary}</summary>`, '', ...inner, '', '</details>'].join('\n');
}

function basenameOf(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}
