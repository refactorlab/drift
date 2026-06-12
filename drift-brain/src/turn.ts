// drift-brain — pure, testable helpers for a single chat turn.
//
// Kept separate from index.ts (the server wiring) so the prompt-building and the
// SDK-message folding can be unit-tested without spawning the Agent SDK process.

export type Turn = { role: "user" | "assistant"; content: string };

// Timing + identity surfaced for one turn. Sourced from the Agent SDK's `result`
// message (duration_ms / duration_api_ms / ttft_ms) and the session_id that rides
// on nearly every SDK message.
export interface TurnMeta {
  sessionId?: string;
  durationMs?: number; // total wall-clock the Claude CLI took to answer this turn
  durationApiMs?: number; // of which, time spent in the model API call
  ttftMs?: number; // time to first streamed token
  // Token accounting off the final `result` message's `usage`. On a RESUMED turn the
  // SDK replays the whole session, so inputTokens is the full reprocessed context —
  // a rising inputTokens with low cacheReadTokens is the tell-tale of context bloat /
  // cache misses (the usual cause of a live conversation getting slower each turn).
  inputTokens?: number; // fresh (uncached) prompt tokens prefilled this turn
  outputTokens?: number; // tokens generated this turn
  cacheReadTokens?: number; // prompt tokens served from the prompt cache (cheap/fast)
  cacheCreationTokens?: number; // tokens written into the cache this turn
  costUsd?: number; // SDK-reported total_cost_usd for this turn
}

// Render the whole (client-capped) transcript as a single labeled prompt. We run
// STATELESS — this is sent on EVERY turn, not just the first — so the model always
// sees the conversation from the transcript itself rather than a server session.
export function renderPrompt(transcript: Turn[]): string {
  return (
    transcript.map((t) => `${t.role === "assistant" ? "You" : "User"}: ${t.content}`).join("\n") +
    "\nYou:"
  );
}

// Fold one SDK message into the running turn meta. Pure (returns a new object).
// session_id appears on almost every message; the timing fields only on the final
// `result` message.
export function foldMeta(meta: TurnMeta, msg: unknown): TurnMeta {
  if (!msg || typeof msg !== "object") return meta;
  const m = msg as Record<string, unknown>;
  const next: TurnMeta = { ...meta };
  if (typeof m.session_id === "string" && m.session_id) next.sessionId = m.session_id;
  if (m.type === "result") {
    if (typeof m.duration_ms === "number") next.durationMs = m.duration_ms;
    if (typeof m.duration_api_ms === "number") next.durationApiMs = m.duration_api_ms;
    if (typeof m.ttft_ms === "number") next.ttftMs = m.ttft_ms;
    if (typeof m.total_cost_usd === "number") next.costUsd = m.total_cost_usd;
    const usage = m.usage as Record<string, unknown> | undefined;
    if (usage && typeof usage === "object") {
      if (typeof usage.input_tokens === "number") next.inputTokens = usage.input_tokens;
      if (typeof usage.output_tokens === "number") next.outputTokens = usage.output_tokens;
      if (typeof usage.cache_read_input_tokens === "number") next.cacheReadTokens = usage.cache_read_input_tokens;
      if (typeof usage.cache_creation_input_tokens === "number") next.cacheCreationTokens = usage.cache_creation_input_tokens;
    }
  }
  return next;
}
