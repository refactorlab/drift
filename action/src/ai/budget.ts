// Client-side token budgeting for the per-suggestion prompt.
//
// GitHub Models enforces a HARD input-token cap per request — 8000 on the
// Free/Pro/Business (low) tier. That cap counts the system + user messages
// combined; exceed it and the call 413s with
//   "Request body too large for <model>. Max size: 8000 tokens."
// before any inference happens. The old per-finding prompt sent the focal
// file's WHOLE diff, so a newly-added or heavily-changed file blew the cap
// and every suggestion came back empty. We now count tokens HERE, before
// the POST, and shrink the diff until it fits (see focal-prompt.ts).
//
// gpt-tokenizer is pure JavaScript (no native/WASM), bundles cleanly with
// esbuild into the dist/ runner, and ships the `o200k_base` encoding used
// by gpt-4.1 / gpt-4o / gpt-5 — so the count matches what the server bills.
// (Other OpenAI-family models share o200k_base; for non-OpenAI models this
// is a close, conservative estimate — fine for staying under a ceiling.)
import { encode } from 'gpt-tokenizer/encoding/o200k_base';

/** Token count for `text` under o200k_base; ~chars/4 fallback if encoding throws. */
export function countTokens(text: string): number {
  try {
    return encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

// Total input ceiling (system + user) we aim to stay under. Below the 8000
// hard cap on purpose: the request also carries the chat envelope (roles,
// JSON framing) the server counts, so we leave headroom. Override via
// AI_MAX_INPUT_TOKENS for a higher tier (Enterprise High is 16000).
export const DEFAULT_INPUT_CEILING = 7000;

export function inputCeiling(): number {
  const v = process.env.AI_MAX_INPUT_TOKENS;
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_INPUT_CEILING;
}
