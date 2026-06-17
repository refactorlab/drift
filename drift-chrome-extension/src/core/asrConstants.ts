// Shared ASR (speech-to-text) constants, used by BOTH the main-thread runtime
// (asrRuntime.ts) and the transcription worker (asrWorker.ts) — kept separate so
// the worker doesn't import the runtime (which would pull a `new Worker(...)`
// spawn into the worker bundle).

/** Whisper tiny (English), ONNX, q8 ≈ 40 MB. Fetched from the Hub on first use
 *  and cached by transformers.js in CacheStorage (offline thereafter) — the same
 *  engine (@huggingface/transformers + onnxruntime-web under public/ort/) the
 *  Kokoro TTS worker already uses. */
export const ASR_MODEL_ID = 'onnx-community/whisper-tiny.en';
export const ASR_DTYPE = 'q8';

/** Whisper expects 16 kHz mono f32 input. */
export const ASR_SAMPLE_RATE = 16_000;
