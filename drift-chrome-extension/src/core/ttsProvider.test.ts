import { describe, it, expect, vi } from 'vitest';
import { createTtsProvider, voiceToSid, KOKORO_VOICE_SID, DEFAULT_SID } from './ttsProvider';
import { readWavHeader, KOKORO_SAMPLE_RATE } from './wav';
import type { KokoroRuntime } from './kokoroRuntime';

// A fake Kokoro engine: records the (text, sid) it was asked to speak and
// returns a fixed-length silent buffer — so the provider's sanitise → synth →
// WAV path is exercised without the ~80MB model.
function fakeRuntime(seconds = 0.5): KokoroRuntime & { calls: { text: string; sid: number }[] } {
  const calls: { text: string; sid: number }[] = [];
  return {
    calls,
    async synthesize(text, { sid }) {
      calls.push({ text, sid });
      return { samples: new Float32Array(Math.round(KOKORO_SAMPLE_RATE * seconds)), sampleRate: KOKORO_SAMPLE_RATE };
    },
    free() {},
  };
}

describe('voiceToSid — catalog + fail-soft', () => {
  it('maps a known voice to its speaker id', () => {
    expect(voiceToSid('am_michael')).toEqual({ voice: 'am_michael', sid: KOKORO_VOICE_SID.am_michael, fellBack: false });
  });
  it('falls back to af_heart for an unknown name', () => {
    expect(voiceToSid('nope')).toEqual({ voice: 'af_heart', sid: DEFAULT_SID, fellBack: true });
  });
  it('falls back for an illegal-charset name (no case escape)', () => {
    expect(voiceToSid('af heart!')).toMatchObject({ voice: 'af_heart', fellBack: true });
  });
  it('falls back when unset', () => {
    expect(voiceToSid(undefined).fellBack).toBe(true);
  });
});

describe('KokoroWasmTtsProvider', () => {
  it('isAvailable reflects whether the runtime loads', async () => {
    expect(await createTtsProvider(async () => fakeRuntime()).isAvailable()).toBe(true);
    expect(
      await createTtsProvider(async () => {
        throw new Error('assets not staged');
      }).isAvailable(),
    ).toBe(false);
  });

  it('sanitises, synthesizes, and returns a playable WAV', async () => {
    const rt = fakeRuntime(0.5);
    const provider = createTtsProvider(async () => rt);
    const res = await provider.synthesize({ text: 'We changed the API in comment.test.ts.', voice: 'am_michael' });

    // The model received SANITISED text (acronym lowered, extension de-spelled).
    expect(rt.calls[0].text).toBe('We changed the api in comment test ts.');
    expect(rt.calls[0].sid).toBe(KOKORO_VOICE_SID.am_michael);

    const h = readWavHeader(res.wav);
    expect(h.sampleRate).toBe(KOKORO_SAMPLE_RATE);
    expect(res.voice).toBe('am_michael');
    expect(res.durationSeconds).toBeCloseTo(0.5, 2);
    expect(res.spoken).toBe('We changed the api in comment test ts.');
  });

  it('loads the runtime once and caches it across calls', async () => {
    const load = vi.fn(async () => fakeRuntime());
    const provider = createTtsProvider(load);
    await provider.synthesize({ text: 'one.' });
    await provider.synthesize({ text: 'two.' });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('self-heals after a transient load failure — retries instead of caching the rejection', async () => {
    // The provider is now an app-wide singleton (ttsEngine). A failed first load
    // must NOT wedge it forever: the cached rejected promise has to be dropped so
    // the next synth retries the load. (Pre-fix, `this.runtime ??= load()` kept the
    // rejection and every later synth threw the same stale error.)
    let attempt = 0;
    const load = vi.fn(async () => {
      if (++attempt === 1) throw new Error('transient: engine still warming');
      return fakeRuntime();
    });
    const provider = createTtsProvider(load);

    await expect(provider.synthesize({ text: 'hello.' })).rejects.toThrow(/transient/);
    // Second attempt retries the load and succeeds.
    const res = await provider.synthesize({ text: 'hello.' });
    expect(res.wav.length).toBeGreaterThan(0);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('throws (caller skips audio) when nothing survives sanitising', async () => {
    const provider = createTtsProvider(async () => fakeRuntime());
    await expect(provider.synthesize({ text: '🎉🚀' })).rejects.toThrow(/nothing to speak/i);
  });

  it('honours an abort signal', async () => {
    const provider = createTtsProvider(async () => fakeRuntime());
    const ac = new AbortController();
    ac.abort();
    await expect(provider.synthesize({ text: 'hello.', signal: ac.signal })).rejects.toThrow(/abort/i);
  });
});
