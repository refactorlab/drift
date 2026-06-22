import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkOllama,
  drainNdjson,
  formatFor,
  listOllamaModels,
  makeOllamaBrainFactory,
  normalizeBaseUrl,
  ollamaErrorMessage,
  toOllama,
  DEFAULT_OLLAMA_URL,
} from './ollamaBrain';
import type { ChatTurn } from './chatContext';

const enc = new TextEncoder();

/** A 200 response whose body streams the given string chunks (chunks may split lines). */
function streamResponse(chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

/** A response that emits `first`, then HANGS until `signal` aborts (to test interrupt). */
function hangingResponse(first: string, signal: AbortSignal): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(first));
    },
    pull() {
      return new Promise<void>((_resolve, reject) => {
        const fail = () => reject(new DOMException('aborted', 'AbortError'));
        if (signal.aborted) return fail();
        signal.addEventListener('abort', fail, { once: true });
      });
    },
  });
  return new Response(body, { status: 200 });
}

const stubFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) =>
  vi.stubGlobal('fetch', vi.fn(impl));

afterEach(() => vi.unstubAllGlobals());

describe('normalizeBaseUrl', () => {
  it('trims trailing slashes and defaults when empty', () => {
    expect(normalizeBaseUrl('http://localhost:11434/')).toBe('http://localhost:11434');
    expect(normalizeBaseUrl('  http://host:1234//  ')).toBe('http://host:1234');
    expect(normalizeBaseUrl('')).toBe(DEFAULT_OLLAMA_URL);
    expect(normalizeBaseUrl(undefined)).toBe(DEFAULT_OLLAMA_URL);
  });
});

describe('toOllama', () => {
  it('maps roles 1:1 (system/user/assistant pass through)', () => {
    const msgs: ChatTurn[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'yo' },
    ];
    expect(toOllama(msgs)).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'yo' },
    ]);
  });
});

describe('drainNdjson (the streaming core)', () => {
  it('parses complete lines and keeps the partial leftover', () => {
    const { records, rest } = drainNdjson('{"message":{"content":"a"}}\n{"message":{"content":"b"}}\n{"mess');
    expect(records.map((r) => r.message?.content)).toEqual(['a', 'b']);
    expect(rest).toBe('{"mess'); // the half line is preserved for the next chunk
  });

  it('skips blank lines and un-parseable fragments without throwing', () => {
    const { records, rest } = drainNdjson('\n  \n{"done":true}\nnot json\n');
    expect(records).toEqual([{ done: true }]);
    expect(rest).toBe('');
  });

  it('reassembles a record split across two drains', () => {
    const a = drainNdjson('{"message":{"con');
    expect(a.records).toEqual([]);
    const b = drainNdjson(a.rest + 'tent":"hello"}}\n');
    expect(b.records[0].message?.content).toBe('hello');
  });
});

describe('formatFor (router structured output)', () => {
  it('passes a parsed JSON schema through as `format`', () => {
    expect(formatFor({ type: 'json_object', schema: '{"type":"object"}' })).toEqual({ format: { type: 'object' } });
  });
  it('falls back to "json" for an unparseable schema, and undefined otherwise', () => {
    expect(formatFor({ type: 'json_object', schema: 'not json' })).toEqual({ format: 'json' });
    expect(formatFor({ type: 'grammar', schema: 'x' } as never)).toBeUndefined();
    expect(formatFor(undefined)).toBeUndefined();
  });
});

describe('ollamaErrorMessage', () => {
  it('turns a fetch TypeError into actionable setup guidance', () => {
    const m = ollamaErrorMessage(new TypeError('Failed to fetch'), 'http://localhost:11434');
    expect(m).toContain('reach Ollama');
    expect(m).toContain('OLLAMA_ORIGINS');
  });
  it('passes through a real error message', () => {
    expect(ollamaErrorMessage(new Error('model not found'), 'x')).toBe('model not found');
  });
});

describe('listOllamaModels / checkOllama', () => {
  it('lists installed model names from /api/tags', async () => {
    stubFetch(async (url) => {
      expect(url).toBe('http://localhost:11434/api/tags');
      return new Response(JSON.stringify({ models: [{ name: 'llama3.2:latest' }, { model: 'qwen2.5:7b' }, { name: '' }] }), { status: 200 });
    });
    expect(await listOllamaModels('http://localhost:11434/')).toEqual(['llama3.2:latest', 'qwen2.5:7b']);
  });

  it('checkOllama returns ok+models when reachable', async () => {
    stubFetch(async () => new Response(JSON.stringify({ models: [{ name: 'm1' }] }), { status: 200 }));
    expect(await checkOllama('http://localhost:11434')).toEqual({ ok: true, models: ['m1'] });
  });

  it('checkOllama flags BLOCKED when GET lists models but POST is origin-rejected (403)', async () => {
    stubFetch(async (url) => {
      if (url.endsWith('/api/tags')) return new Response(JSON.stringify({ models: [{ name: 'llama3.2' }] }), { status: 200 });
      // POST /api/show is origin-checked → 403, the GET-works/POST-403 trap.
      return new Response('forbidden', { status: 403 });
    });
    const r = await checkOllama('http://localhost:11434');
    expect(r.ok).toBe(false);
    expect(r.blocked).toBe(true);
    expect(r.models).toEqual(['llama3.2']); // still surfaced so the user can pick
    expect(r.error).toMatch(/OLLAMA_ORIGINS/);
  });

  it('a chat POST 403 yields the actionable origin-blocked message', async () => {
    stubFetch(async () => new Response('forbidden', { status: 403 }));
    const rt = await makeOllamaBrainFactory({ model: 'llama3.2' })();
    await expect(rt.generate([{ role: 'user', content: 'hi' }])).rejects.toThrow(/OLLAMA_ORIGINS/);
  });

  it('checkOllama returns an actionable error when unreachable (never throws)', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const r = await checkOllama('http://localhost:11434');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('OLLAMA_ORIGINS');
  });
});

describe('makeOllamaBrainFactory', () => {
  const msgs: ChatTurn[] = [{ role: 'user', content: 'hi' }];

  it('throws (no runtime) when no model is selected', async () => {
    await expect(makeOllamaBrainFactory({ model: '' })()).rejects.toThrow(/model/i);
  });

  it('generate streams NDJSON: tokens fire, full text resolves, done stops', async () => {
    let sentBody: Record<string, unknown> = {};
    stubFetch(async (url, init) => {
      expect(url).toBe('http://localhost:11434/api/chat');
      sentBody = JSON.parse(String(init?.body));
      return streamResponse([
        '{"message":{"content":"Hel"}}\n{"message":{"content":"lo"}}\n', // two tokens, one chunk
        '{"message":{"content":"!"},"done":false}\n',
        '{"message":{"content":""},"done":true,"done_reason":"stop"}\n', // done → stop
        '{"message":{"content":"IGNORED"}}\n', // after done — must not be read
      ]);
    });
    const rt = await makeOllamaBrainFactory({ model: 'llama3.2' })();
    const tokens: string[] = [];
    const out = await rt.generate(msgs, { onToken: (t) => tokens.push(t), temperature: 0.5, maxTokens: 128 });
    expect(out).toBe('Hello!');
    expect(tokens).toEqual(['Hel', 'lo', '!']);
    expect(sentBody).toMatchObject({ model: 'llama3.2', stream: true, options: { temperature: 0.5, num_predict: 128 } });
    expect(sentBody.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('complete is non-streaming and carries the router `format`', async () => {
    let sentBody: Record<string, unknown> = {};
    stubFetch(async (_url, init) => {
      sentBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ message: { content: '{"tool":"none"}' }, done: true }), { status: 200 });
    });
    const rt = await makeOllamaBrainFactory({ model: 'm' })();
    const out = await rt.complete(msgs, { responseFormat: { type: 'json_object', schema: '{"type":"object"}' } });
    expect(out).toBe('{"tool":"none"}');
    expect(sentBody).toMatchObject({ stream: false, format: { type: 'object' } });
  });

  it('maps an HTTP error body into a readable message', async () => {
    stubFetch(async () => new Response(JSON.stringify({ error: 'model "x" not found' }), { status: 404 }));
    const rt = await makeOllamaBrainFactory({ model: 'x' })();
    await expect(rt.generate(msgs)).rejects.toThrow(/model "x" not found/);
  });

  it('interrupt() soft-stops a stream mid-flight, resolving with the partial text', async () => {
    let captured!: AbortSignal;
    stubFetch(async (_url, init) => {
      captured = init!.signal as AbortSignal;
      return hangingResponse('{"message":{"content":"partial"}}\n', captured);
    });
    const rt = await makeOllamaBrainFactory({ model: 'm' })();
    const p = rt.generate(msgs);
    await new Promise((r) => setTimeout(r, 0)); // let the first chunk be read + token emitted
    rt.interrupt();
    expect(await p).toBe('partial'); // partial text, not a throw
  });

  it('throws a descriptive error when the stream closes with no output (not a silent empty reply)', async () => {
    stubFetch(async () => streamResponse([])); // 200 but the body yields nothing + no `done`
    const rt = await makeOllamaBrainFactory({ model: 'm' })();
    await expect(rt.generate(msgs)).rejects.toThrow(/no output/i);
  });

  it('an already-aborted caller signal soft-stops too', async () => {
    stubFetch(async () => streamResponse([])); // never reached
    const rt = await makeOllamaBrainFactory({ model: 'm' })();
    const ac = new AbortController();
    ac.abort();
    expect(await rt.generate(msgs, { signal: ac.signal })).toBe('');
  });
});
