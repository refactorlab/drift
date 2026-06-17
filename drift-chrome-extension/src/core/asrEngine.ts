// App-wide shared ASR runtime. The Whisper model + ort engine load once and are
// shared by push-to-talk and the duplex voice controller. Self-heals like the
// brain/TTS singletons: a rejected load drops the cache so a later call retries.

import { defaultAsrFactory, type AsrFactory, type AsrProgress, type AsrRuntime } from './asrRuntime';

let shared: Promise<AsrRuntime> | null = null;
let factory: AsrFactory = defaultAsrFactory;

/** Override the factory (tests inject a fake). Resets any cached runtime. */
export function setAsrFactory(f: AsrFactory): void {
  factory = f;
  shared = null;
}

/** Get the shared ASR runtime, loading it on first use. `onProgress` only fires
 *  on the first (loading) call. Self-heals on failure. */
export function getSharedAsr(onProgress?: (p: AsrProgress) => void): Promise<AsrRuntime> {
  if (!shared) shared = factory(onProgress);
  return shared.catch((e) => {
    shared = null;
    throw e;
  });
}

/** Drop the shared runtime (terminate the worker). */
export function freeSharedAsr(): void {
  const cur = shared;
  shared = null;
  void cur?.then((rt) => rt.free()).catch(() => {});
}
