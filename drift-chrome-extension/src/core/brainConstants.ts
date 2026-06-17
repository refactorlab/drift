// Shared brain (in-browser LLM) constants, used by BOTH the main-thread runtime
// (brainRuntime.ts) and the inference worker (brainWorker.ts) — kept in their
// own module so the worker doesn't import the runtime (which would pull a
// `new Worker(...)` spawn into the worker bundle).

/** The in-browser brain: Qwen 2.5 1.5B Instruct (NOT coder), 4-bit WebGPU build.
 *  ~1.1 GB; WebLLM downloads it once and caches it in IndexedDB. The compiled
 *  context window is ~4k tokens (see chatContext budgeting). */
export const BRAIN_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

/** Advertised download size (≈1.1 GB) — display only. */
export const BRAIN_MODEL_BYTES = 1_100_000_000;

/** Version tag recorded in settings once the model is downloaded. */
export const BRAIN_VERSION = BRAIN_MODEL_ID;

/** Hard cap on the LLM's reply length when running locally. Qwen's compiled
 *  context window is ~4k tokens, so a bounded output (a) keeps the input+output
 *  inside that window and (b) keeps replies snappy on WebGPU. 1000–1500 is the
 *  sweet spot; tune here — it's the single source for the generate cap and the
 *  context-budget output reserve. */
export const MAX_OUTPUT_TOKENS = 1200;

/** Default system prompt / persona for the assistant. */
export const DEFAULT_PERSONA =
  'You are Andy, a concise, friendly AI assistant running entirely on-device in a ' +
  "browser side panel. You help the user reason about code and pull requests. Keep " +
  'replies short and conversational unless asked for detail.';
