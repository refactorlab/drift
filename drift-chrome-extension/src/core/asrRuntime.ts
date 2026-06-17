// The in-tab Whisper ASR seam — the speech-input counterpart of kokoroRuntime.ts.
// Spawns the persistent transcription worker (asrWorker.ts), hands it the bundled
// ort path, waits until the model is loaded, and exposes `transcribe`. Mirrors
// the Kokoro/brain factories so it's injectable for tests and fails soft.

import type { AsrWorkerInit, AsrWorkerMessage, AsrWorkerTranscribe } from './asrWorker';

/** Bundled engine dir under public/ (shared with the TTS worker; see stage-ort.mjs). */
export const ORT_DIR = 'ort';

export type AsrProgress = { phase: string; fraction: number | null };

/** A loaded, ready-to-use ASR engine. */
export interface AsrRuntime {
  /** Transcribe 16 kHz mono f32 PCM → text. */
  transcribe(pcm16k: Float32Array): Promise<string>;
  /** Release the engine — terminates the worker thread. */
  free(): void;
}

/** Builds a runtime. Injected so tests use a fake; production spawns the worker.
 *  `onProgress` streams the model download (first load only). */
export type AsrFactory = (onProgress?: (p: AsrProgress) => void) => Promise<AsrRuntime>;

/** chrome.runtime.getURL when in an extension; a plain path otherwise (tests). */
function extUrl(path: string): string {
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : `/${path}`;
}

/**
 * Default factory: spawn the ASR worker, hand it the bundled ort path, and wait
 * until the Whisper model is loaded. Defensive — init/transcribe failures
 * reject/settle so the caller treats it as "ASR unavailable".
 */
export const defaultAsrFactory: AsrFactory = async (onProgress) => {
  const worker = new Worker(new URL('./asrWorker.ts', import.meta.url), { type: 'module' });

  await new Promise<void>((resolve, reject) => {
    const onInit = (e: MessageEvent<AsrWorkerMessage>) => {
      if (e.data.type === 'progress') {
        onProgress?.({ phase: e.data.phase, fraction: e.data.fraction });
      } else if (e.data.type === 'ready') {
        worker.removeEventListener('message', onInit);
        resolve();
      } else if (e.data.type === 'init-error') {
        worker.removeEventListener('message', onInit);
        worker.terminate();
        reject(new Error(e.data.message));
      }
    };
    worker.addEventListener('message', onInit);
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new Error(ev.message || 'asr worker crashed during init'));
    };
    // Trailing slash is REQUIRED: onnxruntime-web concatenates wasmPaths +
    // filename, so a missing slash yields `.../ortort-wasm-*.wasm` → 404 → "no
    // available backend found". Mirrors kokoroRuntime's `extUrl('ort/')`.
    worker.postMessage({ type: 'init', wasmPaths: extUrl(`${ORT_DIR}/`) } satisfies AsrWorkerInit);
  });

  let seq = 0;
  const pending = new Map<number, (err: Error) => void>();
  worker.onerror = (ev) => {
    const err = new Error(ev.message || 'asr worker crashed during transcription');
    for (const reject of pending.values()) reject(err);
    pending.clear();
  };

  return {
    transcribe(pcm16k) {
      const id = ++seq;
      // Copy to a standalone, exactly-sized buffer we can transfer (zero-copy).
      const buf = pcm16k.slice().buffer;
      return new Promise<string>((resolve, reject) => {
        pending.set(id, reject);
        const settle = () => {
          worker.removeEventListener('message', onMsg);
          pending.delete(id);
        };
        const onMsg = (e: MessageEvent<AsrWorkerMessage>) => {
          const m = e.data;
          if (m.type === 'result' && m.id === id) {
            settle();
            resolve(m.text);
          } else if (m.type === 'transcribe-error' && m.id === id) {
            settle();
            reject(new Error(m.message));
          }
        };
        worker.addEventListener('message', onMsg);
        worker.postMessage({ type: 'transcribe', id, samples: buf } satisfies AsrWorkerTranscribe, [buf]);
      });
    },
    free() {
      worker.terminate();
    },
  };
};

/** Can ASR RUN here? It runs on the bundled ort wasm — a WebAssembly check. */
export async function isAsrSupported(): Promise<boolean> {
  return typeof WebAssembly !== 'undefined';
}
