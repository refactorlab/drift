import { describe, expect, it } from 'vitest';
import { fileGraphFromScan } from './scanFileGraph';

// A scan carrying per-file tree-sitter symbols + the file's diff → the PRIMARY in-file tree.
// (`pr_scope` is the marker `asScanOutput` keys on to accept the payload as a scan.)
const scanWithSymbols = {
  pr_scope: { changed_files: ['src/engine.ts'] },
  pr_symbols: [
    {
      path: 'src/engine.ts',
      symbols: [
        { name: 'Engine', kind: 'class', line: 1, end_line: 40 },
        { name: 'pushMic', kind: 'method', line: 10, end_line: 18, parent: 'Engine' },
        { name: 'rms', kind: 'function', line: 50, end_line: 60 },
        { name: '<anon@70>', kind: 'function', line: 70, end_line: 71 }, // synthetic → dropped
      ],
    },
  ],
  pr_diff: {
    files: [
      {
        path: 'src/engine.ts',
        status: 'M',
        hunks: [{ header: '@@ -10,2 +12,2 @@', lines: [{ type: 'add', text: 'changed pushMic line' }] }], // line 12 ∈ pushMic
      },
    ],
  },
};

// A scan with NO per-file symbols for the path, but a structured call graph → FALLBACK.
const scanCallGraphOnly = {
  pr_review: {
    architecture_flow: {
      diff_merged_structured: {
        nodes: [
          { id: 'A', label: 'caller' },
          { id: 'F', label: 'legacy.rb', class: 'changed' },
          { id: 'B', label: 'callee' },
        ],
        edges: [{ from: 'A', to: 'F' }, { from: 'F', to: 'B' }],
        class_defs: [{ name: 'changed', fill: '#9e6a03', stroke: '#d29922', color: '#fff' }],
      },
    },
  },
};

const labelCls = (g: { nodes: Array<{ label: string; cls?: string }> }, label: string) => g.nodes.find((n) => n.label === label)?.cls;

describe('fileGraphFromScan', () => {
  it('PRIMARY: builds the in-file tree-sitter tree (changed vs unchanged) from pr_symbols + pr_diff', () => {
    const g = fileGraphFromScan(scanWithSymbols, 'src/engine.ts')!;
    expect(g).not.toBeNull();
    expect(labelCls(g, 'engine.ts')).toBe('changed'); // the file root
    expect(labelCls(g, 'pushMic')).toBe('changed'); // touched by the hunk
    expect(labelCls(g, 'rms')).toBe('unchanged'); // not touched
    expect(g.nodes.some((n) => n.label === '<anon@70>')).toBe(false); // synthetic dropped
    const seedLabels = g.seeds.map((id) => g.nodes.find((n) => n.id === id)?.label);
    expect(seedLabels).toContain('pushMic');
  });

  it('matches a basename-only path against the fully-qualified symbol path', () => {
    const g = fileGraphFromScan(scanWithSymbols, 'engine.ts')!;
    expect(g).not.toBeNull();
    expect(g.nodes.some((n) => n.label === 'pushMic')).toBe(true);
  });

  it('FALLBACK: uses the cross-file call graph when the file has no tree-sitter symbols', () => {
    const g = fileGraphFromScan(scanCallGraphOnly, 'app/legacy.rb')!;
    expect(g).not.toBeNull();
    expect(g.seeds).toEqual(['F']);
    expect(new Set(g.nodes.map((n) => n.id))).toEqual(new Set(['A', 'F', 'B']));
  });

  it('returns null when the scan has neither symbols nor a structured graph', () => {
    expect(fileGraphFromScan({ pr_review: {} }, 'src/engine.ts')).toBeNull();
    expect(fileGraphFromScan(null, 'src/engine.ts')).toBeNull();
  });
});
