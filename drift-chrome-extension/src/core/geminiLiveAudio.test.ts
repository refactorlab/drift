import { describe, it, expect } from 'vitest';
import { floatTo16BitPCM, encodeMicChunk, decodePcmChunk } from './geminiLiveAudio';

describe('geminiLiveAudio', () => {
  it('round-trips a ramp signal within one LSB', () => {
    const n = 256;
    const src = new Float32Array(n);
    for (let i = 0; i < n; i++) src[i] = (i / (n - 1)) * 2 - 1; // -1 .. 1
    const out = decodePcmChunk(encodeMicChunk(src));
    expect(out.length).toBe(n);
    for (let i = 0; i < n; i++) expect(out[i]).toBeCloseTo(src[i], 3); // ~1e-3 > 1 LSB
  });

  it('clamps out-of-range samples to the 16-bit limits', () => {
    const pcm = floatTo16BitPCM(new Float32Array([2, -2, 1, -1, 0]));
    expect(pcm[0]).toBe(0x7fff); // +2 clamps to +full scale
    expect(pcm[1]).toBe(-0x8000); // -2 clamps to -full scale
    expect(pcm[2]).toBe(0x7fff);
    expect(pcm[3]).toBe(-0x8000);
    expect(pcm[4]).toBe(0);
  });

  it('handles empty input and empty base64', () => {
    expect(encodeMicChunk(new Float32Array(0))).toBe('');
    expect(decodePcmChunk('')).toEqual(new Float32Array(0));
  });

  it('does not overflow the call stack on a long buffer', () => {
    const long = new Float32Array(200_000).fill(0.25);
    const b64 = encodeMicChunk(long);
    expect(b64.length).toBeGreaterThan(0);
    const back = decodePcmChunk(b64);
    expect(back.length).toBe(long.length);
    expect(back[0]).toBeCloseTo(0.25, 3);
  });
});
