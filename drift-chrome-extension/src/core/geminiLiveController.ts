// Gemini Live voice mode — drift's BYO-key path to Google's bidirectional audio
// API (ai.live.connect). ONE WebSocket does STT + LLM + TTS with SERVER-SIDE
// turn-taking, so this controller has NO local VAD / duplex / cascade and never
// touches Whisper or Kokoro — it REPLACES them when brainMode === 'gemini-live'.
//
// Shape mirrors geminiBrain.ts: @google/genai is dynamic-imported INSIDE start()
// (so the side-panel bundle pulls it only when this mode actually runs), and the
// `connect` seam is injectable for tests. The protocol logic — buildLiveConfig +
// interpretLiveMessage — is a PURE functional core (no Web Audio, no handlers),
// unit-tested directly; the imperative shell below just wires the microphone and
// playback to it. It satisfies the SAME VoiceHandlers contract as VoiceController,
// so Chat.tsx reuses its handlers object unchanged.

import type { FunctionCall, FunctionDeclaration, LiveConnectConfig, LiveConnectParameters, LiveServerMessage, Modality, Session } from '@google/genai';
import type { Turn } from './chatContext';
import type { VoiceHandlers, VoiceState } from './voiceController';
import type { PrToolState } from './chatTools';
import type { LiveToolOutcome } from './geminiLiveTools';
import { decodePcmChunk, encodeMicChunk } from './geminiLiveAudio';
import { ensureMicPermission } from './micPermission';

/** Default Live model (BYO key). Overridable in Settings (`geminiLiveModel`). */
export const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

const INPUT_RATE = 16_000; // Gemini Live PCM input  (mic → server)
const OUTPUT_RATE = 24_000; // Gemini Live PCM output (server → speakers)

/** The narrow surface Chat.tsx depends on (Dependency-Inversion seam). Both
 *  VoiceController and GeminiLiveController satisfy it structurally, so the chat
 *  UI can hold either behind one ref without knowing which voice engine is live. */
export interface VoiceSession {
  stop(): void | Promise<void>;
  resetConversation(persona: string, history?: Turn[]): void;
}

// ── functional core: pure protocol logic (no Web Audio, no handlers) ──────────

/** What the controller should DO in response to a server message. The reducer
 *  only DESCRIBES effects; the imperative shell performs them. */
export type LiveEffect =
  | { kind: 'userText'; text: string }
  | { kind: 'assistantToken'; text: string }
  | { kind: 'assistantDone'; full: string; interrupted: boolean }
  | { kind: 'playAudio'; pcm: Float32Array }
  | { kind: 'flushAudio' }
  | { kind: 'state'; state: VoiceState };

/** One LiveState lives across a whole session; per-turn fields reset on
 *  turnComplete / interrupt. */
export interface LiveState {
  userText: string; // accumulated input transcription for the current turn
  assistantText: string; // accumulated output transcription for the current turn
  userFlushed: boolean; // the single user bubble has been emitted this turn
  assistantOpen: boolean; // ≥1 assistant token emitted (a bubble is open)
  speaking: boolean; // model audio is in flight this turn
  closed: boolean; // turn finalized by an interrupt (guards the trailing turnComplete)
}

export function initLiveState(): LiveState {
  return { userText: '', assistantText: '', userFlushed: false, assistantOpen: false, speaking: false, closed: false };
}

/** A short nudge so Gemini reliably USES the declared drift tools (rather than
 *  free-associating) and narrates their results — appended to the persona only
 *  when tools are wired. */
const TOOL_NUDGE =
  "You can operate Drift's PR tools directly — call them when the reviewer asks to scan/analyze the PR, wants a guided walkthrough/handover, or (during one) says next / proceed / go to a file / stop. After a tool runs, narrate its result conversationally; never tell the user to run it themselves.";

/** Audio modality + persona + transcription + (optional) function-calling tools.
 *  `responseModalities` is hard-coded to the string value of Modality.AUDIO (a
 *  string enum) so this pure module never imports the SDK runtime — Settings.tsx
 *  imports DEFAULT_GEMINI_LIVE_MODEL from this file, and a value import would pull
 *  @google/genai into that bundle. */
export function buildLiveConfig(opts: { persona?: string; tools?: FunctionDeclaration[] }): LiveConnectConfig {
  const hasTools = !!opts.tools?.length;
  const systemInstruction = hasTools ? `${opts.persona ?? ''}\n\n${TOOL_NUDGE}`.trim() : opts.persona;
  return {
    responseModalities: ['AUDIO'] as Modality[],
    systemInstruction,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    ...(hasTools ? { tools: [{ functionDeclarations: opts.tools }] } : {}),
  };
}

/** Reduce one server message into the next state + a list of effects. Pure. */
export function interpretLiveMessage(state: LiveState, msg: LiveServerMessage): { state: LiveState; effects: LiveEffect[] } {
  const sc = msg.serverContent;
  // A toolCall has no serverContent but still ends the user's turn (the model chose
  // to ACT) — so flush the user bubble. The call itself is executed by the shell.
  const hasToolCall = !!msg.toolCall?.functionCalls?.length;
  if (!sc && !hasToolCall) return { state, effects: [] };

  const effects: LiveEffect[] = [];
  let s = state;

  // A finalized turn is reopened by the NEXT turn's content (covers an interrupt
  // that never gets its trailing turnComplete).
  const hasContent = !!(sc?.inputTranscription?.text || sc?.outputTranscription?.text || sc?.modelTurn);
  if (s.closed && hasContent) s = initLiveState();

  // 1 — INPUT transcription: accumulate the user's words for this turn.
  if (sc?.inputTranscription?.text) s = { ...s, userText: s.userText + sc.inputTranscription.text };

  // Emit the ONE user bubble at the turn boundary, BEFORE any assistant output.
  const flushUser = (): void => {
    if (!s.userFlushed && s.userText.trim()) {
      effects.push({ kind: 'userText', text: s.userText.trim() });
      s = { ...s, userFlushed: true };
    }
  };
  const modelStarting = !!(sc?.outputTranscription?.text || sc?.modelTurn || hasToolCall);
  if (sc?.inputTranscription?.finished || modelStarting) flushUser();

  // 2 — OUTPUT transcription: stream assistant tokens (deltas); open bubble once.
  if (sc?.outputTranscription?.text) {
    const delta = sc.outputTranscription.text;
    s = { ...s, assistantText: s.assistantText + delta, assistantOpen: true };
    effects.push({ kind: 'assistantToken', text: delta });
  }

  // 3 — MODEL AUDIO: decode + schedule; flip to Speaking on the first chunk.
  for (const part of sc?.modelTurn?.parts ?? []) {
    const data = part.inlineData?.data;
    if (!data) continue;
    if (!s.speaking) {
      s = { ...s, speaking: true };
      effects.push({ kind: 'state', state: 'speaking' });
    }
    effects.push({ kind: 'playAudio', pcm: decodePcmChunk(data) });
  }

  // 4 — INTERRUPTED (server-side barge): stop playback, close the partial turn.
  if (sc?.interrupted && !s.closed) {
    effects.push({ kind: 'flushAudio' });
    flushUser();
    effects.push({ kind: 'assistantDone', full: s.assistantText, interrupted: true });
    effects.push({ kind: 'state', state: 'listening' });
    return { state: { ...initLiveState(), closed: true }, effects };
  }

  // 5 — TURN COMPLETE: finalize. After an interrupt this turn is already closed,
  // so the trailing turnComplete just clears the latch (no double assistantDone).
  if (sc?.turnComplete) {
    if (s.closed) return { state: initLiveState(), effects };
    flushUser();
    if (s.assistantOpen || s.speaking) effects.push({ kind: 'assistantDone', full: s.assistantText, interrupted: false });
    effects.push({ kind: 'state', state: 'listening' });
    return { state: initLiveState(), effects };
  }

  return { state: s, effects };
}

// ── imperative shell: Web Audio + the live WebSocket session ──────────────────

/** The injectable connect seam (production = a bound ai.live.connect). */
export type LiveConnect = (params: LiveConnectParameters) => Promise<Session>;

/** Bridges Gemini function-calling to drift's tools: the function declarations to
 *  advertise, and an executor that runs a chosen tool (driving the UI handlers) and
 *  returns the narratable outcome. Production builds one lazily (geminiLiveTools +
 *  getSharedBrain); tests inject a fake. */
export interface LiveToolBridge {
  declarations: FunctionDeclaration[];
  execute(name: string, args: Record<string, unknown>, handlers: VoiceHandlers): Promise<LiveToolOutcome>;
}

export interface GeminiLiveOptions {
  apiKey: string;
  /** Live model id; defaults to {@link DEFAULT_GEMINI_LIVE_MODEL}. */
  model?: string;
  /** System instruction / persona (same string passed to VoiceController). */
  persona: string;
  /** Reads the live PR/scan state for tool execution. When omitted, no tools are
   *  advertised (free-form voice only). */
  getToolState?: () => PrToolState | null;
  /** Injected for tests; production builds one from a dynamic-imported SDK. */
  connect?: LiveConnect;
  /** Injected for tests; production builds the bridge lazily in boot(). */
  toolBridge?: LiveToolBridge;
}

/** Root-mean-square of a frame, for the orb energy meter. */
function rms(buf: Float32Array): number {
  if (!buf.length) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Build the production connect seam — dynamic-import the SDK so the bundle only
 *  pulls @google/genai when gemini-live is actually selected (cf. geminiBrain.ts). */
async function defaultConnect(apiKey: string): Promise<LiveConnect> {
  if (!apiKey) throw new Error('Gemini API key not set');
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  return (params) => ai.live.connect(params);
}

export class GeminiLiveController implements VoiceSession {
  private stopped = false;
  private session: Session | null = null;
  private liveState: LiveState = initLiveState();
  private uiState: VoiceState = 'idle';

  // Audio plumbing (created in start, torn down in stop).
  private stream: MediaStream | null = null;
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private playhead = 0; // next playback start time on the output context's clock
  // The latest recognised user utterance — handed to a tool as its `userText` (e.g.
  // the handover parses "next" / "go to <file>" / "stop" from it).
  private lastUserText = '';
  // Aborts an in-flight tool run (handover/scan) on teardown.
  private toolAbort = new AbortController();

  private constructor(
    private readonly handlers: VoiceHandlers,
    private readonly connect: LiveConnect,
    private readonly model: string,
    private readonly getToolState: (() => PrToolState | null) | null,
    private bridge: LiveToolBridge | null,
  ) {}

  /** Open the mic + the live session and start streaming. Rejects (so the caller
   *  can fall back to text mode) if mic/audio/connect setup fails. */
  static async start(handlers: VoiceHandlers, opts: GeminiLiveOptions): Promise<GeminiLiveController> {
    const connect = opts.connect ?? (await defaultConnect(opts.apiKey));
    const vc = new GeminiLiveController(handlers, connect, opts.model || DEFAULT_GEMINI_LIVE_MODEL, opts.getToolState ?? null, opts.toolBridge ?? null);
    try {
      await vc.boot(opts.persona);
    } catch (e) {
      await vc.stop(); // release any mic/context opened before the failure
      throw e;
    }
    return vc;
  }

  private async boot(persona: string): Promise<void> {
    // 1 — secure the mic (the side panel can't host the prompt itself) + open it.
    await ensureMicPermission();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });

    // 2 — input @16 kHz (mic), output @24 kHz (model). A fresh AudioContext starts
    // SUSPENDED after the async work above (the entering click's activation has
    // expired); without resume() the mic never pumps and audio never plays — the
    // same "connects but silent" fix as audioCapture.ts.
    this.inputCtx = new AudioContext({ sampleRate: INPUT_RATE });
    await this.inputCtx.resume();
    this.outputCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
    await this.outputCtx.resume();
    this.outputNode = this.outputCtx.createGain();
    this.outputNode.connect(this.outputCtx.destination);

    // 2b — wire drift's tools to Gemini function-calling (handover / scan over voice).
    // Built LAZILY here (pulls chatTools + the agents) so the Settings/side-panel
    // bundles stay lean until a Live session actually starts. Skipped when no PR
    // state is available (free-form voice only) or when a bridge was injected.
    if (!this.bridge && this.getToolState) this.bridge = await this.makeDefaultBridge();

    // 3 — open the live session. Connecting resolves once the socket is ready, so
    // we wire the mic AFTER (no race on `this.session`).
    this.session = await this.connect({ model: this.model, callbacks: this.liveCallbacks(), config: this.liveConfig(persona) });

    if (this.stopped) {
      // Torn down mid-connect — close the freshly-opened session and bail.
      try { this.session.close(); } catch { /* already closing */ }
      this.session = null;
      return;
    }

    this.startMicPump();
    this.setState('listening');
  }

  /** Mic → PCM16 base64 → sendRealtimeInput. Runs continuously (even during
   *  playback) so the server can hear a barge; echo cancellation keeps the
   *  model's own output from re-triggering it. */
  private startMicPump(): void {
    const ctx = this.inputCtx!;
    this.micSource = ctx.createMediaStreamSource(this.stream!);
    this.scriptNode = ctx.createScriptProcessor(4096, 1, 1);
    this.scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
      if (this.stopped || !this.session) return;
      const frame = e.inputBuffer.getChannelData(0);
      this.session.sendRealtimeInput({ audio: { data: encodeMicChunk(frame), mimeType: `audio/pcm;rate=${INPUT_RATE}` } });
      if (this.uiState !== 'speaking') this.handlers.onLevel?.(Math.min(1, rms(frame) * 2.2));
    };
    this.micSource.connect(this.scriptNode);
    // A ScriptProcessor only fires once it reaches a destination; route it through
    // a SILENT gain so the raw mic isn't echoed to the speakers.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    this.scriptNode.connect(sink);
    sink.connect(ctx.destination);
  }

  private onMessage(msg: LiveServerMessage): void {
    if (this.stopped) return;
    const { state, effects } = interpretLiveMessage(this.liveState, msg);
    this.liveState = state;
    for (const fx of effects) this.applyEffect(fx);
    // Tool calls are impure (async tool run + sendToolResponse) → handled in the shell.
    const calls = msg.toolCall?.functionCalls;
    if (calls && calls.length) void this.handleToolCalls(calls);
  }

  private applyEffect(fx: LiveEffect): void {
    switch (fx.kind) {
      case 'userText':
        this.lastUserText = fx.text; // hand this to a tool as its userText (handover intent)
        this.handlers.onUserText(fx.text);
        break;
      case 'assistantToken':
        this.handlers.onAssistantToken(fx.text);
        break;
      case 'assistantDone':
        this.handlers.onAssistantDone(fx.full, fx.interrupted);
        break;
      case 'playAudio':
        this.playPcm(fx.pcm);
        break;
      case 'flushAudio':
        this.flushAudio();
        break;
      case 'state':
        this.setState(fx.state);
        break;
    }
  }

  private setState(state: VoiceState): void {
    this.uiState = state;
    this.handlers.onState(state);
  }

  /** Schedule a decoded chunk back-to-back on the output clock + report energy. */
  private playPcm(pcm: Float32Array): void {
    const ctx = this.outputCtx;
    if (!ctx || !this.outputNode || pcm.length === 0) return;
    const buffer = ctx.createBuffer(1, pcm.length, OUTPUT_RATE);
    buffer.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.outputNode);
    src.addEventListener('ended', () => this.sources.delete(src));
    this.playhead = Math.max(this.playhead, ctx.currentTime);
    src.start(this.playhead);
    this.playhead += buffer.duration;
    this.sources.add(src);
    this.handlers.onLevel?.(Math.min(1, rms(pcm) * 2.2));
  }

  /** Stop + drop every scheduled source (barge / teardown). Keeps the session. */
  private flushAudio(): void {
    for (const src of this.sources) {
      try {
        src.stop();
        src.disconnect();
      } catch { /* already ended */ }
    }
    this.sources.clear();
    this.playhead = 0;
  }

  private onSocketError(e: ErrorEvent): void {
    if (this.stopped) return;
    this.handlers.onError?.(`Gemini Live error: ${e.message || 'connection error'}`);
    void this.stop();
  }

  /** Live-session callbacks — shared by the initial connect and reconnect. */
  private liveCallbacks() {
    return {
      onmessage: (m: LiveServerMessage) => this.onMessage(m),
      onerror: (e: ErrorEvent) => this.onSocketError(e),
      onclose: () => {},
    };
  }

  /** The connect config, with the tool declarations from the bridge (if any). */
  private liveConfig(persona: string): LiveConnectConfig {
    return buildLiveConfig({ persona, tools: this.bridge?.declarations });
  }

  /** Production tool bridge: declarations from drift's tools + an executor that runs
   *  the chosen tool against the shared (Gemini text) brain, driving the UI handlers.
   *  Dynamic imports keep chatTools + the agents out of the eager bundle. */
  private async makeDefaultBridge(): Promise<LiveToolBridge | null> {
    const getState = this.getToolState;
    if (!getState) return null;
    try {
      const [{ buildLiveToolDeclarations, executeLiveTool }, { getSharedBrain }] = await Promise.all([
        import('./geminiLiveTools'),
        import('./brainEngine'),
      ]);
      return {
        declarations: buildLiveToolDeclarations(),
        execute: async (name, args, handlers) => {
          const state = getState();
          if (!state) return { ok: false, content: 'No pull request is open in the current tab.' };
          const brain = await getSharedBrain();
          return executeLiveTool(name, args, { state, brain, userText: this.lastUserText, signal: this.toolAbort.signal }, handlers);
        },
      };
    } catch (e) {
      // Tools are a best-effort enhancement — a load failure must not block voice.
      this.handlers.onError?.(`Voice tools unavailable: ${errMessage(e)}`);
      return null;
    }
  }

  /** Run each Gemini-requested tool locally, then hand the result back so the model
   *  narrates it. The reducer has already flushed the user bubble for this turn. */
  private async handleToolCalls(calls: FunctionCall[]): Promise<void> {
    for (const call of calls) {
      if (this.stopped || !this.session) return;
      const name = call.name ?? '';
      const outcome: LiveToolOutcome = this.bridge
        ? await this.bridge.execute(name, (call.args ?? {}) as Record<string, unknown>, this.handlers)
        : { ok: false, content: `Tool ${name} is unavailable.` };
      if (this.stopped || !this.session) return;
      const response = outcome.ok ? { output: outcome.spoken || outcome.content } : { error: outcome.content };
      this.session.sendToolResponse({ functionResponses: [{ id: call.id, name, response }] });
    }
  }

  /** Re-ground a live session on a new conversation (PR switch / new chat). Gemini
   *  holds turn state server-side, so the honest reset is a reconnect with the new
   *  system instruction; the mic + contexts stay up. Fire-and-forget to match
   *  VoiceController.resetConversation's synchronous signature. */
  resetConversation(persona: string, _history: Turn[] = []): void {
    if (this.stopped) return;
    void (async () => {
      try {
        this.session?.close();
      } catch { /* already closing */ }
      this.flushAudio();
      this.liveState = initLiveState();
      try {
        this.session = await this.connect({ model: this.model, callbacks: this.liveCallbacks(), config: this.liveConfig(persona) });
      } catch (e) {
        if (!this.stopped) this.handlers.onError?.(`Voice reconnect failed: ${errMessage(e)}`);
      }
    })();
  }

  /** Tear everything down. Idempotent. Closes the socket FIRST (stops the message
   *  source) before disposing audio, so a late message can't touch a dead context. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.toolAbort.abort(); // cancel any in-flight handover/scan

    try {
      this.session?.close();
    } catch { /* already closing */ }
    this.session = null;

    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null;
      try { this.scriptNode.disconnect(); } catch { /* not connected */ }
      this.scriptNode = null;
    }
    try { this.micSource?.disconnect(); } catch { /* not connected */ }
    this.micSource = null;

    this.flushAudio();
    try { this.outputNode?.disconnect(); } catch { /* not connected */ }
    this.outputNode = null;

    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;

    await this.inputCtx?.close().catch(() => {});
    await this.outputCtx?.close().catch(() => {});
    this.inputCtx = null;
    this.outputCtx = null;

    this.handlers.onState('idle');
  }
}

/** Open a Gemini Live voice session. Thin wrapper over GeminiLiveController.start
 *  mirroring VoiceController.start's call shape. */
export function startGeminiLive(handlers: VoiceHandlers, opts: GeminiLiveOptions): Promise<GeminiLiveController> {
  return GeminiLiveController.start(handlers, opts);
}
