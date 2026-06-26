// The shared agentic turn — used by BOTH the text chat (Chat.tsx) and the voice
// controller, so tool-calling behaves identically whether you type or speak.
//
// Two phases per round, leaning on WebLLM's RELIABLE native feature
// (grammar-constrained structured output via XGrammar) rather than its WIP
// function-calling:
//   1. ROUTE  — a tiny non-streaming `complete()` with a JSON-schema response
//               format whose `tool` field is enum-locked to the AVAILABLE tools
//               + "none". The decision is GUARANTEED valid + can't name an
//               unavailable tool. (No fragile <tool_call> stream parsing.)
//   2. ANSWER — if "none", freeform-stream the reply; if a tool, run it
//               (progress + cancel), feed the result back, and re-route. The
//               final answer is an unconstrained stream (best quality + clean UX).
// Capped at `maxRounds` so a confused model can't loop forever.

import type { BrainRuntime } from './brainRuntime';
import { logger } from './debug';
import { buildMessages, type ChatTurn, type Turn } from './chatContext';
import type { FilePresentation } from '../agents/scrollPlan';
import type { ExplainerDoc } from '../agents/explainerDoc';
import {
  buildSystemPrompt,
  buildRouterSystemPrompt,
  routerSchema,
  parseRouterDecision,
  getAvailableTools,
  findTool,
  isMetaQuestion,
  routeHandover,
  routeRisk,
  routeDeck,
  buildToolFailureReport,
  type PrToolState,
  type ToolRunContext,
  type ToolBreadcrumb,
} from './chatTools';

export interface AgentEvents {
  /** A visible reply-token delta (final answer only). */
  onToken: (delta: string) => void;
  /** A tool call started — show a tool-step card. */
  onToolStart?: (tool: string) => void;
  /** Human-readable progress for the running tool. */
  onToolProgress?: (tool: string, note: string) => void;
  /** Tool finished — `ok`, with a short summary for the card. On failure, `details`
   *  carries the copyable developer report (error + context + progress log). */
  onToolEnd?: (tool: string, ok: boolean, summary: string, details?: string) => void;
  /** Apply a state change a tool reported (e.g. scan ran → file count). */
  onStatePatch?: (patch: Partial<PrToolState>) => void;
  /** A handover file step produced clickable presentation beats — attach them to the
   *  reply so the message can render breathing buttons (replay scroll+highlight). */
  onPresentation?: (presentation: FilePresentation) => void;
  /** The summary_presentation_deck tool produced a playable deck — attach it to the reply. */
  onDeck?: (deck: ExplainerDoc) => void;
}

export interface AgentTurnOpts {
  brain: BrainRuntime;
  persona: string;
  /** Prior conversation turns (the current userText is appended internally). */
  history: Turn[];
  userText: string;
  /** Live state accessor — re-read each round (scanRunning flips during a scan). */
  getState: () => PrToolState;
  signal: AbortSignal;
  events: AgentEvents;
  maxRounds?: number;
  maxTokens?: number;
}

/** Tool result messages accumulated across rounds, fed back into both phases. */
type Extra = ChatTurn[];

async function answer(
  brain: BrainRuntime,
  persona: string,
  state: PrToolState,
  history: Turn[],
  userText: string,
  extra: Extra,
  signal: AbortSignal,
  maxTokens: number | undefined,
  onToken: (d: string) => void,
): Promise<string> {
  const messages = [...buildMessages(buildSystemPrompt(persona, state), history, userText), ...extra];
  return brain.generate(messages, { signal, maxTokens, onToken });
}

/**
 * Run one agentic turn. Returns the final visible answer text (for history /
 * speaking). Tool side effects are surfaced via events.
 */
export async function runAgentTurn(opts: AgentTurnOpts): Promise<string> {
  const { brain, persona, history, userText, getState, signal, events } = opts;
  const maxRounds = opts.maxRounds ?? 3;
  const extra: Extra = [];
  const log = logger('agent');
  log.log(`turn "${userText.slice(0, 80)}" · history=${history.length}`);

  // State patches a tool reported THIS turn. We merge them over getState() each
  // round so a flag a tool just set (scanRan, architectureKnown) is visible to
  // the very next route — without waiting on the host's async re-render. This is
  // what lets get_pr_architecture → explain_architecture chain within one turn.
  const turnPatch: Partial<PrToolState> = {};

  for (let round = 0; round < maxRounds; round++) {
    const state = { ...getState(), ...turnPatch };
    const tools = getAvailableTools(state);
    log.log(`round ${round} · tools=[${tools.map((t) => t.name).join(', ') || 'none'}]`);

    // ── 1. ROUTE (only if any tool is available) ──
    // A question about US ("what can you do?", "cool functions you can run?") or
    // plain chit-chat never needs a tool — short-circuit to "none" deterministically
    // on the first round so a 1.5B router can't misfire it into a PR scan. (Later
    // rounds carry tool results, so skip the guard there.)
    let chosen: string | null = null;
    // Deterministic handover control ("next"/"proceed"/"go to <file>"/"stop"/…)
    // bypasses the weak LLM router — same principle as isMetaQuestion. Checked
    // EVERY round so a "walk me through" on an unscanned PR can scan (round 0) then
    // start the walkthrough (round 1, once scan_ran flips in turnPatch).
    // Risk routing joins the handover short-circuit: a direct risk question must hit
    // the grounded explain_risk before the weak router (or the meta guard) can answer
    // it from imagination — the "Address before merge → 'no obvious risks'" bug.
    const forced = routeHandover(userText, state) ?? routeRisk(userText, state) ?? routeDeck(userText, state);
    if (forced && findTool(forced)?.available(state)) {
      chosen = forced;
      log.log(`route → ${chosen} (forced short-circuit)`);
    } else if (tools.length && !(round === 0 && extra.length === 0 && isMetaQuestion(userText))) {
      const routeMsgs = [
        ...buildMessages(buildRouterSystemPrompt(persona, state), history, userText),
        ...extra,
      ];
      const stop = log.time('route');
      try {
        const decision = await brain.complete(routeMsgs, {
          signal,
          // Headroom so the longest tool name (e.g. explain_business_logic_changes)
          // can't be truncated mid-JSON — truncated structured output fails to parse
          // (Qwen structured-output guidance: don't cap max_tokens too tight).
          maxTokens: 40,
          temperature: 0,
          responseFormat: { type: 'json_object', schema: routerSchema(state) },
        });
        chosen = parseRouterDecision(decision, state);
        log.log(`route → ${chosen ?? 'none'} (raw: ${decision.trim().slice(0, 60)})`);
      } catch (e) {
        log.warn('route failed → answering directly', e);
        chosen = null; // routing failed → just answer
      }
      stop();
      if (signal.aborted) return '';
    }

    // ── 2a. No tool → freeform answer (final) ──
    if (!chosen) {
      const stop = log.time('answer');
      const text = (await answer(brain, persona, state, history, userText, extra, signal, opts.maxTokens, events.onToken)).trim();
      stop();
      log.log(`answer · ${text.length} chars`);
      return text;
    }

    // ── 2b. Run the tool, feed the result, loop ──
    const tool = findTool(chosen)!;
    log.log(`▶ tool ${tool.name}`);
    const toolTimer = log.time(`tool ${tool.name}`);
    events.onToolStart?.(tool.name);
    // Breadcrumb the progress notes (with timing) so a failure can show WHICH
    // stage it died at — copied off the tool-step card for developers.
    const breadcrumbs: ToolBreadcrumb[] = [];
    const toolStart = Date.now();
    const ctx: ToolRunContext = {
      state,
      signal,
      onProgress: (note) => {
        breadcrumbs.push({ t: Date.now() - toolStart, note });
        events.onToolProgress?.(tool.name, note);
      },
      brain,
      userText,
      mode: 'text',
    };
    let result: {
      ok: boolean;
      content: string;
      statePatch?: Partial<PrToolState>;
      summary?: string;
      details?: string;
      final?: boolean;
      presentation?: FilePresentation;
      deck?: ExplainerDoc;
    };
    try {
      result = await tool.run(call_args(), ctx);
    } catch (e) {
      if (signal.aborted || (e as Error)?.name === 'AbortError') {
        events.onToolEnd?.(tool.name, false, 'stopped');
        return '';
      }
      const reason = e instanceof Error ? e.message : String(e);
      const details = buildToolFailureReport(tool.name, state, breadcrumbs, e, Date.now() - toolStart);
      result = { ok: false, content: `Tool failed: ${reason}`, summary: `failed — ${reason}`.slice(0, 140), details };
    }
    if (result.statePatch) {
      Object.assign(turnPatch, result.statePatch); // authoritative for the next round
      events.onStatePatch?.(result.statePatch);
    }
    events.onToolEnd?.(tool.name, result.ok, result.summary ?? (result.ok ? 'done' : 'failed'), result.details);
    toolTimer();
    log.log(`◀ tool ${tool.name} ${result.ok ? 'ok' : 'failed'} · ${result.content.slice(0, 80)}`);

    // A `final` tool (handover) produces the user-facing reply ITSELF — already
    // formatted (the plan, the per-file explanation, the "Proceed?" prompt). Emit it
    // VERBATIM and return. Feeding it back through the weak 1.5B answer model
    // collapsed the whole thing into a useless "Next." (it latched onto the
    // 'say "next"' instruction). This is also terminal — no re-route, no second
    // cursor advance.
    if (result.final) {
      if (result.presentation) events.onPresentation?.(result.presentation);
      if (result.deck) events.onDeck?.(result.deck);
      if (result.content) events.onToken(result.content);
      return result.content;
    }

    extra.push({ role: 'assistant', content: `Called ${tool.name}.` });
    extra.push({ role: 'user', content: `Tool result (${tool.name}):\n${result.content}` });
  }

  // Rounds exhausted (kept calling tools) — produce a final answer with what we have.
  return (
    await answer(brain, persona, { ...getState(), ...turnPatch }, history, userText, extra, signal, opts.maxTokens, events.onToken)
  ).trim();
}

/** Our tools take no args today; centralize so adding args later is one change. */
function call_args(): Record<string, unknown> {
  return {};
}
