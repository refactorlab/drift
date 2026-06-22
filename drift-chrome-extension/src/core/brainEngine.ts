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
import { makeOllamaBrainFactory } from './ollamaBrain';

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
  // Wait for the selector to pick the factory from settings BEFORE loading — otherwise the
  // first call could race ahead on the default (WebLLM) even though the user chose Ollama.
  if (!shared) shared = (installing ?? Promise.resolve()).then(() => factory(onProgress));
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

/** Pick the brain factory for the given settings: Gemini when selected AND a key is
 *  present; Ollama when selected AND a model is chosen; otherwise the on-device WebLLM
 *  brain. (A half-configured provider falls back to local rather than failing every turn.) */
function pickFactory(s: Settings): BrainFactory {
  // 'gemini-live' uses the SAME Gemini text brain for TYPED chat; its voice path
  // (Gemini Live audio) is a separate controller, not a BrainRuntime.
  if ((s.brainMode === 'gemini' || s.brainMode === 'gemini-live') && s.geminiApiKey) {
    return makeGeminiBrainFactory({ apiKey: s.geminiApiKey, model: s.geminiModel });
  }
  if (s.brainMode === 'ollama' && s.ollamaModel) {
    return makeOllamaBrainFactory({ baseUrl: s.ollamaBaseUrl, model: s.ollamaModel });
  }
  return defaultBrainFactory;
}

/** Identity of the brain-relevant settings, so an unrelated change (theme, etc.)
 *  never tears down a loaded brain. */
const brainKey = (s: Settings): string =>
  [s.brainMode ?? 'local', s.geminiModel ?? '', s.geminiLiveModel ?? '', s.geminiApiKey ? 'set' : '', s.ollamaBaseUrl ?? '', s.ollamaModel ?? ''].join('|');

let installing: Promise<void> | null = null;
/**
 * Wire brain selection to persisted settings: pick the factory now, and re-pick
 * (freeing the previous runtime) whenever a brain-relevant field changes. Call
 * once at side-panel startup; getSharedBrain() awaits the returned promise so the
 * first generation can't race ahead of the picked factory. Idempotent.
 */
export function installBrainSelector(): Promise<void> {
  if (!installing) {
    installing = (async () => {
      const s0 = await getSettings();
      let prev = brainKey(s0);
      setBrainFactory(pickFactory(s0));
      onSettingsChange((s) => {
        if (brainKey(s) === prev) return; // unrelated settings change — leave the brain alone
        prev = brainKey(s);
        freeSharedBrain(); // terminate the previous runtime (e.g. the WebLLM worker)
        setBrainFactory(pickFactory(s));
      });
    })();
  }
  return installing;
}
