import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffResult, FileDiff } from '../core/prDiff';

vi.mock('../core/prDiff', () => ({ fetchPrChangedFiles: vi.fn() }));
import { fetchPrChangedFiles } from '../core/prDiff';
import { collectFileDiff, resetChangeCollectorCache } from './changeCollector';
import type { PrId } from '../core/prRefs';

const PR: PrId = { owner: 'o', repo: 'r', number: 7, host: 'github.com' };
const SIGNAL = new AbortController().signal;

const fileDiff = (path: string): FileDiff => ({
  path,
  status: 'M',
  additions: 1,
  deletions: 0,
  hunks: [{ header: '@@ -1 +1,2 @@', lines: [{ type: 'add', text: `// ${path}` }] }],
});
const result = (fileDiffs: FileDiff[]): DiffResult => ({
  changedPaths: [],
  diffStats: '',
  diffStatus: '',
  entries: [],
  fileDiffs,
  diffTruncated: false,
});
const collect = (path: string, sha = 's') => collectFileDiff({ pr: PR, url: 'u', sha, path, signal: SIGNAL });

describe('collectFileDiff', () => {
  beforeEach(() => {
    resetChangeCollectorCache();
    vi.mocked(fetchPrChangedFiles).mockReset();
  });

  it('renders the matched file diff to unified-diff text', async () => {
    vi.mocked(fetchPrChangedFiles).mockResolvedValue(result([fileDiff('src/a.ts')]));
    const out = await collect('src/a.ts');
    expect(out).toContain('@@ -1 +1,2 @@');
    expect(out).toContain('+// src/a.ts');
  });

  it('matches on a path-boundary-safe suffix (not a substring)', async () => {
    vi.mocked(fetchPrChangedFiles).mockResolvedValue(result([fileDiff('pkg/src/voicePrompt.ts')]));
    expect(await collect('src/voicePrompt.ts')).toContain('voicePrompt.ts');
  });

  it('memoises one fetch per (url, sha) across files', async () => {
    vi.mocked(fetchPrChangedFiles).mockResolvedValue(result([fileDiff('src/a.ts'), fileDiff('src/b.ts')]));
    await collect('src/a.ts');
    await collect('src/b.ts');
    expect(fetchPrChangedFiles).toHaveBeenCalledTimes(1);
  });

  it('returns "" when the file is not in the PR diff', async () => {
    vi.mocked(fetchPrChangedFiles).mockResolvedValue(result([fileDiff('src/other.ts')]));
    expect(await collect('src/missing.ts')).toBe('');
  });

  it('returns "" on fetch failure, and stays retryable (does not poison the memo)', async () => {
    vi.mocked(fetchPrChangedFiles).mockRejectedValueOnce(new Error('network'));
    expect(await collect('src/a.ts')).toBe('');
    vi.mocked(fetchPrChangedFiles).mockResolvedValueOnce(result([fileDiff('src/a.ts')]));
    expect(await collect('src/a.ts')).toContain('+// src/a.ts');
    expect(fetchPrChangedFiles).toHaveBeenCalledTimes(2);
  });
});
