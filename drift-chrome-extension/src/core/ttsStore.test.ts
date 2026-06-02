import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import { downloadTts, ensureTts, isTtsAvailable, loadKokoroRuntime, MODEL_VERSION } from './ttsStore';
import { getSettings, patchSettings, type TtsMeta } from '../state/settings';
import type { KokoroAssets, KokoroRuntime, RuntimeFactory, RuntimeProgress } from './kokoroRuntime';

// The Kokoro model is NO LONGER bundled — it is DOWNLOADED on demand (the user's
// one-time Settings action) and transformers caches it. ensureTts is a cheap
// PROBE (ready only once a download is recorded); downloadTts performs the
// fetch. These tests inject a fake runtime factory so no real model is loaded.

const fakeRuntime: KokoroRuntime = {
  async synthesize() {
    return { samples: new Float32Array(1), sampleRate: 24000 };
  },
  free() {},
};

/** A factory that emits a couple of download-progress ticks then resolves. */
function progressFactory(ticks: RuntimeProgress[]): { factory: RuntimeFactory; freed: () => number } {
  let frees = 0;
  const factory: RuntimeFactory = async (_assets, onProgress) => {
    for (const t of ticks) onProgress?.(t);
    return { ...fakeRuntime, free: () => void frees++ };
  };
  return { factory, freed: () => frees };
}

describe('ttsStore.ensureTts — probe only, never downloads', () => {
  beforeEach(() => installChromeMock());
  afterEach(() => vi.restoreAllMocks());

  it('throws when the model has not been downloaded yet', async () => {
    expect((await getSettings()).tts).toBeUndefined();
    await expect(ensureTts()).rejects.toThrow(/download it in Settings/i);
  });

  it('reports ready when a remote download is recorded', async () => {
    const meta: TtsMeta = { version: MODEL_VERSION, bytes: 100, source: 'remote', acquiredAt: 1 };
    await patchSettings({ tts: meta });
    const r = await ensureTts();
    expect(r.status).toBe('ready');
    expect((await getSettings()).tts?.acquiredAt).toBe(1); // untouched — no re-download
  });
});

describe('ttsStore.downloadTts — explicit one-time model download', () => {
  beforeEach(() => installChromeMock());
  afterEach(() => vi.restoreAllMocks());

  it('downloads, records a remote meta, and sums the per-file bytes', async () => {
    const { factory, freed } = progressFactory([
      { phase: 'Downloading model.onnx', file: 'model.onnx', total: 90_000_000, fraction: 0.5 },
      { phase: 'Downloading model.onnx', file: 'model.onnx', total: 90_000_000, fraction: 1 },
      { phase: 'Downloading tokenizer.json', file: 'tokenizer.json', total: 2_000_000, fraction: 1 },
    ]);

    const r = await downloadTts(undefined, factory);
    expect(r.status).toBe('acquired');
    expect(r.meta).toMatchObject({ version: MODEL_VERSION, source: 'remote', bytes: 92_000_000 });
    expect((await getSettings()).tts?.source).toBe('remote');
    expect(freed()).toBe(1); // the warm-up runtime is released
  });

  it('short-circuits to ready (no factory call) when already downloaded', async () => {
    await patchSettings({ tts: { version: MODEL_VERSION, bytes: 1, source: 'remote', acquiredAt: 1 } });
    const factory = vi.fn<RuntimeFactory>(async () => fakeRuntime);
    const r = await downloadTts(undefined, factory);
    expect(r.status).toBe('ready');
    expect(factory).not.toHaveBeenCalled();
  });

  it('streams progress phases (start → ready)', async () => {
    const { factory } = progressFactory([
      { phase: 'Downloading model.onnx', file: 'model.onnx', total: 10, fraction: 1 },
    ]);
    const phases: string[] = [];
    await downloadTts((p) => phases.push(p.phase), factory);
    expect(phases.some((p) => /Downloading Kokoro voice model/i.test(p))).toBe(true);
    expect(phases.at(-1)).toMatch(/ready/i);
  });
});

describe('ttsStore.loadKokoroRuntime — asset resolution + injected factory', () => {
  beforeEach(() => installChromeMock());
  afterEach(() => vi.restoreAllMocks());

  it('resolves the bundled engine dir and hands it to the factory', async () => {
    let seen: KokoroAssets | null = null;
    const rt = await loadKokoroRuntime(undefined, async (assets) => {
      seen = assets;
      return fakeRuntime;
    });
    expect(rt).toBe(fakeRuntime);
    expect(seen!.glueUrl).toContain('ort');
    expect(seen!.baseUrl).toContain('ort');
  });
});

describe('ttsStore.isTtsAvailable — true only once the model is downloaded', () => {
  beforeEach(() => installChromeMock());
  afterEach(() => vi.restoreAllMocks());

  it('is false before any download', async () => {
    expect(await isTtsAvailable()).toBe(false);
  });

  it('is true when a remote download is recorded', async () => {
    await patchSettings({ tts: { version: MODEL_VERSION, bytes: 1, source: 'remote', acquiredAt: 1 } });
    expect(await isTtsAvailable()).toBe(true);
  });
});
