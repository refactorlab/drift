// Encode raw PCM samples into a minimal WAV (RIFF/PCM) container the browser's
// <audio> element plays directly. Kokoro (via sherpa-onnx) yields mono float32
// samples in [-1, 1] at a fixed 24 kHz; we quantise to signed 16-bit PCM — the
// same 24 kHz mono WAV the action ships, so the live-scan audio matches what
// reviewers hear on the PR. Pure + dependency-free so it is unit-testable.

export const KOKORO_SAMPLE_RATE = 24000;

/** Clamp a float sample to [-1, 1] then scale to signed 16-bit. */
function toPcm16(sample: number): number {
  const s = sample < -1 ? -1 : sample > 1 ? 1 : sample;
  return s < 0 ? s * 0x8000 : s * 0x7fff;
}

/**
 * Build a 44-byte-header mono 16-bit PCM WAV from float32 samples.
 * `samples` is the model output (length = duration * sampleRate).
 */
export function encodeWavFromFloat32(samples: Float32Array, sampleRate = KOKORO_SAMPLE_RATE): Uint8Array {
  const numFrames = samples.length;
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const byteRate = sampleRate * blockAlign;
  const dataBytes = numFrames * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true); // file size - 8
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    view.setInt16(offset, toPcm16(samples[i]), true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

/** Duration of a float32 PCM buffer, in seconds. */
export function pcmDurationSeconds(samples: Float32Array, sampleRate = KOKORO_SAMPLE_RATE): number {
  return sampleRate > 0 ? samples.length / sampleRate : 0;
}

/** Parsed WAV header fields — used by tests and the duration-ratio guard. */
export function readWavHeader(wav: Uint8Array): {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataBytes: number;
  durationSeconds: number;
} {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  const dataBytes = view.getUint32(40, true);
  const bytesPerFrame = (bitsPerSample / 8) * channels || 1;
  const durationSeconds = dataBytes / (sampleRate * bytesPerFrame || 1);
  return { sampleRate, channels, bitsPerSample, dataBytes, durationSeconds };
}
