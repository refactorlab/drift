import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, type ChromeMock } from '../test/chromeMock';
import { getStoredAudio, loadAudio } from './audio';
import type { AudioRef } from '../core/types';

const AUDIO: AudioRef = {
  url: 'https://github.com/o/r/actions/runs/1/artifacts/2',
  label: '🔊 Listen to the spoken summary',
};

describe('loadAudio (end-to-end through the messaging layer)', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });

  it('sends a binary FETCH_ARTIFACT and returns the data URL', async () => {
    const seen = vi.fn();
    mock.setResponder((msg) => {
      seen(msg);
      return {
        ok: true,
        fetched: { ok: true, dataUrl: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', bytes: 321 },
      };
    });
    const res = await loadAudio(AUDIO);
    expect(seen).toHaveBeenCalledWith({ type: 'FETCH_ARTIFACT', url: AUDIO.url, binary: true });
    expect(res).toEqual({
      ok: true,
      dataUrl: 'data:audio/mpeg;base64,AAAA',
      mime: 'audio/mpeg',
      bytes: 321,
      cached: false,
    });
  });

  it('surfaces a worker-level download failure', async () => {
    mock.setResponder(() => ({ ok: true, fetched: { ok: false, error: 'HTTP 404' } }));
    expect(await loadAudio(AUDIO)).toEqual({ ok: false, error: 'HTTP 404' });
  });

  it('surfaces a runtime-level error response', async () => {
    mock.setResponder(() => ({ ok: false, error: 'no content script' }));
    expect(await loadAudio(AUDIO)).toEqual({ ok: false, error: 'no content script' });
  });

  it('defaults the mime when the worker omits it', async () => {
    mock.setResponder(() => ({ ok: true, fetched: { ok: true, dataUrl: 'data:x;base64,AA' } }));
    const res = await loadAudio(AUDIO);
    expect(res).toMatchObject({ ok: true, mime: 'audio/mpeg' });
  });
});

describe('loadAudio caching (keyed by the unique artifact URL)', () => {
  let mock: ChromeMock;
  beforeEach(() => {
    mock = installChromeMock();
  });

  it('persists the audio after a successful download', async () => {
    mock.setResponder(() => ({
      ok: true,
      fetched: { ok: true, dataUrl: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', bytes: 321 },
    }));
    await loadAudio(AUDIO);
    const stored = await getStoredAudio(AUDIO.url);
    expect(stored).toMatchObject({ url: AUDIO.url, dataUrl: 'data:audio/mpeg;base64,AAAA', bytes: 321 });
    expect(typeof stored?.loadedAt).toBe('number');
  });

  it('serves the cached copy on a second load without hitting the worker', async () => {
    const responder = vi.fn(() => ({
      ok: true,
      fetched: { ok: true, dataUrl: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', bytes: 321 },
    }));
    mock.setResponder(responder);

    const first = await loadAudio(AUDIO);
    expect(first).toMatchObject({ ok: true, cached: false });

    const second = await loadAudio(AUDIO);
    expect(second).toMatchObject({ ok: true, dataUrl: 'data:audio/mpeg;base64,AAAA', cached: true });
    // The download path ran exactly once — the second call came from cache.
    expect(responder).toHaveBeenCalledTimes(1);
  });

  it('re-downloads when the run changes (new artifact id → new URL → cache miss)', async () => {
    const responder = vi.fn(() => ({
      ok: true,
      fetched: { ok: true, dataUrl: 'data:audio/mpeg;base64,BBBB', mime: 'audio/mpeg', bytes: 9 },
    }));
    mock.setResponder(responder);

    await loadAudio(AUDIO);
    const next: AudioRef = { ...AUDIO, url: 'https://github.com/o/r/actions/runs/2/artifacts/9' };
    const res = await loadAudio(next);

    expect(res).toMatchObject({ ok: true, cached: false });
    expect(responder).toHaveBeenCalledTimes(2);
    // Both artifacts are cached side by side under their unique URLs.
    expect(await getStoredAudio(AUDIO.url)).not.toBeNull();
    expect(await getStoredAudio(next.url)).not.toBeNull();
  });

  it('does not cache a failed download', async () => {
    mock.setResponder(() => ({ ok: true, fetched: { ok: false, error: 'HTTP 404' } }));
    await loadAudio(AUDIO);
    expect(await getStoredAudio(AUDIO.url)).toBeNull();
  });

  it('bounds the cache: loading many artifacts keeps only the most-recent few', async () => {
    mock.setResponder(() => ({
      ok: true,
      fetched: { ok: true, dataUrl: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', bytes: 1 },
    }));
    // Load more distinct artifacts than the cache holds (MAX_AUDIO_CACHE = 8).
    for (let i = 0; i < 11; i++) {
      await loadAudio({ ...AUDIO, url: `https://github.com/o/r/actions/runs/${i}/artifacts/${i}` });
    }
    const all = await chrome.storage.local.get(null);
    const audioKeys = Object.keys(all).filter((k) => k.startsWith('drift:audio:'));
    expect(audioKeys.length).toBe(8);
    // The most-recent artifact is always retained.
    expect(await getStoredAudio('https://github.com/o/r/actions/runs/10/artifacts/10')).not.toBeNull();
  });
});
