import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { decodeArtifact, audioMime, isZip, toBase64 } from './artifactDecode';

// Decode a base64 data URL back to bytes so we can assert a lossless round-trip.
function bytesFromDataUrl(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

describe('artifactDecode', () => {
  it('extracts the JSON entry from a zipped artifact', () => {
    const zip = zipSync({ 'pr-scan.json': strToU8('{"pr_review":{"a":1}}') });
    expect(isZip(zip)).toBe(true);
    const d = decodeArtifact(zip);
    expect(d.ok).toBe(true);
    expect(d.filename).toBe('pr-scan.json');
    expect(JSON.parse(d.text!)).toEqual({ pr_review: { a: 1 } });
  });

  it('passes plain (non-zip) JSON through unchanged', () => {
    const buf = strToU8('{"plain":true}');
    expect(isZip(buf)).toBe(false);
    expect(decodeArtifact(buf).text).toBe('{"plain":true}');
  });

  it('returns a base64 audio data URL from a zipped audio artifact (lossless)', () => {
    const audio = new Uint8Array([0, 1, 2, 250, 251, 255, 128, 64]);
    const zip = zipSync({ 'summary.mp3': audio });
    const d = decodeArtifact(zip, { binary: true });
    expect(d.ok).toBe(true);
    expect(d.mime).toBe('audio/mpeg');
    expect(d.filename).toBe('summary.mp3');
    expect(d.dataUrl!.startsWith('data:audio/mpeg;base64,')).toBe(true);
    expect([...bytesFromDataUrl(d.dataUrl!)]).toEqual([...audio]);
  });

  it('prefers the audio entry when a zip mixes audio + other files', () => {
    const zip = zipSync({ 'notes.txt': strToU8('hi'), 'spoken.ogg': new Uint8Array([9, 9]) });
    const d = decodeArtifact(zip, { binary: true });
    expect(d.filename).toBe('spoken.ogg');
    expect(d.mime).toBe('audio/ogg');
  });

  it('falls back to the response content-type for non-zip binary audio', () => {
    const d = decodeArtifact(new Uint8Array([1, 2, 3]), {
      binary: true,
      contentType: 'audio/wav',
    });
    expect(d.mime).toBe('audio/wav');
    expect(d.dataUrl!.startsWith('data:audio/wav;base64,')).toBe(true);
  });

  it('defaults binary MIME to audio/mpeg when nothing else is known', () => {
    const d = decodeArtifact(new Uint8Array([1, 2, 3]), { binary: true });
    expect(d.mime).toBe('audio/mpeg');
  });

  it('reports an empty zip as an error', () => {
    const zip = zipSync({});
    expect(decodeArtifact(zip)).toMatchObject({ ok: false, error: 'empty zip' });
    expect(decodeArtifact(zip, { binary: true })).toMatchObject({ ok: false, error: 'empty zip' });
  });

  it('audioMime maps known extensions and ignores others', () => {
    expect(audioMime('x.mp3')).toBe('audio/mpeg');
    expect(audioMime('x.M4A')).toBe('audio/mp4');
    expect(audioMime('x.json')).toBeUndefined();
  });

  it('toBase64 round-trips a buffer larger than the 32K chunk boundary', () => {
    const big = new Uint8Array(70000).map((_, i) => i % 256);
    expect([...bytesFromDataUrl('data:x;base64,' + toBase64(big))]).toEqual([...big]);
  });
});
