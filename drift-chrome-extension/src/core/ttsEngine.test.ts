import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import type { KokoroRuntime } from './kokoroRuntime';

// The shared engine builds its provider with a loader that calls
// ttsStore.loadKokoroRuntime. We mock JUST that loader so we can count how many
// times the (real) provider actually loads the model — the whole point of the
// singleton is that it loads ONCE and is reused, instead of once per consumer.
const loadKokoroRuntime = vi.fn();
vi.mock('./ttsStore', () => ({
  loadKokoroRuntime: (...a: unknown[]) => loadKokoroRuntime(...a),
}));

import { getSharedTtsProvider, __resetSharedTtsProvider } from './ttsEngine';

function fakeRuntime(): KokoroRuntime {
  return {
    async synthesize() {
      return { samples: new Float32Array(2400), sampleRate: 24000 };
    },
    free() {},
  };
}

describe('ttsEngine — the app-wide shared Kokoro provider', () => {
  beforeEach(() => {
    installChromeMock();
    __resetSharedTtsProvider();
    loadKokoroRuntime.mockReset();
    loadKokoroRuntime.mockResolvedValue(fakeRuntime());
  });

  it('hands back the SAME provider instance to every caller', () => {
    // The pipeline and SpokenSummary both call this; they must get one engine.
    expect(getSharedTtsProvider()).toBe(getSharedTtsProvider());
  });

  it('loads the 92 MB model ONCE across many synths from the shared provider', async () => {
    // Simulate the pipeline's eager synth then the card's later synth: both go
    // through the one shared provider, so the model loads a single time — the fix
    // for "it loads again after the scan is done".
    const pipeline = getSharedTtsProvider();
    await pipeline.synthesize({ text: 'Eager pipeline synth.' });

    const card = getSharedTtsProvider();
    await card.synthesize({ text: 'Later card synth.' });

    expect(card).toBe(pipeline);
    expect(loadKokoroRuntime).toHaveBeenCalledTimes(1); // ← never a second load
  });

  it('builds a fresh provider after reset (test seam only)', () => {
    const first = getSharedTtsProvider();
    __resetSharedTtsProvider();
    expect(getSharedTtsProvider()).not.toBe(first);
  });
});
