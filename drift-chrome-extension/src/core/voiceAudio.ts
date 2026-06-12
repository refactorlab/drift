// Browser audio I/O for the LIVE voice agent, driven by the volley-core Rust FSM
// (vendored wasm-bindgen module, ~18 KB). The FSM owns ALL turn-taking — onset,
// end-pointing, and echo-aware barge-in — running deterministically at audio rate
// on the main thread; JS just reframes the mic and reacts to its action codes.
// This replaces the hand-rolled energy VAD (which kept missing turn 2 + self-barging).
//
//   mic ─(ScriptProcessor, 24 kHz)─► 480-sample frames ─► engine.pushMic ─► action
//     UserStarted → capture · Commit → resample 24→16k → WAV → cascade · BargeIn → abort + keep capturing
//
// Why ScriptProcessor (deprecated) over an AudioWorklet: it runs on the main thread
// with no separate module file, no SharedArrayBuffer, and no cross-origin isolation
// — the MV3 COOP/COEP that an AudioWorklet+SAB ring would need breaks the extension's
// other fetches. The FSM decision is 1–2 ms; that's irrelevant for turn-taking.
// Web Audio isn't available in jsdom, so this module is excluded from unit tests
// (the FSM itself is unit-tested in Rust; the WAV codec in wav.ts).

import init, { Engine, resample } from '../vendor/volley/volley_core.js';
import wasmUrl from '../vendor/volley/volley_core_bg.wasm?url';
import { encodeWavFromFloat32 } from './wav';

// The capture worklet ships as a static file in public/ (copied to the dist root) and is
// loaded by URL — NOT bundled/`?url`-imported, which CRXJS fails to emit as a standalone
// worklet asset. getURL gives a same-origin chrome-extension:// URL addModule can fetch.
const CAPTURE_WORKLET_URL = chrome.runtime.getURL('capture-worklet.js');

const SR = 24000; // capture rate — MUST match volley-core RENDER_FRAME (480 = 20 ms @ 24 kHz)
const ASR_SR = 16000; // Whisper's rate

// volley-core action codes (mirror crates/volley-core/src/wasm.rs).
const ACT = { NONE: 0, USER_STARTED: 1, COMMIT: 2, BARGE_IN: 3 } as const;

// DuplexCascade micro-turn tuning (counts are 20 ms frames). floorMargin > 0 turns
// ON the adaptive noise floor so onset rides ambient — this is what fixes turn-2
// detection after the browser ducks the mic following Andy's playback.
const TUNING = {
  vadThreshold: 0.02, // base mic-energy gate
  vadHang: 4, // 80 ms dip tolerance (barge hangover + blip discard)
  minSpeech: 5, // 100 ms min speech — rejects blips
  endSilence: 25, // 500 ms trailing silence ends a turn (snappy)
  bargeFrames: 5, // 100 ms sustained over-talk triggers barge-in (snappier interrupt)
  // Echo-aware barge gate strength: gate = vadThreshold + echoMargin * output_level, where
  // output_level is the CLEAN TTS playback RMS. The browser AEC (echoCancellation: true)
  // already strips most of Andy's voice from the mic, so the residual echo is FAR below the
  // playback level — keying the gate to the full level (old 0.8) floated it above the user's
  // own AEC-cleaned voice and made barge-in nearly impossible (you'd have to shout, and
  // un-barged speech-over-Andy is silently dropped — only a BargeIn captures it). Pulled back
  // so a normal speaking voice interrupts; the post-playback ECHO_GUARD + the noise-transcript
  // filter absorb any rare self-capture this lets through. Tune on-device: lower = easier to
  // interrupt but risk Andy self-barging on his own echo; higher = the reverse.
  echoMargin: 0.4,
  floorMargin: 4.0, // adaptive noise floor ON (survives AGC ducking)
};
// Fraction of the clean playback level we estimate actually survives the browser AEC into the
// mic. Feeding output_level * this (instead of the raw level) to the FSM models the real in-mic
// echo, so the echo gate reflects what the mic hears — not what the speaker emits.
const ECHO_COUPLING = 0.6;
const MAX_UTT_FRAMES = 1500; // 30 s cap on one utterance (memory bound)

// After the turn's LAST audio stops, the speaker's acoustic tail (room reverb +
// residual echo the browser AEC didn't kill) keeps ringing into the mic. If we drop
// straight to Listening it false-onsets and commits Andy's own echo as a "user" turn.
// So hold the FSM in Speaking — where the echo-aware gate applies — for this many
// 20 ms frames before re-arming. A genuinely loud barge-in still cuts through.
const ECHO_GUARD_FRAMES = 20; // ~400 ms — hold (with the gate PINNED HIGH, see onFrame) through the
// speaker tail's decay before re-arming to Listening, so Andy's echo can't false-commit as a phantom
// "user" turn. Short enough that your real reply (which lands after the tail) isn't blocked.
// Per-frame decay of the held echo level during inter-sentence gaps + the guard, so the
// Speaking gate stays elevated while the tail decays instead of collapsing to the bare
// threshold the instant a sentence's playback ends.
const ECHO_DECAY = 0.9;

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  wasmReady ??= (async () => {
    await init(wasmUrl);
  })();
  return wasmReady;
}

export interface VadHandlers {
  /** A completed user utterance, as a 16 kHz mono WAV. */
  onUtterance: (wav: Uint8Array) => void;
  /** Speech onset confirmed (UI affordance). */
  onSpeechStart?: () => void;
  /** User talked over Andy — abort the in-flight turn + stop playback. */
  onBargeIn?: () => void;
}

export class VoiceIO {
  private engine?: Engine;
  private handlers?: VadHandlers;

  // Capture (24 kHz) → VAD/FSM. The mic stream is kept alive across Start/End (so we don't
  // re-prompt); the context + worklet are rebuilt fresh each Start.
  private capCtx?: AudioContext;
  private mic?: MediaStream;
  private workletNode?: AudioWorkletNode;

  // Playback (default rate) → Andy's MP3 + level meter.
  private playCtx?: AudioContext;
  private aiAnalyser?: AnalyserNode;
  private aiSource?: AudioBufferSourceNode;

  // Utterance assembly (ported from volley web/src/worker.mjs onFrame).
  private capturing = false;
  private utt: Float32Array[] = [];
  private uttLen = 0;
  private preRoll: Float32Array[] = []; // un-clips a barge-in's leading speech
  private turnSpeaking = false; // set on the turn's first audio (one setSpeaking(true) per turn)
  private guardFrames = 0; // post-playback echo-guard countdown (keeps FSM in Speaking)
  private echoHold = 0; // decaying echo level fed to the gate across gaps + the guard
  private busy = false; // a turn (ASR→brain→TTS) is in flight — drives the Thinking self-heal

  /** Begin a hands-free conversation: load the FSM, acquire the mic, run the loop.
   *  Throws if mic permission is denied (caller falls back to the grant tab). */
  async startConversation(handlers: VadHandlers): Promise<void> {
    this.handlers = handlers;
    await ensureWasm();
    // Acquire the mic ONCE per panel session and keep it (stopConversation only MUTES it).
    // Re-calling getUserMedia on every Start is what re-triggered the permission prompt each
    // time; reusing the live stream means at most one prompt until you leave the Voice view.
    if (!this.mic || !this.mic.active) {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    }
    this.mic.getTracks().forEach((t) => (t.enabled = true)); // un-mute (a prior End muted it)

    // Fresh capture context + worklet each Start (robust); only the mic stream is reused.
    this.capCtx = new AudioContext({ sampleRate: SR }); // mic is resampled to 24 kHz for us
    await this.capCtx.resume();
    await this.capCtx.audioWorklet.addModule(CAPTURE_WORKLET_URL);
    this.playCtx ??= new AudioContext();
    await this.playCtx.resume();

    this.engine = Engine.withConfig(
      TUNING.vadThreshold,
      TUNING.vadHang,
      TUNING.minSpeech,
      TUNING.endSilence,
      TUNING.bargeFrames,
      TUNING.echoMargin,
      TUNING.floorMargin,
    );
    // Claude is a slow remote brain: never barge during Thinking (ambient noise would
    // abort the multi-second think-wait). Speaking-phase barge stays on.
    this.engine.setBargeInThinking(false);

    const src = this.capCtx.createMediaStreamSource(this.mic);
    const node = new AudioWorkletNode(this.capCtx, 'drift-capture');
    node.port.onmessage = (e) => this.onFrame(e.data as Float32Array); // 480-sample frames, audio thread
    const mute = this.capCtx.createGain();
    mute.gain.value = 0; // the node must reach a destination to be pulled; we don't want to hear it
    src.connect(node);
    node.connect(mute);
    mute.connect(this.capCtx.destination);
    this.workletNode = node;
    this.resetCapture();
  }

  /** Soft stop (End conversation): stop the FSM + playback but KEEP the mic, contexts, and
   *  capture graph alive so the next Start reuses them and does NOT re-prompt for the mic.
   *  The mic tracks are MUTED (not stopped) so capture pauses without losing the grant. */
  stopConversation(): void {
    this.stopPlayback();
    if (this.workletNode) {
      this.workletNode.port.onmessage = null; // stop frames BEFORE freeing the engine
      this.workletNode.disconnect();
      this.workletNode = undefined;
    }
    this.engine?.free();
    this.engine = undefined;
    void this.capCtx?.close(); // tear down the capture context + worklet (rebuilt fresh next Start)
    this.capCtx = undefined;
    this.mic?.getTracks().forEach((t) => (t.enabled = false)); // mute, but keep the grant + stream
    this.resetCapture();
  }

  private resetCapture(): void {
    this.capturing = false;
    this.utt = [];
    this.uttLen = 0;
    this.preRoll = [];
    this.turnSpeaking = false;
    this.guardFrames = 0;
    this.echoHold = 0;
    this.busy = false;
  }

  private onFrame(frame: Float32Array): void {
    const eng = this.engine;
    if (!eng) return;
    const f = Float32Array.from(frame); // detach from the reused accumulator

    // Rolling pre-roll (newest last), spanning the FSM's barge window incl. dip hangover,
    // so a barge-in's leading speech (heard during playback, otherwise unbuffered) isn't clipped.
    this.preRoll.push(f);
    while (this.preRoll.length > TUNING.bargeFrames + TUNING.vadHang + 2) this.preRoll.shift();

    // Self-heal: the FSM must NEVER linger in Thinking when no turn is running. A COMMIT whose
    // turn bailed early (the overlap/noise guard returns before beginThinking/endTurn) would
    // otherwise strand it in Thinking forever → permanently deaf ("it stops hearing me"). One
    // frame later we force it back to Listening so it always re-arms.
    if (!this.busy && eng.stateCode() === 1) eng.setSpeaking(false);

    // Post-playback echo guard: after the last audio of a turn we keep the FSM in Speaking
    // (set by endTurn) for ECHO_GUARD_FRAMES so the decaying speaker tail can't false-onset
    // the moment we re-arm. When it elapses, drop to Listening for real.
    if (this.guardFrames > 0 && eng.stateCode() === 2) {
      if (--this.guardFrames === 0) eng.setSpeaking(false);
    }

    // Barge gate while Speaking. Two sub-cases:
    //  • Andy is ACTUALLY playing (guard not active): feed the real in-mic echo level so a LOUD
    //    user can still barge through and interrupt mid-reply.
    //  • Post-playback GUARD (guardFrames > 0, nothing playing — just the acoustic tail decaying):
    //    PIN the gate HIGH. A "barge" here interrupts nothing; letting the decaying tail cross the
    //    gate is exactly what captured Andy's echo as a phantom "Transcribing…" turn that then got
    //    dropped as noise ("it transcribes but doesn't work"). The guard's frame countdown — not the
    //    echo — is what ends Speaking. After it, we drop to Listening and capture your real reply.
    if (eng.stateCode() === 2) {
      if (this.guardFrames > 0) {
        eng.setOutputLevel(1.0); // suppress echo-barge entirely during the guard
      } else {
        this.echoHold = Math.max(this.aiLevel(), this.echoHold * ECHO_DECAY);
        eng.setOutputLevel(this.echoHold * ECHO_COUPLING); // model in-mic echo, not speaker output
      }
    } else {
      this.echoHold = 0;
      eng.setOutputLevel(0);
    }

    switch (eng.pushMic(f)) {
      case ACT.USER_STARTED:
        this.capturing = true;
        this.utt = [f];
        this.uttLen = f.length;
        this.handlers?.onSpeechStart?.();
        break;
      case ACT.NONE:
        if (this.capturing) {
          this.utt.push(f);
          this.uttLen += f.length;
          if (this.utt.length > MAX_UTT_FRAMES) this.uttLen -= this.utt.shift()!.length; // slide the window
        }
        break;
      case ACT.COMMIT: {
        this.capturing = false;
        const utt = this.merge();
        this.utt = [];
        this.uttLen = 0;
        this.emit(utt);
        break;
      }
      case ACT.BARGE_IN:
        // The FSM is ALREADY back in Listening with speech_frames=1 (counting this frame as
        // the new utterance's start). Tell the orchestrator to abort the in-flight turn, then
        // KEEP capturing, seeding from the pre-roll. Do NOT touch engine state (setSpeaking(false)
        // would reset speech_frames and clobber this capture — the contract worker.mjs relies on).
        this.handlers?.onBargeIn?.();
        this.capturing = true;
        this.guardFrames = 0; // the user cut in — abandon any pending echo guard
        this.echoHold = 0;
        this.utt = this.preRoll.slice();
        this.uttLen = this.utt.reduce((n, c) => n + c.length, 0);
        break;
    }
  }

  private merge(): Float32Array {
    const out = new Float32Array(this.uttLen);
    let o = 0;
    for (const c of this.utt) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }

  private emit(utt: Float32Array): void {
    const at16 = resample(utt, SR, ASR_SR); // 24 kHz → 16 kHz, in Rust
    this.handlers?.onUtterance(encodeWavFromFloat32(at16, ASR_SR));
  }

  // ---- FSM phase hooks, driven by the orchestrator (Voice.tsx) ----

  /** A turn started (ASR/brain running). The FSM is already in Thinking from the COMMIT
   *  frame; this is hygiene + resets the per-turn speaking latch. */
  beginThinking(): void {
    this.busy = true; // a turn is now running → the Thinking self-heal stands down
    this.turnSpeaking = false;
    this.guardFrames = 0; // a fresh turn supersedes any pending echo guard
    this.echoHold = 0;
    this.engine?.setThinking();
  }

  /** Return the FSM to Listening after a turn — UNLESS a barge-in already moved it there
   *  (it's mid-capturing the next utterance; stomping it would clip the user's interruption).
   *  When the turn ended in Speaking, don't re-arm immediately: arm an echo guard so the
   *  decaying speaker tail can't false-commit as a phantom user turn (onFrame drops to
   *  Listening when the guard elapses). Thinking→Listening is immediate (nothing played). */
  endTurn(): void {
    const eng = this.engine;
    if (!eng) return;
    this.busy = false; // the turn is over → the self-heal may re-arm a stranded Thinking state
    this.turnSpeaking = false;
    const st = eng.stateCode();
    if (st === 0) return; // barge-in already in Listening — don't stomp the new capture
    if (st === 2) {
      this.guardFrames = ECHO_GUARD_FRAMES; // hold through the echo tail
      return;
    }
    eng.setSpeaking(false); // Thinking → Listening (no audio played; no tail to guard)
  }

  /** Play Andy's MP3 reply; resolves when finished or aborted. Sets the FSM to Speaking
   *  on the turn's first audio so it can detect (echo-aware) barge-in. */
  async play(mp3: Uint8Array, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;
    this.playCtx ??= new AudioContext();
    await this.playCtx.resume();
    const copy = mp3.slice().buffer; // decodeAudioData detaches its input
    const audioBuf = await this.playCtx.decodeAudioData(copy);
    if (signal?.aborted) return;
    if (!this.turnSpeaking) {
      this.turnSpeaking = true;
      this.engine?.setSpeaking(true); // ONCE per turn — re-calling would clear the barge run
    }
    const src = this.playCtx.createBufferSource();
    src.buffer = audioBuf;
    const analyser = this.playCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    analyser.connect(this.playCtx.destination);
    this.aiAnalyser = analyser;
    this.aiSource = src;
    await new Promise<void>((resolve) => {
      const onAbort = () => {
        try { src.stop(); } catch { /* already stopped */ }
        finish();
      };
      const finish = () => {
        signal?.removeEventListener('abort', onAbort);
        // Disconnect this turn's nodes so AnalyserNodes don't accumulate on playCtx
        // across a long conversation (a slow leak / degradation source).
        try { src.disconnect(); analyser.disconnect(); } catch { /* already gone */ }
        if (this.aiSource === src) this.aiSource = undefined;
        if (this.aiAnalyser === analyser) this.aiAnalyser = undefined;
        resolve();
      };
      src.onended = finish;
      signal?.addEventListener('abort', onAbort, { once: true });
      src.start();
    });
  }

  stopPlayback(): void {
    try { this.aiSource?.stop(); } catch { /* already stopped */ }
    this.aiSource = undefined;
  }

  /** Live mic loudness 0..1 (the FSM's last-frame energy) — drives the "you" orb. */
  micLevel(): number {
    return this.engine?.getLastEnergy() ?? 0;
  }

  /** Live assistant loudness 0..1 while speaking, else 0 — drives the "Andy" orb + echo gate. */
  aiLevel(): number {
    if (!this.aiSource || !this.aiAnalyser) return 0;
    const buf = new Uint8Array(this.aiAnalyser.fftSize);
    this.aiAnalyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const x = (buf[i] - 128) / 128;
      sum += x * x;
    }
    return Math.sqrt(sum / buf.length);
  }

  /** Full teardown (leaving the Voice view): release the mic + both audio contexts. */
  close(): void {
    this.stopConversation(); // closes capCtx + worklet, mutes mic
    this.mic?.getTracks().forEach((t) => t.stop()); // release the mic for real
    this.mic = undefined;
    void this.playCtx?.close();
    this.playCtx = undefined;
  }
}
