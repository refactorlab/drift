import { describe, it, expect } from 'vitest';
import { encodeWavFromFloat32, readWavHeader, pcmDurationSeconds, KOKORO_SAMPLE_RATE } from './wav';

const ascii = (b: Uint8Array, o: number, n: number) =>
  String.fromCharCode(...b.slice(o, o + n));

describe('encodeWavFromFloat32 — 24 kHz mono 16-bit PCM', () => {
  it('writes a valid RIFF/WAVE header sized to the samples', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const wav = encodeWavFromFloat32(samples);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(ascii(wav, 36, 4)).toBe('data');

    const h = readWavHeader(wav);
    expect(h.sampleRate).toBe(KOKORO_SAMPLE_RATE);
    expect(h.channels).toBe(1);
    expect(h.bitsPerSample).toBe(16);
    expect(h.dataBytes).toBe(samples.length * 2);
    expect(wav.length).toBe(44 + samples.length * 2);
  });

  it('clamps out-of-range samples to the int16 limits', () => {
    const wav = encodeWavFromFloat32(new Float32Array([2, -2]));
    const view = new DataView(wav.buffer);
    expect(view.getInt16(44, true)).toBe(32767); // +2 clamped to +1 → 0x7fff
    expect(view.getInt16(46, true)).toBe(-32768); // -2 clamped to -1 → -0x8000
  });

  it('reports duration from sample count / rate', () => {
    const samples = new Float32Array(KOKORO_SAMPLE_RATE); // exactly 1 second
    expect(pcmDurationSeconds(samples)).toBeCloseTo(1, 5);
    expect(readWavHeader(encodeWavFromFloat32(samples)).durationSeconds).toBeCloseTo(1, 3);
  });

  it('honours a non-default sample rate', () => {
    const wav = encodeWavFromFloat32(new Float32Array([0.1, 0.2]), 16000);
    expect(readWavHeader(wav).sampleRate).toBe(16000);
  });
});
