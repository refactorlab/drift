// Gemini brain — a BrainRuntime backed by the Gemini API (free Flash tier) via
// @google/genai. A drop-in for the on-device WebLLM brain: identical contract,
// so chat, voice, and the tool router all work unchanged. The user supplies
// their own (free-tier) key; nothing is bundled, proxied, or sent to a server.
//
// The SDK is dynamic-imported INSIDE the factory (not a top-level value import)
// so the side-panel bundle only pulls @google/genai when Gemini mode is actually
// selected — the same lazy discipline as the WebLLM worker's `import()`.

import type { GoogleGenAI } from '@google/genai';
import type { ChatTurn } from './chatContext';
import type { BrainRuntime, BrainFactory, GenerateOptions, CompleteOptions } from './brainRuntime';
import type { BrainResponseFormat } from './brainWorker';

/** Default model: a free-tier Flash. Override via Settings (`geminiModel`). */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

type GeminiContent = { role: 'user' | 'model'; parts: Array<{ text: string }> };

/** Split drift's ChatTurn[] into Gemini's shape: the leading `system` turn(s)
 *  become `systemInstruction`; user/assistant become `contents` (Gemini roles
 *  are 'user' | 'model'). Pure — unit-tested directly. */
export function toGemini(messages: ChatTurn[]): { systemInstruction?: string; contents: GeminiContent[] } {
  let systemInstruction: string | undefined;
  const contents: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemInstruction = systemInstruction ? `${systemInstruction}\n\n${m.content}` : m.content;
    } else {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }
  }
  return { systemInstruction, contents };
}

/** drift's response_format → Gemini structured output. The tool ROUTER uses
 *  `{ type:'json_object', schema }` where schema is a STRINGIFIED JSON Schema. */
function structuredConfig(rf?: BrainResponseFormat): Record<string, unknown> {
  if (rf?.type !== 'json_object') return {}; // 'grammar' (XGrammar) has no Gemini analogue
  try {
    return { responseMimeType: 'application/json', responseSchema: JSON.parse(rf.schema) };
  } catch {
    return { responseMimeType: 'application/json' }; // unparseable schema → still force JSON
  }
}

/** Combine the caller's AbortSignal (if any) with our internal one so BOTH
 *  `opts.signal` and `runtime.interrupt()` can stop a generation. Dependency-free
 *  (no `AbortSignal.any`, which is Chrome-116+ / absent in jsdom). */
function merge(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b;
  if (a.aborted) return a;
  if (b.aborted) return b;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return ctrl.signal;
}

/** Build a Gemini-backed BrainFactory. `apiKey`/`model`/`client` are injected so
 *  this stays pure and unit-testable with a fake GoogleGenAI (no network). */
export function makeGeminiBrainFactory(opts: { apiKey: string; model?: string; client?: GoogleGenAI }): BrainFactory {
  const model = opts.model || DEFAULT_GEMINI_MODEL;
  return async () => {
    if (!opts.apiKey) throw new Error('Gemini API key not set');
    const ai = opts.client ?? new (await import('@google/genai')).GoogleGenAI({ apiKey: opts.apiKey });
    const inflight = new Set<AbortController>();
    const interrupt = (): void => {
      for (const ac of inflight) ac.abort();
      inflight.clear();
    };

    return {
      async generate(messages: ChatTurn[], gen: GenerateOptions = {}): Promise<string> {
        const { systemInstruction, contents } = toGemini(messages);
        const ac = new AbortController();
        inflight.add(ac);
        const signal = merge(gen.signal, ac.signal);
        let full = '';
        try {
          const stream = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction,
              abortSignal: signal,
              ...(typeof gen.temperature === 'number' ? { temperature: gen.temperature } : {}),
              ...(gen.maxTokens ? { maxOutputTokens: gen.maxTokens } : {}),
            },
          });
          for await (const chunk of stream) {
            const t = chunk.text ?? '';
            if (t) {
              full += t;
              gen.onToken?.(t);
            }
          }
          return full;
        } catch (err) {
          // Aborted → soft-stop with whatever streamed (mirrors the WebLLM brain,
          // whose generate resolves with partial text on interrupt).
          if (signal.aborted) return full;
          throw err;
        } finally {
          inflight.delete(ac);
        }
      },

      async complete(messages: ChatTurn[], cmp: CompleteOptions = {}): Promise<string> {
        const { systemInstruction, contents } = toGemini(messages);
        const ac = new AbortController();
        inflight.add(ac);
        try {
          const res = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              abortSignal: merge(cmp.signal, ac.signal),
              temperature: cmp.temperature ?? 0,
              ...(cmp.maxTokens ? { maxOutputTokens: cmp.maxTokens } : {}),
              ...structuredConfig(cmp.responseFormat),
            },
          });
          return res.text ?? '';
        } finally {
          inflight.delete(ac);
        }
      },

      interrupt,
      free: interrupt, // stateless HTTP client — just stop anything in flight
    } satisfies BrainRuntime;
  };
}
