// Persistent cache of the live-scan SPOKEN-SUMMARY audio (the on-device Kokoro
// WAV), so replaying a past scan plays its narration INSTANTLY instead of
// re-synthesizing the model on the click path.
//
// The scan pipeline synthesizes the WAV once (its "Spoken summary" step) and we
// persist it here keyed by the scan record id (`${url}@${sha}@${ts}`). On replay
// we hand the decoded WAV back to <SpokenSummary> via its `prepared` prop, which
// arms a blob and skips synthesis entirely.
//
// WAV is multi-MB, so the cache is bounded to the most-recently-saved few entries
// (unlimitedStorage is granted, but unbounded growth is poor hygiene — same
// contract as state/audio.ts for the action's artifact audio).

import { toBase64 } from '../core/artifactDecode';
import type { PreparedAudio } from '../core/ttsProvider';

const PREFIX = 'drift:spoken:';
/** How many distinct spoken-summary clips to keep at once. */
export const MAX_SPOKEN_AUDIO = 12;

const keyFor = (id: string) => `${PREFIX}${id}`;

interface StoredSpokenAudio {
  /** Scan record id this audio belongs to (`${url}@${sha}@${ts}`). */
  id: string;
  /** Base64 of the 24 kHz mono WAV bytes. */
  wavBase64: string;
  voice: string;
  durationSeconds: number;
  savedAt: number;
}

/** Decode base64 → bytes (mirror of artifactDecode.toBase64). */
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Persist a scan's synthesized spoken-summary audio. Fail-soft: never throws. */
export async function saveSpokenAudio(id: string, audio: PreparedAudio): Promise<void> {
  try {
    const rec: StoredSpokenAudio = {
      id,
      wavBase64: toBase64(audio.wav),
      voice: audio.voice,
      durationSeconds: audio.durationSeconds,
      savedAt: Date.now(),
    };
    const key = keyFor(id);
    await chrome.storage.local.set({ [key]: rec });
    // Housekeeping must never sink the save — the audio is already persisted.
    await pruneSpokenAudio(key).catch(() => {});
  } catch {
    // Quota or encoding failure: the replay path just falls back to re-synthesis.
  }
}

/** The cached spoken audio for a scan record, decoded to PreparedAudio, or null. */
export async function getSpokenAudio(id: string): Promise<PreparedAudio | null> {
  const k = keyFor(id);
  const data = await chrome.storage.local.get(k);
  const rec = data[k] as StoredSpokenAudio | undefined;
  if (!rec) return null;
  try {
    return { wav: fromBase64(rec.wavBase64), voice: rec.voice, durationSeconds: rec.durationSeconds };
  } catch {
    return null;
  }
}

/** Drop one scan's cached audio (called when a scan record is deleted). */
export async function removeSpokenAudio(id: string): Promise<void> {
  await chrome.storage.local.remove(keyFor(id));
}

/**
 * Drop all cached audio for a PR url. Record ids are `${url}@${sha}@${ts}`, so we
 * match entries whose stored id begins with `${url}@` — called when a PR's whole
 * scan history is cleared.
 */
export async function removeSpokenAudioForUrl(url: string): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(
    (k) => k.startsWith(PREFIX) && (all[k] as StoredSpokenAudio | undefined)?.id?.startsWith(`${url}@`),
  );
  if (keys.length) await chrome.storage.local.remove(keys);
}

/**
 * Keep only the newest MAX_SPOKEN_AUDIO clips; evict the rest. `keepKey` (the
 * entry we just wrote) always survives and wins savedAt ties, so the clip the
 * user is about to replay is never the one evicted.
 */
async function pruneSpokenAudio(keepKey: string): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const entries = Object.entries(all)
    .filter(([k]) => k.startsWith(PREFIX))
    .map(([k, v]) => [k, v as StoredSpokenAudio] as const);
  if (entries.length <= MAX_SPOKEN_AUDIO) return;
  entries.sort((a, b) => {
    if (a[0] === keepKey) return -1;
    if (b[0] === keepKey) return 1;
    return (b[1]?.savedAt ?? 0) - (a[1]?.savedAt ?? 0);
  });
  const stale = entries.slice(MAX_SPOKEN_AUDIO).map(([k]) => k);
  if (stale.length) await chrome.storage.local.remove(stale);
}
