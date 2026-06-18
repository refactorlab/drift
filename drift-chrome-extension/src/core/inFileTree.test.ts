import { describe, expect, it } from 'vitest';
import { buildInFileTree, changedNewLinesFromHunks, type DiffHunkLite, type TreeSymbol } from './inFileTree';

const labelCls = (g: { nodes: Array<{ label: string; cls?: string }> }, label: string) => g.nodes.find((n) => n.label === label)?.cls;

describe('changedNewLinesFromHunks', () => {
  it('collects the new-side ADDED line numbers (context advances, del does not)', () => {
    const hunks: DiffHunkLite[] = [
      {
        header: '@@ -1,3 +10,4 @@',
        lines: [
          { type: 'context', text: 'a' }, // line 10
          { type: 'add', text: 'b' }, // line 11
          { type: 'add', text: 'c' }, // line 12
          { type: 'context', text: 'd' }, // line 13
        ],
      },
      { header: '@@ -40 +50,1 @@', lines: [{ type: 'del', text: 'gone' }] }, // pure delete → no new line
    ];
    expect([...changedNewLinesFromHunks(hunks)].sort((a, b) => a - b)).toEqual([11, 12]);
  });
});

describe('buildInFileTree', () => {
  const symbols: TreeSymbol[] = [
    { name: 'Engine', kind: 'class', line: 1, end_line: 50 },
    { name: 'pushMic', kind: 'method', line: 10, end_line: 20, parent: 'Engine' },
    { name: 'rms', kind: 'function', line: 60, end_line: 70 },
    { name: 'unchangedFn', kind: 'function', line: 80, end_line: 90 },
  ];

  it('classes touched symbols changed and the rest unchanged, nesting methods under their class', () => {
    const tree = buildInFileTree({ path: 'src/engine.ts', changeCode: 'M', symbols, changedLines: new Set([12]) })!;
    expect(tree).not.toBeNull();
    // The file root + a changed method whose class also reads as changed (its span contains line 12).
    expect(labelCls(tree, 'engine.ts')).toBe('changed');
    expect(labelCls(tree, 'pushMic')).toBe('changed');
    expect(labelCls(tree, 'Engine')).toBe('changed');
    // Symbols with no changed line are unchanged.
    expect(labelCls(tree, 'rms')).toBe('unchanged');
    expect(labelCls(tree, 'unchangedFn')).toBe('unchanged');

    // Seeds are the changed symbols (the scope-0 focus).
    const seedLabels = tree.seeds.map((id) => tree.nodes.find((n) => n.id === id)?.label);
    expect(seedLabels).toContain('pushMic');
    expect(seedLabels).not.toContain('rms');

    // Containment: pushMic hangs off Engine; Engine off the file root.
    const id = (label: string) => tree.nodes.find((n) => n.label === label)!.id;
    const root = tree.nodes.find((n) => n.id.startsWith('file:'))!.id;
    expect(tree.edges).toContainEqual({ from: id('Engine'), to: id('pushMic') });
    expect(tree.edges).toContainEqual({ from: root, to: id('Engine') });
  });

  it('treats every symbol as changed when no diff lines are known', () => {
    const tree = buildInFileTree({ path: 'src/new.ts', changeCode: 'A', symbols })!;
    expect(labelCls(tree, 'rms')).toBe('added'); // file is added → touched symbols are "added"
    expect(tree.seeds.length).toBeGreaterThan(1);
  });

  it('returns null when the file exposes no real symbols', () => {
    expect(buildInFileTree({ path: 'x.ts', symbols: [{ name: '<module>', kind: 'module', line: 1, end_line: 9 }] })).toBeNull();
    expect(buildInFileTree({ path: 'x.ts', symbols: [] })).toBeNull();
  });
});
