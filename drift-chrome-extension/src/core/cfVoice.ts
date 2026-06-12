// Cloudflare Workers AI — STT + TTS, called DIRECTLY from the side panel with
// the user's own (BYO) Workers AI token. The extension page is CORS-exempt for
// api.cloudflare.com because the manifest grants `https://*/*` host permission,
// so no proxy Worker is needed — the browser orchestrates the loop and these are
// two stateless REST calls.
//
//   STT: @cf/openai/whisper-large-v3-turbo  →  { audio: <base64>, language }  →  { result: { text } }
//   TTS: @cf/deepgram/aura-1                →  { text, speaker, encoding:"mp3" }  →  raw mp3 bytes
//
// Schemas verified June 2026 against developers.cloudflare.com/workers-ai/models.

export interface CfCreds {
  accountId: string;
  apiToken: string;
}

export const STT_MODEL = '@cf/openai/whisper-large-v3-turbo';
export const TTS_MODEL = '@cf/deepgram/aura-1';
export const DEFAULT_SPEAKER = 'asteria';

/** Aura-1 speaker catalog (for the Settings picker). */
export const AURA_SPEAKERS = [
  'asteria', 'luna', 'stella', 'athena', 'hera', // feminine
  'orion', 'arcas', 'perseus', 'angus', 'orpheus', 'helios', 'zeus', // masculine
] as const;

/** REST run endpoint for a Workers AI model. */
export function runUrl(accountId: string, model: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
}

/** True when both credentials are present (cheap gate before any network call). */
export function hasCfCreds(c: { voiceCfAccountId?: string; voiceCfApiToken?: string }): boolean {
  return !!c.voiceCfAccountId?.trim() && !!c.voiceCfApiToken?.trim();
}

/**
 * Base64-encode bytes in chunks. `btoa(String.fromCharCode(...bytes))` blows the
 * call-stack arg limit for utterance-sized buffers, so we build the binary string
 * in fixed windows first. Pure + synchronous → unit-testable.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000; // 32 KiB per window — well under the arg-count limit
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Pull the transcript text out of a Workers AI STT response (`{ result: { text } }`). */
export function parseTranscript(json: unknown): string {
  const text = (json as { result?: { text?: unknown } })?.result?.text;
  return typeof text === 'string' ? text.trim() : '';
}

// Whisper, fed near-silence or the residual echo of our own TTS (after the browser's
// echo canceller), doesn't return empty — it HALLUCINATES a small, well-known set of
// filler phrases ("you", "thank you", "thanks for watching", a lone period, the ♪
// music glyph…). Left unfiltered these become phantom "You" turns that make Andy talk
// to his own echo ("Sorry, I didn't quite catch that"). We drop them BEFORE a turn is
// created. Kept deliberately tight — real one-word replies ("yes", "no", "stop") are
// NOT in the set, so we never swallow a genuine answer.
const ECHO_HALLUCINATIONS = new Set([
  'you',
  'thank you',
  'thank you very much',
  'thanks',
  'thanks for watching',
  'thank you for watching',
  'please subscribe',
  'bye',
  'bye bye',
  'goodbye',
]);

/** True when a transcript is almost certainly silence/echo, not real user speech:
 *  empty, punctuation/symbols only, or one of Whisper's stock silence hallucinations. */
export function isNoiseTranscript(text: string): boolean {
  const trimmed = text.trim();
  // Non-speech annotations Whisper emits for silence/noise: "[BLANK_AUDIO]", "[silence]",
  // "(music)", "♪ … ♪" — the whole thing is bracketed/parenthesized/note-wrapped.
  if (/^[[(♪].*[\])♪]$/.test(trimmed)) return true;
  const t = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '') // strip punctuation, ♪, brackets, etc.
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return true; // blank, or punctuation/symbols only (".", "♪", "[BLANK_AUDIO]")
  return ECHO_HALLUCINATIONS.has(t);
}

type FetchLike = typeof fetch;

export interface CfOpts {
  signal?: AbortSignal;
  /** Override fetch (tests inject a fake). */
  fetchImpl?: FetchLike;
}

async function failMessage(res: Response): Promise<string> {
  // Cloudflare error bodies are JSON `{ errors: [{ message }] }`; fall back to text.
  const body = await res.text().catch(() => '');
  try {
    const j = JSON.parse(body);
    const m = j?.errors?.[0]?.message;
    if (m) return String(m);
  } catch { /* not json */ }
  return body.slice(0, 200) || res.statusText;
}

/** Transcribe a 16 kHz mono WAV via Workers AI Whisper. Returns the trimmed text. */
export async function transcribe(
  creds: CfCreds,
  wavBytes: Uint8Array,
  opts: CfOpts & { language?: string } = {},
): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(runUrl(creds.accountId, STT_MODEL), {
    method: 'POST',
    headers: { authorization: `Bearer ${creds.apiToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ audio: bytesToBase64(wavBytes), language: opts.language ?? 'en' }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Cloudflare STT ${res.status}: ${await failMessage(res)}`);
  return parseTranscript(await res.json());
}

/** Synthesize speech via Workers AI Aura-1. Returns raw MP3 bytes (decode + play). */
export async function synthesize(
  creds: CfCreds,
  text: string,
  opts: CfOpts & { speaker?: string } = {},
): Promise<Uint8Array> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(runUrl(creds.accountId, TTS_MODEL), {
    method: 'POST',
    headers: { authorization: `Bearer ${creds.apiToken}`, 'content-type': 'application/json' },
    // NB: `container` must be OMITTED for encoding=mp3 — Aura-1 returns
    // 400 "container is not applicable when encoding=mp3" if it's present.
    body: JSON.stringify({ text, speaker: opts.speaker ?? DEFAULT_SPEAKER, encoding: 'mp3' }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Cloudflare TTS ${res.status}: ${await failMessage(res)}`);
  return new Uint8Array(await res.arrayBuffer());
}
