import { afterEach, describe, expect, it, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { downloadArtifact } from './download';

// Build a minimal fetch Response stand-in over raw bytes.
function resp(bytes: Uint8Array, { ok = true, status = 200, contentType = 'application/zip' } = {}) {
  return {
    ok,
    status,
    url: 'https://final',
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}
const stubFetch = (r: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(r));

describe('downloadArtifact (fetch → decode → FetchedArtifact)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('extracts JSON text from a zipped artifact and reports the zip size', async () => {
    const zip = zipSync({ 'pr-scan.json': strToU8('{"pr_review":{}}') });
    stubFetch(resp(zip));
    const r = await downloadArtifact('u');
    expect(r.ok).toBe(true);
    expect(r.text).toBe('{"pr_review":{}}');
    expect(r.bytes).toBe(zip.length);
    expect(r.filename).toBe('pr-scan.json');
  });

  it('returns an audio data URL for a binary request', async () => {
    const zip = zipSync({ 'summary.mp3': new Uint8Array([1, 2, 3]) });
    stubFetch(resp(zip));
    const r = await downloadArtifact('u', true);
    expect(r.ok).toBe(true);
    expect(r.mime).toBe('audio/mpeg');
    expect(r.dataUrl!.startsWith('data:audio/mpeg;base64,')).toBe(true);
  });

  it('maps a non-OK HTTP response to an error (no body read)', async () => {
    stubFetch(resp(new Uint8Array(), { ok: false, status: 404 }));
    expect(await downloadArtifact('u')).toEqual({ ok: false, status: 404, error: 'HTTP 404' });
  });

  it('passes a plain (non-zip) JSON body through', async () => {
    stubFetch(resp(strToU8('{"plain":1}'), { contentType: 'application/json' }));
    const r = await downloadArtifact('u');
    expect(r.text).toBe('{"plain":1}');
  });

  it('catches a thrown fetch (CORS / network) and returns an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    expect(await downloadArtifact('u')).toEqual({ ok: false, error: 'Failed to fetch' });
  });

  it('surfaces an empty-zip decode error with the downloaded size', async () => {
    const zip = zipSync({});
    stubFetch(resp(zip));
    const r = await downloadArtifact('u');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('empty zip');
    expect(r.bytes).toBe(zip.length);
  });
});
