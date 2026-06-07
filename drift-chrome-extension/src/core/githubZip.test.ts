import { describe, it, expect, vi, afterEach } from 'vitest';
import { archiveUrl, downloadArchive, type DownloadProgress } from './githubZip';

// A fake fetch Response that streams `chunks` through a getReader(), optionally
// advertising a Content-Length. Mirrors the shape readBodyWithProgress uses.
function streamResponse(chunks: Uint8Array[], opts: { contentLength?: number; ok?: boolean; status?: number } = {}) {
  let i = 0;
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: {
      get: (h: string) =>
        h.toLowerCase() === 'content-length' && opts.contentLength != null
          ? String(opts.contentLength)
          : null,
    },
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
      }),
    },
  };
}

const collect = () => {
  const ticks: DownloadProgress[] = [];
  return { ticks, onProgress: (p: DownloadProgress) => ticks.push(p) };
};

describe('archiveUrl', () => {
  it('uses the raw sha path for a commit-ish ref', () => {
    expect(archiveUrl('o', 'r', 'a'.repeat(40))).toBe(`https://github.com/o/r/archive/${'a'.repeat(40)}.zip`);
  });
  it('routes a branch name through refs/heads so slashes resolve', () => {
    expect(archiveUrl('o', 'r', 'feature/x')).toBe('https://github.com/o/r/archive/refs/heads/feature/x.zip');
  });
});

describe('downloadArchive — progress + estimate surfacing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('concatenates streamed chunks into the full byte array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([new Uint8Array([1, 2]), new Uint8Array([3])])));
    const out = await downloadArchive('o', 'r', 'main');
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });

  it('surfaces the estimate up front (fetching tick) and on stream start, flagged estimated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([new Uint8Array(10)])));
    const { ticks, onProgress } = collect();
    await downloadArchive('o', 'r', 'main', onProgress, undefined, 1000);

    // First tick fires BEFORE the network resolves, so a slow first byte already
    // shows "0 / ~1000".
    expect(ticks[0]).toMatchObject({ phase: 'fetching o/r@main', bytes: 0, total: 1000, estimated: true });
    expect(ticks.some((t) => t.phase.startsWith('downloading') && t.total === 1000 && t.estimated)).toBe(true);
  });

  it('reports the TRUE size (not the estimate) once the stream drains', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([new Uint8Array(7)])));
    const { ticks, onProgress } = collect();
    await downloadArchive('o', 'r', 'main', onProgress, undefined, 9999);

    const last = ticks.at(-1)!;
    expect(last).toMatchObject({ bytes: 7, total: 7 });
    expect(last.estimated).toBeFalsy();
  });

  it('prefers a real Content-Length over the estimate and is not flagged estimated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([new Uint8Array(4)], { contentLength: 4 })));
    const { ticks, onProgress } = collect();
    await downloadArchive('o', 'r', 'main', onProgress, undefined, 9999);

    const streaming = ticks.find((t) => t.phase.startsWith('downloading'))!;
    expect(streaming.total).toBe(4);
    expect(streaming.estimated).toBe(false);
  });

  it('leaves total undefined when there is neither Content-Length nor estimate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([new Uint8Array(3)])));
    const { ticks, onProgress } = collect();
    await downloadArchive('o', 'r', 'main', onProgress);

    expect(ticks[0]).toMatchObject({ phase: 'fetching o/r@main', bytes: 0 });
    expect(ticks[0].total).toBeUndefined();
    expect(ticks[0].estimated).toBe(false);
  });

  it('throws a useful error on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([], { ok: false, status: 404 })));
    await expect(downloadArchive('o', 'r', 'main')).rejects.toThrow(/download o\/r@main failed: HTTP 404/);
  });
});
