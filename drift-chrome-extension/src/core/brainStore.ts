// Readiness + acquisition for the in-tab LLM brain (Qwen via WebLLM) — the chat
// counterpart of ttsStore.ts. The brain has two parts with different lifecycles:
//
//   • ENGINE — WebLLM's wasm/WebGPU runtime, bundled with the extension. "Can it
//              run here?" reduces to a WebGPU-support check (isBrainSupported).
//   • MODEL  — Qwen2.5-1.5B-Instruct (~1.1 GB). Non-code DATA, NOT bundled. It is
//              DOWNLOADED on demand — a deliberate, one-time Settings action
//              (downloadBrain) — and WebLLM persists it in IndexedDB, so every
//              later load is an offline cache hit.
//
// Two entry points, deliberately separate so nothing downloads 1.1 GB behind the
// user's back:
//   • ensureBrain(): a cheap PROBE. "ready" iff the model is already downloaded;
//     otherwise throws (caller shows the Settings download).
//   • downloadBrain(): the explicit DOWNLOAD, with progress. After it succeeds
//     isBrainAvailable() is true and the chat uses the brain.

import { getSettings, patchSettings, type BrainMeta } from '../state/settings';
import { BRAIN_MODEL_BYTES, BRAIN_VERSION } from './brainConstants';
import {
  defaultBrainFactory,
  isBrainSupported,
  type BrainFactory,
  type BrainProgress,
  type BrainRuntime,
} from './brainRuntime';

export type AcquireProgress = { phase: string; fraction: number | null };
export type AcquireStatus = 'ready' | 'acquired' | 'updated';
export type AcquireResult = { status: AcquireStatus; meta: BrainMeta };

/**
 * Cheap PROBE — never downloads. Resolves "ready" only when the model has
 * already been downloaded (recorded in settings); otherwise throws so the caller
 * points the user at the Settings download. Throws when WebGPU is unavailable.
 */
export async function ensureBrain(onProgress?: (p: AcquireProgress) => void): Promise<AcquireResult> {
  const log = onProgress ?? (() => {});
  log({ phase: 'Checking AI engine…', fraction: null });

  if (!(await isBrainSupported())) {
    throw new Error('WebGPU unavailable — no on-device AI');
  }

  const have = (await getSettings()).brain ?? null;
  if (have && have.source === 'remote') {
    log({ phase: `AI model ready · ${have.version}`, fraction: 1 });
    return { status: 'ready', meta: have };
  }
  throw new Error('AI model not downloaded — download it in Settings');
}

/**
 * DOWNLOAD the Qwen model (the user's one-time Settings action) and record it.
 * Loading a runtime fetches + compiles the model; WebLLM caches it in IndexedDB,
 * so this is the moment the ~1.1 GB lands on disk. Idempotent: if the current
 * version is already downloaded it short-circuits to "ready".
 */
export async function downloadBrain(
  onProgress?: (p: AcquireProgress) => void,
  factory: BrainFactory = defaultBrainFactory,
): Promise<AcquireResult> {
  const log = onProgress ?? (() => {});

  if (!(await isBrainSupported())) {
    throw new Error('WebGPU unavailable — no on-device AI');
  }

  const have = (await getSettings()).brain ?? null;
  if (have && have.source === 'remote' && have.version === BRAIN_VERSION) {
    log({ phase: `AI model ready · ${BRAIN_VERSION}`, fraction: 1 });
    return { status: 'ready', meta: have };
  }

  log({ phase: 'Downloading AI model… (~1.1 GB, one time)', fraction: 0 });

  const onTick = (p: BrainProgress) => log({ phase: p.phase, fraction: p.fraction });
  const rt = await loadBrainRuntime(factory, onTick);
  rt.free(); // we only wanted the download/cache warm; release the worker

  const meta: BrainMeta = {
    version: BRAIN_VERSION,
    bytes: BRAIN_MODEL_BYTES,
    source: 'remote',
    acquiredAt: Date.now(),
  };
  await patchSettings({ brain: meta });
  log({ phase: `AI model ready · ${BRAIN_VERSION}`, fraction: 1 });
  return { status: have ? 'updated' : 'acquired', meta };
}

/**
 * CHEAP availability check used by the chat UI to decide whether to use the
 * brain. True iff WebGPU is present AND the model has been downloaded. Never throws.
 */
export async function isBrainAvailable(): Promise<boolean> {
  try {
    if (!(await isBrainSupported())) return false;
    return (await getSettings()).brain?.source === 'remote';
  } catch {
    return false;
  }
}

/** Build a ready brain runtime. `factory` is injected for tests. `onProgress`
 *  streams the model download (first load only). */
export async function loadBrainRuntime(
  factory: BrainFactory = defaultBrainFactory,
  onProgress?: (p: BrainProgress) => void,
): Promise<BrainRuntime> {
  return factory(onProgress);
}
