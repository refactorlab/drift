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
import { getSettings, onSettingsChange, type Settings } from '../state/settings';
import { makeGeminiBrainFactory } from './geminiBrain';

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

/** Pick the brain factory for the given settings: Gemini when selected AND a key
 *  is present; otherwise the on-device WebLLM brain. */
function pickFactory(s: Settings): BrainFactory {
  return s.brainMode === 'gemini' && s.geminiApiKey
    ? makeGeminiBrainFactory({ apiKey: s.geminiApiKey, model: s.geminiModel })
    : defaultBrainFactory;
}

/** Identity of the brain-relevant settings, so an unrelated change (theme, etc.)
 *  never tears down a loaded brain. */
const brainKey = (s: Settings): string =>
  `${s.brainMode ?? 'local'}|${s.geminiModel ?? ''}|${s.geminiApiKey ? 'set' : ''}`;

let selectorInstalled = false;
/**
 * Wire brain selection to persisted settings: pick the factory now, and re-pick
 * (freeing the previous runtime) whenever a brain-relevant field changes. Call
 * once at side-panel startup, before the first getSharedBrain(). Idempotent.
 */
export async function installBrainSelector(): Promise<void> {
  if (selectorInstalled) return;
  selectorInstalled = true;
  const s0 = await getSettings();
  let prev = brainKey(s0);
  setBrainFactory(pickFactory(s0));
  onSettingsChange((s) => {
    if (brainKey(s) === prev) return; // unrelated settings change — leave the brain alone
    prev = brainKey(s);
    freeSharedBrain(); // terminate the previous runtime (e.g. the WebLLM worker)
    setBrainFactory(pickFactory(s));
  });
}
