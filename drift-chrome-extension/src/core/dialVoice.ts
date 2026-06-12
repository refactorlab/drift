// Dial (getdial.ai) — a FULLY HOSTED outbound AI phone call. Unlike the browser
// path in cfVoice.ts (where the side panel orchestrates STT→LLM→TTS itself), Dial
// runs the entire call on their infrastructure: their telephony rings the user's
// phone, their STT/TTS/LLM hold the conversation. We only:
//   1. send the system prompt (the PR grounding) + the number to dial, and
//   2. poll the call until it ends, then read the transcript.
//
// The extension page is CORS-exempt for getdial.ai because the manifest grants
// `https://*/*` host permission, so these are plain REST calls from the panel —
// no proxy needed. The user's own sk_live_ key is BYO, stored only on-device.
//
//   List numbers : GET  /api/v1/numbers              → { numbers: PhoneNumber[] }
//   Place a call : POST /api/v1/calls                → { call: DialCall }   (status "initiated")
//   Get a call   : GET  /api/v1/calls/{id}           → { call: DialCall }   (poll for transcript)
//
// Schemas verified June 2026 against docs.getdial.ai/api-reference/rest-api.

export const DIAL_API_BASE = 'https://getdial.ai/api/v1';

/** A provisioned Dial phone number (the account's own numbers). */
export interface DialNumber {
  id: string;
  number: string; // E.164
  nickname?: string | null;
  country?: string;
  capabilities?: string; // comma-separated, e.g. "voice,sms,whatsapp"
}

// Dial's call `status` comes in TWO shapes, and the docs only document one:
//   • POST /calls           → a STRING, e.g. "initiated"
//   • GET /calls/{id} & list → an OBJECT, e.g.
//       { state: "Terminated", terminationType: "busy", label: "Busy",
//         cancelRequested: false, cancelPending: false }
// We accept both and normalize via statusText()/isTerminalStatus() so neither the
// poll loop nor the UI ever blindly touches a missing field.
export interface DialCallStatus {
  /** Lifecycle state, e.g. "Queued" | "Ringing" | "InProgress" | "Terminated". */
  state?: string;
  /** Why a terminated call ended, e.g. "completed" | "busy" | "no-answer" | "failed" | "canceled". */
  terminationType?: string;
  /** Human-readable label Dial already formats, e.g. "Busy" | "Ringing" | "Completed". */
  label?: string;
  cancelRequested?: boolean;
  cancelPending?: boolean;
}
export type DialStatus = string | DialCallStatus;

/** A call resource. `status` is a string on create and an object on read (see above);
 *  `transcript`/`duration` fill in once the call ends. */
export interface DialCall {
  id: string;
  phoneNumberId?: string;
  from?: string;
  to?: string;
  direction?: 'inbound' | 'outbound';
  status?: DialStatus;
  duration?: number; // seconds
  transcript?: string | null;
  instruction?: string | null;
  createdAt?: string;
  /** Set once the call has ended (object-shape reads include this). */
  terminatedAt?: string | null;
  terminationType?: string | null;
}

export interface PlaceCallBody {
  /** Recipient phone number in E.164 format. */
  to: string;
  /** Id of the Dial number to call from. */
  fromNumberId: string;
  /** System prompt the AI voice agent runs with for the whole call. */
  outboundInstruction: string;
  /** BCP-47 language tag. Optional — omit to let Dial auto-detect. */
  language?: string;
  /** Voice gender. Optional — Dial defaults to female. */
  voiceGender?: 'male' | 'female';
}

export interface DialOpts {
  signal?: AbortSignal;
  /** Override fetch (tests inject a fake). */
  fetchImpl?: typeof fetch;
}

/** True when an API key is present (cheap gate before any network call). */
export function hasDialCreds(c: { dialApiKey?: string }): boolean {
  return !!c.dialApiKey?.trim();
}

/** Call statuses that mean the call is over (no more polling needed). The API
 *  spells it "cancelled"; we accept the US "canceled" too, defensively. */
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'canceled', 'no-answer', 'busy', 'terminated']);

/** A short, human-readable status label from EITHER shape (string or object) —
 *  never throws on a missing field. Returns "" when there's nothing to show. */
export function statusText(status: DialStatus | undefined | null): string {
  if (!status) return '';
  if (typeof status === 'string') return status;
  return (status.label || status.terminationType || status.state || '').toString();
}

/** True when the call has reached a terminal state, from EITHER status shape.
 *  Object form is terminal when `state` is "Terminated" (or a terminationType is
 *  present); string form is terminal when it's in the {@link TERMINAL} set. */
export function isTerminalStatus(status: DialStatus | undefined | null): boolean {
  if (!status) return false;
  if (typeof status === 'string') return TERMINAL.has(status.trim().toLowerCase());
  if (status.state && status.state.trim().toLowerCase() === 'terminated') return true;
  if (status.terminationType) return true; // a reason-to-end is only set once ended
  return TERMINAL.has((status.label ?? '').trim().toLowerCase());
}

/** True when the call carries a non-empty transcript. */
export function hasTranscript(call: DialCall | null | undefined): boolean {
  return !!call?.transcript?.trim();
}

/** Normalized termination reason ("completed" | "busy" | "no-answer" | …) read from
 *  either status shape, or "" if the call isn't terminated / has no reason. */
export function terminationOf(call: DialCall | null | undefined): string {
  if (!call) return '';
  const t =
    call.terminationType ??
    (typeof call.status === 'object' ? call.status?.terminationType : undefined) ??
    '';
  return t.trim().toLowerCase();
}

// Calls that never connected produce no conversation, so Dial never emits a
// `call.transcribed` for them — there's nothing to wait for. A normal completion
// reports "completed" (or, on some reads, an empty reason), which DOES transcribe.
const NO_TRANSCRIPT_REASONS = new Set(['busy', 'no-answer', 'failed', 'canceled', 'cancelled']);

/** Whether a terminated call can still yield a transcript. Dial transcribes a call
 *  ASYNCHRONOUSLY: the `call.ended` event (status → Terminated) fires a few seconds
 *  before `call.transcribed`, so a completed call read at the instant of termination
 *  usually still has `transcript: null`. Busy / no-answer / failed calls never will. */
export function mayYieldTranscript(call: DialCall | null | undefined): boolean {
  return !NO_TRANSCRIPT_REASONS.has(terminationOf(call));
}

function authHeaders(apiKey: string): HeadersInit {
  return { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
}

/** Pull a human-readable message out of a Dial error body (`{ error: string | obj }`). */
async function failMessage(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  try {
    const j = JSON.parse(body);
    const e = j?.error;
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object') return JSON.stringify(e);
  } catch {
    /* not json */
  }
  return body.slice(0, 200) || res.statusText;
}

/** List the account's provisioned phone numbers (to pick a `fromNumberId`). */
export async function listNumbers(apiKey: string, opts: DialOpts = {}): Promise<DialNumber[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(`${DIAL_API_BASE}/numbers`, {
    method: 'GET',
    headers: authHeaders(apiKey),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Dial list numbers ${res.status}: ${await failMessage(res)}`);
  const json = (await res.json()) as { numbers?: DialNumber[] };
  return json.numbers ?? [];
}

/** Place an outbound AI voice call. Returns the freshly-created call (status
 *  "initiated"); the transcript arrives later via {@link getCall}/{@link pollCall}.
 *
 *  An `Idempotency-Key` is sent so a network retry can't double-dial: replaying the
 *  same key returns the original call instead of placing a second one. */
export async function placeCall(
  apiKey: string,
  body: PlaceCallBody,
  opts: DialOpts & { idempotencyKey?: string } = {},
): Promise<DialCall> {
  const doFetch = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = { ...(authHeaders(apiKey) as Record<string, string>) };
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
  const res = await doFetch(`${DIAL_API_BASE}/calls`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Dial place call ${res.status}: ${await failMessage(res)}`);
  const json = (await res.json()) as { call?: DialCall };
  if (!json.call) throw new Error('Dial place call: response had no call');
  return json.call;
}

/** Fetch a single call by id (status, duration, transcript once available). */
export async function getCall(apiKey: string, id: string, opts: DialOpts = {}): Promise<DialCall> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(`${DIAL_API_BASE}/calls/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders(apiKey),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Dial get call ${res.status}: ${await failMessage(res)}`);
  const json = (await res.json()) as { call?: DialCall };
  if (!json.call) throw new Error('Dial get call: response had no call');
  return json.call;
}

export interface PollOpts extends DialOpts {
  /** Fired on every poll with the latest call snapshot (drives the live UI). */
  onUpdate?: (call: DialCall) => void;
  /** Delay between polls. Default 4000ms. */
  intervalMs?: number;
  /** Safety cap on total wall-clock. Default 30 minutes. */
  timeoutMs?: number;
  /** Once the call is terminal, how long to keep polling for the (asynchronously
   *  produced) transcript before giving up. Default 60s. */
  transcriptGraceMs?: number;
  /** Poll cadence while waiting for the post-call transcript. Default 2500ms. */
  transcriptPollMs?: number;
  /** Injectable sleep (tests pass a no-wait fake). */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/** Abortable sleep — rejects with the abort reason if the signal fires mid-wait. */
function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Poll a call until it reaches a terminal status AND its transcript has been produced
 * (or the timeout/abort fires), calling `onUpdate` with each snapshot. Returns the
 * final call.
 *
 * Dial transcribes a call asynchronously: `call.ended` (status → Terminated) lands a
 * few seconds before `call.transcribed`, so the snapshot at the instant of termination
 * usually still has `transcript: null`. Rather than subscribe to the account event
 * stream (a presence-based, lossy channel meant for a long-lived server watching ALL
 * account events — overkill for one browser-watched call), we keep polling the same
 * call object for a short grace window until the transcript materializes. Calls that
 * never connected (busy / no-answer / failed) never transcribe, so we return at once.
 */
export async function pollCall(apiKey: string, id: string, opts: PollOpts = {}): Promise<DialCall> {
  const interval = opts.intervalMs ?? 4000;
  const timeout = opts.timeoutMs ?? 30 * 60_000;
  const grace = opts.transcriptGraceMs ?? 60_000;
  const transcriptPoll = opts.transcriptPollMs ?? 2500;
  const sleep = opts.sleep ?? defaultSleep;
  const startedAt = Date.now();
  let terminalAt: number | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const call = await getCall(apiKey, id, { signal: opts.signal, fetchImpl: opts.fetchImpl });
    opts.onUpdate?.(call);
    if (call.terminatedAt || isTerminalStatus(call.status)) {
      // The call ended — wait out the async transcript before returning.
      if (hasTranscript(call) || !mayYieldTranscript(call)) return call;
      if (terminalAt === null) terminalAt = Date.now();
      else if (Date.now() - terminalAt >= grace) return call; // transcript never came
      await sleep(transcriptPoll, opts.signal);
      continue;
    }
    if (Date.now() - startedAt >= timeout) return call; // give up; return last snapshot
    await sleep(interval, opts.signal);
  }
}
