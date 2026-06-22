import { describe, it, expect, vi } from 'vitest';
import type { GoogleGenAI } from '@google/genai';
import { makeGeminiBrainFactory, toGemini } from './geminiBrain';
import type { ChatTurn } from './chatContext';

// A fake @google/genai client whose streaming yields scripted chunks. `capture`
// records the request so we can assert what was sent to the SDK. No network.
function streamFake(
  chunks: Array<{ text: string }>,
  capture?: (req: Record<string, unknown>) => void,
): GoogleGenAI {
  return {
    models: {
      generateContentStream: vi.fn(async (req: Record<string, unknown>) => {
        capture?.(req);
        return (async function* () {
          for (const c of chunks) yield c;
        })();
      }),
    },
  } as unknown as GoogleGenAI;
}

describe('toGemini', () => {
  it('maps system → systemInstruction and user/assistant → user/model contents', () => {
    const msgs: ChatTurn[] = [
      { role: 'system', content: 'You are Andy.' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'bye' },
    ];
    const { systemInstruction, contents } = toGemini(msgs);
    expect(systemInstruction).toBe('You are Andy.');
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'hello' }] },
      { role: 'user', parts: [{ text: 'bye' }] },
    ]);
  });
});

describe('makeGeminiBrainFactory', () => {
  it('throws if no API key is set', async () => {
    await expect(makeGeminiBrainFactory({ apiKey: '' })()).rejects.toThrow(/key/i);
  });

  it('streams tokens through onToken and resolves with the full text', async () => {
    const client = streamFake([{ text: 'Hel' }, { text: 'lo' }, { text: '!' }]);
    const brain = await makeGeminiBrainFactory({ apiKey: 'k', client })();
    const tokens: string[] = [];
    const full = await brain.generate([{ role: 'user', content: 'hi' }], { onToken: (t) => tokens.push(t) });
    expect(tokens).toEqual(['Hel', 'lo', '!']);
    expect(full).toBe('Hello!');
  });

  it('forwards model + systemInstruction + contents to the SDK', async () => {
    let req: Record<string, unknown> = {};
    const client = streamFake([{ text: 'ok' }], (r) => (req = r));
    const brain = await makeGeminiBrainFactory({ apiKey: 'k', model: 'gemini-x', client })();
    await brain.generate([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'q' },
    ]);
    expect(req.model).toBe('gemini-x');
    expect((req.config as Record<string, unknown>).systemInstruction).toBe('sys');
    expect(req.contents).toEqual([{ role: 'user', parts: [{ text: 'q' }] }]);
  });

  it('resolves with partial text when the stream aborts', async () => {
    const ac = new AbortController();
    const client = {
      models: {
        generateContentStream: vi.fn(async () =>
          (async function* () {
            yield { text: 'Hel' };
            ac.abort(); // caller aborts mid-stream…
            throw new DOMException('aborted', 'AbortError'); // …SDK reacts
          })(),
        ),
      },
    } as unknown as GoogleGenAI;
    const brain = await makeGeminiBrainFactory({ apiKey: 'k', client })();
    const full = await brain.generate([{ role: 'user', content: 'hi' }], { signal: ac.signal });
    expect(full).toBe('Hel');
  });

  it('complete() forwards a json_object responseFormat as a Gemini responseSchema', async () => {
    let req: Record<string, unknown> = {};
    const client = {
      models: {
        generateContent: vi.fn(async (r: Record<string, unknown>) => {
          req = r;
          return { text: '{"tool":"none"}' };
        }),
      },
    } as unknown as GoogleGenAI;
    const brain = await makeGeminiBrainFactory({ apiKey: 'k', client })();
    const schema = JSON.stringify({ type: 'object', properties: { tool: { type: 'string' } } });
    const out = await brain.complete([{ role: 'user', content: 'route' }], {
      responseFormat: { type: 'json_object', schema },
    });
    expect(out).toBe('{"tool":"none"}');
    const cfg = req.config as Record<string, unknown>;
    expect(cfg.responseMimeType).toBe('application/json');
    expect(cfg.responseSchema).toEqual(JSON.parse(schema));
  });
});
