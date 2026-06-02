// Pure decoding of downloaded GitHub-artifact bytes into either text (JSON) or
// a playable binary `data:` URL (audio). Kept side-effect free and separate
// from the service worker (which owns fetch + chrome wiring) so it can be
// unit-tested directly against real zip bytes.

import { unzipSync, strFromU8 } from 'fflate';

/** Subset of FetchedArtifact this module produces (the SW adds status/bytes). */
export interface DecodedArtifact {
  ok: boolean;
  text?: string | null;
  /** Base64 `data:` URL for binary (audio) artifacts. */
  dataUrl?: string | null;
  mime?: string | null;
  /** Name of the entry chosen from the zip, when applicable. */
  filename?: string;
  error?: string;
}

// Map an audio entry's extension to a MIME type for the <audio> data URL.
const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  webm: 'audio/webm',
};

export function audioMime(name: string): string | undefined {
  return AUDIO_MIME[name.split('.').pop()?.toLowerCase() ?? ''];
}

export function isZip(buf: Uint8Array): boolean {
  // ZIP local-file-header magic "PK\x03\x04".
  return buf[0] === 0x50 && buf[1] === 0x4b;
}

// Base64-encode bytes in chunks so we never blow the call stack on
// String.fromCharCode for large audio buffers.
export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * Decode raw artifact bytes. GitHub Actions artifacts arrive zipped; we extract
 * the relevant entry (an audio file when `binary`, else the JSON) and either
 * return its text or a base64 audio data URL. Non-zip payloads pass through.
 */
export function decodeArtifact(
  buf: Uint8Array,
  opts: { binary?: boolean; contentType?: string | null } = {},
): DecodedArtifact {
  const { binary = false, contentType = null } = opts;
  const zipped = isZip(buf);

  if (binary) {
    let payload = buf;
    let name = '';
    if (zipped) {
      const files = unzipSync(buf);
      const names = Object.keys(files);
      name = names.find((n) => audioMime(n)) ?? names[0] ?? '';
      if (!name) return { ok: false, error: 'empty zip' };
      payload = files[name];
    }
    const mime =
      audioMime(name) ?? (contentType?.startsWith('audio/') ? contentType : 'audio/mpeg');
    return { ok: true, dataUrl: `data:${mime};base64,${toBase64(payload)}`, mime, filename: name || undefined };
  }

  if (zipped) {
    const files = unzipSync(buf);
    const names = Object.keys(files);
    const jsonName = names.find((n) => /\.json$/i.test(n)) ?? names[0];
    if (!jsonName) return { ok: false, error: 'empty zip' };
    return { ok: true, text: strFromU8(files[jsonName]), filename: jsonName };
  }

  return { ok: true, text: new TextDecoder().decode(buf) };
}
