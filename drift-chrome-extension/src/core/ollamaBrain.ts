// Ollama brain — a BrainRuntime backed by a LOCAL Ollama server (http://localhost:11434
// by default) over its native HTTP API. A drop-in for the on-device WebLLM brain: identical
// contract, so chat, voice, and the tool router all work unchanged. Nothing is bundled or
// downloaded — the weights live in the user's own Ollama; this is just a thin HTTP client.
//
// Native `/api/chat` (NOT the OpenAI-compat /v1) on purpose: it streams NDJSON (one JSON
// object per line), exposes `/api/tags` for "what's installed locally", and takes a JSON
// `format` for the router's structured output. No SDK, no worker, no WebGPU.
//
// CORS: Ollama only allows 127.0.0.1/0.0.0.0 origins by default, so a chrome-extension://
// origin is rejected until the user starts it with OLLAMA_ORIGINS allowing this extension.
// A failed fetch surfaces as an uncatchable TypeError — ollamaErrorMessage turns that into
// actionable setup guidance instead of a raw stack.

import type { ChatTurn } from './chatContext';
import type { BrainRuntime, BrainFactory, GenerateOptions, CompleteOptions } from './brainRuntime';
import type { BrainResponseFormat } from './brainWorker';

/** Where a local Ollama listens by default. Overridable via Settings (`ollamaBaseUrl`). */
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/** One NDJSON line of a streamed `/api/chat` response (also the non-stream body shape). */
interface OllamaChatChunk {
  message?: { role?: string; content?: string };
  done?: boolean;
  done_reason?: string;
  error?: string;
}

/** Trim a base URL to a clean origin (no trailing slash); empty → the default. Pure. */
export function normalizeBaseUrl(url: string | undefined): string {
  const u = (url ?? '').trim();
  return (u || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
}

/** drift's ChatTurn[] → Ollama's `messages` (a 1:1 role/content mapping — Ollama accepts
 *  system/user/assistant directly, unlike Gemini). Pure. */
export function toOllama(messages: ChatTurn[]): Array<{ role: string; content: string }> {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/** Drain every COMPLETE NDJSON line from `buffer`, returning the parsed records and the
 *  leftover partial line (a JSON object can be split across stream chunks). Blank lines and
 *  un-parseable fragments are skipped, never thrown. Pure — the streaming core, unit-tested. */
export function drainNdjson(buffer: string): { records: OllamaChatChunk[]; rest: string } {
  const records: OllamaChatChunk[] = [];
  let nl: number;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try {
      records.push(JSON.parse(line) as OllamaChatChunk);
    } catch {
      /* a partial / malformed line — skip; the rest of the stream carries the real content */
    }
  }
  return { records, rest: buffer };
}

/** Ollama's `options` from drift's generate/complete opts (`num_predict` is its max-tokens).
 *  Returns undefined when nothing is set, so the request stays minimal. Pure. */
function buildOptions(opts: { temperature?: number; maxTokens?: number }): Record<string, number> | undefined {
  const o: Record<string, number> = {};
  if (typeof opts.temperature === 'number') o.temperature = opts.temperature;
  if (opts.maxTokens) o.num_predict = opts.maxTokens;
  return Object.keys(o).length ? o : undefined;
}

/** drift's response_format → Ollama's `format`: the router passes `{type:'json_object',
 *  schema}` (a STRINGIFIED JSON Schema) → Ollama takes the schema object (structured output),
 *  or the literal "json" if it won't parse. 'grammar' has no analogue → no format. Pure. */
export function formatFor(rf?: BrainResponseFormat): { format: unknown } | undefined {
  if (rf?.type !== 'json_object') return undefined;
  try {
    return { format: JSON.parse(rf.schema) };
  } catch {
    return { format: 'json' };
  }
}

/** Turn any fetch failure into an ACTIONABLE message. A network/CORS failure is an
 *  uncatchable TypeError ("Failed to fetch") — the most common cause is Ollama not running
 *  or not allowing this extension's origin. Pure. */
export function ollamaErrorMessage(err: unknown, baseUrl: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return `Couldn't reach Ollama at ${baseUrl}. Make sure \`ollama serve\` is running and was started with OLLAMA_ORIGINS allowing this extension.`;
  }
  return msg;
}

/** The fix for an origin-blocked POST. Ollama does NOT origin-check GET /api/tags (so the
 *  model list works), but it 403s the generative POST endpoints unless OLLAMA_ORIGINS allows
 *  the caller — so a green model list can still mean chat is blocked. */
export const ORIGIN_BLOCKED_MSG =
  "Ollama refused this extension (HTTP 403). Quit the Ollama app first (so the terminal server can bind), then run — QUOTES REQUIRED so the shell doesn't expand `*`:  OLLAMA_ORIGINS='*' ollama serve  . The exact per-extension command is in Settings → Ollama.";

/** Read a non-OK response into a readable message. A 403 is special-cased — it always
 *  means the extension's origin isn't allowed (not a bad request), so we surface the fix. */
async function httpError(res: Response): Promise<Error> {
  if (res.status === 403) return new Error(ORIGIN_BLOCKED_MSG);
  let detail = '';
  try {
    detail = ((await res.clone().json()) as { error?: string }).error ?? '';
  } catch {
    /* non-JSON body */
  }
  return new Error(`Ollama error (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
}

/** Combine the caller's AbortSignal with our internal one so BOTH `opts.signal` and
 *  `runtime.interrupt()` can stop a generation. Dependency-free (no AbortSignal.any). */
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

/** The locally-installed model names, newest-pull first as Ollama returns them. Throws a
 *  mapped error when the server is unreachable (the Settings "Test connection" catches it). */
export async function listOllamaModels(baseUrl: string, signal?: AbortSignal): Promise<string[]> {
  const base = normalizeBaseUrl(baseUrl);
  let res: Response;
  try {
    res = await fetch(`${base}/api/tags`, { signal });
  } catch (err) {
    throw new Error(ollamaErrorMessage(err, base));
  }
  if (!res.ok) throw await httpError(res);
  const json = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
  return (json.models ?? []).map((m) => m.name || m.model || '').filter(Boolean);
}

export interface OllamaStatus {
  /** Both the model list (GET) AND a generative request (POST) are allowed. */
  ok: boolean;
  /** Installed model names — present even when `blocked`, so the user can still pick one. */
  models: string[];
  /** GET worked (models listed) but a POST is origin-blocked (HTTP 403) — chat will fail
   *  until OLLAMA_ORIGINS allows this extension. */
  blocked?: boolean;
  /** An actionable reason when `ok` is false. */
  error?: string;
}

/** Does a POST (generative) request reach Ollama, or is the extension origin blocked? GET
 *  /api/tags is NOT origin-checked but POST endpoints ARE — so we probe POST /api/show (it
 *  returns model metadata, runs NO inference) to detect the 403 BEFORE the first chat. A
 *  non-403 (200, or even 404 for a missing model) means the origin is allowed. */
async function postAllowed(baseUrl: string, model: string, signal?: AbortSignal): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${normalizeBaseUrl(baseUrl)}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
      signal,
    });
    return res.status === 403 ? { ok: false, error: ORIGIN_BLOCKED_MSG } : { ok: true };
  } catch (err) {
    return { ok: false, error: ollamaErrorMessage(err, normalizeBaseUrl(baseUrl)) };
  }
}

/** Probe a local Ollama for the Settings "Test connection" — never throws. Lists models
 *  (GET) AND verifies generative access (POST), so a green model list can't hide a
 *  chat-blocking 403. Returns a structured result the UI maps to ✅ / ⚠️ blocked / ❌. */
export async function checkOllama(baseUrl: string, signal?: AbortSignal): Promise<OllamaStatus> {
  let models: string[];
  try {
    models = await listOllamaModels(baseUrl, signal);
  } catch (err) {
    return { ok: false, models: [], error: err instanceof Error ? err.message : String(err) };
  }
  // GET succeeded — now confirm a POST isn't origin-blocked (the GET-works/POST-403 trap).
  if (models.length) {
    const probe = await postAllowed(baseUrl, models[0], signal);
    if (!probe.ok) return { ok: false, blocked: true, models, error: probe.error };
  }
  return { ok: true, models };
}

/** Build an Ollama-backed BrainFactory. `baseUrl`/`model` are injected so this stays
 *  testable with a stubbed global `fetch` (no real server). */
export function makeOllamaBrainFactory(opts: { baseUrl?: string; model?: string }): BrainFactory {
  const baseUrl = normalizeBaseUrl(opts.baseUrl);
  const model = (opts.model ?? '').trim();
  return async () => {
    if (!model) throw new Error('No Ollama model selected — pick one in Settings');
    const inflight = new Set<AbortController>();
    const interrupt = (): void => {
      for (const ac of inflight) ac.abort();
      inflight.clear();
    };

    return {
      async generate(messages: ChatTurn[], gen: GenerateOptions = {}): Promise<string> {
        const ac = new AbortController();
        inflight.add(ac);
        const signal = merge(gen.signal, ac.signal);
        let full = '';
        try {
          const res = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: toOllama(messages), stream: true, options: buildOptions(gen) }),
            signal,
          });
          if (!res.ok) throw await httpError(res);
          if (!res.body) throw new Error('Ollama returned no response body');
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let sawDone = false;
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const { records, rest } = drainNdjson(buffer);
            buffer = rest;
            for (const r of records) {
              if (r.error) throw new Error(r.error);
              const t = r.message?.content ?? '';
              if (t) {
                full += t;
                gen.onToken?.(t);
              }
              if (r.done) {
                sawDone = true;
                return full;
              }
            }
          }
          // The connection closed before Ollama signalled `done` AND produced nothing — a
          // wrong endpoint / blocked origin / dropped connection. Surface it instead of
          // resolving '' (which would silently drop the reply bubble).
          if (!full && !sawDone) {
            throw new Error(`Ollama at ${baseUrl} returned no output — check the model name, that it's installed, and OLLAMA_ORIGINS allows this extension.`);
          }
          return full;
        } catch (err) {
          if (signal.aborted) return full; // interrupt → soft-stop with whatever streamed
          throw new Error(ollamaErrorMessage(err, baseUrl));
        } finally {
          inflight.delete(ac);
        }
      },

      async complete(messages: ChatTurn[], cmp: CompleteOptions = {}): Promise<string> {
        const ac = new AbortController();
        inflight.add(ac);
        const signal = merge(cmp.signal, ac.signal);
        try {
          const res = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: toOllama(messages),
              stream: false,
              options: buildOptions(cmp),
              ...formatFor(cmp.responseFormat),
            }),
            signal,
          });
          if (!res.ok) throw await httpError(res);
          const json = (await res.json()) as OllamaChatChunk;
          if (json.error) throw new Error(json.error);
          return json.message?.content ?? '';
        } catch (err) {
          if (signal.aborted) return '';
          throw new Error(ollamaErrorMessage(err, baseUrl));
        } finally {
          inflight.delete(ac);
        }
      },

      interrupt,
      free: interrupt, // stateless HTTP client — just stop anything in flight
    } satisfies BrainRuntime;
  };
}
