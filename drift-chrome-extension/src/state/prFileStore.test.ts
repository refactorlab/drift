import { describe, it, expect } from 'vitest';
import { fileDiffToText, buildPrFileEntries, selectShasToEvict, MAX_FILE_CHARS } from './prFileStore';
import type { FileDiff } from '../core/prDiff';
import type { FileTree } from '../core/repoZip';

const enc = new TextEncoder();

const hunkDiff: FileDiff = {
  path: 'a.ts',
  status: 'M',
  additions: 1,
  deletions: 1,
  hunks: [
    {
      header: '@@ -1,2 +1,2 @@',
      lines: [
        { type: 'context', text: 'const x = 1;' },
        { type: 'del', text: 'const y = 2;' },
        { type: 'add', text: 'const y = 3;' },
      ],
    },
  ],
};

describe('fileDiffToText', () => {
  it('renders hunk header + sign-prefixed lines', () => {
    const text = fileDiffToText(hunkDiff);
    expect(text).toContain('@@ -1,2 +1,2 @@');
    expect(text).toContain(' const x = 1;');
    expect(text).toContain('-const y = 2;');
    expect(text).toContain('+const y = 3;');
  });

  it('returns a placeholder for binary diffs and a marker when truncated', () => {
    expect(fileDiffToText({ ...hunkDiff, binary: true })).toContain('binary');
    expect(fileDiffToText({ ...hunkDiff, truncated: true })).toContain('truncated');
  });

  it('empty for undefined', () => {
    expect(fileDiffToText(undefined)).toBe('');
  });
});

describe('buildPrFileEntries', () => {
  it('pairs tree bytes with each file diff and skips files absent at HEAD', () => {
    const tree: FileTree = new Map([['a.ts', enc.encode('export const a = 1;\n')]]);
    const entries = buildPrFileEntries(tree, [hunkDiff], ['a.ts', 'deleted.ts']);
    expect(entries).toHaveLength(1); // deleted.ts not in tree → skipped
    expect(entries[0].path).toBe('a.ts');
    expect(entries[0].content).toContain('export const a = 1;');
    expect(entries[0].diff).toContain('+const y = 3;');
    expect(entries[0].status).toBe('M');
  });

  it('caps stored content to MAX_FILE_CHARS', () => {
    const big = 'x'.repeat(MAX_FILE_CHARS + 5000);
    const tree: FileTree = new Map([['big.ts', enc.encode(big)]]);
    const [entry] = buildPrFileEntries(tree, [], ['big.ts']);
    expect(entry.content.length).toBe(MAX_FILE_CHARS);
  });
});

describe('selectShasToEvict', () => {
  it('keeps the newest `max` shas and evicts the rest', () => {
    const rows = [
      { prKey: 'pr@old', ts: 100 },
      { prKey: 'pr@old', ts: 110 },
      { prKey: 'pr@mid', ts: 200 },
      { prKey: 'pr@new', ts: 300 },
    ];
    expect(selectShasToEvict(rows, 2).sort()).toEqual(['pr@old']);
    expect(selectShasToEvict(rows, 1).sort()).toEqual(['pr@mid', 'pr@old']);
  });

  it('evicts nothing when within the cap', () => {
    expect(selectShasToEvict([{ prKey: 'pr@a', ts: 1 }], 2)).toEqual([]);
  });
});
