// The in-tab Kokoro TTS engine seam. The action synthesises the spoken summary
// server-side with `sherpa-onnx-offline-tts` + the kokoro-multi-lang model; the
// live scan does the SAME Kokoro synthesis locally, in the browser, via the
// `kokoro-js` package (Kokoro-82M ONNX, run through @huggingface/transformers →
// onnxruntime-web). This is the browser-native counterpart of taking the scanner
// from a native CLI to `drift-static-profiler.wasm`.
//
// Everything ships INSIDE the extension — nothing is fetched at runtime (the
// same "bundled, works offline" contract as the scanner wasm): the ort ENGINE
// under public/ort/ (stage-ort.mjs), the Kokoro MODEL under public/models/<repo>/
// (stage-kokoro.mjs), and the VOICES pre-seeded into a CacheStorage from bundled
// copies (see ttsWorker.ts).
//
// CRUCIALLY, synthesis runs OFF THE MAIN THREAD. Loading the ~92 MB model and
// running ONNX inference are heavy synchronous calls; on the page they froze the
// side panel ("browser stuck on Listen"). So this factory spawns a PERSISTENT
// module worker (ttsWorker.ts) — the exact pattern the scanner uses (scanWorker)
// — that loads the model once and answers every synth request. The main thread
// only ever moves a few KB of PCM. chrome.* is unavailable inside a worker, so
// we pass the packaged asset URLs in at init.
//
// Every entry point fails SOFT: a load/synth error rejects and the caller
// (SpokenSummary) degrades to the system voice. The concrete engine is kept
// behind the `RuntimeFactory` injection so the provider and its tests run
// against a fake — identical to how `WasmScanProvider` injects `loadWasm`.

import type { TtsWorkerInit, TtsWorkerMessage, TtsWorkerSynth } from './ttsWorker';

export { KOKORO_MODEL_ID } from './ttsConstants';

/** One synthesis result: mono float32 PCM in [-1, 1] + its sample rate. */
export type KokoroPcm = { samples: Float32Array; sampleRate: number };

/** A loaded, ready-to-synthesise Kokoro engine. */
export interface KokoroRuntime {
  /** Synthesize `text`. `voice` is the Kokoro voice NAME (e.g. `af_heart`); the
   *  legacy `sid` is accepted for the sherpa contract but kokoro-js uses names. */
  synthesize(text: string, opts: { sid: number; voice?: string; speed?: number }): Promise<KokoroPcm>;
  /** Release the engine — terminates the worker thread. */
  free(): void;
}

/** Where the engine assets live. Retained for the injected-factory seam; the
 *  worker factory ignores it (asset URLs are derived from chrome.runtime). */
export type KokoroAssets = {
  glueUrl: string;
  baseUrl: string;
};

/** Model-acquisition progress, forwarded from the worker's download callback. */
export type RuntimeProgress = {
  phase: string;
  fraction: number | null;
  file?: string;
  loaded?: number;
  total?: number;
};

/** Builds a runtime from resolved assets. Injected so tests use a fake. The
 *  optional `onProgress` streams the model DOWNLOAD (first load fetches ~92 MB
 *  from the Hub then CacheStorage serves it offline). */
export type RuntimeFactory = (
  assets: KokoroAssets,
  onProgress?: (p: RuntimeProgress) => void,
) => Promise<KokoroRuntime>;

/** chrome.runtime.getURL when in an extension; a plain path otherwise (tests). */
function extUrl(path: string): string {
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : `/${path}`;
}

/**
 * Default factory: spawn the synthesis worker, hand it the packaged asset URLs,
 * and wait until it has loaded the bundled Kokoro model. Returns a
 * {@link KokoroRuntime} whose `synthesize` round-trips a request through the
 * worker (so the page never blocks) and whose `free` terminates it.
 *
 * The worker is persistent: the model loads once here and every later synth
 * reuses it. Isolated and defensive — an init/synth failure rejects and the
 * caller treats it as "engine unavailable → system voice".
 */
export const defaultRuntimeFactory: RuntimeFactory = async (_assets, onProgress) => {
  const worker = new Worker(new URL('./ttsWorker.ts', import.meta.url), { type: 'module' });

  // Block on first model load so isAvailable()/the first synth reflects reality.
  // The first load DOWNLOADS the model from the Hub (then CacheStorage serves it
  // offline) — progress is forwarded to onProgress so Settings can show a bar.
  await new Promise<void>((resolve, reject) => {
    const onInit = (e: MessageEvent<TtsWorkerMessage>) => {
      if (e.data.type === 'progress') {
        onProgress?.({
          phase: e.data.phase,
          fraction: e.data.fraction,
          file: e.data.file,
          loaded: e.data.loaded,
          total: e.data.total,
        });
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
      reject(new Error(ev.message || 'tts worker crashed during init'));
    };
    // Only the ort ENGINE wasm is bundled (MV3 forbids remote script); the MODEL
    // DATA is fetched from the Hub + cached, so no model URL is passed in.
    const init: TtsWorkerInit = { type: 'init', wasmPaths: extUrl('ort/') };
    worker.postMessage(init);
  });

  // Init has resolved; repurpose onerror. A worker crash MID-SYNTH posts no
  // `synth-error`, so without this the synth promise never settles and the UI
  // hangs on "… Synthesizing" forever. Reject every in-flight request so the
  // caller fails soft to the system voice instead.
  let seq = 0;
  const pending = new Map<number, (err: Error) => void>();
  worker.onerror = (ev) => {
    const err = new Error(ev.message || 'tts worker crashed during synthesis');
    for (const reject of pending.values()) reject(err);
    pending.clear();
  };
  return {
    synthesize(text, { voice = 'af_heart', speed = 1.0 }) {
      const id = ++seq;
      return new Promise<KokoroPcm>((resolve, reject) => {
        pending.set(id, reject);
        const settle = () => {
          worker.removeEventListener('message', onMsg);
          pending.delete(id);
        };
        const onMsg = (e: MessageEvent<TtsWorkerMessage>) => {
          const m = e.data;
          if (m.type === 'result' && m.id === id) {
            settle();
            resolve({ samples: new Float32Array(m.samples), sampleRate: m.sampleRate });
          } else if (m.type === 'synth-error' && m.id === id) {
            settle();
            reject(new Error(m.message));
          }
        };
        worker.addEventListener('message', onMsg);
        worker.postMessage({ type: 'synth', id, text, voice, speed } satisfies TtsWorkerSynth);
      });
    },
    free() {
      worker.terminate();
    },
  };
};

/**
 * Can the on-device engine RUN here? The ort engine wasm is bundled, so this is
 * just a WebAssembly-support check. Whether the MODEL has actually been
 * DOWNLOADED (the user's one-time Settings action) is a separate, settings-backed
 * fact — see ttsStore.isTtsAvailable. Never throws. (The `_glueUrl` arg is
 * retained for ttsStore call-site compatibility.)
 */
export async function isKokoroGlueReachable(_glueUrl?: string): Promise<boolean> {
  return typeof WebAssembly !== 'undefined';
}
