// Downloads the spoken-summary audio artifact (via the background worker →
// GitHub) and returns a playable `data:` URL.
//
// We cache the decoded audio in chrome.storage.local keyed by the artifact URL.
// That URL carries the GitHub Actions artifact id (…/artifacts/<id>), which is
// unique and immutable per run — so a *re-run* mints a new id → new URL → cache
// miss → re-fetch, while the *same* artifact is served straight from cache with
// no second download. Same contract the JSON artifacts use (see artifacts.ts).
//
// Audio is multi-MB, so we keep the cache bounded to the most-recently-loaded
// few entries (unlimitedStorage is granted, but unbounded growth is poor
// hygiene).

import type { AudioRef } from '../core/types';
import { sendToRuntime } from '../core/messaging';

export interface StoredAudio {
  url: string;
  /** Playable base64 `data:` URL. */
  dataUrl: string;
  mime: string;
  /** Raw downloaded size in bytes (the zip). */
  bytes: number;
  loadedAt: number;
}

export type AudioResult =
  | { ok: true; dataUrl: string; mime: string; bytes: number; cached: boolean }
  | { ok: false; error: string };

/** How many distinct audio artifacts to keep cached at once. */
const MAX_AUDIO_CACHE = 8;

const keyFor = (url: string) => `drift:audio:${url}`;

/** Cached audio for this exact artifact URL, or null if we've never loaded it. */
export async function getStoredAudio(url: string): Promise<StoredAudio | null> {
  const k = keyFor(url);
  const data = await chrome.storage.local.get(k);
  return (data[k] as StoredAudio | undefined) ?? null;
}

/**
 * Keep only the newest MAX_AUDIO_CACHE audio entries; evict the rest. `keepKey`
 * is the entry we just wrote: it always survives and wins loadedAt ties, so the
 * audio the user is about to play is never the one evicted (timestamps can tie
 * to the millisecond on rapid PR-to-PR loads).
 */
async function pruneAudioCache(keepKey: string): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const entries = Object.entries(all)
    .filter(([k]) => k.startsWith('drift:audio:'))
    .map(([k, v]) => [k, v as StoredAudio] as const);
  if (entries.length <= MAX_AUDIO_CACHE) return;
  entries.sort((a, b) => {
    if (a[0] === keepKey) return -1;
    if (b[0] === keepKey) return 1;
    return (b[1]?.loadedAt ?? 0) - (a[1]?.loadedAt ?? 0);
  });
  const stale = entries.slice(MAX_AUDIO_CACHE).map(([k]) => k);
  if (stale.length) await chrome.storage.local.remove(stale);
}

/**
 * Return the PR's spoken-summary audio as a playable data URL. Serves a cached
 * copy when this exact artifact has already been downloaded; otherwise fetches
 * it via the user's GitHub session and caches the result.
 */
export async function loadAudio(audio: AudioRef): Promise<AudioResult> {
  const cached = await getStoredAudio(audio.url);
  if (cached) {
    return {
      ok: true,
      dataUrl: cached.dataUrl,
      mime: cached.mime,
      bytes: cached.bytes,
      cached: true,
    };
  }

  let res;
  try {
    res = await sendToRuntime({ type: 'FETCH_ARTIFACT', url: audio.url, binary: true });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'download failed' };
  }
  if (!res.ok) return { ok: false, error: res.error };
  if (!('fetched' in res)) return { ok: false, error: 'unexpected response' };

  const f = res.fetched;
  if (f.ok && f.dataUrl) {
    const rec: StoredAudio = {
      url: audio.url,
      dataUrl: f.dataUrl,
      mime: f.mime ?? 'audio/mpeg',
      bytes: f.bytes ?? 0,
      loadedAt: Date.now(),
    };
    const key = keyFor(audio.url);
    await chrome.storage.local.set({ [key]: rec });
    // Housekeeping must never sink the happy path — we already have the audio.
    await pruneAudioCache(key).catch(() => {});
    return { ok: true, dataUrl: rec.dataUrl, mime: rec.mime, bytes: rec.bytes, cached: false };
  }
  return { ok: false, error: f.error ?? 'download failed' };
}
