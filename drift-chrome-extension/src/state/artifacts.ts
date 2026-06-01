// Downloads an artifact's real bytes (via the background worker → GitHub) and
// caches the JSON in chrome.storage.local. No reconstruction/fallback: a file
// only has content once it's actually been downloaded.

import type { ArtifactRef } from '../core/types';
import { sendToRuntime } from '../core/messaging';

export interface StoredArtifact {
  url: string;
  name: string;
  /** GitHub Actions artifact id parsed from the URL, when present. */
  id?: string;
  /** The real downloaded JSON. */
  content: string;
  /** Size of the JSON in bytes. */
  bytes: number;
  /** Raw downloaded size (the zip). */
  downloadedBytes?: number;
  loadedAt: number;
}

export type LoadResult = { ok: true; rec: StoredArtifact } | { ok: false; error: string };

const keyFor = (url: string) => `drift:artifact:${url}`;

export function artifactIdFromUrl(url?: string): string | undefined {
  return url?.match(/artifacts\/(\d+)/)?.[1];
}

const byteLen = (s: string) => new TextEncoder().encode(s).length;

/** One-time cleanup: drop any cached artifact whose content is the old derived
 * reconstruction, so the app only ever serves real downloaded files. */
export async function purgeDerivedCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const stale = Object.entries(all)
    .filter(
      ([k, v]) =>
        k.startsWith('drift:artifact:') &&
        typeof (v as StoredArtifact)?.content === 'string' &&
        /derived-v\d|Reconstructed locally/.test((v as StoredArtifact).content),
    )
    .map(([k]) => k);
  if (stale.length) await chrome.storage.local.remove(stale);
}

export async function getStoredArtifact(url: string): Promise<StoredArtifact | null> {
  const k = keyFor(url);
  const data = await chrome.storage.local.get(k);
  const rec = data[k] as StoredArtifact | undefined;
  if (!rec) return null;
  // Self-heal: purge any legacy reconstructed/derived cache so we re-download
  // the REAL artifact instead of serving stale scraped content.
  if (/derived-v\d|Reconstructed locally/.test(rec.content)) {
    await chrome.storage.local.remove(k);
    return null;
  }
  return rec;
}

/** Download + unzip the real artifact, then cache it. No derived fallback. */
export async function loadArtifact(artifact: ArtifactRef): Promise<LoadResult> {
  if (!artifact.url) return { ok: false, error: 'no download URL on this PR' };

  let res;
  try {
    res = await sendToRuntime({ type: 'FETCH_ARTIFACT', url: artifact.url });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'download failed' };
  }

  if (!res.ok) return { ok: false, error: res.error };
  if (!('fetched' in res)) return { ok: false, error: 'unexpected response' };

  const f = res.fetched;
  if (f.ok && f.text != null) {
    const rec: StoredArtifact = {
      url: artifact.url,
      name: artifact.name,
      id: artifactIdFromUrl(artifact.url),
      content: f.text,
      bytes: byteLen(f.text),
      downloadedBytes: f.bytes,
      loadedAt: Date.now(),
    };
    await chrome.storage.local.set({ [keyFor(artifact.url)]: rec });
    return { ok: true, rec };
  }
  return { ok: false, error: f.error ?? 'download failed' };
}
