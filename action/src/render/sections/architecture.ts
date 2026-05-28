// 🏗 Architecture & reach — one section that answers "what does this PR touch,
// and who depends on it?". Merges what used to be four separate sections
// (architecture flow · business logic · affected roots · key files) into the
// template's top-down layout:
//
//   intro     — N entry points reach the change
//   table     — files the most callers depend on (reach count)
//   callout   — changed files unreachable from any entry point (likely dead)
//   <details> — flow diagram · business-logic reach · data structures · mindmap
//
// Every Mermaid block is the scanner's pre-rendered, theme-matched diagram,
// framed verbatim.

import type { PrScope, ArchitectureFlow, BusinessLogic, KeyFilesBlock, DataStructureEntry } from '../../report.ts';
import type { PrContext } from '../context.ts';
import { fileLink } from '../context.ts';
import { int, plural, inlineList, escapeHtml } from '../lib/format.ts';

const MAX_REACH_ROWS = 12;
const MAX_UNREACHABLE_LINKED = 8;
const MAX_ROOTS_INLINE = 12;

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
  const roots = prScope.affected_roots;
  const unreachable = prScope.unreachable_changes;
  const dataStructures = arch?.data_structures ?? [];
  const keyFileRows = flattenKeyFiles(keyFiles);

  const nothing =
    roots.length === 0 &&
    unreachable.length === 0 &&
    dataStructures.length === 0 &&
    keyFileRows.length === 0 &&
    !archMermaid(arch) &&
    !business?.mermaid;
  if (nothing) return null;

  const lines: string[] = ['## 🏗 Architecture & reach', ''];

  // intro + reach table (or an inline root list when there's no key-file data)
  if (roots.length > 0) {
    const reaches = plural(roots.length, 'reaches', 'reach');
    const intro = `**${int(roots.length)}** entry ${plural(roots.length, 'point')} ${reaches} changes in this PR.`;
    if (keyFileRows.length > 0) {
      lines.push(`${intro} The files most callers depend on:`, '');
      lines.push('| File | Roots reaching it |', '|---|---:|');
      for (const row of keyFileRows.slice(0, MAX_REACH_ROWS)) {
        lines.push(`| ${fileLink(ctx, row.path, undefined, row.path)} | ${row.reach === null ? '—' : int(row.reach)} |`);
      }
      lines.push('');
    } else {
      lines.push(intro, '', inlineList(roots, MAX_ROOTS_INLINE), '');
    }
  } else {
    lines.push("No entry point reaches this PR's changes — the change is internal, config, or unreachable.", '');
  }

  // unreachable callout
  if (unreachable.length > 0) {
    const links = unreachable.slice(0, MAX_UNREACHABLE_LINKED).map((f) => fileLink(ctx, f, undefined, basenameOf(f)));
    const more = unreachable.length > MAX_UNREACHABLE_LINKED ? `, *…+${unreachable.length - MAX_UNREACHABLE_LINKED} more*` : '';
    const note = (input.deadCodeCount ?? 0) > 0 ? ' (These match the dead-code suggestions above.)' : '';
    lines.push(
      `> **${int(unreachable.length)} changed ${plural(unreachable.length, 'file')} ${unreachable.length === 1 ? 'is' : 'are'} unreachable** ` +
        `from any entry point — likely dead code, config, or tests: ${links.join(', ')}${more}.${note}`,
      '',
    );
  }

  // collapsible diagrams + tables (blank line between siblings so each renders)
  const details: string[] = [];
  const flow = archMermaid(arch);
  if (flow) {
    details.push(
      detailsBlock('🧭 Architecture flow diagram — before → after', [
        '> Nodes labelled `‹lambda@N›` are anonymous functions/callbacks the profiler could not name; treat them as call sites within their module.',
        '',
        '```mermaid',
        flow,
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

// ── key-file reach table ─────────────────────────────────────────────────────

type ReachRow = { path: string; reach: number | null };

function flattenKeyFiles(kf?: KeyFilesBlock): ReachRow[] {
  const rows: ReachRow[] = [];
  for (const g of kf?.groups ?? []) {
    for (const f of g.files) rows.push({ path: f.path, reach: reachCount(f.why) });
  }
  // Most-depended-on first; unknown reach sinks to the bottom.
  return rows.sort((a, b) => (b.reach ?? -1) - (a.reach ?? -1) || a.path.localeCompare(b.path));
}

/** Parse the leading integer out of "N root(s) reach this file". */
function reachCount(why?: string): number | null {
  const m = (why ?? '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
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

function detailsBlock(summary: string, inner: string[]): string {
  return ['<details>', `<summary>${summary}</summary>`, '', ...inner, '', '</details>'].join('\n');
}

function basenameOf(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}
