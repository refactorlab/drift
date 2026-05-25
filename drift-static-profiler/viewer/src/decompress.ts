// Decoder for the 1.1 interned wire format.
//
// The drift-static-profiler can now emit two report shapes:
//
//   • Legacy 1.0 — every `CallTreeNode` carries inline `name`, `file`,
//     `line`, `parent_class`, `kind`, every `callers[]` row carries the
//     same. Repeating thousands of times on a polyglot scan produces
//     250 MB–1 GB files in the wild.
//
//   • Compact 1.1 — adds top-level `string_table: string[]` and
//     `frames: Frame[]`. Nodes reference frames by `u32`; long strings
//     (file paths, finding messages, SQL literals) are pulled into the
//     string table. Same data, 60–90 % smaller wire / disk.
//
// The viewer keeps its in-memory model on the legacy denormalized shape
// so none of the dozens of render paths (CallTreeView, FlameView,
// Insights, etc.) need to change. This file is the one-time expansion
// pass: take whatever came over the wire, return the canonical
// denormalized `Report` (or `CallTreeNode` for sidecars).
//
// Mirrors `compact::expand` in `drift-static-profiler/src/compact.rs`.
// Field names on the wire are the readable struct names — the same
// strings the encoder used — so each rename here is a two-place edit
// (this file + the Rust struct field).

import type {
  CallTreeNode,
  CallerRef,
  CategoryRollup,
  CategoryTopEntry,
  Category,
  EntryDecl,
  EntryMatch,
  Evidence,
  ExternalCall,
  Finding,
  FindingTopRef,
  HotPath,
  ImmediateFix,
  RefactorCandidate,
  RankedByScore,
  Report,
  RootCalleeSummary,
  RootCallerSummary,
  RootOverview,
  Summary,
  SymbolKind,
  TopSymbol,
} from './types';

// ─── wire shapes (mirror the Rust structs) ───────────────────────────────────

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
  /** string_table index of a non-canonical id. Omitted (= 0) when the
   *  id is the canonical `{file}::{parent_class}::{name}` shape — the
   *  decoder reconstructs it in that case. */
  id?: number;
  // ── Schema v1.2 ("A Few Good Hoists"): symbol-intrinsic fields hoisted
  // off every CallTreeNode onto the Frame so a symbol that appears 35×
  // in a tree stores them once. The reader has to honour the same
  // hoist — `expandNode` below prefers the Frame's value over the
  // node's, mirroring Rust `resolve_findings` / `prefer_frame_*`.
  // Without this, scans written in v1.2 round-trip with empty
  // `findings`, `callers`, zero `complexity`, etc. — the Insights /
  // Smells / Statistics tabs all show "no data" even when the scan has
  // hundreds of findings (visible via the summary aggregate count).
  callers?: number[];
  callers_count?: number;
  callees_count?: number;
  call_site_count?: number;
  complexity?: number;
  loc?: number;
  nesting_depth?: number;
  parameter_count?: number;
  is_async?: boolean;
  is_recursive?: boolean;
  n_plus_one_risk?: boolean;
  blocking_in_async?: boolean;
  pagerank?: number;
  category_self?: number;
  external_calls?: CompactExternalCall[];
  findings?: CompactFinding[];
}

interface CompactReport {
  schema_version: string;
  mode: string;
  generator?: unknown;
  string_table: string[];
  frames: Frame[];
  summary: CompactSummary;
  entries: CompactCallTreeNode[];
}

interface CompactEntryDoc {
  string_table: string[];
  frames: Frame[];
  entry: CompactCallTreeNode;
}

interface CompactCallTreeNode {
  frame: number;
  depth: number;
  children?: CompactCallTreeNode[];
  /** string_table index, 0 = not truncated */
  truncated_reason?: number;
  /** caller frame indices */
  callers?: number[];
  callers_count?: number;
  callees_count?: number;
  subtree_size: number;
  /** category byte, 0 none, 1..=7 Category */
  category_self?: number;
  categories_reached?: Record<string, number>;
  external_calls?: CompactExternalCall[];
  complexity?: number;
  loc?: number;
  nesting_depth?: number;
  parameter_count?: number;
  is_async?: boolean;
  call_site_count?: number;
  is_recursive?: boolean;
  pagerank?: number;
  percent_total?: number;
  percent_parent?: number;
  n_plus_one_risk?: boolean;
  blocking_in_async?: boolean;
  findings?: CompactFinding[];
  /** entry-label string_table indices */
  entry_labels?: number[];
}

interface CompactExternalCall {
  name: number;
  receiver?: number;
  category: number;
  tier: number;
  evidence?: number;
  line: number;
  in_loop?: boolean;
  in_await?: boolean;
  sql_literal?: number;
}

interface CompactFinding {
  kind: string;
  severity: string;
  effort: string;
  confidence: number;
  line: number;
  message: number;
  evidence?: CompactEvidence[];
  remediation?: number;
  byte_range?: { start: number; end: number };
  fidelity?: string;
  fusion_paths?: number[];
  predicted_sql?: number;
  originating_orm?: number;
}

interface CompactEvidence {
  call: number;
  line: number;
  category?: number;
}

interface CompactSummary {
  languages: string[];
  files: number;
  symbols: number;
  edges: number;
  categories: Record<string, number>;
  top_callers: CompactTopSymbol[];
  top_callees: CompactTopSymbol[];
  hot_paths: HotPath[];
  dead_code: CompactTopSymbol[];
  pagerank_top: CompactRankedByScore[];
  recursive_symbols: CompactTopSymbol[];
  language_breakdown: unknown[];
  profiled_language?: string | null;
  profiled_language_percent?: number | null;
  findings_by_kind?: Record<string, number>;
  findings_top?: CompactFindingTopRef[];
  roots_overview?: CompactRootOverview[];
  immediate_fixes?: CompactImmediateFix[];
  refactor_candidates?: CompactRefactorCandidate[];
  entry_declarations?: CompactEntryDecl[];
  sql_files_scanned?: number | null;
  sql_files_with_findings?: number | null;
  findings_by_category?: Record<string, CategoryRollup>;
  findings_by_orm_family?: Record<string, number>;
  findings_top_by_category?: Record<string, CompactCategoryTopEntry[]>;
}

interface CompactTopSymbol { frame: number; count: number }
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
interface CompactRootOverview {
  frame: number;
  subtree_size: number;
  percent_of_all_roots: number;
  categories_reached?: Record<string, number>;
  findings_by_severity?: Record<string, number>;
  findings_total: number;
  callers?: number[];
  first_callees?: CompactCalleeSummary[];
}
interface CompactCalleeSummary { frame: number; subtree_size: number }
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
interface CompactEntryDecl {
  file: number;
  line: number;
  kind: string;
  raw: number;
  argv?: number[];
  service?: number;
  workdir?: number;
  matched?: CompactEntryMatch;
}
interface CompactEntryMatch {
  confidence: string;
  frame: number;
  evidence: number;
}

// ─── public entry points ─────────────────────────────────────────────────────

/**
 * Return a denormalized `Report` regardless of whether `raw` is the legacy
 * 1.0 inline form or the new 1.1 interned form. Auto-detected via the
 * presence of `string_table` at the top level. Safe to call on any
 * `r.json()` result that should be a report.
 */
export function decompressReport(raw: unknown): Report {
  if (!isCompactReport(raw)) {
    return raw as Report;
  }
  const c = raw as CompactReport;
  // Match the Rust encoder: frames whose canonical id is
  // `{source_root}/{file}::{parent_class}::{name}` get their `id`
  // field elided. The reader rebuilds it using `generator.source_root`
  // as the prefix.
  const gen = c.generator as { source_root?: string } | undefined;
  const sourceRootPrefix = (gen?.source_root ?? '').replace(/\/+$/, '');
  const ctx: Ctx = {
    strings: c.string_table ?? [],
    frames: c.frames ?? [],
    sourceRootPrefix,
  };
  return {
    generator: c.generator as Report['generator'],
    summary: expandSummary(c.summary, ctx),
    entries: (c.entries ?? []).map((n) => expandNode(n, ctx)),
  };
}

/**
 * Return a denormalized `CallTreeNode` regardless of whether `raw` is a
 * legacy bare-node sidecar or the new 1.1 `CompactEntryDoc` envelope.
 * Per-entry sidecars don't carry a source-root prefix; encoder side
 * always stores `id` explicitly for non-canonical forms so this is
 * lossless.
 */
export function decompressEntry(raw: unknown): CallTreeNode {
  if (!isCompactEntryDoc(raw)) {
    return raw as CallTreeNode;
  }
  const doc = raw as CompactEntryDoc;
  const ctx: Ctx = {
    strings: doc.string_table ?? [],
    frames: doc.frames ?? [],
    sourceRootPrefix: '',
  };
  return expandNode(doc.entry, ctx);
}

function isCompactReport(raw: unknown): boolean {
  return (
    !!raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as Record<string, unknown>).string_table) &&
    Array.isArray((raw as Record<string, unknown>).frames) &&
    Array.isArray((raw as Record<string, unknown>).entries)
  );
}

function isCompactEntryDoc(raw: unknown): boolean {
  return (
    !!raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as Record<string, unknown>).string_table) &&
    Array.isArray((raw as Record<string, unknown>).frames) &&
    !!(raw as Record<string, unknown>).entry
  );
}

// ─── shared context + lookups ────────────────────────────────────────────────

interface Ctx {
  strings: string[];
  frames: Frame[];
  /** Source-root prefix shared by `graph::SymbolId`s in this report.
   *  Empty for per-entry sidecars (they store any non-canonical id
   *  explicitly). */
  sourceRootPrefix: string;
}

function s(ctx: Ctx, ix: number | undefined): string {
  if (ix === undefined || ix === null) return '';
  return ctx.strings[ix] ?? '';
}

/** String-table lookup that returns null when the slot is empty.
 *  Matches the Rust convention: index 0 = "" = `None`. */
function sOpt(ctx: Ctx, ix: number | undefined): string | null {
  if (ix === undefined || ix === null) return null;
  const v = ctx.strings[ix];
  return v && v.length > 0 ? v : null;
}

function frame(ctx: Ctx, ix: number): Frame {
  return ctx.frames[ix] ?? { name: 0, file: 0, line: 0, parent_class: 0, kind: 0, id: 0 };
}

/** Reconstruct the canonical symbol id from a frame. Mirrors
 *  `frame_id` on the Rust side — non-canonical ids (synthetic
 *  `.sql`-file nodes etc.) carry their own `id` slot; canonical ones
 *  are rebuilt as `{prefix/}{file}::{parent_class}::{name}` where
 *  `prefix` is `generator.source_root` (empty for sidecars). */
function frameId(ctx: Ctx, f: Frame): string {
  if (f.id && f.id !== 0) return s(ctx, f.id);
  const file = s(ctx, f.file);
  const parent = s(ctx, f.parent_class);
  const name = s(ctx, f.name);
  if (ctx.sourceRootPrefix.length > 0) {
    return `${ctx.sourceRootPrefix}/${file}::${parent}::${name}`;
  }
  return `${file}::${parent}::${name}`;
}

const KINDS: SymbolKind[] = ['Function', 'Method', 'Class'];
function kindFromByte(b: number): SymbolKind {
  return KINDS[b] ?? 'Function';
}

const CATEGORIES: (Category | null)[] = [
  null,        // 0
  'db',        // 1
  'network',   // 2
  'io',        // 3
  'cache',     // 4
  'queue',     // 5
  'log',       // 6
  'compute',   // 7
];
function categoryFromByte(b: number | undefined): Category | null {
  if (!b) return null;
  return CATEGORIES[b] ?? null;
}

const TIERS = [
  'imported_module' as const,
  'receiver_pattern' as const,
  'method_signature' as const,
];
function tierFromByte(b: number): 'imported_module' | 'receiver_pattern' | 'method_signature' {
  return TIERS[b] ?? 'imported_module';
}

// ─── node expansion ──────────────────────────────────────────────────────────

function expandNode(n: CompactCallTreeNode, ctx: Ctx): CallTreeNode {
  const f = frame(ctx, n.frame);
  const parent = sOpt(ctx, f.parent_class);
  // For every v1.2-hoisted intrinsic, prefer the Frame's value when it's
  // non-default (= came from a 1.2 file); fall back to the node's own
  // value (1.1). Mirrors Rust `prefer_frame_*` / `resolve_*` helpers
  // exactly so a sidecar round-tripped through `to_compact_entry` lands
  // on the JS side with the SAME data the Rust reader would see.
  const frameCallers = f.callers && f.callers.length > 0 ? f.callers : n.callers;
  const frameExternals = f.external_calls && f.external_calls.length > 0
    ? f.external_calls
    : n.external_calls;
  const frameFindings = f.findings && f.findings.length > 0 ? f.findings : n.findings;
  const preferNum = (frameV: number | undefined, nodeV: number | undefined): number =>
    frameV && frameV !== 0 ? frameV : nodeV ?? 0;
  const preferBool = (frameV: boolean | undefined, nodeV: boolean | undefined): boolean =>
    !!frameV || !!nodeV;
  const preferCategoryByte = (
    frameV: number | undefined,
    nodeV: number | undefined,
  ): number | undefined => (frameV && frameV !== 0 ? frameV : nodeV);
  return {
    id: frameId(ctx, f),
    name: s(ctx, f.name),
    kind: kindFromByte(f.kind),
    file: s(ctx, f.file),
    line: f.line,
    depth: n.depth,
    parent_class: parent,
    children: (n.children ?? []).map((c) => expandNode(c, ctx)),
    truncated_reason: sOpt(ctx, n.truncated_reason) ?? null,
    callers: (frameCallers ?? []).map((cix) => expandCallerRef(cix, ctx)),
    callers_count: preferNum(f.callers_count, n.callers_count),
    callees_count: preferNum(f.callees_count, n.callees_count),
    subtree_size: n.subtree_size,
    category_self: categoryFromByte(preferCategoryByte(f.category_self, n.category_self)),
    categories_reached: n.categories_reached ?? {},
    external_calls: (frameExternals ?? []).map((x) => expandExternalCall(x, ctx)),
    complexity: preferNum(f.complexity, n.complexity),
    loc: preferNum(f.loc, n.loc),
    nesting_depth: preferNum(f.nesting_depth, n.nesting_depth),
    parameter_count: preferNum(f.parameter_count, n.parameter_count),
    is_async: preferBool(f.is_async, n.is_async),
    call_site_count: preferNum(f.call_site_count, n.call_site_count),
    is_recursive: preferBool(f.is_recursive, n.is_recursive),
    pagerank: preferNum(f.pagerank, n.pagerank),
    percent_total: n.percent_total ?? 0,
    percent_parent: n.percent_parent ?? 0,
    n_plus_one_risk: preferBool(f.n_plus_one_risk, n.n_plus_one_risk),
    blocking_in_async: preferBool(f.blocking_in_async, n.blocking_in_async),
    findings: (frameFindings ?? []).map((fd) => expandFinding(fd, ctx)),
    entry_labels: (n.entry_labels ?? []).map((ix) => s(ctx, ix)),
  };
}

function expandCallerRef(ix: number, ctx: Ctx): CallerRef {
  const f = frame(ctx, ix);
  return {
    id: frameId(ctx, f),
    name: s(ctx, f.name),
    file: s(ctx, f.file),
    line: f.line,
    parent_class: sOpt(ctx, f.parent_class),
  };
}

function expandExternalCall(x: CompactExternalCall, ctx: Ctx): ExternalCall {
  const cat = categoryFromByte(x.category) ?? 'compute';
  const sqlLiteral = sOpt(ctx, x.sql_literal);
  const call: ExternalCall = {
    name: s(ctx, x.name),
    receiver: sOpt(ctx, x.receiver),
    category: cat,
    tier: tierFromByte(x.tier),
    evidence: s(ctx, x.evidence),
    line: x.line,
    in_loop: !!x.in_loop,
    in_await: !!x.in_await,
  };
  // `sql_literal` isn't on the TS ExternalCall type, but keep it on the
  // resulting object so any future consumer that does read it (the SQL
  // inspector) sees the rehydrated value. Cast at the boundary.
  if (sqlLiteral) (call as ExternalCall & { sql_literal: string }).sql_literal = sqlLiteral;
  return call;
}

function expandFinding(f: CompactFinding, ctx: Ctx): Finding {
  return {
    kind: f.kind as Finding['kind'],
    severity: f.severity as Finding['severity'],
    effort: f.effort as Finding['effort'],
    confidence: f.confidence,
    line: f.line,
    message: s(ctx, f.message),
    evidence: (f.evidence ?? []).map((e) => expandEvidence(e, ctx)),
    remediation: sOpt(ctx, f.remediation) ?? undefined,
  };
}

function expandEvidence(e: CompactEvidence, ctx: Ctx): Evidence {
  const cat = categoryFromByte(e.category);
  const out: Evidence = {
    call: s(ctx, e.call),
    line: e.line,
  };
  if (cat) out.category = cat;
  return out;
}

// ─── summary expansion ───────────────────────────────────────────────────────

function expandSummary(c: CompactSummary, ctx: Ctx): Summary {
  return {
    languages: c.languages,
    files: c.files,
    symbols: c.symbols,
    edges: c.edges,
    categories: c.categories,
    top_callers: c.top_callers.map((t) => expandTopSymbol(t, ctx)),
    top_callees: c.top_callees.map((t) => expandTopSymbol(t, ctx)),
    hot_paths: c.hot_paths,
    dead_code: c.dead_code.map((t) => expandTopSymbol(t, ctx)),
    pagerank_top: c.pagerank_top.map((r) => expandRankedByScore(r, ctx)),
    recursive_symbols: c.recursive_symbols.map((t) => expandTopSymbol(t, ctx)),
    language_breakdown: c.language_breakdown as Summary['language_breakdown'],
    profiled_language: c.profiled_language ?? undefined,
    profiled_language_percent: c.profiled_language_percent ?? undefined,
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
    roots_overview: c.roots_overview?.map((r) => expandRootOverview(r, ctx)),
    immediate_fixes: c.immediate_fixes?.map((i) => expandImmediateFix(i, ctx)),
    refactor_candidates: c.refactor_candidates?.map((r) =>
      expandRefactorCandidate(r, ctx),
    ),
    entry_declarations: c.entry_declarations?.map((d) => expandEntryDecl(d, ctx)),
  };
}

function expandTopSymbol(t: CompactTopSymbol, ctx: Ctx): TopSymbol {
  const f = frame(ctx, t.frame);
  return {
    name: s(ctx, f.name),
    file: s(ctx, f.file),
    line: f.line,
    parent_class: sOpt(ctx, f.parent_class),
    count: t.count,
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
    kind: t.kind as FindingTopRef['kind'],
    severity: t.severity as FindingTopRef['severity'],
    line: t.line,
  };
}

function expandCategoryTopEntry(e: CompactCategoryTopEntry, ctx: Ctx): CategoryTopEntry {
  const f = frame(ctx, e.frame);
  return {
    node_id: frameId(ctx, f),
    file: s(ctx, f.file),
    line: e.line,
    kind: e.kind,
    severity: e.severity as CategoryTopEntry['severity'],
    confidence: e.confidence,
    rule: sOpt(ctx, e.rule) ?? undefined,
    message: s(ctx, e.message),
    originating_orm: sOpt(ctx, e.originating_orm) ?? undefined,
  };
}

function expandRootOverview(r: CompactRootOverview, ctx: Ctx): RootOverview {
  const f = frame(ctx, r.frame);
  return {
    node_id: frameId(ctx, f),
    name: s(ctx, f.name),
    file: s(ctx, f.file),
    line: f.line,
    parent_class: sOpt(ctx, f.parent_class),
    kind: kindFromByte(f.kind),
    subtree_size: r.subtree_size,
    percent_of_all_roots: r.percent_of_all_roots,
    // The Rust encoder elides empty BTreeMaps via
    // `skip_serializing_if = "BTreeMap::is_empty"`, so the compact
    // form may carry `categories_reached: undefined`. The legacy
    // (1.0) form always emitted `{}`, so we restore the same
    // invariant here — consumers that iterate the map don't need
    // a `?? {}` fallback to stay safe.
    categories_reached: r.categories_reached ?? {},
    findings_by_severity: r.findings_by_severity ?? {},
    findings_total: r.findings_total,
    callers: (r.callers ?? []).map((cix) => expandRootCallerSummary(cix, ctx)),
    first_callees: (r.first_callees ?? []).map((c) => expandRootCalleeSummary(c, ctx)),
  };
}

function expandRootCallerSummary(ix: number, ctx: Ctx): RootCallerSummary {
  const f = frame(ctx, ix);
  return {
    node_id: frameId(ctx, f),
    name: s(ctx, f.name),
    file: s(ctx, f.file),
    line: f.line,
    parent_class: sOpt(ctx, f.parent_class),
  };
}

function expandRootCalleeSummary(
  c: CompactCalleeSummary,
  ctx: Ctx,
): RootCalleeSummary {
  const f = frame(ctx, c.frame);
  return {
    node_id: frameId(ctx, f),
    name: s(ctx, f.name),
    file: s(ctx, f.file),
    line: f.line,
    parent_class: sOpt(ctx, f.parent_class),
    subtree_size: c.subtree_size,
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
    kind: i.kind as ImmediateFix['kind'],
    severity: i.severity as ImmediateFix['severity'],
    effort: i.effort as ImmediateFix['effort'],
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
    kinds: r.kinds as RefactorCandidate['kinds'],
    worst_severity: r.worst_severity as RefactorCandidate['worst_severity'],
    max_effort: r.max_effort as RefactorCandidate['max_effort'],
    complexity: r.complexity,
    loc: r.loc,
    percent_total: r.percent_total,
    why: s(ctx, r.why),
  };
}

function expandEntryDecl(d: CompactEntryDecl, ctx: Ctx): EntryDecl {
  return {
    file: s(ctx, d.file),
    line: d.line,
    kind: d.kind as EntryDecl['kind'],
    raw: s(ctx, d.raw),
    argv: (d.argv ?? []).map((ix) => s(ctx, ix)),
    service: sOpt(ctx, d.service),
    workdir: sOpt(ctx, d.workdir),
    matched: d.matched ? expandEntryMatch(d.matched, ctx) : undefined,
  };
}

function expandEntryMatch(m: CompactEntryMatch, ctx: Ctx): EntryMatch {
  const f = frame(ctx, m.frame);
  return {
    confidence: m.confidence as EntryMatch['confidence'],
    symbol_id: frameId(ctx, f),
    symbol_name: s(ctx, f.name),
    symbol_file: s(ctx, f.file),
    symbol_line: f.line,
    evidence: s(ctx, m.evidence),
  };
}
