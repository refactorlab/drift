/// <reference lib="webworker" />
// The heavy half of the live pipeline, moved OFF the main thread. The UI thread
// only ever needs the small JSON result — the multi-megabyte unzipped tree is
// born, walked by the WASM scanner, and dies entirely in here. Both the unzip
// (`unzipSync`) and the scan (`wasi.start`) are single, synchronous,
// uninterruptible calls; running them on the page froze the side panel for the
// whole duration. In a worker they block only this thread, so the page stays
// responsive (clock ticks, progress paints) and we post milestones back.

import { unzipRepoArchive } from './repoZip';
import { runScanPr } from './wasi';

export type ScanWorkerRequest = {
  /** Raw github archive zip bytes (transferred, not copied). */
  zip: ArrayBuffer;
  /** Pre-compiled scanner module (compiled once on the main thread, cached). */
  wasm: WebAssembly.Module;
  inputs: {
    changedFiles: string[];
    commits?: string[];
    diffStats?: string;
    diffStatus?: string;
    /** JSON map of NEW-file changed-line ranges → SYMBOL-level diff attribution. */
    diffHunks?: string;
    prTitle?: string;
    prBody?: string;
  };
};

export type ScanWorkerMessage =
  | { type: 'progress'; phase: 'unzip' | 'scan'; message: string; files?: number }
  | { type: 'done'; out: ArrayBuffer }
  | { type: 'error'; message: string };

type PostFn = (msg: ScanWorkerMessage, transfer?: Transferable[]) => void;

/**
 * The worker's whole job: unzip the transferred archive, run the scanner over
 * it (forwarding ALL inputs — including `diffStatus`), and post the result back.
 * Extracted from the `onmessage` handler so it can be unit-tested in Node
 * without a real Worker (the handler below is just the thin event shim).
 */
export async function runScanJob(req: ScanWorkerRequest, post: PostFn): Promise<void> {
  const { zip, wasm, inputs } = req;
  // Rolling tail of the scanner's stdout/stderr. On a non-zero exit the bare
  // "exited with code N" hides WHY — clap's `error: …` / a panic line lands here,
  // so we append it to the surfaced error instead of dropping it.
  const logTail: string[] = [];
  try {
    post({ type: 'progress', phase: 'unzip', message: 'unzipping archive…' });
    const tree = unzipRepoArchive(new Uint8Array(zip));
    post({ type: 'progress', phase: 'unzip', message: `${tree.size} files`, files: tree.size });

    post({ type: 'progress', phase: 'scan', message: `scan-pr · ${tree.size} files` });
    const out = await runScanPr(wasm, tree, {
      ...inputs,
      onLog: (line) => {
        logTail.push(line);
        if (logTail.length > 12) logTail.shift();
        post({ type: 'progress', phase: 'scan', message: line.slice(0, 120) });
      },
    });

    // Copy out of the WASI buffer into a standalone ArrayBuffer we can transfer.
    const buf = out.slice().buffer;
    post({ type: 'done', out: buf }, [buf]);
  } catch (err) {
    const base = err instanceof Error ? err.message : String(err);
    post({ type: 'error', message: appendScannerReason(base, logTail) });
  }
}

// The scanner's clap/panic line — the actual reason behind an exit code — lands
// in the log tail. Pull the most telling line out and append it to the error so
// the UI shows "exited with code 2 — error: <reason>" rather than a dead end.
export function appendScannerReason(base: string, logTail: string[]): string {
  if (!logTail.length) return base;
  const hit = [...logTail]
    .reverse()
    .find((l) => /\b(error|panic|unexpected|unrecognized|required|invalid|usage:)\b/i.test(l));
  const reason = (hit ?? logTail[logTail.length - 1]).replace(/\s+/g, ' ').trim().slice(0, 240);
  return reason && !base.includes(reason) ? `${base} — ${reason}` : base;
}

// Wire the handler only inside an actual Worker (guarded so importing this
// module in Node — e.g. vitest — doesn't touch the undefined `self`).
if (typeof self !== 'undefined' && 'postMessage' in self) {
  const post: PostFn = (msg, transfer) =>
    (self as unknown as Worker).postMessage(msg, transfer ?? []);
  self.onmessage = (e: MessageEvent<ScanWorkerRequest>) => void runScanJob(e.data, post);
}
