/// <reference lib="webworker" />
// Off-main-thread Whisper transcription — the speech-input counterpart of
// ttsWorker.ts (Kokoro) and brainWorker.ts (Qwen). Reuses the SAME bundled
// engine as the TTS worker: @huggingface/transformers running onnxruntime-web
// from public/ort/. Loading the model + running inference are heavy synchronous
// CPU calls, so they live here, off the page.
//
// PERSISTENT: the ASR pipeline loads once on `init`, then every `transcribe`
// reuses it. chrome.* is unavailable here, so the page passes the bundled ort
// path in via the init message (identical to ttsWorker).

import { ASR_DTYPE, ASR_MODEL_ID } from './asrConstants';

export type AsrWorkerInit = { type: 'init'; wasmPaths: string };
export type AsrWorkerTranscribe = { type: 'transcribe'; id: number; samples: ArrayBuffer };
export type AsrWorkerRequest = AsrWorkerInit | AsrWorkerTranscribe;

export type AsrWorkerMessage =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'progress'; phase: string; file?: string; loaded?: number; total?: number; fraction: number | null }
  | { type: 'result'; id: number; text: string }
  | { type: 'transcribe-error'; id: number; message: string };

const post = (msg: AsrWorkerMessage) => (self as unknown as Worker).postMessage(msg);

/** A transformers ASR pipeline: `(audio) => { text }`. */
type AsrPipe = (audio: Float32Array) => Promise<{ text: string }>;

let asrPromise: Promise<AsrPipe> | null = null;

type HfProgress = { status: string; file?: string; name?: string; progress?: number; loaded?: number; total?: number };

function reportProgress(p: HfProgress): void {
  const file = p.file ?? p.name;
  const fraction = typeof p.progress === 'number' ? Math.max(0, Math.min(1, p.progress / 100)) : null;
  const phase = p.status === 'progress' && file ? `Downloading ${file}` : `${p.status}${file ? ` · ${file}` : ''}`;
  post({ type: 'progress', phase, file, loaded: p.loaded, total: p.total, fraction });
}

/** Strip Whisper's non-lexical bracket/parenthesis tags (e.g. "(wind blowing)",
 *  "[BLANK_AUDIO]") and collapse whitespace — ported from Volley's cleanAsr. */
export function cleanAsr(text: string): string {
  return (text || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function init(msg: AsrWorkerInit): Promise<AsrPipe> {
  const { env, pipeline } = await import('@huggingface/transformers');
  // Fetch model DATA from the Hub and let transformers cache it (offline after
  // first load). Only data is fetched; the ort ENGINE wasm is bundled.
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  const wasm = env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.numThreads = 1; // extension pages aren't cross-origin-isolated → no SAB threads
    wasm.proxy = false; // already off the page's main thread
    wasm.wasmPaths = msg.wasmPaths;
  }
  const pipe = (await pipeline('automatic-speech-recognition', ASR_MODEL_ID, {
    device: 'wasm',
    dtype: ASR_DTYPE,
    progress_callback: reportProgress,
  })) as unknown as AsrPipe;
  return pipe;
}

self.onmessage = async (e: MessageEvent<AsrWorkerRequest>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      asrPromise = init(msg);
      await asrPromise;
      post({ type: 'ready' });
    } catch (err) {
      asrPromise = null;
      post({ type: 'init-error', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // transcribe
  try {
    if (!asrPromise) throw new Error('asr worker not initialised');
    const pipe = await asrPromise;
    const samples = new Float32Array(msg.samples); // 16 kHz mono f32
    const out = await pipe(samples);
    post({ type: 'result', id: msg.id, text: cleanAsr(out.text) });
  } catch (err) {
    post({ type: 'transcribe-error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
