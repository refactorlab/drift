import { describe, expect, it } from 'vitest';
import {
  buildFileGraph,
  distancesFrom,
  levelsFromRanks,
  normalizeFlowchart,
  reachable,
  scopeToFile,
  seedIdsForFile,
  signedRanks,
  type ChangeGraph,
  type GraphEdge,
  type GraphNode,
} from './changeImpactGraph';
import type { MermaidStructured } from './scanOutput';

const N = (id: string, label: string, cls?: string): GraphNode => ({ id, label, cls });
const E = (from: string, to: string): GraphEdge => ({ from, to });

// A small file-scoped shape: A → S → B → C, plus an unrelated island X → Y.
//   S is the file's changed symbol (the seed); A calls it (upstream), B/C are downstream.
const graph: ChangeGraph = {
  direction: 'LR',
  nodes: [N('A', 'caller'), N('S', 'seedSym', 'changed'), N('B', 'callee'), N('C', 'deepCallee'), N('X', 'island'), N('Y', 'island2')],
  edges: [E('A', 'S'), E('S', 'B'), E('B', 'C'), E('X', 'Y')],
  classDefs: [{ name: 'changed', fill: '#9e6a03', stroke: '#d29922', color: '#fff' }],
};

describe('normalizeFlowchart', () => {
  it('maps nodes/edges/class_defs and is tolerant of junk', () => {
    const raw: MermaidStructured = {
      direction: 'TB',
      nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', class: 'added' }],
      edges: [
        { from: 'a', to: 'b', style: 'dashed' },
        { from: 'a', to: 'a' }, // self-edge → dropped
        { from: 'a', to: 'ghost' }, // unknown target → dropped
      ],
      class_defs: [{ name: 'added', fill: '#1', stroke: '#2', color: '#3', stroke_dasharray: '4 3' }],
    };
    const g = normalizeFlowchart(raw);
    expect(g.direction).toBe('TB');
    expect(g.nodes).toHaveLength(2);
    expect(g.edges).toEqual([{ from: 'a', to: 'b', dashed: true }]);
    expect(g.classDefs[0]).toMatchObject({ name: 'added', stroke: '#2', strokeDasharray: '4 3' });
  });

  it('defaults to LR and empty arrays for a missing payload', () => {
    const g = normalizeFlowchart(undefined);
    expect(g).toEqual({ direction: 'LR', nodes: [], edges: [], classDefs: [] });
  });
});

describe('seedIdsForFile', () => {
  const nodes = [N('1', 'loadWasm', 'changed'), N('2', 'fmtMs', 'added'), N('3', 'unrelated'), N('4', 'live')];
  it('prefers the file CHANGED nodes, matched by symbol name', () => {
    expect(seedIdsForFile(nodes, 'src/wasm.ts', ['loadWasm', 'fmtMs'])).toEqual(['1', '2']);
  });
  it('matches by basename and basename-substring when no symbol names', () => {
    expect(seedIdsForFile([N('1', 'live', 'changed')], 'src/live.ts', [])).toEqual(['1']);
  });
  it('falls back to all file nodes when none carry a changed class', () => {
    expect(seedIdsForFile([N('1', 'foo'), N('2', 'bar')], 'x.ts', ['foo'])).toEqual(['1']);
  });
});

describe('signedRanks', () => {
  it('is 0 at the seed, + downstream, − upstream, and omits unreachable nodes', () => {
    const r = signedRanks(graph.nodes, graph.edges, ['S']);
    expect(r.get('S')).toBe(0);
    expect(r.get('B')).toBe(1);
    expect(r.get('C')).toBe(2);
    expect(r.get('A')).toBe(-1);
    expect(r.has('X')).toBe(false); // the unrelated island never reaches the seed
  });
});

describe('distancesFrom (undirected — the scope-ring metric)', () => {
  it('reaches a SIBLING via up-then-down (which signed ranks miss)', () => {
    // file → A (changed seed) and file → B (sibling). B is unreachable by directed walk
    // from A, but is 2 undirected hops away (A → file → B).
    const nodes = [N('file', 'f'), N('A', 'a', 'changed'), N('B', 'b')];
    const edges = [E('file', 'A'), E('file', 'B')];
    expect(signedRanks(nodes, edges, ['A']).has('B')).toBe(false); // directed misses the sibling
    const d = distancesFrom(nodes, edges, ['A']);
    expect(d.get('A')).toBe(0);
    expect(d.get('file')).toBe(1);
    expect(d.get('B')).toBe(2); // reached via the parent
  });
});

describe('levelsFromRanks', () => {
  it('groups node ids into rings by |rank|', () => {
    const r = signedRanks(graph.nodes, graph.edges, ['S']);
    const levels = levelsFromRanks(graph.nodes, r);
    expect(levels[0]).toEqual(['S']);
    expect(new Set(levels[1])).toEqual(new Set(['A', 'B']));
    expect(levels[2]).toEqual(['C']);
  });
});

describe('scopeToFile', () => {
  it('keeps nodes within maxDepth and the edges between them', () => {
    const scoped = scopeToFile(graph, ['S'], { maxDepth: 1 });
    expect(new Set(scoped.nodes.map((n) => n.id))).toEqual(new Set(['A', 'S', 'B']));
    expect(scoped.edges).toEqual([{ from: 'A', to: 'S' }, { from: 'S', to: 'B' }]);
    expect(scoped.seeds).toEqual(['S']);
  });
  it('caps the node count to the nearest-to-the-change', () => {
    const scoped = scopeToFile(graph, ['S'], { maxDepth: 5, maxNodes: 2 });
    expect(scoped.nodes.map((n) => n.id)).toContain('S');
    expect(scoped.nodes.length).toBeLessThanOrEqual(2);
  });
});

describe('reachable', () => {
  it('walks callees (down) and callers (up) from a node', () => {
    expect(reachable(graph.edges, 'S', 'down')).toEqual(new Set(['S', 'B', 'C']));
    expect(reachable(graph.edges, 'S', 'up')).toEqual(new Set(['S', 'A']));
  });
});

describe('buildFileGraph', () => {
  const structured: MermaidStructured = {
    direction: 'LR',
    nodes: [
      { id: 'A', label: 'caller' },
      { id: 'S', label: 'seedSym', class: 'changed' },
      { id: 'B', label: 'callee' },
    ],
    edges: [{ from: 'A', to: 'S' }, { from: 'S', to: 'B' }],
    class_defs: [{ name: 'changed', fill: '#9e6a03', stroke: '#d29922', color: '#fff' }],
  };

  it('scopes the PR graph to the file seeded by its symbol names', () => {
    const fg = buildFileGraph(structured, { path: 'src/seedSym.ts', symbolNames: ['seedSym'] });
    expect(fg).not.toBeNull();
    expect(fg!.seeds).toEqual(['S']);
    expect(new Set(fg!.nodes.map((n) => n.id))).toEqual(new Set(['A', 'S', 'B']));
  });

  it('returns null when there is nothing to draw', () => {
    expect(buildFileGraph(undefined, { path: 'x.ts', symbolNames: [] })).toBeNull();
    expect(buildFileGraph({ nodes: [{ id: 'A', label: 'a' }], edges: [] }, { path: 'a.ts', symbolNames: ['a'] })).toBeNull(); // no edges
    expect(buildFileGraph(structured, { path: 'other.ts', symbolNames: ['nope'] })).toBeNull(); // no seed match
  });
});
