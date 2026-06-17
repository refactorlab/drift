// Linear-interpolation resampler — the JS twin of the Rust `resample_linear` in
// drift-static-profiler's voice module. Cheap and good enough for ASR input
// (context-rate mic → 16 kHz Whisper) and for FSM framing (context-rate → 24 kHz).
// Kept in JS (not the wasm export) so the audio capture path has no hard
// dependency on the voice wasm being instantiated.

export function resampleLinear(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (input.length === 0 || inRate === outRate) return input;
  const ratio = outRate / inRate;
  const n = Math.max(1, Math.round(input.length * ratio));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / ratio;
    const i0 = Math.floor(t);
    const frac = t - i0;
    const a = input[i0] ?? 0;
    const b = input[i0 + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** Concatenate a list of Float32 chunks into one buffer. */
export function concatFloat32(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
