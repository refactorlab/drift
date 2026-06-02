// Readiness + acquisition for the in-tab Kokoro voice engine — the TTS
// counterpart of scannerStore.ts. The engine has two parts with different
// lifecycles:
//
//   • ENGINE  — onnxruntime-web's glue + .wasm. Bundled under public/ort/ (staged
//               from node_modules by scripts/stage-ort.mjs) because MV3 forbids
//               executing remote script. Always present once the extension is
//               installed → "can it run here?" is just a WebAssembly-support check.
//
//   • MODEL   — Kokoro-82M (~92 MB at q8). Non-code DATA, so it is NOT bundled.
//               It is DOWNLOADED on demand — a deliberate, one-time action the
//               user takes in Settings (downloadTts) — and transformers persists
//               it in CacheStorage, so every later load is an offline cache hit.
//
// Two entry points, deliberately separate so nothing downloads 92 MB behind the
// user's back:
//   • ensureTts(): a cheap PROBE. Reports "ready" iff the model has already been
//     downloaded; otherwise throws (caller fails soft to the system voice). Used
//     on launch + in onboarding — it NEVER downloads.
//   • downloadTts(): the explicit DOWNLOAD, with progress. Called by the Settings
//     "Download voice model" button. Once it succeeds, isTtsAvailable() is true
//     and every live scan synthesises with Kokoro by default.

import { getSettings, patchSettings, type TtsMeta } from '../state/settings';
import { KOKORO_DTYPE, KOKORO_MODEL_ID } from './ttsConstants';
import {
  defaultRuntimeFactory,
  isKokoroGlueReachable,
  type KokoroAssets,
  type KokoroRuntime,
  type RuntimeFactory,
  type RuntimeProgress,
} from './kokoroRuntime';

/** Bundled engine dir under public/ (see stage-ort.mjs). */
export const TTS_DIR = 'ort';

/** Stable version tag for the downloaded model (repo id + quantization). */
export const MODEL_VERSION = `${KOKORO_MODEL_ID}@${KOKORO_DTYPE}`;

export type AcquireProgress = { phase: string; fraction: number | null };
export type AcquireStatus = 'ready' | 'acquired' | 'updated';
export type AcquireResult = { status: AcquireStatus; meta: TtsMeta };

/**
 * Resolve where the bundled ENGINE lives. Retained for the injected-factory seam
 * in {@link loadKokoroRuntime}; the worker factory derives the ort path itself
 * (the model comes from the Hub), but tests still assert the resolution.
 */
export async function resolveTtsAssets(_ttsUrl?: string): Promise<KokoroAssets> {
  const base =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(TTS_DIR) : `/${TTS_DIR}`;
  return { glueUrl: base, baseUrl: base };
}

/**
 * Cheap PROBE — never downloads. Resolves "ready" only when the model has
 * already been downloaded (recorded in settings as a `remote` acquisition);
 * otherwise throws so the caller fails soft to the system voice and the user is
 * pointed at the Settings download. Throws when WebAssembly is unavailable too.
 */
export async function ensureTts(onProgress?: (p: AcquireProgress) => void): Promise<AcquireResult> {
  const log = onProgress ?? (() => {});
  log({ phase: 'Checking voice engine…', fraction: null });

  if (!(await isKokoroGlueReachable())) {
    throw new Error('WebAssembly unavailable — no on-device voice');
  }

  const have = (await getSettings()).tts ?? null;
  if (have && have.source === 'remote') {
    log({ phase: `Voice model ready · ${have.version}`, fraction: 1 });
    return { status: 'ready', meta: have };
  }
  throw new Error('voice model not downloaded — download it in Settings');
}

/**
 * DOWNLOAD the Kokoro model (the user's one-time Settings action) and record it.
 * Loading a runtime fetches the model from the Hub; transformers caches it, so
 * this is the moment the ~92 MB lands on disk. Progress is forwarded for the
 * Settings bar. Idempotent: if the current version is already downloaded it
 * short-circuits to "ready" (a cache hit, no network).
 */
export async function downloadTts(
  onProgress?: (p: AcquireProgress) => void,
  factory: RuntimeFactory = defaultRuntimeFactory,
): Promise<AcquireResult> {
  const log = onProgress ?? (() => {});

  if (!(await isKokoroGlueReachable())) {
    throw new Error('WebAssembly unavailable — no on-device voice');
  }

  const have = (await getSettings()).tts ?? null;
  if (have && have.source === 'remote' && have.version === MODEL_VERSION) {
    log({ phase: `Voice model ready · ${MODEL_VERSION}`, fraction: 1 });
    return { status: 'ready', meta: have };
  }

  log({ phase: 'Downloading Kokoro voice model… (~92 MB, one time)', fraction: 0 });

  // Sum the largest reported size per file so the recorded `bytes` reflects the
  // real download, not double-counted progress ticks.
  const totals = new Map<string, number>();
  const onTick = (p: RuntimeProgress) => {
    if (p.file && p.total) totals.set(p.file, Math.max(totals.get(p.file) ?? 0, p.total));
    log({ phase: p.phase, fraction: p.fraction });
  };

  const { ttsUrl } = await getSettings();
  const rt = await loadKokoroRuntime(ttsUrl, factory, onTick);
  rt.free(); // we only wanted the download/cache warm; release the worker

  let bytes = 0;
  for (const t of totals.values()) bytes += t;

  const meta: TtsMeta = { version: MODEL_VERSION, bytes, source: 'remote', acquiredAt: Date.now() };
  await patchSettings({ tts: meta });
  log({ phase: `Voice model ready · ${MODEL_VERSION}`, fraction: 1 });
  return { status: have ? 'updated' : 'acquired', meta };
}

/**
 * CHEAP availability check used by the UI + the live-scan pipeline to decide
 * whether to synthesise with Kokoro. True iff the engine can run here AND the
 * model has been downloaded (the Settings action). Never throws.
 */
export async function isTtsAvailable(_ttsUrl?: string): Promise<boolean> {
  try {
    if (!(await isKokoroGlueReachable())) return false;
    return (await getSettings()).tts?.source === 'remote';
  } catch {
    return false;
  }
}

/**
 * Build a ready Kokoro runtime. `factory` is injected for tests; production uses
 * the real kokoro-js loader (which downloads/caches the model on first use).
 * `onProgress` streams the model download (first load only).
 */
export async function loadKokoroRuntime(
  ttsUrl?: string,
  factory: RuntimeFactory = defaultRuntimeFactory,
  onProgress?: (p: RuntimeProgress) => void,
): Promise<KokoroRuntime> {
  const assets = await resolveTtsAssets(ttsUrl);
  return factory(assets, onProgress);
}
