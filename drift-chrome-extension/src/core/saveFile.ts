// Save a generated artifact to disk, preferring the File System Access API
// (`showSaveFilePicker`) and falling back to `chrome.downloads`.
//
// Why the File System Access API is the primary path:
//   • It is the modern, native "Save As" — it pre-fills the filename, lets the
//     user choose the folder, and writes the bytes DIRECTLY through a
//     `FileSystemWritableFileStream` (no download-manager round-trip, no temp
//     blob URL to leak).
//   • It needs NO extra extension permission. It runs in the side-panel
//     document, which is a normal secure `chrome-extension://` page on the main
//     thread — exactly where the API is supported. (It is NOT exposed to service
//     workers, and `showDirectoryPicker` is broken in extensions — but a plain
//     file SAVE works. See crbug.com/40240444.)
//
// Why we still keep `chrome.downloads` as a fallback:
//   • Browsers/contexts without the File System Access API (or where the call
//     throws for a non-user reason) must still be able to export. This preserves
//     the previous behavior byte-for-byte, including the "always prompt for a
//     location" UX (`saveAs: true`).
//
// CRITICAL — user activation: `showSaveFilePicker()` must be the FIRST awaited
// call inside the click handler. Any `await` (or other activation-consuming API)
// before it spends the transient user activation and the picker throws a
// `SecurityError`. Callers therefore compute `data` SYNCHRONOUSLY and hand it in;
// this helper opens the picker before it touches the stream. (crbug.com/40175286)

export type SaveMethod = 'file-system-access' | 'downloads';

export interface SaveOutcome {
  /** Which mechanism actually wrote (or attempted) the file. */
  method: SaveMethod;
  /** The user dismissed the picker — nothing was written. This is NOT an error;
   *  callers should treat it as a no-op (no toast, no thrown error). */
  cancelled?: boolean;
}

export interface SaveFileOptions {
  /** Default filename shown in the picker / used by the download. */
  suggestedName: string;
  /** The bytes to write. Strings are written as UTF-8. */
  data: string | Blob | BufferSource;
  /** MIME type for the picker's accept filter and the fallback blob. */
  mime: string;
  /** Human label for the file-type group in the picker (e.g. "Drift scan JSON"). */
  description?: string;
  /** Accepted extensions for the picker filter (e.g. [".json"]). Derived from
   *  `suggestedName` when omitted. */
  extensions?: string[];
}

/** Feature-detect the File System Access save picker on the document's window. */
export function hasFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

/** `true` for the DOMException the picker throws when the user cancels it. */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException ? err.name === 'AbortError' : (err as { name?: string })?.name === 'AbortError';
}

/** Trailing extension of a filename, INCLUDING the dot (e.g. ".json"), or "". */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
}

/**
 * Open the native save picker and stream `data` into the chosen file. Calls
 * `showSaveFilePicker` synchronously (no prior await) to preserve the user
 * gesture, then writes. Rethrows so the caller can distinguish cancel (AbortError)
 * from a genuine failure that warrants the fallback.
 */
async function writeViaPicker(opts: SaveFileOptions): Promise<void> {
  const exts = opts.extensions ?? (extensionOf(opts.suggestedName) ? [extensionOf(opts.suggestedName)] : []);
  const handle = await window.showSaveFilePicker({
    suggestedName: opts.suggestedName,
    // Start in the Downloads folder so the location matches the old
    // chrome.downloads behavior the first time.
    startIn: 'downloads',
    types: exts.length ? [{ description: opts.description ?? 'File', accept: { [opts.mime]: exts } }] : undefined,
  });
  const writable = await handle.createWritable();
  try {
    await writable.write(opts.data as FileSystemWriteChunkType);
    await writable.close();
  } catch (err) {
    // Leave no half-written file behind on a write/close failure.
    await writable.abort?.().catch(() => undefined);
    throw err;
  }
}

/**
 * Fallback: hand a blob URL to `chrome.downloads` with `saveAs: true` (always
 * prompts), mirroring the prior export behavior exactly. The object URL can't be
 * revoked synchronously — the download reads from it asynchronously — so it's
 * released on a generous timer once the download has certainly started.
 */
function saveViaDownloads(opts: SaveFileOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.downloads?.download) {
      reject(new Error('no file-save mechanism available (File System Access API and chrome.downloads both absent)'));
      return;
    }
    const blob = opts.data instanceof Blob ? opts.data : new Blob([opts.data], { type: opts.mime });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: opts.suggestedName, saveAs: true }, () => {
      void chrome.runtime.lastError; // swallow "user cancelled the Save As dialog"
      // Revoke once the download has had time to read the blob; revoking now
      // would abort an in-flight download.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      resolve();
    });
  });
}

/**
 * Save `data` to a user-chosen file. Tries the File System Access API first and
 * falls back to `chrome.downloads`. Resolves with which method was used (and
 * `cancelled: true` if the user dismissed the File System Access picker — in
 * which case nothing was written and no fallback is attempted).
 *
 * Call this directly from a click handler with `data` already computed, so the
 * picker fires inside the user gesture.
 */
export async function saveTextFile(opts: SaveFileOptions): Promise<SaveOutcome> {
  if (hasFileSystemAccess()) {
    try {
      await writeViaPicker(opts);
      return { method: 'file-system-access' };
    } catch (err) {
      // User dismissed the picker → done, nothing written, don't double-prompt.
      if (isAbortError(err)) return { method: 'file-system-access', cancelled: true };
      // A genuine failure (permission, disk, unsupported filesystem) → fall back
      // so the export still succeeds rather than silently dropping.
      console.warn('[drift] File System Access save failed; falling back to chrome.downloads', err);
    }
  }
  await saveViaDownloads(opts);
  return { method: 'downloads' };
}
