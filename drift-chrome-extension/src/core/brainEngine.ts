// App-wide shared brain runtime. WebLLM holds ~1.1 GB of weights on the GPU, so
// we load the engine ONCE and share it across the chat surface (text + voice
// modes). Self-heals: if the load rejects, the cached promise is dropped so the
// next call retries (a transient first-load failure can't wedge the session) —
// the same discipline as ttsEngine.getSharedTtsProvider.

import {
  defaultBrainFactory,
  type BrainFactory,
  type BrainProgress,
  type BrainRuntime,
} from './brainRuntime';

let shared: Promise<BrainRuntime> | null = null;
let factory: BrainFactory = defaultBrainFactory;

/** Override the factory (tests inject a fake). Resets any cached runtime. */
export function setBrainFactory(f: BrainFactory): void {
  factory = f;
  shared = null;
}

/**
 * Get the shared brain, loading it on first use. `onProgress` only fires on the
 * first (loading) call. Rejects if WebLLM can't load (no WebGPU, model not
 * downloaded yet, etc.) — and drops the cache so a later call can retry.
 */
export function getSharedBrain(onProgress?: (p: BrainProgress) => void): Promise<BrainRuntime> {
  if (!shared) shared = factory(onProgress);
  return shared.catch((e) => {
    shared = null; // self-heal: allow a retry once the model is downloaded
    throw e;
  });
}

/** Drop the shared runtime (terminate the worker). Used on teardown / model change. */
export function freeSharedBrain(): void {
  const cur = shared;
  shared = null;
  void cur?.then((rt) => rt.free()).catch(() => {});
}
