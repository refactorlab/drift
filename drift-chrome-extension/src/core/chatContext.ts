// Context planning — the PURE, framework-free core that turns the on-screen
// transcript into the chat-message prompt sent to the brain, and decides how
// much history to keep. Ported from Volley's web/src/context.mjs (TypeScript +
// drift naming). Nothing here touches React, chrome.storage, or the worker, so
// it unit-tests in isolation (chatContext.test.ts).

import { Tiktoken } from 'js-tiktoken/lite';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';
import { MAX_OUTPUT_TOKENS } from './brainConstants';

/** One chat message in the OpenAI/WebLLM shape. */
export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** A transcript turn as displayed in the UI. `role` is the display role; an
 *  agent reply maps to the `assistant` chat role. */
export interface Turn {
  role: 'user' | 'agent';
  text: string;
}

// Real BPE token counting via tiktoken (js-tiktoken — pure JS, bundles cleanly,
// no WASM). cl100k_base is OpenAI's BPE; the brain is Qwen, whose tokenizer
// differs slightly, so treat these as an accurate-but-not-exact context gauge.
// This matches what goose does (it counts with tiktoken-rs o200k even for
// non-OpenAI models); cl100k tends to OVER-count Qwen on code — the safe
// direction for a budget guard. Per-message overhead (+4) approximates the
// chat-template role markers/separators the model adds around each message.
const ENC = new Tiktoken(cl100k_base);
export const countTokens = (s: string): number => ENC.encode(s || '').length;
export const countMsgTokens = (messages: ChatTurn[]): number =>
  messages.reduce((n, m) => n + countTokens(m.content) + 4, 0);

// Encoding hundreds of KB with a pure-JS BPE is a blocking, O(n) main-thread
// stall (js-tiktoken is ~1s on ~900k tokens). So for LARGE text we sample like
// aider's RepoMap.token_count: exact under a small threshold, else count ~100
// evenly-spaced lines and extrapolate by the sample's tokens-per-char ratio.
// Use this for "how big is this / is it over budget" checks; use countTokens
// for the small message strings where exactness is cheap.
const SAMPLE_THRESHOLD_CHARS = 200;
export function estimateTokens(text: string): number {
  const len = (text || '').length;
  if (len < SAMPLE_THRESHOLD_CHARS) return countTokens(text);
  const lines = text.split('\n');
  const step = Math.max(1, Math.floor(lines.length / 100));
  let sample = '';
  for (let i = 0; i < lines.length; i += step) sample += lines[i] + '\n';
  const sampleTokens = countTokens(sample);
  return Math.ceil((sampleTokens / Math.max(1, sample.length)) * len);
}

// Truncate to a TOKEN budget the correct way — encode → slice the token array →
// decode (NOT char×4). Skips the encode entirely when a cheap estimate is already
// under budget, so a huge input isn't encoded just to be returned whole.
export function truncateToTokens(text: string, maxTokens: number, marker = '\n…(truncated)'): string {
  if (!text || estimateTokens(text) <= maxTokens) return text;
  const toks = ENC.encode(text);
  if (toks.length <= maxTokens) return text;
  return ENC.decode(toks.slice(0, maxTokens)) + marker;
}

export const DEFAULT_HISTORY_WINDOW = 0; // optional coarse message cap; 0 = no cap → the TOKEN budget rules
export const DEFAULT_HISTORY_TOKENS = 4000; // token cap (input + reserved output) when "send full history" is off
export const DEFAULT_OUTPUT_RESERVE = MAX_OUTPUT_TOKENS; // tokens held back for the REPLY — matches the local generate cap

// "Send full history" — when true we send the ENTIRE transcript and NEVER trim.
// DEFAULT IS NOW false: Qwen's compiled context window is ~4096 tokens, and
// sending unbounded history overflowed it after a few turns — WebLLM then errors
// and the conversation wedges (the "stops responding after a few messages" bug).
// With this false, the 4000-token budget below trims oldest-first to stay inside
// the window. (The live VOICE loop goes further and SUMMARIZES old turns instead
// of dropping them — see contextManager.ts.)
export const DEFAULT_UNLIMITED_HISTORY = false;

// The output tokens to reserve for the reply: the user's Max-tokens cap if set,
// else the default. Single source of truth so the budget math and the UI/log
// can't drift apart.
export const effectiveReserve = (maxTokens?: number): number =>
  Number.isFinite(maxTokens) && (maxTokens as number) > 0 ? (maxTokens as number) : DEFAULT_OUTPUT_RESERVE;

// The TRANSCRIPT is the single source of truth for context: we project each turn
// into a chat message so what the engine sees is byte-for-byte what's displayed
// (including a reply cut short by a barge-in). Display role 'agent' → 'assistant'.
export const turnToMsg = (t: Turn): ChatTurn => ({
  role: t.role === 'agent' ? 'assistant' : 'user',
  content: t.text,
});

// Token-budget cap on projected history — the binding constraint that keeps the
// prompt inside the model's context window. Keeps the most-recent SUFFIX of
// `turns` whose projected tokens fit `budget`, trimming OLDEST-first. `budget`
// 0/falsy ⇒ no cap. Counts per message exactly like countMsgTokens (incl. the
// +4 chat-template overhead). A HARD ceiling: if even the single latest turn
// exceeds the budget, none are kept (the current user turn + system still go).
export function sliceTurnsByTokens(turns: Turn[], budget: number): Turn[] {
  if (!budget || budget <= 0) return turns;
  let total = 0;
  let i = turns.length;
  while (i > 0) {
    const t = countTokens(turns[i - 1].text) + 4; // per-message, matches countMsgTokens
    if (total + t > budget) break;
    total += t;
    i--;
  }
  const kept = turns.slice(i);
  // Don't begin history on an orphaned assistant reply (its user turn was
  // trimmed) — keep the chat template clean: system → user → assistant → …
  return kept.length && kept[0].role === 'agent' ? kept.slice(1) : kept;
}

// Decide which PRIOR turns to keep so the WHOLE request fits the budget. The
// budget is the model's usable context for one turn = INPUT (system + history +
// this user msg) + reserved OUTPUT. We never trim the system prompt or the
// current user message — only the history.
//   unlimited    → send the WHOLE transcript: NO token cap, NO message window.
//   budget <= 0  → no token cap (window only)
//   no room left → history dropped entirely (system + user still sent)
export function planContext(
  turns: Turn[],
  persona: string,
  userText: string,
  win: number,
  budget: number,
  outReserve: number | undefined,
  unlimited: boolean,
): Turn[] {
  if (unlimited) return turns; // "send full history": bypass both the token budget and the message window
  const windowed = win > 0 ? turns.slice(-win) : turns;
  if (!(budget > 0)) return windowed; // no token cap → message window only
  const reserve = effectiveReserve(outReserve);
  const fixed = countTokens(persona) + 4 + (countTokens(userText) + 4) + reserve; // never-trimmed parts
  const historyBudget = budget - fixed;
  return historyBudget > 0 ? sliceTurnsByTokens(windowed, historyBudget) : [];
}

/**
 * Build the full `messages` array for one brain call: system persona + planned
 * history + the current user turn. The single place the prompt is assembled, so
 * the UI estimate and the engine input never diverge.
 */
export function buildMessages(
  persona: string,
  turns: Turn[],
  userText: string,
  opts: { unlimited?: boolean; window?: number; budget?: number; outReserve?: number } = {},
): ChatTurn[] {
  const unlimited = opts.unlimited ?? DEFAULT_UNLIMITED_HISTORY;
  const win = opts.window ?? DEFAULT_HISTORY_WINDOW;
  const budget = opts.budget ?? DEFAULT_HISTORY_TOKENS;
  const kept = planContext(turns, persona, userText, win, budget, opts.outReserve, unlimited);
  return [
    { role: 'system', content: persona },
    ...kept.map(turnToMsg),
    { role: 'user', content: userText },
  ];
}
