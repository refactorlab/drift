// Shared Kokoro constants used by BOTH the main-thread runtime (kokoroRuntime.ts)
// and the synthesis worker (ttsWorker.ts). Kept in their own module so the worker
// doesn't import the runtime (which would pull its own `new Worker(...)` spawn
// into the worker bundle and confuse the bundler).

/** Bundled Kokoro model: HF repo id (= on-disk layout under public/models/<id>/)
 *  + the quantization variant we ship. q8 ≈ 92 MB. */
export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
export const KOKORO_DTYPE = 'q8';

/** CacheStorage name + URL kokoro-js uses internally for voice style vectors. We
 *  pre-seed this cache from the BUNDLED voices so synthesis is fully offline.
 *  Must match kokoro-js internals (pinned via the dependency version). */
export const VOICE_CACHE = 'kokoro-voices';
export const voiceHubUrl = (voice: string) =>
  `https://huggingface.co/${KOKORO_MODEL_ID}/resolve/main/voices/${voice}.bin`;
