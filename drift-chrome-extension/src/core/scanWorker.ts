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
    prTitle?: string;
    prBody?: string;
  };
};

export type ScanWorkerMessage =
  | { type: 'progress'; phase: 'unzip' | 'scan'; message: string; files?: number }
  | { type: 'done'; out: ArrayBuffer }
  | { type: 'error'; message: string };

const post = (msg: ScanWorkerMessage, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(msg, transfer ?? []);

self.onmessage = async (e: MessageEvent<ScanWorkerRequest>) => {
  const { zip, wasm, inputs } = e.data;
  try {
    post({ type: 'progress', phase: 'unzip', message: 'unzipping archive…' });
    const tree = unzipRepoArchive(new Uint8Array(zip));
    post({ type: 'progress', phase: 'unzip', message: `${tree.size} files`, files: tree.size });

    post({ type: 'progress', phase: 'scan', message: `scan-pr · ${tree.size} files` });
    const out = await runScanPr(wasm, tree, {
      ...inputs,
      onLog: (line) => post({ type: 'progress', phase: 'scan', message: line.slice(0, 120) }),
    });

    // Copy out of the WASI buffer into a standalone ArrayBuffer we can transfer.
    const buf = out.slice().buffer;
    post({ type: 'done', out: buf }, [buf]);
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
