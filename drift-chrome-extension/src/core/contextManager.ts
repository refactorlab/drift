// Conversation-context manager for the live voice loop.
//
// THE PROBLEM IT SOLVES: Qwen (the in-browser brain) has a COMPILED ~4k-token
// context window. Sending the whole growing transcript every turn (the old
// `unlimited` default) overflows it after a few exchanges — WebLLM then errors,
// the turn fails, and the FSM falls back to Listening and never recovers ("stuck
// in Listening after a few messages").
//
// Volley keeps the prompt small by trimming oldest-first (web/src/context.mjs).
// Drift goes one step further and SUMMARIZES: once history grows past a cap, the
// older turns are folded into a compact running summary by the brain itself, so
// the agent keeps a MEMORY of the earlier conversation instead of forgetting it.
// A hard oldest-first token trim sits underneath as a safety net, so even if
// summarization is skipped or fails we can NEVER overflow the window.

import {
  countTokens,
  countMsgTokens,
  sliceTurnsByTokens,
  turnToMsg,
  type Turn,
  type ChatTurn,
} from './chatContext';

/** History (running summary + verbatim turns) is kept under this many tokens.
 *  Crossing it triggers summarization. Input(≈1500) + reply(≈1200) < Qwen's 4k. */
export const CONTEXT_MAX_TOKENS = 1500;
/** Target size for the compressed summary the brain produces. */
export const CONTEXT_SUMMARY_TOKENS = 500;
/** Always keep the most-recent N turns verbatim (never fold them into the summary)
 *  so the immediate back-and-forth stays high-fidelity. */
export const KEEP_RECENT_TURNS = 4;

/** Runs ONE brain completion for summarization and returns the summary text. */
export type Summarize = (messages: ChatTurn[], maxTokens: number) => Promise<string>;

export class ConversationContext {
  private summary = '';
  private turns: Turn[] = [];

  constructor(initial: Turn[] = []) {
    this.turns = initial.filter((t) => t.text && t.text.trim());
  }

  /** Append a completed turn to history. */
  add(role: 'user' | 'agent', text: string): void {
    if (text && text.trim()) this.turns.push({ role, text });
  }

  /** Current history size in tokens (running summary + verbatim turns). */
  private historyTokens(): number {
    const summaryTokens = this.summary ? countTokens(this.summary) + 4 : 0;
    return summaryTokens + countMsgTokens(this.turns.map(turnToMsg));
  }

  /**
   * If history exceeds {@link CONTEXT_MAX_TOKENS}, fold the OLDER turns (everything
   * but the last {@link KEEP_RECENT_TURNS}) into the running summary via the brain,
   * keeping recent turns verbatim. Best-effort: on failure we leave state unchanged
   * and rely on the hard trim in {@link toMessages}. AWAIT this BEFORE generating a
   * reply so the prompt is already inside the window.
   */
  async compact(summarize: Summarize): Promise<void> {
    if (this.historyTokens() <= CONTEXT_MAX_TOKENS) return;
    const keep = this.turns.slice(-KEEP_RECENT_TURNS);
    const old = this.turns.slice(0, -KEEP_RECENT_TURNS);
    if (!old.length) return; // only recent turns remain; toMessages() hard-trims if even those overflow
    try {
      const next = await summarize(buildSummaryPrompt(this.summary, old), CONTEXT_SUMMARY_TOKENS);
      if (next && next.trim()) {
        this.summary = next.trim();
        this.turns = keep;
      }
    } catch {
      /* leave state as-is — toMessages() will hard-trim so we never overflow */
    }
  }

  /**
   * Assemble the prompt for one reply: system persona + (optional) running summary
   * + the most-recent verbatim turns that fit the budget + the current user message.
   * The oldest-first trim here is the HARD ceiling guaranteeing we stay inside the
   * window even when summarization was skipped or failed. `userText` is passed
   * separately (never trimmed) so the current turn always reaches the brain.
   *
   * The persona AND the running summary go into ONE system message: WebLLM accepts
   * a single system message and only at index 0 — a second `system` turn (the old
   * shape, once a summary existed) makes it throw "System prompt should always be
   * the first message in `messages`", which silently broke every voice reply after
   * summarization first kicked in.
   */
  toMessages(persona: string, userText: string): ChatTurn[] {
    const system = this.summary
      ? `${persona}\n\nSummary of the earlier conversation:\n${this.summary}`
      : persona;
    const msgs: ChatTurn[] = [{ role: 'system', content: system }];
    const fixed = countTokens(system) + 4 + countTokens(userText) + 4;
    const budget = Math.max(0, CONTEXT_MAX_TOKENS - fixed);
    for (const t of sliceTurnsByTokens(this.turns, budget)) msgs.push(turnToMsg(t));
    msgs.push({ role: 'user', content: userText });
    return msgs;
  }
}

/** Build the brain prompt that compresses prior turns into an updated summary. */
function buildSummaryPrompt(prevSummary: string, turns: Turn[]): ChatTurn[] {
  const convo = turns
    .map((t) => `${t.role === 'agent' ? 'Assistant' : 'User'}: ${t.text}`)
    .join('\n');
  return [
    {
      role: 'system',
      content:
        'You compress a conversation into a brief, factual running summary. Preserve key facts, ' +
        "decisions, names, numbers, and the user's goals/preferences. Drop pleasantries and filler. " +
        'Write plain prose (no headings, no lists), under 350 words.',
    },
    {
      role: 'user',
      content:
        (prevSummary ? `Summary so far:\n${prevSummary}\n\n` : '') +
        `Conversation to fold in:\n${convo}\n\nUpdated summary:`,
    },
  ];
}
