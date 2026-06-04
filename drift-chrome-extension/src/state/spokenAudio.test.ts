import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import {
  saveSpokenAudio,
  getSpokenAudio,
  removeSpokenAudio,
  removeSpokenAudioForUrl,
  MAX_SPOKEN_AUDIO,
} from './spokenAudio';
import type { PreparedAudio } from '../core/ttsProvider';

// A tiny non-trivial WAV-ish payload (real bytes, incl. 0 and 255 to catch any
// base64 corruption at the byte boundaries).
const wavOf = (seed: number): Uint8Array =>
  new Uint8Array([0, 255, seed & 0xff, (seed * 7) & 0xff, 128, 1, 2, 3]);
const audioOf = (seed: number): PreparedAudio => ({
  wav: wavOf(seed),
  voice: 'af_heart',
  durationSeconds: 12.5,
});

const PR = 'https://github.com/acme/web/pull/1';
const id = (sha: string, ts: number) => `${PR}@${sha}@${ts}`;

describe('spokenAudio — persist & replay the live-scan WAV', () => {
  beforeEach(() => {
    installChromeMock();
  });

  it('round-trips the WAV bytes byte-for-byte through storage', async () => {
    const a = audioOf(42);
    await saveSpokenAudio(id('abc', 100), a);
    const back = await getSpokenAudio(id('abc', 100));
    expect(back).not.toBeNull();
    expect(Array.from(back!.wav)).toEqual(Array.from(a.wav));
    expect(back!.voice).toBe('af_heart');
    expect(back!.durationSeconds).toBe(12.5);
  });

  it('returns null for a scan that was never saved (→ caller re-synthesizes)', async () => {
    expect(await getSpokenAudio(id('missing', 1))).toBeNull();
  });

  it('persists into chrome.storage.local under a drift:spoken: key', async () => {
    await saveSpokenAudio(id('abc', 100), audioOf(1));
    const all = await chrome.storage.local.get(null);
    expect(Object.keys(all).some((k) => k.startsWith('drift:spoken:'))).toBe(true);
  });

  it('removeSpokenAudio drops just that one clip', async () => {
    await saveSpokenAudio(id('a', 1), audioOf(1));
    await saveSpokenAudio(id('b', 2), audioOf(2));
    await removeSpokenAudio(id('a', 1));
    expect(await getSpokenAudio(id('a', 1))).toBeNull();
    expect(await getSpokenAudio(id('b', 2))).not.toBeNull();
  });

  it('removeSpokenAudioForUrl clears every clip for that PR, leaving others', async () => {
    await saveSpokenAudio(id('a', 1), audioOf(1));
    await saveSpokenAudio(id('b', 2), audioOf(2));
    const OTHER = 'https://github.com/acme/web/pull/2@x@9';
    await saveSpokenAudio(OTHER, audioOf(3));
    await removeSpokenAudioForUrl(PR);
    expect(await getSpokenAudio(id('a', 1))).toBeNull();
    expect(await getSpokenAudio(id('b', 2))).toBeNull();
    expect(await getSpokenAudio(OTHER)).not.toBeNull();
  });

  it('bounds the cache to MAX_SPOKEN_AUDIO, evicting oldest but keeping the newest write', async () => {
    // Save MAX+5 clips with increasing savedAt (Date.now advances in real time;
    // to be deterministic we just save sequentially — savedAt is monotonic enough,
    // and the just-written key is always kept by pruneSpokenAudio).
    const n = MAX_SPOKEN_AUDIO + 5;
    for (let i = 0; i < n; i++) await saveSpokenAudio(id('s', i), audioOf(i));
    const all = await chrome.storage.local.get(null);
    const kept = Object.keys(all).filter((k) => k.startsWith('drift:spoken:'));
    expect(kept.length).toBe(MAX_SPOKEN_AUDIO);
    // The most recent write must survive (the clip the user is about to replay).
    expect(await getSpokenAudio(id('s', n - 1))).not.toBeNull();
  });
});
