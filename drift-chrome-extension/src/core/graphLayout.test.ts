import { describe, expect, it } from 'vitest';
import { boundsOf, layoutGraph, levelBounds, nodeWidth } from './graphLayout';
import type { FileGraph } from './changeImpactGraph';

// A → S → B → C : one caller (rank −1), the seed (0), two callees (+1, +2).
const graph: FileGraph = {
  direction: 'LR',
  nodes: [
    { id: 'A', label: 'caller' },
    { id: 'S', label: 'seedSym', cls: 'changed' },
    { id: 'B', label: 'callee' },
    { id: 'C', label: 'deep' },
  ],
  edges: [{ from: 'A', to: 'S' }, { from: 'S', to: 'B' }, { from: 'B', to: 'C' }],
  classDefs: [],
  seeds: ['S'],
};

describe('nodeWidth', () => {
  it('scales with label length within clamp bounds', () => {
    expect(nodeWidth('x')).toBe(96);
    expect(nodeWidth('a'.repeat(200))).toBe(300);
    expect(nodeWidth('medium label')).toBeGreaterThan(96);
  });
});

describe('layoutGraph', () => {
  const layout = layoutGraph(graph);
  const by = new Map(layout.nodes.map((p) => [p.id, p]));

  it('places callers left of the seed and callees to the right (by signed rank)', () => {
    expect(by.get('A')!.x).toBeLessThan(by.get('S')!.x);
    expect(by.get('S')!.x).toBeLessThan(by.get('B')!.x);
    expect(by.get('B')!.x).toBeLessThan(by.get('C')!.x);
  });

  it('records each node rank + scope level', () => {
    expect(by.get('S')!.rank).toBe(0);
    expect(by.get('A')!.rank).toBe(-1);
    expect(by.get('C')!.rank).toBe(2);
    expect(by.get('A')!.level).toBe(1);
    expect(layout.maxLevel).toBe(2);
  });

  it('emits one [start,end] anchor pair per edge with positive canvas size', () => {
    expect(layout.edges).toHaveLength(3);
    for (const e of layout.edges) expect(e.points).toHaveLength(2);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe('levelBounds / boundsOf', () => {
  const layout = layoutGraph(graph);
  it('level 0 is tighter than the full scope', () => {
    const inner = levelBounds(layout, 0);
    const outer = levelBounds(layout, layout.maxLevel);
    expect(inner.x1 - inner.x0).toBeLessThan(outer.x1 - outer.x0);
  });
  it('boundsOf covers exactly the requested ids', () => {
    const b = boundsOf(layout, new Set(['S']));
    const s = layout.nodes.find((p) => p.id === 'S')!;
    expect(b.x0).toBeCloseTo(s.x - s.w / 2);
    expect(b.x1).toBeCloseTo(s.x + s.w / 2);
  });
});
