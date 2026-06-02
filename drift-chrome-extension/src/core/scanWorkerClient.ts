// Main-thread driver for scanWorker: spawns the worker, transfers the zip bytes
// + compiled module in, relays progress out, and resolves the parsed JSON. The
// worker is single-shot — created per scan and terminated on done/error/abort —
// so an aborted scan tears down its thread (and the WASM run) immediately
// instead of leaking a runaway computation.

import type { ScanWorkerMessage, ScanWorkerRequest } from './scanWorker';

export type WorkerScanProgress = { phase: 'unzip' | 'scan'; message: string; files?: number };

export type WorkerScanInputs = ScanWorkerRequest['inputs'];

export function scanInWorker(
  zip: Uint8Array,
  wasm: WebAssembly.Module,
  inputs: WorkerScanInputs,
  opts: { onProgress?: (p: WorkerScanProgress) => void; signal?: AbortSignal } = {},
): Promise<unknown> {
  const { onProgress, signal } = opts;
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));

  return new Promise<unknown>((resolve, reject) => {
    const worker = new Worker(new URL('./scanWorker.ts', import.meta.url), { type: 'module' });

    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (e: MessageEvent<ScanWorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress?.({ phase: msg.phase, message: msg.message, files: msg.files });
      } else if (msg.type === 'done') {
        cleanup();
        try {
          resolve(JSON.parse(new TextDecoder().decode(new Uint8Array(msg.out))));
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      } else {
        cleanup();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      cleanup();
      reject(new Error(e.message || 'scan worker crashed'));
    };

    // Transfer the zip buffer (zero-copy); the module is structured-cloned.
    const req: ScanWorkerRequest = { zip: bufferOf(zip), wasm, inputs };
    worker.postMessage(req, [req.zip]);
  });
}

/** A standalone ArrayBuffer for the view, so it can be transferred safely. */
function bufferOf(view: Uint8Array): ArrayBuffer {
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
    return view.buffer as ArrayBuffer;
  }
  return view.slice().buffer;
}
