import { describe, it, expect, vi } from 'vitest';
import {
  bytesToBase64,
  parseTranscript,
  isNoiseTranscript,
  runUrl,
  hasCfCreds,
  transcribe,
  synthesize,
  STT_MODEL,
  TTS_MODEL,
} from './cfVoice';

describe('bytesToBase64', () => {
  it('matches btoa for small buffers', () => {
    const bytes = new Uint8Array([72, 105]); // "Hi"
    expect(bytesToBase64(bytes)).toBe(btoa('Hi'));
  });

  it('round-trips a large (multi-chunk) buffer without overflowing the call stack', () => {
    const n = 0x8000 * 2 + 123; // spans 3 chunks
    const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = i % 256;
    const b64 = bytesToBase64(bytes);
    const decoded = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(decoded.length).toBe(n);
    expect(decoded[0]).toBe(0);
    expect(decoded[n - 1]).toBe((n - 1) % 256);
  });
});

describe('parseTranscript', () => {
  it('extracts and trims result.text', () => {
    expect(parseTranscript({ result: { text: '  hello world  ' } })).toBe('hello world');
  });
  it('returns empty string when shape is wrong', () => {
    expect(parseTranscript({})).toBe('');
    expect(parseTranscript(null)).toBe('');
    expect(parseTranscript({ result: { text: 42 } })).toBe('');
  });
});

describe('isNoiseTranscript', () => {
  it('flags blank and punctuation/symbol-only transcripts as noise', () => {
    expect(isNoiseTranscript('')).toBe(true);
    expect(isNoiseTranscript('   ')).toBe(true);
    expect(isNoiseTranscript('.')).toBe(true);
    expect(isNoiseTranscript('...')).toBe(true);
    expect(isNoiseTranscript('♪')).toBe(true);
    expect(isNoiseTranscript('[BLANK_AUDIO]')).toBe(true);
  });

  it("flags Whisper's stock silence/echo hallucinations (case + punctuation insensitive)", () => {
    expect(isNoiseTranscript('you')).toBe(true);
    expect(isNoiseTranscript('You.')).toBe(true);
    expect(isNoiseTranscript('Thank you.')).toBe(true);
    expect(isNoiseTranscript('thanks for watching!')).toBe(true);
    expect(isNoiseTranscript('Please subscribe')).toBe(true);
  });

  it('does NOT flag genuine short user replies', () => {
    expect(isNoiseTranscript('yes')).toBe(false);
    expect(isNoiseTranscript('no')).toBe(false);
    expect(isNoiseTranscript('stop')).toBe(false);
    expect(isNoiseTranscript('what changed in merge.rs?')).toBe(false);
  });
});

describe('runUrl / hasCfCreds', () => {
  it('builds the Workers AI run endpoint', () => {
    expect(runUrl('acct123', STT_MODEL)).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acct123/ai/run/@cf/openai/whisper-large-v3-turbo',
    );
  });
  it('gates on both credentials being non-blank', () => {
    expect(hasCfCreds({})).toBe(false);
    expect(hasCfCreds({ voiceCfAccountId: 'a', voiceCfApiToken: ' ' })).toBe(false);
    expect(hasCfCreds({ voiceCfAccountId: 'a', voiceCfApiToken: 't' })).toBe(true);
  });
});

describe('transcribe', () => {
  it('POSTs base64 audio with bearer auth and returns the text', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ result: { text: 'open the pod bay doors' } }), { status: 200 }),
    );
    const text = await transcribe({ accountId: 'acct', apiToken: 'tok' }, new Uint8Array([1, 2, 3]), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(text).toBe('open the pod bay doors');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain(STT_MODEL);
    expect(init!.method).toBe('POST');
    const headers = init!.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok');
    const body = JSON.parse(init!.body as string);
    expect(typeof body.audio).toBe('string');
    expect(body.language).toBe('en');
  });

  it('throws with the Cloudflare error message on a non-2xx', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ errors: [{ message: 'invalid token' }] }), { status: 403 }),
    );
    await expect(
      transcribe({ accountId: 'a', apiToken: 'bad' }, new Uint8Array([0]), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/Cloudflare STT 403: invalid token/);
  });
});

describe('synthesize', () => {
  it('POSTs the text + speaker and returns raw mp3 bytes', async () => {
    const audio = new Uint8Array([0xff, 0xfb, 0x10]);
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(audio, { status: 200 }),
    );
    const out = await synthesize({ accountId: 'acct', apiToken: 'tok' }, 'hi there', {
      speaker: 'orion',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(Array.from(out)).toEqual([0xff, 0xfb, 0x10]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain(TTS_MODEL);
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({ text: 'hi there', speaker: 'orion', encoding: 'mp3' });
  });
});
