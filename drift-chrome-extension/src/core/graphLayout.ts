// LAYERED LAYOUT for the change-impact graph — pure geometry, no React.
//
// SINGLE RESPONSIBILITY: place a {@link FileGraph}'s nodes into columns by their
// SIGNED rank (callers to the left, the changed seeds in the centre column, callees
// to the right) and route each edge as two anchor points the view curves. Column
// index == |rank| == scope level, so the view's "zoom in → zoom out" timeline maps
// 1:1 onto the columns: level 0 is the centre, each step reveals the next ring out.
//
// A small dependency-free layered layout (no dagre): the file-scoped graph is small
// (capped in changeImpactGraph.scopeToFile), so even ordering matters more than
// crossing-minimisation. Deterministic + unit-tested.

import { distancesFrom, signedRanks, type FileGraph, type GraphNode } from './changeImpactGraph';

export interface PlacedNode {
  id: string;
  /** Centre coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Column key: signed rank (−k callers … 0 change … +k callees) where defined, else the
   *  undirected distance (a sibling/co-callee placed outward). Drives x only. */
  rank: number;
  /** Scope level = UNDIRECTED distance from the change (the reveal ring / timeline stop). */
  level: number;
  node: GraphNode;
}
export interface PlacedEdge {
  from: string;
  to: string;
  /** [start, end] anchor points (centre-right of `from` → centre-left of `to`). */
  points: Array<{ x: number; y: number }>;
}
export interface GraphLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
  /** Deepest scope ring (max |rank|) — the timeline's last stop (full file scope). */
  maxLevel: number;
}

const NODE_H = 34;
const COL_GAP = 48;
const ROW_GAP = 14;
const PAD = 18;

/** Node box width from its label length, clamped so neither tiny nor huge. */
export const nodeWidth = (label: string): number => Math.max(96, Math.min(300, label.length * 6.6 + 26));

/** Lay the file-scoped graph out left-to-right. COLUMN = directed signed rank (callers
 *  left, the change centre, callees right) where it's defined, falling back to the
 *  UNDIRECTED distance for a node the directed walk can't sign (a tree sibling / co-callee
 *  — placed outward). RING/level = undirected distance from the change (the timeline). Pure. */
export function layoutGraph(g: FileGraph): GraphLayout {
  const signed = signedRanks(g.nodes, g.edges, g.seeds);
  const dist = distancesFrom(g.nodes, g.edges, g.seeds);
  const placeable = g.nodes.filter((n) => dist.has(n.id));
  const columnOf = (id: string): number => signed.get(id) ?? dist.get(id)!;

  // Bucket nodes into columns (source order preserved within a column).
  const byRank = new Map<number, GraphNode[]>();
  for (const n of placeable) {
    const r = columnOf(n.id);
    (byRank.get(r) ?? byRank.set(r, []).get(r)!).push(n);
  }
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  // Column x-positions: each column as wide as its widest node.
  const colWidth = new Map<number, number>();
  for (const r of ranks) colWidth.set(r, Math.max(...byRank.get(r)!.map((n) => nodeWidth(n.label))));
  const colX = new Map<number, number>();
  let cursor = PAD;
  for (const r of ranks) {
    colX.set(r, cursor + colWidth.get(r)! / 2);
    cursor += colWidth.get(r)! + COL_GAP;
  }
  const width = Math.max(cursor - COL_GAP + PAD, PAD * 2);

  // Tallest column sets the canvas height; shorter columns are centred against it.
  let maxColH = 0;
  for (const r of ranks) maxColH = Math.max(maxColH, byRank.get(r)!.length * (NODE_H + ROW_GAP) - ROW_GAP);
  const height = maxColH + PAD * 2;

  const pos = new Map<string, PlacedNode>();
  for (const r of ranks) {
    const col = byRank.get(r)!;
    const colH = col.length * (NODE_H + ROW_GAP) - ROW_GAP;
    let y = PAD + (maxColH - colH) / 2 + NODE_H / 2;
    for (const n of col) {
      pos.set(n.id, { id: n.id, x: colX.get(r)!, y, w: nodeWidth(n.label), h: NODE_H, rank: r, level: dist.get(n.id)!, node: n });
      y += NODE_H + ROW_GAP;
    }
  }

  const edges: PlacedEdge[] = [];
  for (const e of g.edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    edges.push({ from: e.from, to: e.to, points: [{ x: a.x + a.w / 2, y: a.y }, { x: b.x - b.w / 2, y: b.y }] });
  }

  const maxLevel = placeable.length ? Math.max(...placeable.map((n) => dist.get(n.id)!)) : 0;
  return { nodes: [...pos.values()], edges, width, height, maxLevel };
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Bounding box of every node within scope `level` (|rank| ≤ level) — the camera
 *  target as the timeline zooms out. Falls back to the whole canvas when empty. Pure. */
export function levelBounds(layout: GraphLayout, level: number): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of layout.nodes) {
    if (p.level > level) continue;
    x0 = Math.min(x0, p.x - p.w / 2);
    x1 = Math.max(x1, p.x + p.w / 2);
    y0 = Math.min(y0, p.y - p.h / 2);
    y1 = Math.max(y1, p.y + p.h / 2);
  }
  if (x0 === Infinity) return { x0: 0, y0: 0, x1: layout.width, y1: layout.height };
  return { x0, y0, x1, y1 };
}

/** Bounding box of a specific set of node ids (the click-to-focus subtree). Pure. */
export function boundsOf(layout: GraphLayout, ids: Set<string>): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of layout.nodes) {
    if (!ids.has(p.id)) continue;
    x0 = Math.min(x0, p.x - p.w / 2);
    x1 = Math.max(x1, p.x + p.w / 2);
    y0 = Math.min(y0, p.y - p.h / 2);
    y1 = Math.max(y1, p.y + p.h / 2);
  }
  if (x0 === Infinity) return { x0: 0, y0: 0, x1: layout.width, y1: layout.height };
  return { x0, y0, x1, y1 };
}
