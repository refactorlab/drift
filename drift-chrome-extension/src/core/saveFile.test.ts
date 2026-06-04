import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveTextFile, hasFileSystemAccess } from './saveFile';

// A fake File System Access save handle: showSaveFilePicker → handle →
// createWritable → writable. `writes` records what was streamed in.
function fakePicker() {
  const writes: unknown[] = [];
  const writable = {
    write: vi.fn(async (chunk: unknown) => {
      writes.push(chunk);
    }),
    close: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
  };
  const handle = { createWritable: vi.fn(async () => writable) };
  const showSaveFilePicker = vi.fn(async () => handle);
  return { showSaveFilePicker, handle, writable, writes };
}

// Stub chrome.downloads + a URL object-url shim for the fallback path.
function stubDownloads() {
  const download = vi.fn((_opts: unknown, cb?: (id?: number) => void) => cb?.(1));
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL });
  vi.stubGlobal('chrome', { downloads: { download }, runtime: { lastError: undefined } });
  return { download, revokeObjectURL };
}

describe('saveTextFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('detects the File System Access API on the window', () => {
    expect(hasFileSystemAccess()).toBe(false);
    vi.stubGlobal('showSaveFilePicker', vi.fn());
    expect(hasFileSystemAccess()).toBe(true);
  });

  it('writes via the File System Access API when available', async () => {
    const { showSaveFilePicker, writable, writes } = fakePicker();
    vi.stubGlobal('showSaveFilePicker', showSaveFilePicker);

    const out = await saveTextFile({
      suggestedName: 'pr-7.json',
      data: '{"a":1}',
      mime: 'application/json',
      description: 'JSON',
    });

    expect(out).toEqual({ method: 'file-system-access' });
    // Picker is configured with the suggested name + a type filter derived from
    // the extension, and starts in Downloads.
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: 'pr-7.json',
      startIn: 'downloads',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    expect(writes).toEqual(['{"a":1}']);
    expect(writable.close).toHaveBeenCalledTimes(1);
  });

  it('treats an AbortError from the picker as a cancel — and does NOT fall back', async () => {
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }),
    );
    const { download } = stubDownloads();

    const out = await saveTextFile({ suggestedName: 'x.json', data: 'x', mime: 'application/json' });

    expect(out).toEqual({ method: 'file-system-access', cancelled: true });
    expect(download).not.toHaveBeenCalled();
  });

  it('falls back to chrome.downloads when the picker fails for a non-cancel reason', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => {
        throw new Error('filesystem unavailable');
      }),
    );
    const { download, revokeObjectURL } = stubDownloads();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const out = await saveTextFile({ suggestedName: 'x.html', data: '<b>x</b>', mime: 'text/html' });

    expect(out).toEqual({ method: 'downloads' });
    expect(warn).toHaveBeenCalled();
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'blob:fake', filename: 'x.html', saveAs: true }),
      expect.any(Function),
    );
    // The object URL is revoked on a timer once the download has started.
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('uses chrome.downloads when the File System Access API is unavailable', async () => {
    vi.useFakeTimers();
    const { download } = stubDownloads(); // no showSaveFilePicker stubbed → unavailable

    const out = await saveTextFile({ suggestedName: 'scan.json', data: '{}', mime: 'application/json' });

    expect(out).toEqual({ method: 'downloads' });
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'scan.json', saveAs: true }),
      expect.any(Function),
    );
    vi.runAllTimers();
  });

  it('aborts the writable and falls back when writing fails', async () => {
    vi.useFakeTimers();
    const writable = {
      write: vi.fn(async () => {
        throw new Error('disk full');
      }),
      close: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    };
    const handle = { createWritable: vi.fn(async () => writable) };
    vi.stubGlobal('showSaveFilePicker', vi.fn(async () => handle));
    const { download } = stubDownloads();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const out = await saveTextFile({ suggestedName: 'x.json', data: 'x', mime: 'application/json' });

    expect(writable.abort).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ method: 'downloads' });
    expect(download).toHaveBeenCalled();
    vi.runAllTimers();
  });
});
