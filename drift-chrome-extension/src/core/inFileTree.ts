// The IN-FILE TREE — the file's own tree-sitter symbols as a containment TREE
// (file → top-level functions/classes → methods), each classed CHANGED vs UNCHANGED.
//
// SINGLE RESPONSIBILITY: turn a changed file's tree-sitter symbols (the scanner's
// `pr_symbols`) PLUS the new-side lines its diff touched into a {@link FileGraph} the
// existing layout + view render. This is the "third level" of the change-impact
// diagram: when a file isn't wired into the cross-file call graph (the common
// "changed — no call edges" case), this still shows WHAT inside the file changed.
//
// No new profiler command needed — tree-sitter symbols already ship in `pr_symbols`,
// and "what changed" is the intersection of each symbol's line span with the diff's
// added lines. Pure + unit-tested.

import { scopeToFile, type FileGraph, type GraphClassDef, type GraphEdge, type GraphNode } from './changeImpactGraph';

/** A file's tree-sitter symbol (the `pr_symbols` shape). */
export interface TreeSymbol {
  name: string;
  kind: string;
  line: number;
  end_line: number;
  /** Enclosing class/type name when this is a method. */
  parent?: string;
}

/** The minimal diff-hunk shape (structurally compatible with prDiff.DiffHunk). */
export interface DiffHunkLite {
  header: string;
  lines: Array<{ type: 'add' | 'del' | 'context'; text: string }>;
}

/** Whole-file tree-sitter roots — never a useful "symbol" node. */
const MODULE_KINDS = new Set(['module', 'program', 'source_file', 'translation_unit']);
const CLASS_KINDS = new Set(['class', 'interface', 'struct', 'enum', 'trait']);
const basename = (p: string): string => p.split('/').pop() ?? p;

/** The diagram's class legend — added/changed/removed plus UNCHANGED (muted), so the
 *  in-file tree can show what stayed the same alongside what changed. */
export const TREE_CLASS_DEFS: GraphClassDef[] = [
  { name: 'added', fill: '#15391f', stroke: '#3fb950', color: '#fff' },
  { name: 'changed', fill: '#3a2e08', stroke: '#d29922', color: '#fff' },
  { name: 'removed', fill: '#3a1416', stroke: '#f85149', color: '#fff' },
  { name: 'unchanged', fill: '#161d2b', stroke: '#5a6577', color: '#aeb6c2' },
];

/** The change-class a file's TOUCHED symbols inherit (from the file's diff status). */
function fileClassFor(code: string | undefined): string {
  return code === 'A' ? 'added' : code === 'D' ? 'removed' : 'changed';
}

/** The NEW-side line numbers a unified diff ADDS — the file's changed lines. (A pure
 *  deletion adds nothing, so a delete-only symbol reads as unchanged; modifications,
 *  which replace a line, are caught by the added side.) Pure. */
export function changedNewLinesFromHunks(hunks: DiffHunkLite[] | undefined): Set<number> {
  const changed = new Set<number>();
  for (const h of hunks ?? []) {
    const m = /\+(\d+)/.exec(h.header ?? '');
    if (!m) continue;
    let n = Number(m[1]);
    for (const ln of h.lines ?? []) {
      if (ln.type === 'add') changed.add(n++);
      else if (ln.type === 'context') n++;
      // 'del' — no new-side line, doesn't advance the counter
    }
  }
  return changed;
}

/** Does any changed line fall within [start, end]? Iterates the (bounded) changed set. */
function spanTouched(changed: Set<number>, start: number, end: number): boolean {
  for (const l of changed) if (l >= start && l <= end) return true;
  return false;
}

export interface InFileTreeInput {
  path: string;
  /** The file's diff status code (A/M/R/C) — colors the file root + touched symbols. */
  changeCode?: string;
  symbols: TreeSymbol[];
  /** New-side changed line numbers; empty/undefined → every symbol is treated as changed
   *  (we know the file changed, just not which lines — e.g. its diff wasn't cached). */
  changedLines?: Set<number>;
  /** Breadth cap — keep the change + this many nearest symbols (legibility). */
  maxNodes?: number;
}

/** Build the file's in-file symbol TREE: a file-root node with every real symbol beneath
 *  it (methods nested under their class), each classed changed vs unchanged from the diff.
 *  Seeds = the changed symbols (scope level 0 — what the diagram zooms in on). Returns null
 *  when the file exposes no real symbols (caller then falls back to the call graph). Pure. */
export function buildInFileTree(input: InFileTreeInput): FileGraph | null {
  const real = input.symbols.filter((s) => s.name && !s.name.startsWith('<') && !MODULE_KINDS.has(s.kind));
  if (!real.length) return null;

  const changed = input.changedLines;
  const touched = (s: TreeSymbol): boolean => !changed || changed.size === 0 || spanTouched(changed, s.line, s.end_line);
  const fileCls = fileClassFor(input.changeCode);

  const rootId = `file:${input.path}`;
  const nodes: GraphNode[] = [{ id: rootId, label: basename(input.path), cls: fileCls }];
  const ids: string[] = [];
  const classNodeId = new Map<string, string>();
  const seeds: string[] = [];

  real.forEach((s, i) => {
    const id = `sym:${i}:${s.name}`;
    ids.push(id);
    const isChanged = touched(s);
    nodes.push({ id, label: s.name, cls: isChanged ? fileCls : 'unchanged' });
    if (isChanged) seeds.push(id);
    if (CLASS_KINDS.has(s.kind)) classNodeId.set(s.name, id);
  });

  // Containment edges: a method hangs off its class node; everything else off the file root.
  const edges: GraphEdge[] = real.map((s, i) => ({ from: (s.parent && classNodeId.get(s.parent)) || rootId, to: ids[i] }));

  if (!seeds.length) seeds.push(rootId); // nothing read as changed → center the timeline on the file

  const full: FileGraph = { direction: 'LR', nodes, edges, classDefs: TREE_CLASS_DEFS, seeds };
  // Keep the change + its nearest symbols so a huge file stays legible (depth is naturally
  // shallow for a containment tree; the cap is really on breadth).
  return scopeToFile(full, seeds, { maxDepth: 99, maxNodes: input.maxNodes ?? 60 });
}
