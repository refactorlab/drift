// Client for the local drift-brain (../../drift-brain) — the Claude "brain" that
// runs as a tiny loopback process so it can use your `claude login` subscription
// (the only ToS-legal way to use the subscription; see the plan). The browser
// orchestrates the turn; this is just the LLM hop: POST a transcript, stream the
// spoken reply back over Server-Sent Events.
//
//   POST {brainUrl}/turn  { systemPrompt, transcript:[{role,content}], model }
//     → text/event-stream:  data:{"text":"…"}  …  then  event:done  (or event:error)
//
// STATELESS: the client sends the last N (capped) turns as the transcript every
// time — there is no server session. This is deliberate: aborting a resumed session
// on barge-in corrupts the on-disk session and drops context after the first
// interrupt. The transcript here is the single source of truth.

export const DEFAULT_BRAIN_URL = 'http://localhost:8787';
export const DEFAULT_VOICE_MODEL = 'claude-opus-4-8'; // most capable (default); Haiku is faster for live

/** Claude models the voice brain can run, fastest → most capable. The id is passed
 *  to drift-brain → the Agent SDK; the label is shown in the picker. */
export interface VoiceModel {
  id: string;
  label: string;
}
export const VOICE_MODELS: VoiceModel[] = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 · fastest' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 · balanced' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 · most capable' },
  { id: 'claude-fable-5', label: 'Fable 5 · latest' },
];

/** Short display name for a model id ("claude-opus-4-8" → "Opus 4.8 · most capable"). */
export function voiceModelLabel(id: string | undefined): string {
  const m = VOICE_MODELS.find((v) => v.id === (id || DEFAULT_VOICE_MODEL));
  return m ? m.label : id || DEFAULT_VOICE_MODEL;
}

export interface BrainTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface SseEvent {
  event: string; // "message" (default), "meta", "done", or "error"
  data: string;
}

/** Per-turn timing + token usage reported by the brain after a reply. */
export interface BrainMeta {
  durationMs?: number; // wall-clock the Claude CLI took to answer this turn
  durationApiMs?: number; // of which, time in the model API call
  ttftMs?: number; // time to first streamed token
  // Real token usage off the SDK result (the ground truth — NOT a tiktoken estimate,
  // which is OpenAI's tokenizer and wrong for Claude). inputTokens is this turn's
  // full prompt: the diff system prompt (cached) + the capped transcript.
  inputTokens?: number; // fresh (uncached) prompt tokens this turn
  outputTokens?: number; // tokens generated this turn
  cacheReadTokens?: number; // prompt tokens served from cache (cheap/fast)
  cacheCreationTokens?: number; // tokens written into the cache this turn
  costUsd?: number; // total_cost_usd for this turn
}

/**
 * Parse complete SSE records out of an accumulating buffer. Records are separated
 * by a blank line; an incomplete trailing record is returned as `rest` to be
 * prepended to the next chunk. Pure → unit-testable.
 */
export function parseSseBuffer(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  // Normalize CRLF so the blank-line split is reliable across servers.
  const norm = buffer.replace(/\r\n/g, '\n');
  const parts = norm.split('\n\n');
  const rest = parts.pop() ?? ''; // last part is incomplete (no terminating blank line yet)
  for (const block of parts) {
    if (!block.trim()) continue;
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    events.push({ event, data: dataLines.join('\n') });
  }
  return { events, rest };
}

export interface StreamBrainOpts {
  brainUrl: string;
  systemPrompt: string;
  transcript: BrainTurn[]; // the last N (capped) turns — stateless, no server session
  model?: string;
  workspaceId?: string; // mount the uploaded PR-diff workspace so Andy can Read files on demand
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  onMeta?: (meta: BrainMeta) => void; // fired once when the turn's timing arrives
}

export interface UploadContextResult {
  workspaceId: string;
  written: number;
  skipped: string[];
}

/**
 * Upload a PR's FULL diff to the brain once (POST /context). The brain writes it to
 * an isolated temp dir; later /turn calls pass the returned workspaceId so Andy gets
 * read-only Read/Grep/Glob over every file — the local-subscription equivalent of
 * Managed Agents' file mounts (which we can't use: API-billed + cloud-sandboxed).
 * Returns null on any failure — callers fall back to inline-only grounding.
 */
export async function uploadBrainContext(
  brainUrl: string,
  key: string,
  files: unknown[],
  fetchImpl: typeof fetch = fetch,
): Promise<UploadContextResult | null> {
  try {
    const res = await fetchImpl(`${brainUrl.replace(/\/$/, '')}/context`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, files }),
    });
    if (!res.ok) return null;
    return (await res.json()) as UploadContextResult;
  } catch {
    return null;
  }
}

/**
 * Stream a brain turn, yielding text deltas as they arrive. Throws on an `error`
 * event or a non-2xx response; returns when the `done` event arrives or the
 * stream closes. Abort via `opts.signal` (the brain interrupts the in-flight turn).
 */
export async function* streamBrain(opts: StreamBrainOpts): AsyncGenerator<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(`${opts.brainUrl.replace(/\/$/, '')}/turn`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: opts.systemPrompt,
      transcript: opts.transcript,
      model: opts.model ?? DEFAULT_VOICE_MODEL,
      workspaceId: opts.workspaceId,
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Brain ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  if (!res.body) throw new Error('Brain returned no response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseBuffer(buffer);
      buffer = rest;
      for (const ev of events) {
        if (ev.event === 'done') return;
        if (ev.event === 'error') {
          let msg = ev.data;
          try { msg = JSON.parse(ev.data)?.message ?? msg; } catch { /* keep raw */ }
          throw new Error(`Brain error: ${msg}`);
        }
        if (ev.event === 'meta') {
          try { opts.onMeta?.(JSON.parse(ev.data) as BrainMeta); } catch { /* ignore malformed meta */ }
          continue;
        }
        // default "message": data is `{"text":"…"}`
        try {
          const text = JSON.parse(ev.data)?.text;
          if (typeof text === 'string' && text) yield text;
        } catch { /* ignore malformed keepalive */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Health probe — true when the brain answers GET /health 2xx. */
export async function pingBrain(brainUrl: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(`${brainUrl.replace(/\/$/, '')}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
