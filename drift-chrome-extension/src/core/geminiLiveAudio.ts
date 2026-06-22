// Pure audio codec for the Gemini Live voice path: Float32 PCM ⇄ signed 16-bit
// PCM ⇄ base64. The Live API speaks little-endian mono PCM16 — base64-encoded in
// each realtime chunk (16 kHz in, 24 kHz out). No SDK and no DOM beyond the
// global btoa/atob, so it's trivially unit-tested (round-trip). This is drift's
// replacement for the Google sample's utils/audio helpers.

/** Clamp each sample to [-1, 1] and scale to signed 16-bit. Pure. */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Base64-encode bytes in chunks so a long buffer can't overflow the
 *  String.fromCharCode argument list (a ~30 s utterance is hundreds of KB). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** One mic frame (Float32, mono) → base64 PCM16 for session.sendRealtimeInput. */
export function encodeMicChunk(frame: Float32Array): string {
  const pcm = floatTo16BitPCM(frame);
  return bytesToBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
}

/** Base64 PCM16 (mono) from the model → Float32 samples for Web Audio playback. */
export function decodePcmChunk(b64: string): Float32Array {
  if (!b64) return new Float32Array(0);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;
  return out;
}
