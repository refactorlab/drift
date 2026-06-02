// Downloads the spoken-summary audio artifact (via the background worker →
// GitHub) and returns a playable `data:` URL. Unlike JSON artifacts we do NOT
// persist the bytes to chrome.storage — base64 audio can be several MB and the
// summary is cheap to re-fetch with the user's GitHub session when needed.

import type { AudioRef } from '../core/types';
import { sendToRuntime } from '../core/messaging';

export type AudioResult =
  | { ok: true; dataUrl: string; mime: string; bytes: number }
  | { ok: false; error: string };

export async function loadAudio(audio: AudioRef): Promise<AudioResult> {
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
    return { ok: true, dataUrl: f.dataUrl, mime: f.mime ?? 'audio/mpeg', bytes: f.bytes ?? 0 };
  }
  return { ok: false, error: f.error ?? 'download failed' };
}
