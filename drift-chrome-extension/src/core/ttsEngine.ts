// The app-wide Kokoro voice ENGINE — a single shared TtsProvider.
//
// WHY THIS EXISTS: the live-scan pipeline (LivePipelineRun) and the playback card
// (SpokenSummary) each used to build their OWN provider via createTtsProvider().
// Each provider spawns its own worker and loads the ~92 MB Kokoro model
// independently — so a scan would load the model once (its eager "Spoken summary"
// step) and then the card would load it AGAIN the first time it had to synthesize
// (a replay cache-miss, a failed eager synth, a voice change). That second load is
// the "it's loading again after the scan is done" the user hit.
//
// Routing both through ONE persistent provider means the worker spins up and the
// model loads exactly ONCE per side-panel session; every later synthesis — eager
// or lazy, pipeline or card — reuses the warm worker. The provider self-heals on a
// failed load (see KokoroWasmTtsProvider.get) so a transient first-load error
// can't wedge the shared engine for the rest of the session.

import { getSettings } from '../state/settings';
import { createTtsProvider, type TtsProvider } from './ttsProvider';
import { loadKokoroRuntime } from './ttsStore';

let shared: TtsProvider | null = null;

/**
 * The one Kokoro provider for the whole app. Lazily constructed (no worker/model
 * work until the first `synthesize`/`isAvailable`), then reused for the panel's
 * lifetime. Both the pipeline and SpokenSummary call this so they share a single
 * warm engine instead of loading the model twice.
 */
export function getSharedTtsProvider(): TtsProvider {
  return (shared ??= createTtsProvider(async () => {
    const { ttsUrl } = await getSettings();
    return loadKokoroRuntime(ttsUrl);
  }));
}

/** Test seam: drop the singleton so the next call builds a fresh provider. */
export function __resetSharedTtsProvider(): void {
  shared = null;
}
