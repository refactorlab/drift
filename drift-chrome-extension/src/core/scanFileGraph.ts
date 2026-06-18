// Bridge: derive a FILE's change-impact diagram from a cached scan record's payload.
//
// SINGLE RESPONSIBILITY: glue the scan shape (scanOutput) to the pure graph builders.
// PRIMARY view = the IN-FILE tree-sitter TREE (inFileTree) — the file's own symbols,
// classed changed vs unchanged from its diff — because it's the "scope of the file" and
// is always available for a changed file with symbols (the screenshot's "changed — no
// call edges" file now shows its real internal structure). FALLBACK = the cross-file
// CALL graph (changeImpactGraph) when the file exposes no tree-sitter symbols. Pure +
// unit-tested; keeps the graph domain decoupled from the scan record.

import { asScanOutput, type FileDiff, type PrSymbol, type ScanOutput } from './scanOutput';
import { buildFileGraph, type FileGraph, type ScopeOpts } from './changeImpactGraph';
import { buildInFileTree, changedNewLinesFromHunks } from './inFileTree';

/** Whole-file tree-sitter roots / synthetic closures — useless as diagram nodes. */
const MODULE_KINDS = new Set(['module', 'program', 'source_file', 'translation_unit']);

/** Path-boundary-safe lookup (exact, then "/"-suffix) shared by the symbol + diff
 *  lookups — the leading "/" stops a bare basename matching many files. */
function matchPath<T extends { path: string }>(list: T[], path: string): T | undefined {
  return list.find((x) => x.path === path) ?? list.find((x) => x.path.endsWith('/' + path) || path.endsWith('/' + x.path));
}

/** The file's REAL tree-sitter symbols from `pr_symbols` (synthetic `<…>` / module
 *  roots dropped). */
function symbolsForPath(scan: ScanOutput | null, path: string): PrSymbol[] {
  const hit = matchPath(scan?.pr_symbols ?? [], path);
  return (hit?.symbols ?? []).filter((s) => !s.name.startsWith('<') && !MODULE_KINDS.has(s.kind));
}

/** The file's literal diff (the `+/-` hunks) from `pr_diff`, or undefined. */
function fileDiffForPath(scan: ScanOutput | null, path: string): FileDiff | undefined {
  return matchPath(scan?.pr_diff?.files ?? [], path);
}

/** The file-scoped change-impact graph for `path`, from a cached scan record's payload
 *  (`rec.scan`). Null when neither the in-file tree nor the call graph can be built —
 *  the caller then renders the message without a diagram. */
export function fileGraphFromScan(scan: unknown, path: string, opts?: ScopeOpts): FileGraph | null {
  const s = asScanOutput(scan);

  // PRIMARY — the in-file tree-sitter tree (what changed INSIDE this file).
  const symbols = symbolsForPath(s, path);
  if (symbols.length) {
    const fd = fileDiffForPath(s, path);
    const tree = buildInFileTree({
      path,
      changeCode: fd?.status,
      symbols,
      changedLines: fd ? changedNewLinesFromHunks(fd.hunks) : undefined,
    });
    if (tree) return tree;
  }

  // FALLBACK — the cross-file call graph (when the file has no tree-sitter symbols,
  // e.g. an unsupported language).
  const structured = s?.pr_review?.architecture_flow?.diff_merged_structured;
  if (!structured) return null;
  return buildFileGraph(structured, { path, symbolNames: symbols.map((x) => x.name) }, opts);
}
