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
    wasm.numThreads = 1; // extension pages aren't cross-origin-isolated → no SAB threads (WASM-fallback path only)
    wasm.proxy = false; // already off the page's main thread; no nested worker
    wasm.wasmPaths = msg.wasmPaths;
  }
  const { KokoroTTS } = await import('kokoro-js');

  const loadWasm = () =>
    KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
      dtype: KOKORO_DTYPE,
      device: 'wasm',
      progress_callback: reportProgress,
    }) as unknown as Promise<Tts>;

  // Match Volley: run Kokoro on the GPU (fp32 / WebGPU) — synthesis is ~10× faster
  // there than the q8 / WASM single-thread path. The brain (WebLLM) already uses
  // WebGPU, so it's present. Fall back to q8 / WASM if WebGPU init THROWS — OR if
  // it doesn't finish within a deadline: with two WebGPU models loaded (Qwen +
  // Kokoro) the GPU init can WEDGE (never resolve/reject), which would hang the
  // whole worker `init` and leave voice mode "stuck on Starting". The timeout
  // guarantees we always reach a working engine.
  try {
    const WEBGPU_DEADLINE_MS = 45_000;
    const webgpu = KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
      dtype: 'fp32',
      device: 'webgpu',
      progress_callback: reportProgress,
    }) as unknown as Promise<Tts>;
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('WebGPU Kokoro init timed out')), WEBGPU_DEADLINE_MS),
    );
    return await Promise.race([webgpu, timeout]);
  } catch (err) {
    post({ type: 'progress', phase: `WebGPU unavailable (${err instanceof Error ? err.message : 'init failed'}) → q8/WASM fallback`, fraction: null });
    return await loadWasm();
  }
}

self.onmessage = async (e: MessageEvent<TtsWorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      ttsPromise = init(msg);
      const tts = await ttsPromise;
      // Declare ready as soon as the MODEL is loaded — do NOT block on the warmup.
      // The warmup synth compiles WebGPU shaders, which can be slow or even WEDGE
      // (never resolve) on some GPUs; awaiting it here would hang the worker's
      // `ready`, so loadKokoroRuntime() never resolves and VoiceController.start()
      // gets stuck booting ("stuck on Starting", no listening). So warm up in the
      // BACKGROUND instead — the first real synth still benefits if it wins the race.
      post({ type: 'ready' });
      void (async () => {
        try {
          await tts.generate('Hello there.', { voice: 'af_heart', speed: 1.0 });
        } catch {
          /* warmup is best-effort; a real synth will surface any genuine error */
        }
      })();
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
