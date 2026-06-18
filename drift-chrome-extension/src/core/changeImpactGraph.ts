// The CHANGE-IMPACT GRAPH domain — pure graph data, no React, no rendering.
//
// SINGLE RESPONSIBILITY: take the scanner's PR-wide structured call graph
// (`architecture_flow.diff_merged_structured`, which already carries nodes +
// edges + class_defs — see scanOutput.MermaidStructured) and SCOPE it to ONE
// file: the file's CHANGED symbols are the "seeds" (the specific part of the
// file), and we walk the call edges OUTWARD — callers upstream, callees
// downstream — to show only that file's blast radius, never the whole PR.
//
// Everything here is pure + unit-tested. The view (ChangeImpactGraph.tsx) and the
// layout (graphLayout.ts) build on these shapes; the handover attaches the result
// to a file's presentation so the diagram travels with the chat message.

import type { MermaidStructured } from './scanOutput';

/** A node in the scoped graph — a function/class/file symbol. */
export interface GraphNode {
  id: string;
  label: string;
  /** Diff status that picks the node's color: 'added' | 'changed' | 'removed' | … */
  cls?: string;
}
/** A directed call edge (`from` calls `to`). */
export interface GraphEdge {
  from: string;
  to: string;
  dashed?: boolean;
}
/** A node-class style (the legend the scanner ships). */
export interface GraphClassDef {
  name: string;
  fill: string;
  stroke: string;
  color: string;
  strokeWidth?: string;
  strokeDasharray?: string;
}
/** A whole or scoped change-impact graph. */
export interface ChangeGraph {
  direction: 'LR' | 'RL' | 'TB' | 'BT';
  nodes: GraphNode[];
  edges: GraphEdge[];
  classDefs: GraphClassDef[];
}
/** A FILE-scoped change-impact graph: the file's blast radius, with the file's own
 *  CHANGED symbols flagged as `seeds` (scope level 0 — the "specific part of the
 *  file" the diagram zooms in on, then zooms out from to the full file scope). */
export interface FileGraph extends ChangeGraph {
  seeds: string[];
}

const DIRECTIONS = new Set(['LR', 'RL', 'TB', 'BT']);
/** Node diff-classes that count as "the change" — the diagram seeds on these. */
const CHANGED_CLASSES = new Set(['added', 'changed', 'removed']);
const basename = (p: string): string => p.split('/').pop() ?? p;

/** Turn the scanner's raw structured flowchart into the internal {@link ChangeGraph}.
 *  Tolerant of missing fields — a partial scan yields a partial graph (never throws). */
export function normalizeFlowchart(s: MermaidStructured | undefined | null): ChangeGraph {
  const direction = (s?.direction && DIRECTIONS.has(s.direction) ? s.direction : 'LR') as ChangeGraph['direction'];
  const nodes: GraphNode[] = (s?.nodes ?? [])
    .filter((n) => n && typeof n.id === 'string')
    .map((n) => ({ id: n.id, label: (n.label ?? n.id).trim(), cls: n.class }));
  const known = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = (s?.edges ?? [])
    .filter((e) => e && known.has(e.from) && known.has(e.to) && e.from !== e.to)
    .map((e) => ({ from: e.from, to: e.to, dashed: e.style === 'dashed' }));
  const classDefs: GraphClassDef[] = (s?.class_defs ?? [])
    .filter((c) => c && typeof c.name === 'string')
    .map((c) => ({ name: c.name, fill: c.fill, stroke: c.stroke, color: c.color, strokeWidth: c.stroke_width, strokeDasharray: c.stroke_dasharray }));
  return { direction, nodes, edges, classDefs };
}

/** The node ids that belong to `path` — matched by the file's tree-sitter symbol
 *  names, its basename, or a basename-substring (MIRRORS fileBriefing's matcher so the
 *  diagram seeds on the SAME file-scoped nodes the Level-1 correlation already trusts).
 *  Prefers the file's CHANGED nodes (the actual diff); falls back to all its nodes when
 *  the graph carries no diff-class. */
export function seedIdsForFile(nodes: GraphNode[], path: string, symbolNames: string[]): string[] {
  const base = basename(path).toLowerCase();
  const syms = new Set(symbolNames.map((s) => s.toLowerCase()));
  const matches = (n: GraphNode): boolean => {
    const l = n.label.toLowerCase();
    return !!l && (syms.has(l) || l === base || (l.length >= 4 && base.includes(l)));
  };
  const fileNodes = nodes.filter(matches);
  const changed = fileNodes.filter((n) => n.cls && CHANGED_CLASSES.has(n.cls));
  return (changed.length ? changed : fileNodes).map((n) => n.id);
}

/** Adjacency lists (forward = callees, reverse = callers). */
function adjacency(edges: GraphEdge[]): { out: Map<string, string[]>; inc: Map<string, string[]> } {
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => (m.get(k) ?? m.set(k, []).get(k)!).push(v);
  for (const e of edges) {
    push(out, e.from, e.to);
    push(inc, e.to, e.from);
  }
  return { out, inc };
}

/** Breadth-first distances from `starts` over `adj` (0 for the starts). Pure. */
function bfs(starts: string[], adj: Map<string, string[]>): Map<string, number> {
  const dist = new Map<string, number>();
  let frontier = [...new Set(starts)];
  for (const s of frontier) dist.set(s, 0);
  let d = 0;
  while (frontier.length) {
    d++;
    const next: string[] = [];
    for (const u of frontier) for (const v of adj.get(u) ?? []) if (!dist.has(v)) (dist.set(v, d), next.push(v));
    frontier = next;
  }
  return dist;
}

/** Each node's SIGNED distance from the seeds: 0 = a seed (the change), +k = k calls
 *  DOWNSTREAM (callees), −k = k calls UPSTREAM (callers). A node reachable both ways
 *  takes its nearer side. Unreachable nodes are absent. This is the layout's column
 *  index AND the scope-timeline's level (|rank|) — callers left, the change centre,
 *  callees right; |rank| is how far you've "zoomed out" from the change. Pure. */
export function signedRanks(nodes: GraphNode[], edges: GraphEdge[], seeds: string[]): Map<string, number> {
  const { out, inc } = adjacency(edges);
  const down = bfs(seeds, out);
  const up = bfs(seeds, inc);
  const rank = new Map<string, number>();
  for (const n of nodes) {
    const dn = down.get(n.id);
    const u = up.get(n.id);
    if (dn == null && u == null) continue;
    if (dn != null && (u == null || dn <= u)) rank.set(n.id, dn);
    else rank.set(n.id, -(u as number));
  }
  return rank;
}

/** Each node's UNDIRECTED distance from the seeds (edges walked both ways): 0 = a seed,
 *  k = k hops away in EITHER direction. This is the scope-RING metric — it includes a
 *  node reachable only via "up then down" (a containment tree's sibling, a call graph's
 *  co-callee), which the directed {@link signedRanks} misses. Used for what's IN scope and
 *  which ring reveals it; the signed rank is kept only for left/right column placement.
 *  Pure. */
export function distancesFrom(nodes: GraphNode[], edges: GraphEdge[], seeds: string[]): Map<string, number> {
  const { out, inc } = adjacency(edges);
  const both = new Map<string, string[]>();
  const add = (k: string, vs: string[]) => both.set(k, [...(both.get(k) ?? []), ...vs]);
  for (const n of nodes) add(n.id, [...(out.get(n.id) ?? []), ...(inc.get(n.id) ?? [])]);
  return bfs(seeds, both);
}

/** Group node ids into scope LEVELS by |rank|: level 0 = the seeds, level k = nodes k
 *  calls away. Drives the "zoom in → zoom out" timeline (reveal one ring per step). */
export function levelsFromRanks(nodes: GraphNode[], rank: Map<string, number>): string[][] {
  const levels: string[][] = [];
  for (const n of nodes) {
    const r = rank.get(n.id);
    if (r == null) continue;
    const k = Math.abs(r);
    (levels[k] ??= []).push(n.id);
  }
  for (let i = 0; i < levels.length; i++) levels[i] ??= [];
  return levels;
}

export interface ScopeOpts {
  /** Max call-distance from the seeds to include (the blast-radius cap). */
  maxDepth?: number;
  /** Hard cap on node count (nearest-to-the-change kept), so the diagram stays legible. */
  maxNodes?: number;
}

/** Induce the FILE-scoped subgraph: keep the seeds and every node within `maxDepth`
 *  calls of them (nearest first, capped at `maxNodes`), plus the edges between kept
 *  nodes. Node order is preserved from the source graph (deterministic). Pure. */
export function scopeToFile(graph: ChangeGraph, seeds: string[], opts: ScopeOpts = {}): FileGraph {
  const { maxDepth = 3, maxNodes = 80 } = opts;
  // UNDIRECTED distance, so a sibling/co-callee reachable only via "up then down" is kept.
  const dist = distancesFrom(graph.nodes, graph.edges, seeds);
  const within = graph.nodes.filter((n) => dist.has(n.id) && dist.get(n.id)! <= maxDepth);
  // Cap by proximity to the change: sort a COPY by distance, take the nearest, then
  // re-filter the original list so the kept nodes keep their source order.
  const nearest = [...within].sort((a, b) => dist.get(a.id)! - dist.get(b.id)!).slice(0, maxNodes);
  const keep = new Set(nearest.map((n) => n.id));
  const nodes = graph.nodes.filter((n) => keep.has(n.id));
  const edges = graph.edges.filter((e) => keep.has(e.from) && keep.has(e.to));
  return { direction: graph.direction, nodes, edges, classDefs: graph.classDefs, seeds: seeds.filter((id) => keep.has(id)) };
}

/** Every node reachable FROM `start` following calls in one direction (the click-to-
 *  focus subtree the view highlights). 'down' = callees, 'up' = callers. Includes
 *  `start`. Pure. */
export function reachable(edges: GraphEdge[], start: string, dir: 'down' | 'up'): Set<string> {
  const { out, inc } = adjacency(edges);
  const adj = dir === 'down' ? out : inc;
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const u = q.shift()!;
    for (const v of adj.get(u) ?? []) if (!seen.has(v)) (seen.add(v), q.push(v));
  }
  return seen;
}

export interface FileForGraph {
  path: string;
  /** The file's tree-sitter symbol names (anchors which graph nodes are the file's). */
  symbolNames: string[];
}

/** The PUBLIC entry: normalize the scanner's structured graph and scope it to ONE
 *  file. Returns null when there's nothing worth drawing — no graph, the file maps to
 *  no node, or the scoped graph has no edges (a lone node isn't a call graph). The
 *  handover calls this and attaches the result to the file's presentation. Pure. */
export function buildFileGraph(
  structured: MermaidStructured | undefined | null,
  file: FileForGraph,
  opts: ScopeOpts = {},
): FileGraph | null {
  const g = normalizeFlowchart(structured);
  if (!g.nodes.length || !g.edges.length) return null;
  const seeds = seedIdsForFile(g.nodes, file.path, file.symbolNames);
  if (!seeds.length) return null;
  const scoped = scopeToFile(g, seeds, opts);
  if (!scoped.edges.length) return null; // a lone changed node — nothing to map
  return scoped;
}
