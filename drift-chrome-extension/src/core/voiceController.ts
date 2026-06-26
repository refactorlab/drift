// The duplex voice controller — drift's port of Volley's worker.mjs control loop,
// running on the main thread (no SharedArrayBuffer needed; see voice-worklet.js).
//
// One audio bus, two engines:
//   • CONTROL plane: the VAD + DuplexCascade FSM inside the drift wasm (VadEngine).
//   • MODEL plane: Whisper (ASR), Qwen (brain), Kokoro (TTS) — all on JS workers.
//
// Flow per turn: mic frames (context rate) → resample to 24 kHz → FSM.pushMic.
// On COMMIT: concat the buffered utterance → resample to 16 kHz → ASR → push the
// user turn → FSM.setThinking → brain.generate (streaming into the transcript) →
// split into speakable chunks → Kokoro → resample to the context rate → play via
// the worklet, reporting output level so the FSM's echo-aware gate works. A
// sustained user burst returns BARGE_IN → abort generation + flush playback.

import { VadEngine, ACT_USER_STARTED, ACT_COMMIT, ACT_BARGE_IN, STATE_THINKING, STATE_SPEAKING } from './voiceWasm';
import { startCapture, type MicCapture } from './audioCapture';
import { resampleLinear, concatFloat32 } from './resample';
import { getSharedAsr } from './asrEngine';
import { getSharedBrain } from './brainEngine';
import type { BrainRuntime } from './brainRuntime';
import { loadKokoroRuntime } from './ttsStore';
import { type Turn } from './chatContext';
import { ConversationContext } from './contextManager';
import {
  getAvailableTools,
  findTool,
  isMetaQuestion,
  routeHandover,
  routeRisk,
  routeDeck,
  buildRouterSystemPrompt,
  routerSchema,
  parseRouterDecision,
  buildToolFailureReport,
  type PrToolState,
  type ToolBreadcrumb,
} from './chatTools';
import { logger } from './debug';
import type { KokoroRuntime } from './kokoroRuntime';
import type { FilePresentation } from '../agents/scrollPlan';
import type { ExplainerDoc } from '../agents/explainerDoc';

const log = logger('voice');

const FSM_RATE = 24_000; // the FSM/TTS bus rate
const ASR_RATE = 16_000; // Whisper input rate
// Pre-roll kept before onset so the first phoneme (or a barge's trigger speech)
// isn't clipped. A barge is DECLARED only after `bargeSpeechFrames` of speech-
// over-agent, and the FSM tolerates dips up to `vadHang` between those frames, so
// the true onset can sit ~(bargeSpeechFrames + vadHang) frames back. We keep that
// span + a small margin — matches Volley's `preRoll` sizing (worker.mjs).
const PREROLL_FRAMES = 11; // 5 (barge) + 4 (hang) + 2 margin ≈ 220 ms @ 20 ms/frame
// Hard cap on the in-flight utterance buffer. The FSM only commits on end-silence,
// so a never-ending utterance (a long monologue, or steady noise above the gate)
// would grow `utt` without bound and OOM the page. Keep a sliding ~30 s window —
// also Whisper's own processing window, so older audio would be truncated anyway.
// Mirrors Volley's MAX_UTTERANCE_FRAMES (worker.mjs).
const MAX_UTTERANCE_FRAMES = 1500; // 30 s @ 20 ms/frame

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface VoiceHandlers {
  /** The recognised user utterance (push a user turn). */
  onUserText: (text: string) => void;
  /** A streamed brain token for the in-flight reply. */
  onAssistantToken: (text: string) => void;
  /** The reply finished (full text); `interrupted` if a barge-in cut it short. */
  onAssistantDone: (full: string, interrupted: boolean) => void;
  /** FSM state changed (drives the UI indicator). */
  onState: (state: VoiceState) => void;
  /** Agent tool lifecycle (voice can call the same tools as text — scan, etc.). */
  onToolStart?: (tool: string) => void;
  onToolProgress?: (tool: string, note: string) => void;
  /** On failure, `details` carries the copyable developer report (error + context + progress log). */
  onToolEnd?: (tool: string, ok: boolean, summary: string, details?: string) => void;
  onStatePatch?: (patch: Partial<PrToolState>) => void;
  /** Handover presentation beats (clickable line spots) for the transcript message. */
  onPresentation?: (presentation: FilePresentation) => void;
  /** The summary_presentation_deck tool's playable deck for the transcript message. */
  onDeck?: (deck: ExplainerDoc) => void;
  /** Normalized 0..1 audio energy for the UI orb: mic loudness while listening,
   *  agent playback loudness while speaking. High-rate (per frame) — the sink
   *  should write a ref, not setState. */
  onLevel?: (level: number) => void;
  /** A non-fatal error (ASR/brain/TTS failure for one turn). */
  onError?: (message: string) => void;
}

// Faithful port of Volley's tts-clean.mjs PIPELINE. Kokoro phonemizes WHATEVER
// string it's handed, so raw markdown gets spelled out ("asterisk asterisk"),
// URLs get read char-by-char, list numbers/bullets get spoken, and smart quotes/
// em-dashes garble prosody. We strip non-speech while PRESERVING the punctuation
// Kokoro uses for prosody (. , ! ? ; : ' " ( ) -) plus $ % &. ORDER matters:
// fold unicode→ASCII first, then unwrap word-carrying markdown, then kill
// constructs whose inner chars would survive the catch-all, THEN the catch-all.
const TTS_CLEAN: Array<[RegExp, string]> = [
  // 1 — unicode punctuation → ASCII
  [/[‘’‚‛]/g, "'"],
  [/[“”„‟]/g, '"'],
  [/\s*[–—―]+\s*/g, ', '], // – — ― → comma pause
  [/…/g, '...'],
  // 2 — escape / control sequences (their params are digits)
  // eslint-disable-next-line no-control-regex
  [/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1B\\))/g, ''],
  // eslint-disable-next-line no-control-regex
  [/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ''],
  // 3 — unwrap markdown that carries spoken words (before URL strip)
  [/```[\s\S]*?```/g, ' '],
  [/!\[([^\]]*)\]\([^)]*\)/g, '$1'],
  [/\[([^\]]*)\]\([^)]*\)/g, '$1'],
  [/`([^`]+)`/g, '$1'],
  [/(\*{1,3}|_{1,3})(\S(?:.*?\S)?)\1/g, '$2'],
  [/~~([^~]*)~~/g, '$1'],
  // 4 — drop remaining bare URLs
  [/<https?:\/\/[^>]+>|\bhttps?:\/\/\S+|\bwww\.\S+/gi, ' '],
  // 5 — line-leading heading / quote / list markers (digits + bullets)
  [/^[ \t]*(?:#{1,6}|>+|[-*+•]|\d+[.)])[ \t]+/gm, ''],
  // 6 — catch-all: emoji + every remaining non-speech char → space
  [/\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*/gu, ' '],
  [/[^\p{L}\p{N}\s.,!?;:'"()$%&-]/gu, ' '],
  // 7 — tidy hyphens / whitespace / space-before-punct
  [/(?<![\p{L}\p{N}])-+|-+(?![\p{L}\p{N}])/gu, ' '],
  [/\s+/g, ' '],
  [/ +([.,!?;:])/g, '$1'],
];

/** Clean one chunk of LLM/markdown text into speakable plain text for Kokoro.
 *  May return '' — the caller skips empties. */
export function cleanForTts(text: string): string {
  if (!text) return '';
  return TTS_CLEAN.reduce((s, [re, to]) => s.replace(re, to), String(text)).trim();
}

/** Minimum chars before a CLAUSE mark (, ; :) is worth flushing as its own chunk
 *  — avoids choppy micro-clips. Volley's DEFAULT_CHUNK_MIN. */
export const CHUNK_MIN = 16;

/** Index just past the next speakable break in `buf`, or -1. Sentence-enders
 *  (. ! ? … and newline) break immediately; clause marks (, ; :) break only once
 *  the chunk is at least `clauseMin` chars. The FIRST chunk of a reply passes
 *  clauseMin=2 so "Sure," can start playing instantly (minimal time-to-first-
 *  audio — DuplexCascade's streaming thesis); later chunks pass CHUNK_MIN. */
export function nextBreak(buf: string, clauseMin: number = CHUNK_MIN): number {
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c === '.' || c === '!' || c === '?' || c === '…' || c === '\n') return i + 1;
    if ((c === ',' || c === ';' || c === ':') && i + 1 >= clauseMin) return i + 1;
  }
  return -1;
}

export class VoiceController {
  private engine!: VadEngine;
  private capture!: MicCapture;
  // Kokoro (TTS) is loaded LAZILY, off the listening critical path — see start().
  // Only needed to SPEAK, so we never block "listening" on it.
  private kokoroPromise: Promise<KokoroRuntime> | null = null;
  private ensureKokoro(): Promise<KokoroRuntime> {
    if (!this.kokoroPromise) this.kokoroPromise = loadKokoroRuntime();
    return this.kokoroPromise;
  }
  private stopped = false;

  // Capture state
  private preroll: Float32Array[] = []; // recent pre-onset 24 kHz frames
  private utt: Float32Array[] = []; // current utterance (24 kHz frames)
  private capturing = false;

  // Generation state
  private genAbort: AbortController | null = null;
  // Bumped on every barge-in (Volley's turnEpoch). A turn whose ASR/summarize/
  // prefill was still in flight when the user barged compares its snapshot and
  // bails WITHOUT touching FSM/context state — the barge handler has already put
  // the FSM in Listening and re-seeded the new capture, so a stale turn must not
  // reset() it or commit a half-turn to context.
  private turnEpoch = 0;
  private speaking = false;
  // True from the moment a reply starts generating until ALL its TTS is queued.
  // Gates onPlaybackIdle so a transient queue drain BETWEEN chunks (synthesis
  // lagging playback on the WASM fallback) can't flip us out of Speaking mid-reply
  // — Volley keeps Speaking active for the whole reply (backpressured writeOut).
  private replyActive = false;
  private persona = '';
  // Bounded, self-summarizing conversation memory (replaces an unbounded turns
  // array that overflowed Qwen's ~4k window after a few exchanges → "stuck in
  // Listening"). See contextManager.ts.
  private ctx!: ConversationContext;

  private constructor(
    private readonly handlers: VoiceHandlers,
    private readonly opts: { persona: string; voice: string; history: Turn[]; getToolState?: () => PrToolState | null },
  ) {
    this.persona = opts.persona;
    this.ctx = new ConversationContext(opts.history);
  }

  /** Boot all engines and start listening. Rejects if any engine fails to load. */
  static async start(
    handlers: VoiceHandlers,
    opts: { persona: string; voice: string; history: Turn[]; getToolState?: () => PrToolState | null },
  ): Promise<VoiceController> {
    const vc = new VoiceController(handlers, opts);
    log.log('start: creating VAD engine…');
    vc.engine = await VadEngine.create();
    // Barge-in DURING the Thinking phase is OFF. Volley keeps it on because its
    // Thinking is a single ~100 ms local generate. Drift's Thinking is now a
    // MULTI-STEP pipeline — summarize-check → grammar-constrained tool ROUTER call
    // → optional PR SCAN → answer prefill — often 1–3 s. With Thinking-barge on,
    // any mic energy in that long window (the user's own trailing speech, a breath,
    // room noise) fired a spurious barge that ABORTED the turn → "I spoke and it
    // did nothing, then sat in Listening." Off = the reply is allowed to land; the
    // user can still interrupt once the agent STARTS SPEAKING (Speaking-phase
    // barge is governed by the echo gate and is unaffected by this flag).
    vc.engine.setBargeInThinking(false);

    // CRITICAL ORDERING: open the mic + worklet and START LISTENING before the
    // heavy model loads. Whisper (~40 MB), Qwen (already warm from text mode), and
    // Kokoro (a FRESH worker every voice session) take seconds to (re)initialize;
    // gating "listening" on them left the orb stuck in a non-listening state with
    // no feedback ("Starting… and doesn't listen"). The mic + VAD are all we need
    // to LISTEN — the models only matter once the user has spoken, by which point
    // the background warm-up below has (almost always) finished. If a model is
    // still loading when the first utterance commits, handleUtterance simply awaits
    // the SAME shared promise (it's a singleton) and the FSM sits in Thinking.
    log.log('start: opening mic…');
    vc.capture = await startCapture({
      onFrame: (f) => vc.onFrame(f),
      onPlaybackIdle: () => vc.onPlaybackIdle(),
      onOutLevel: (rms) => {
        vc.engine.setOutputLevel(rms);
        if (vc.speaking) vc.handlers.onLevel?.(Math.min(1, rms * 2.2)); // orb energy
      },
    });
    handlers.onState('listening'); // ← LISTEN NOW; models warm in the background
    log.log('start: listening (models warming in background)');

    // Warm Whisper + Qwen + Kokoro off the critical path. A failure surfaces as a
    // soft status but never wedges listening.
    void Promise.all([getSharedAsr(), getSharedBrain(), vc.ensureKokoro()])
      .then(() => log.log('start: all models warm'))
      .catch((e) => {
        log.warn('background model warm failed', e);
        handlers.onError?.(`Voice model load issue: ${e instanceof Error ? e.message : String(e)}`);
      });
    return vc;
  }

  private emitState(): void {
    const s = this.engine.stateCode();
    this.handlers.onState(
      s === STATE_SPEAKING ? 'speaking' : s === STATE_THINKING ? 'thinking' : 'listening',
    );
  }

  /** One mic frame at the context rate → resample to 24 kHz → FSM. */
  private onFrame(ctxFrame: Float32Array): void {
    if (this.stopped) return;
    const frame = resampleLinear(ctxFrame, this.capture.sampleRate, FSM_RATE);

    // Maintain a small pre-roll ring while idle so onset isn't clipped.
    if (!this.capturing) {
      this.preroll.push(frame);
      if (this.preroll.length > PREROLL_FRAMES) this.preroll.shift();
    }

    const act = this.engine.pushMic(frame);

    // Mic loudness → orb energy while listening/thinking (during speaking the
    // playback meter drives it instead). lastEnergy() is the RMS of this frame.
    if (!this.speaking) this.handlers.onLevel?.(Math.min(1, this.engine.lastEnergy() * 4));

    if (this.capturing) {
      this.utt.push(frame);
      // Slide the window so an utterance that never end-points can't grow unbounded.
      if (this.utt.length > MAX_UTTERANCE_FRAMES) this.utt.shift();
    }

    switch (act) {
      case ACT_USER_STARTED:
        this.capturing = true;
        this.utt = [...this.preroll, frame]; // seed with pre-roll so we keep the onset
        this.preroll = [];
        this.emitState();
        break;
      case ACT_BARGE_IN:
        log.log('⚡ barge-in — aborting reply + flushing playback');
        // User talked over the agent (or over Thinking). Mirror Volley's barge
        // handler EXACTLY (worker.mjs):
        //   • abort the in-flight reply (this also interrupts the WebLLM brain via
        //     the AbortSignal) so token streaming + TTS stop immediately,
        //   • flush queued playback so the agent's voice is cut at once,
        //   • drop the echo gate (agent is now silent),
        //   • seed the new utterance with the PRE-ROLL so the ~200 ms of speech
        //     that TRIGGERED the barge (captured during playback) isn't clipped.
        // CRITICAL: do NOT call engine.setSpeaking(false). On returning BargeIn the
        // FSM has ALREADY entered Listening with speech_frames=1, counting THIS
        // frame as the new utterance's onset; setSpeaking(false) would clear_transient
        // (speech_frames→0) and clobber that capture. We only flip our LOCAL speaking
        // flag (synchronously, before flushPlayback's playback-idle can fire) so
        // onPlaybackIdle becomes a no-op and doesn't reset the FSM either.
        this.turnEpoch++; // supersede any in-flight turn so it bails without touching state
        this.abortGeneration(true);
        this.speaking = false;
        this.capture.flushPlayback();
        this.engine.setOutputLevel(0);
        this.capturing = true;
        this.utt = [...this.preroll, frame]; // pre-roll is newest-last; includes the onset
        this.preroll = [];
        this.emitState();
        break;
      case ACT_COMMIT: {
        const utterance = concatFloat32(this.utt);
        this.utt = [];
        this.capturing = false;
        // Clean turn boundary: a new committed utterance means any prior turn is
        // definitively over. Clear replyActive so a value leaked by a previous
        // superseded turn (barge) can't keep onPlaybackIdle from ever ending
        // Speaking. handleUtterance re-sets it true once it actually generates.
        this.replyActive = false;
        this.engine.setThinking();
        this.emitState();
        void this.handleUtterance(utterance);
        break;
      }
      default:
        break;
    }
  }

  /**
   * Router → run-one-tool, shared with the text chat. Returns the tool's output and
   * whether it's `final` — a final tool (handover) produces the user-facing reply
   * ITSELF, so the caller SPEAKS it verbatim instead of folding it into the answer
   * prompt (the weak model collapses it to "Next."). A non-final tool returns a
   * `[Tool result …]` block to fold into generation. Null = no tool / cancelled.
   */
  private async maybeRunTool(
    brain: BrainRuntime,
    userText: string,
    signal: AbortSignal,
    live: () => boolean,
    announce?: (action: string) => void,
  ): Promise<{ text: string; speak: string; final: boolean } | null> {
    const state = this.opts.getToolState?.() ?? null;
    if (!state) return null;
    const tools = getAvailableTools(state);
    if (!tools.length) return null;
    // Deterministic handover control ("next"/"proceed"/"go to <file>"/"stop"/…)
    // bypasses the weak LLM router — same short-circuit the text loop uses. It is
    // checked BEFORE the meta/chit-chat guard because affirmatives like "ok"/"got
    // it" are BOTH greetings and walkthrough "proceed" — during an active handover
    // they must advance it, not be answered as small talk (matches the text path).
    let chosen: string | null = routeHandover(userText, state) ?? routeRisk(userText, state) ?? routeDeck(userText, state);
    if (chosen && !findTool(chosen)?.available(state)) chosen = null;
    if (chosen) {
      log.log(`route → ${chosen} (forced short-circuit)`);
    } else {
      // A question about US / chit-chat needs no tool — short-circuit deterministically
      // so the 1.5B router can't misfire it into a PR scan (matches the text path).
      if (isMetaQuestion(userText)) return null;
      try {
        const routerMessages = this.ctx.toMessages(buildRouterSystemPrompt(this.persona, state), userText);
        const decision = await brain.complete(routerMessages, {
          signal,
          // Headroom so the longest tool name can't be truncated mid-JSON (truncated
          // structured output fails to parse). Matches the text router (agentLoop).
          maxTokens: 40,
          temperature: 0,
          responseFormat: { type: 'json_object', schema: routerSchema(state) },
        });
        if (!live()) return null;
        chosen = parseRouterDecision(decision, state);
        log.log(`route → ${chosen ?? 'none'} (tools=[${tools.map((t) => t.name).join(', ')}])`);
      } catch (e) {
        log.warn('route failed → answering without a tool', e);
        return null; // routing failed → answer without a tool
      }
    }
    if (!chosen) return null;

    const tool = findTool(chosen)!;
    log.log(`▶ tool ${tool.name}`);
    this.handlers.onToolStart?.(tool.name);
    // Narrate the agent's action so the user HEARS what it's doing during the
    // (often multi-second) read loop — e.g. "Checking for breaking changes…".
    if (tool.spokenAction) announce?.(tool.spokenAction);
    // Breadcrumb the progress notes (with timing) so a failure can show WHICH
    // stage it died at — copied off the tool-step card for developers.
    const breadcrumbs: ToolBreadcrumb[] = [];
    const toolStart = Date.now();
    try {
      const result = await tool.run(
        {},
        {
          state,
          signal,
          onProgress: (note) => {
            breadcrumbs.push({ t: Date.now() - toolStart, note });
            this.handlers.onToolProgress?.(tool.name, note);
          },
          brain,
          userText,
          mode: 'voice',
        },
      );
      if (result.statePatch) this.handlers.onStatePatch?.(result.statePatch);
      if (result.presentation) this.handlers.onPresentation?.(result.presentation);
      if (result.deck) this.handlers.onDeck?.(result.deck);
      this.handlers.onToolEnd?.(tool.name, result.ok, result.summary ?? (result.ok ? 'done' : 'failed'), result.details);
      // `final` (handover): the content IS the reply → show it + speak it (the
      // condensed `spoken` variant when present). Otherwise wrap it as a tool-result
      // block for the answer generation to fold in.
      return result.final
        ? { text: result.content, speak: result.spoken ?? result.content, final: true }
        : { text: `[Tool result (${tool.name})]:\n${result.content}`, speak: '', final: false };
    } catch (e) {
      if (signal.aborted || (e as Error)?.name === 'AbortError') {
        this.handlers.onToolEnd?.(tool.name, false, 'stopped');
        return null;
      }
      // Surface the REAL reason — both to the UI chip and (in full) to the answer
      // model, so it can explain the failure instead of saying "give me more
      // details". Previously the error was swallowed into a bare "failed".
      const reason = e instanceof Error ? e.message : String(e);
      const details = buildToolFailureReport(tool.name, state, breadcrumbs, e, Date.now() - toolStart);
      log.error(`tool ${tool.name} failed`, e);
      this.handlers.onToolEnd?.(tool.name, false, `failed — ${reason}`.slice(0, 140), details);
      return { text: `[Tool ${tool.name} failed: ${reason}]`, speak: '', final: false };
    }
  }

  /** ASR → brain → TTS for one committed utterance. */
  private async handleUtterance(utterance24k: Float32Array): Promise<void> {
    const abort = new AbortController();
    this.genAbort = abort;
    const myEpoch = this.turnEpoch; // snapshot; a barge bumps turnEpoch → this turn is superseded
    // Superseded (barge fired) OR cancelled (abort) → bail WITHOUT touching FSM/
    // context state; the barge handler already owns the FSM and the new capture.
    const live = () => !abort.signal.aborted && this.turnEpoch === myEpoch;
    try {
      const pcm16k = resampleLinear(utterance24k, FSM_RATE, ASR_RATE);
      const asr = await getSharedAsr();
      const userText = await asr.transcribe(pcm16k);
      if (!live()) return;
      // Match Volley: reject empties and tag-only blips (no letters/digits left
      // after cleaning) so noise/silence never reaches the brain.
      if (userText.trim().length < 2 || !/[a-z0-9]/i.test(userText)) {
        log.log(`ASR rejected (blip): "${userText}"`);
        this.engine.reset();
        this.emitState();
        return;
      }
      log.log(`ASR → "${userText}"`);
      this.handlers.onUserText(userText);
      const brain = await getSharedBrain();

      // Keep the prompt inside Qwen's ~4k window: summarize older history into a
      // compact running summary once it grows past the cap (contextManager.ts).
      // This is THE fix for "stops responding after a few messages" — unbounded
      // history used to overflow the model. The summary call shares this turn's
      // abort signal, so a barge during summarization cancels it cleanly.
      await this.ctx.compact((msgs, max) => brain.generate(msgs, { maxTokens: max, signal: abort.signal }));
      if (!live()) return;

      // ── TOOL ROUTING ── Same grammar-constrained router the text chat uses, but
      // run inline before the spoken reply (the voice path's streaming-TTS answer
      // is too coupled to hand to the full agentLoop). The model picks an
      // available tool (or none) under XGrammar; if a tool, we run it (the
      // tool-step card + scan chip update via handlers, and it shares this turn's
      // abort signal so a barge/Stop cancels the scan), then feed its result into
      // the answer prompt. The FSM stays in Thinking the whole time → the orb
      // shows "thinking" while a scan runs.
      // ── TTS pipeline — set up BEFORE tool routing so the agent's ACTION can be
      // narrated (spoken) while a multi-second read loop runs. Stream tokens; flush
      // speakable chunks as sentence breaks appear so audio starts before the reply
      // is done. `countAsHeard=false` is used for the spoken action lead-in so it
      // plays but isn't committed as part of the reply transcript.
      let sentenceBuf = '';
      let full = '';
      let spoken = ''; // the prefix actually released to TTS (≤ full) — what the user HEARS
      let firstAudio = false;
      let firstChunk = true; // first chunk breaks early (clauseMin=2) for low time-to-first-audio
      const speak = async (chunk: string, countAsHeard = true) => {
        const clean = cleanForTts(chunk);
        if (!clean) return;
        const kokoro = await this.ensureKokoro(); // lazy — first speak awaits the background warm
        const pcm = await kokoro.synthesize(clean, { sid: 0, voice: this.opts.voice });
        if (abort.signal.aborted) return;
        if (!firstAudio) {
          firstAudio = true;
          // Seed the echo gate before the real-time playback meter starts ticking
          // so the agent's own first frames can't self-trigger a barge.
          this.engine.setOutputLevel(this.engine.rms(pcm.samples));
          this.setSpeaking(true);
        }
        const out = resampleLinear(pcm.samples, pcm.sampleRate, this.capture.sampleRate);
        this.capture.play(out);
        if (countAsHeard) spoken += (spoken ? ' ' : '') + chunk.trim(); // counts as heard
      };

      // Serialize TTS so chunks synthesize AND play in order (Volley's ttsQueue +
      // single pump). Fire-and-forget would let a short later sentence resolve
      // first and play out of order, and run concurrent GPU synths that contend.
      // We chain each chunk on one tail promise so there's exactly one synth in
      // flight at a time, in submission order.
      let ttsTail: Promise<void> = Promise.resolve();
      const enqueueSpeak = (chunk: string, countAsHeard = true): void => {
        ttsTail = ttsTail.then(() => speak(chunk, countAsHeard)).catch(() => {});
      };

      const toolResult = await this.maybeRunTool(brain, userText, abort.signal, live, (action) => {
        // Hold Speaking from the spoken lead-in through the answer so the turn
        // doesn't end when the lead-in audio drains mid-tool.
        this.replyActive = true;
        enqueueSpeak(action, false);
      });
      if (!live()) return;

      this.replyActive = true; // hold Speaking across the whole reply (see field doc)

      if (toolResult?.final) {
        // The tool produced the reply itself (handover) — DON'T run it through
        // generation (that collapsed it to "Next."). SHOW the full content in the
        // transcript, but SPEAK the condensed `speak` variant (the start plan lists
        // every file — fine to read, painful to hear), chunked on the same breaks.
        full = toolResult.text;
        this.handlers.onAssistantToken(toolResult.text);
        let buf = toolResult.speak;
        let idx: number;
        while ((idx = nextBreak(buf, firstChunk ? 2 : CHUNK_MIN)) >= 0) {
          enqueueSpeak(buf.slice(0, idx), false); // not "heard"-tracked: `full` already holds the reply
          buf = buf.slice(idx);
          firstChunk = false;
        }
        if (buf.trim()) enqueueSpeak(buf, false);
      } else {
        const effectiveUser = toolResult ? `${userText}\n\n${toolResult.text}` : userText;
        const messages = this.ctx.toMessages(this.persona, effectiveUser);
        await brain.generate(messages, {
          signal: abort.signal,
          onToken: (tok) => {
            full += tok;
            sentenceBuf += tok;
            this.handlers.onAssistantToken(tok);
            let idx: number;
            while ((idx = nextBreak(sentenceBuf, firstChunk ? 2 : CHUNK_MIN)) >= 0) {
              const chunk = sentenceBuf.slice(0, idx);
              sentenceBuf = sentenceBuf.slice(idx);
              enqueueSpeak(chunk);
              firstChunk = false; // later chunks use the full CHUNK_MIN (no choppy micro-clips)
            }
          },
        });
      }

      if (live()) {
        if (sentenceBuf.trim()) enqueueSpeak(sentenceBuf); // flush the tail
        await ttsTail; // wait for all queued synthesis to finish + be queued for playback
      }
      // Re-evaluate AFTER the await: a barge during synthesis may have superseded
      // this turn (turnEpoch bumped, FSM re-seeded). A superseded turn must NOT
      // touch FSM state below — only commit the prefix actually heard to context.
      if (live()) {
        this.replyActive = false; // reply fully synthesized; playback may still be draining
        this.ctx.add('user', userText);
        this.ctx.add('agent', full);
        this.handlers.onAssistantDone(full, false);
        if (!this.speaking) {
          // No audio was produced (e.g. empty reply) — return to listening.
          this.engine.setSpeaking(false);
          this.emitState();
        } else {
          // Audio queued. End Speaking when it actually drains. If the queue
          // already emptied DURING the reply (synthesis lagged playback and the
          // idle we got was ignored while replyActive), re-check now so we don't
          // hang in Speaking; otherwise the next playback-idle ends the turn.
          this.capture.requestIdleCheck();
        }
      } else if (spoken.trim()) {
        // Superseded/cut mid-reply: remember the user turn + the prefix actually
        // SPOKEN (what was heard) so the next turn's context is coherent — the
        // transcript reads as a reply that was cut off. (If nothing was spoken yet,
        // drop the turn — the superseding utterance is the real one, matching
        // Volley's Thinking-phase barge.) Do NOT touch FSM/replyActive: the new
        // turn owns them now.
        this.ctx.add('user', userText);
        this.ctx.add('agent', spoken.trim());
      }
    } catch (err) {
      // Surface + recover only if THIS turn is still live; a superseded turn's
      // error (e.g. aborted generate) must not reset the FSM out from under the barge.
      if (live()) {
        this.handlers.onError?.(err instanceof Error ? err.message : 'voice turn failed');
        this.engine.reset();
        this.emitState();
      }
    } finally {
      // Clear shared turn state only if THIS turn still owns it (not superseded by
      // a barge that already started a new turn) — otherwise we'd null the new
      // turn's genAbort or clear its replyActive and wedge Speaking.
      if (this.genAbort === abort) this.genAbort = null;
      if (this.turnEpoch === myEpoch) this.replyActive = false;
    }
  }

  private setSpeaking(on: boolean): void {
    this.speaking = on;
    this.engine.setSpeaking(on);
    this.emitState();
  }

  private abortGeneration(interrupted: boolean): void {
    const ab = this.genAbort;
    if (ab && !ab.signal.aborted) {
      ab.abort();
      this.handlers.onAssistantDone('', interrupted);
    }
  }

  /** Worklet's playback queue drained. End Speaking only if the reply is fully
   *  synthesized (replyActive=false) — a drain mid-reply is just synthesis lagging
   *  playback and must NOT end the turn (Volley holds Speaking the whole reply). */
  private onPlaybackIdle(): void {
    if (this.stopped) return;
    if (this.speaking && !this.replyActive) {
      this.setSpeaking(false); // FSM: Speaking → Listening
    }
  }

  /**
   * Switch to a FRESH conversation (the active PR changed, or the user hit "new
   * chat") WITHOUT tearing down the engines. The controller captures persona +
   * history at start and lives across PR navigation, so without this it keeps
   * grounding on — and summarizing — the OLD PR. This supersedes any in-flight
   * turn (so its trailing `ctx.add` is skipped), cuts playback, returns the FSM
   * to Listening, and replaces the persona + accumulated context.
   */
  resetConversation(persona: string, history: Turn[] = []): void {
    log.log(`reset conversation (history=${history.length})`);
    this.turnEpoch++; // supersede any in-flight turn → it bails without touching ctx
    this.replyActive = false;
    this.abortGeneration(true); // stop generation/tool; UI marks the reply ended
    this.genAbort = null;
    this.capture?.flushPlayback(); // cut any agent audio immediately
    // Drop a half-captured utterance and return the FSM to Listening.
    this.capturing = false;
    this.utt = [];
    this.preroll = [];
    this.speaking = false;
    this.engine?.reset();
    this.persona = persona;
    this.ctx = new ConversationContext(history);
    this.emitState();
  }

  /** Tear everything down and release the mic. */
  async stop(): Promise<void> {
    log.log('stop: tearing down');
    this.stopped = true;
    this.abortGeneration(true);
    try {
      await this.capture?.stop();
    } catch {
      /* best-effort */
    }
    this.engine?.free();
    // Free the lazily-loaded Kokoro worker — without this each enter→exit→enter
    // cycle leaked a worker (and re-loaded the model), making re-entry slower.
    void this.kokoroPromise?.then((k) => k.free()).catch(() => {});
    this.kokoroPromise = null;
    this.handlers.onState('idle');
  }
}
