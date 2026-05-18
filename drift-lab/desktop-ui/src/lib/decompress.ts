/**
 * Compact wire-format decoder for the desktop UI.
 *
 * Mirrors `viewer/src/decompress.ts` in the static-profiler viewer, but
 * targets the slimmer `Report` shape declared in
 * `components/scan-summary/types.ts` (summary + entry headers only —
 * no recursive `children`). The Tauri backend now emits the compact
 * 1.1 envelope on the IPC wire (`load_static_scan*`) AND from the
 * embedded HTTP server, so this decoder runs every time we receive
 * a stored-scan envelope.
 *
 * The detection rule: a compact envelope has top-level `string_table`
 * AND `frames`. Anything else is the legacy 1.0 inline form and
 * passes through unchanged.
 */

import type {
  CallTreeEntry,
  CategoryRollup,
  CategoryTopEntry,
  FindingTopRef,
  ImmediateFix,
  RankedByScore,
  RefactorCandidate,
  Report,
  Summary,
} from "../components/scan-summary/types";

interface Frame {
  /** string_table index of the short name (e.g. `save`) */
  name: number;
  /** string_table index of the file path */
  file: number;
  /** 1-based definition line */
  line: number;
  /** string_table index of the enclosing class/module (0 = none) */
  parent_class?: number;
  /** 0 Function, 1 Method, 2 Class */
  kind: number;
  /** string_table index of a non-canonical id (omitted when canonical) */
  id?: number;
}

interface CompactCallTreeNode {
  frame: number;
  subtree_size: number;
}

interface CompactRankedByScore { frame: number; score: number }
interface CompactFindingTopRef {
  frame: number;
  kind: string;
  severity: string;
  line: number;
}
interface CompactCategoryTopEntry {
  frame: number;
  line: number;
  kind: string;
  severity: string;
  confidence: number;
  rule?: number;
  message: number;
  originating_orm?: number;
}
interface CompactImmediateFix {
  frame: number;
  kind: string;
  severity: string;
  effort: string;
  message: number;
}
interface CompactRefactorCandidate {
  frame: number;
  findings_count: number;
  kinds: string[];
  worst_severity: string;
  max_effort: string;
  complexity: number;
  loc: number;
  percent_total: number;
  why: number;
}

interface CompactSummary {
  languages: string[];
  files: number;
  symbols: number;
  edges: number;
  categories: Record<string, number>;
  pagerank_top?: CompactRankedByScore[];
  findings_by_kind?: Record<string, number>;
  findings_top?: CompactFindingTopRef[];
  findings_by_category?: Record<string, CategoryRollup>;
  findings_by_orm_family?: Record<string, number>;
  findings_top_by_category?: Record<string, CompactCategoryTopEntry[]>;
  immediate_fixes?: CompactImmediateFix[];
  refactor_candidates?: CompactRefactorCandidate[];
  language_breakdown?: unknown[];
  profiled_language?: string | null;
  profiled_language_percent?: number | null;
}

interface CompactReport {
  schema_version: string;
  mode: string;
  generator?: Report["generator"];
  string_table: string[];
  frames: Frame[];
  summary: CompactSummary;
  entries: CompactCallTreeNode[];
}

/** Convert a wire `report` value (whatever the backend sent — could be
 *  legacy 1.0 inline or compact 1.1 interned) into the simplified
 *  `Report` shape the desktop summary cards consume. */
export function decompressReport(raw: unknown): Report {
  if (!isCompactReport(raw)) {
    return raw as Report;
  }
  const c = raw as CompactReport;
  // Mirror the Rust encoder: frames whose canonical id is
  // `{source_root}/{file}::{parent_class}::{name}` get their `id` slot
  // elided. Rebuild using `generator.source_root` as the prefix.
  const sourceRootPrefix = (c.generator?.source_root ?? "").replace(/\/+$/, "");
  const ctx: Ctx = {
    strings: c.string_table ?? [],
    frames: c.frames ?? [],
    sourceRootPrefix,
  };
  return {
    generator: c.generator,
    summary: expandSummary(c.summary, ctx),
    entries: (c.entries ?? []).map((n) => expandEntryHeader(n, ctx)),
  };
}

function isCompactReport(raw: unknown): boolean {
  return (
    !!raw &&
    typeof raw === "object" &&
    Array.isArray((raw as Record<string, unknown>).string_table) &&
    Array.isArray((raw as Record<string, unknown>).frames) &&
    Array.isArray((raw as Record<string, unknown>).entries)
  );
}

interface Ctx {
  strings: string[];
  frames: Frame[];
  sourceRootPrefix: string;
}

function s(ctx: Ctx, ix: number | undefined): string {
  if (ix === undefined || ix === null) return "";
  return ctx.strings[ix] ?? "";
}

function sOpt(ctx: Ctx, ix: number | undefined): string | null {
  if (ix === undefined || ix === null) return null;
  const v = ctx.strings[ix];
  return v && v.length > 0 ? v : null;
}

function frame(ctx: Ctx, ix: number): Frame {
  return ctx.frames[ix] ?? { name: 0, file: 0, line: 0, parent_class: 0, kind: 0, id: 0 };
}

/** Same reconstruction rule as the Rust encoder: when `frame.id` is
 *  absent or 0, rebuild as `{source_root}/{file}::{parent_class}::{name}`
 *  (matching `graph::SymbolId::for_symbol`). Sidecar-style encodings
 *  with no `source_root` omit the prefix. */
function frameId(ctx: Ctx, f: Frame): string {
  if (f.id && f.id !== 0) return s(ctx, f.id);
  const file = s(ctx, f.file);
  const parent = s(ctx, f.parent_class);
  const name = s(ctx, f.name);
  if (ctx.sourceRootPrefix.length === 0) {
    return `${file}::${parent}::${name}`;
  }
  return `${ctx.sourceRootPrefix}/${file}::${parent}::${name}`;
}

function expandEntryHeader(n: CompactCallTreeNode, ctx: Ctx): CallTreeEntry {
  const f = frame(ctx, n.frame);
  return {
    id: frameId(ctx, f),
    name: s(ctx, f.name),
    file: s(ctx, f.file),
    line: f.line,
    subtree_size: n.subtree_size,
    parent_class: sOpt(ctx, f.parent_class),
  };
}

function expandSummary(c: CompactSummary, ctx: Ctx): Summary {
  return {
    languages: c.languages,
    files: c.files,
    symbols: c.symbols,
    edges: c.edges,
    categories: c.categories,
    pagerank_top: c.pagerank_top?.map((r) => expandRankedByScore(r, ctx)),
    findings_by_kind: c.findings_by_kind,
    findings_top: c.findings_top?.map((t) => expandFindingTopRef(t, ctx)),
    findings_by_category: c.findings_by_category,
    findings_by_orm_family: c.findings_by_orm_family,
    findings_top_by_category: c.findings_top_by_category
      ? Object.fromEntries(
          Object.entries(c.findings_top_by_category).map(([k, v]) => [
            k,
            v.map((e) => expandCategoryTopEntry(e, ctx)),
          ]),
        )
      : undefined,
    immediate_fixes: c.immediate_fixes?.map((i) => expandImmediateFix(i, ctx)),
    refactor_candidates: c.refactor_candidates?.map((r) =>
      expandRefactorCandidate(r, ctx),
    ),
    language_breakdown: c.language_breakdown as Summary["language_breakdown"],
    profiled_language: c.profiled_language ?? undefined,
    profiled_language_percent: c.profiled_language_percent ?? undefined,
  };
}

function expandRankedByScore(r: CompactRankedByScore, ctx: Ctx): RankedByScore {
  const f = frame(ctx, r.frame);
  return {
    name: s(ctx, f.name),
    file: s(ctx, f.file),
    line: f.line,
    parent_class: sOpt(ctx, f.parent_class),
    score: r.score,
  };
}

function expandFindingTopRef(t: CompactFindingTopRef, ctx: Ctx): FindingTopRef {
  const f = frame(ctx, t.frame);
  return {
    node_id: frameId(ctx, f),
    kind: t.kind as FindingTopRef["kind"],
    severity: t.severity as FindingTopRef["severity"],
    line: t.line,
  };
}

function expandCategoryTopEntry(
  e: CompactCategoryTopEntry,
  ctx: Ctx,
): CategoryTopEntry {
  const f = frame(ctx, e.frame);
  return {
    node_id: frameId(ctx, f),
    file: s(ctx, f.file),
    line: e.line,
    kind: e.kind,
    severity: e.severity as CategoryTopEntry["severity"],
    confidence: e.confidence,
    rule: sOpt(ctx, e.rule) ?? undefined,
    message: s(ctx, e.message),
    originating_orm: sOpt(ctx, e.originating_orm) ?? undefined,
  };
}

function expandImmediateFix(i: CompactImmediateFix, ctx: Ctx): ImmediateFix {
  const f = frame(ctx, i.frame);
  return {
    node_id: frameId(ctx, f),
    name: s(ctx, f.name),
    file: s(ctx, f.file),
    line: f.line,
    parent_class: sOpt(ctx, f.parent_class),
    kind: i.kind as ImmediateFix["kind"],
    severity: i.severity as ImmediateFix["severity"],
    effort: i.effort as ImmediateFix["effort"],
    message: s(ctx, i.message),
  };
}

function expandRefactorCandidate(
  r: CompactRefactorCandidate,
  ctx: Ctx,
): RefactorCandidate {
  const f = frame(ctx, r.frame);
  return {
    node_id: frameId(ctx, f),
    name: s(ctx, f.name),
    file: s(ctx, f.file),
    line: f.line,
    parent_class: sOpt(ctx, f.parent_class),
    findings_count: r.findings_count,
    kinds: r.kinds as RefactorCandidate["kinds"],
    worst_severity: r.worst_severity as RefactorCandidate["worst_severity"],
    max_effort: r.max_effort as RefactorCandidate["max_effort"],
    complexity: r.complexity,
    loc: r.loc,
    percent_total: r.percent_total,
    why: s(ctx, r.why),
  };
}
