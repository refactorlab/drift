import { describe, it, expect, vi } from 'vitest';
import { parseSseBuffer, streamBrain, pingBrain } from './voiceBrain';

describe('parseSseBuffer', () => {
  it('parses message + done records and keeps the incomplete tail', () => {
    const { events, rest } = parseSseBuffer(
      'data: {"text":"Hel"}\n\ndata: {"text":"lo"}\n\nevent: done\ndata: {}\n\ndata: {"text":"par',
    );
    expect(events).toEqual([
      { event: 'message', data: '{"text":"Hel"}' },
      { event: 'message', data: '{"text":"lo"}' },
      { event: 'done', data: '{}' },
    ]);
    expect(rest).toBe('data: {"text":"par');
  });

  it('normalizes CRLF and tags error events', () => {
    const { events } = parseSseBuffer('event: error\r\ndata: {"message":"boom"}\r\n\r\n');
    expect(events).toEqual([{ event: 'error', data: '{"message":"boom"}' }]);
  });
});

function streamingResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const t of gen) out.push(t);
  return out;
}

describe('streamBrain', () => {
  it('yields text deltas across chunk boundaries and stops on done', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      streamingResponse(['data: {"text":"Hel"}\n\ndata: {"te', 'xt":"lo"}\n\nevent: done\ndata: {}\n\n']),
    );
    const deltas = await collect(
      streamBrain({
        brainUrl: 'http://localhost:8787/',
        systemPrompt: 'sys',
        transcript: [{ role: 'user', content: 'hi' }],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    );
    expect(deltas.join('')).toBe('Hello');
    // URL is normalized (no double slash) and body carries the model.
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:8787/turn');
    expect(JSON.parse(init!.body as string).model).toBe('claude-opus-4-8');
  });

  it('is stateless — sends the transcript and never a sessionId', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      streamingResponse(['event: done\ndata: {}\n\n']),
    );
    await collect(
      streamBrain({
        brainUrl: 'http://localhost:8787',
        systemPrompt: 's',
        transcript: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
          { role: 'user', content: 'what changed?' },
        ],
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    );
    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect('sessionId' in body).toBe(false);
    expect(body.transcript).toHaveLength(3);
  });

  it('parses a meta event into onMeta and still yields text', async () => {
    const metas: unknown[] = [];
    const fetchImpl = vi.fn(async () =>
      streamingResponse([
        'data: {"text":"Hi"}\n\n',
        'event: meta\ndata: {"durationMs":1200,"ttftMs":300,"inputTokens":4200,"outputTokens":88}\n\n',
        'event: done\ndata: {}\n\n',
      ]),
    );
    const deltas = await collect(
      streamBrain({
        brainUrl: 'http://localhost:8787',
        systemPrompt: 's',
        transcript: [{ role: 'user', content: 'hi' }],
        fetchImpl: fetchImpl as unknown as typeof fetch,
        onMeta: (m) => metas.push(m),
      }),
    );
    expect(deltas.join('')).toBe('Hi');
    expect(metas).toEqual([{ durationMs: 1200, ttftMs: 300, inputTokens: 4200, outputTokens: 88 }]);
  });

  it('throws on an error event', async () => {
    const fetchImpl = vi.fn(async () => streamingResponse(['event: error\ndata: {"message":"429"}\n\n']));
    await expect(
      collect(
        streamBrain({
          brainUrl: 'http://localhost:8787',
          systemPrompt: 's',
          transcript: [],
          fetchImpl: fetchImpl as unknown as typeof fetch,
        }),
      ),
    ).rejects.toThrow(/Brain error: 429/);
  });

  it('throws on a non-2xx response', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }));
    await expect(
      collect(
        streamBrain({
          brainUrl: 'http://localhost:8787',
          systemPrompt: 's',
          transcript: [],
          fetchImpl: fetchImpl as unknown as typeof fetch,
        }),
      ),
    ).rejects.toThrow(/Brain 500/);
  });
});

describe('pingBrain', () => {
  it('returns true on 2xx and false on throw', async () => {
    expect(await pingBrain('http://localhost:8787', (async () => new Response('ok')) as unknown as typeof fetch)).toBe(true);
    expect(
      await pingBrain('http://localhost:8787', (async () => {
        throw new Error('refused');
      }) as unknown as typeof fetch),
    ).toBe(false);
  });
});
