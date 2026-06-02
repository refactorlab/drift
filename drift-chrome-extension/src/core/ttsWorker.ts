/// <reference lib="webworker" />
// Off-main-thread Kokoro synthesis — the audio counterpart of scanWorker.ts.
// Loading the ~92 MB ONNX model and running inference are heavy, synchronous,
// uninterruptible CPU calls; on the page they froze the whole side panel (the
// "browser stuck on Listen" symptom). In this worker they block only THIS
// thread, so the UI stays responsive (spinner paints, clock ticks) while we
// post nothing back but the final PCM.
//
// The worker is PERSISTENT: the model is loaded once on `init`, then every
// `synth` reuses it — so re-pressing Listen (or switching voices) is fast and
// never reloads the model. chrome.* is unavailable here, so the page passes the
// packaged asset URLs in via the init message.

import { KOKORO_MODEL_ID, KOKORO_DTYPE } from './ttsConstants';

export type TtsWorkerInit = {
  type: 'init';
  /** env.backends.onnx.wasm.wasmPaths — chrome-extension://<id>/ort/ (bundled). */
  wasmPaths: string;
};
export type TtsWorkerSynth = { type: 'synth'; id: number; text: string; voice: string; speed: number };
export type TtsWorkerRequest = TtsWorkerInit | TtsWorkerSynth;

export type TtsWorkerMessage =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  /** Model-download progress, emitted during init (first load only). */
  | { type: 'progress'; phase: string; file?: string; loaded?: number; total?: number; fraction: number | null }
  | { type: 'result'; id: number; samples: ArrayBuffer; sampleRate: number }
  | { type: 'synth-error'; id: number; message: string };

const post = (msg: TtsWorkerMessage, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer);

type Tts = {
  generate: (text: string, opts: { voice: string; speed: number }) => Promise<{ audio: Float32Array; sampling_rate: number }>;
};

let ttsPromise: Promise<Tts> | null = null;

/** transformers.js progress_callback payload (a subset we care about). */
type HfProgress = { status: string; file?: string; name?: string; progress?: number; loaded?: number; total?: number };

/** Map a transformers progress event → a worker `progress` message. */
function reportProgress(p: HfProgress): void {
  const file = p.file ?? p.name;
  const fraction = typeof p.progress === 'number' ? Math.max(0, Math.min(1, p.progress / 100)) : null;
  const phase =
    p.status === 'progress' && file ? `Downloading ${file}` : `${p.status}${file ? ` · ${file}` : ''}`;
  post({ type: 'progress', phase, file, loaded: p.loaded, total: p.total, fraction });
}

async function init(msg: TtsWorkerInit): Promise<Tts> {
  const { env } = await import('@huggingface/transformers');
  // Fetch the MODEL DATA from the Hugging Face Hub and let transformers persist
  // it in CacheStorage (default useBrowserCache) — first load downloads, every
  // later load is an offline cache hit. (Only data is fetched; the ort engine
  // wasm below is bundled, so MV3's no-remote-code rule is respected.)
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  const wasm = env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.numThreads = 1; // extension pages aren't cross-origin-isolated → no SAB threads
    wasm.proxy = false; // already off the page's main thread; no nested worker
    wasm.wasmPaths = msg.wasmPaths;
  }
  const { KokoroTTS } = await import('kokoro-js');
  return KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
    dtype: KOKORO_DTYPE,
    device: 'wasm',
    progress_callback: reportProgress,
  }) as unknown as Promise<Tts>;
}

self.onmessage = async (e: MessageEvent<TtsWorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      ttsPromise = init(msg);
      await ttsPromise;
      post({ type: 'ready' });
    } catch (err) {
      ttsPromise = null;
      post({ type: 'init-error', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // synth
  try {
    if (!ttsPromise) throw new Error('tts worker not initialised');
    const tts = await ttsPromise;
    // Voice style vectors are fetched from the Hub on first use and cached by
    // kokoro-js (same CacheStorage persistence as the model) — no seeding needed.
    const out = await tts.generate(msg.text, { voice: msg.voice, speed: msg.speed });
    // Copy to a standalone, exactly-sized buffer we can transfer (zero-copy).
    const buf = out.audio.slice().buffer;
    post({ type: 'result', id: msg.id, samples: buf, sampleRate: out.sampling_rate }, [buf]);
  } catch (err) {
    post({ type: 'synth-error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
