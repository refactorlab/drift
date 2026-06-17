// The voice control plane's JS wrapper around the drift-static-profiler wasm.
//
// THIS IS THE SINGLE-WASM PAYOFF: the VAD + DuplexCascade FSM ships INSIDE the
// same `drift-static-profiler.wasm` the scanner uses (see the crate's
// src/voice/ + src/voice_wasm.rs). We reuse the already-compiled module from
// scannerStore.loadScannerModule(), instantiate a SECOND, long-lived instance,
// and — crucially — NEVER call `_start` (that's the scanner's CLI entry, which
// runs once and exits). Instead we call `__wasm_call_ctors` once to initialize
// the heap, then drive the FSM through the raw C-ABI exports (vad_*, vp_*) via
// manual linear-memory marshaling (the WASI binary has no wasm-bindgen glue).
//
// Audio frames cross as f32 in linear memory: vp_alloc_f32 → write a Float32Array
// view → call → (read) → vp_free_f32. We re-create the memory view on each use
// because any wasm allocation can grow (and thus detach) the ArrayBuffer.

import { WASI } from '@bjorn3/browser_wasi_shim';
import { loadScannerModule } from './scannerStore';

/** The C-ABI surface exported by the wasm (see src/voice_wasm.rs). */
interface VoiceExports {
  memory: WebAssembly.Memory;
  __wasm_call_ctors: () => void;
  vp_alloc_f32: (n: number) => number;
  vp_free_f32: (ptr: number, n: number) => void;
  vad_new: (
    vadThreshold: number,
    vadHang: number,
    minSpeech: number,
    endSilence: number,
    bargeFrames: number,
    echoMargin: number,
    floorMargin: number,
  ) => number;
  vad_free: (h: number) => void;
  vad_push_mic: (h: number, ptr: number, len: number) => number;
  vad_set_speaking: (h: number, speaking: number) => void;
  vad_set_thinking: (h: number) => void;
  vad_set_barge_in_thinking: (h: number, on: number) => void;
  vad_set_output_level: (h: number, level: number) => void;
  vad_state_code: (h: number) => number;
  vad_reset: (h: number) => void;
  vad_get_last_energy: (h: number) => number;
  vad_get_effective_gate: (h: number) => number;
  vad_get_noise_floor: (h: number) => number;
  vad_get_barge_run: (h: number) => number;
  vad_get_last_reason: (h: number) => number;
  vad_rms: (ptr: number, len: number) => number;
  vad_resample: (inPtr: number, len: number, inRate: number, outRate: number, outLenPtr: number) => number;
}

/** Action codes from vad_push_mic (mirrors voice_wasm.rs / Volley protocol). */
export const ACT_NONE = 0;
export const ACT_USER_STARTED = 1;
export const ACT_COMMIT = 2;
export const ACT_BARGE_IN = 3;

/** FSM state codes from vad_state_code. */
export const STATE_LISTENING = 0;
export const STATE_THINKING = 1;
export const STATE_SPEAKING = 2;

/** DuplexCascade timing. Mirrors `Config::default()` / Volley's DEFAULT_TUNING.
 *  Counts are 20 ms frames (the controller feeds 24 kHz / 480-sample frames). */
export interface VadConfig {
  vadThreshold: number;
  vadHang: number;
  minSpeechFrames: number;
  endSilenceFrames: number;
  bargeSpeechFrames: number;
  echoMargin: number;
  floorMargin: number;
}

export const DEFAULT_VAD_CONFIG: VadConfig = {
  vadThreshold: 0.025,
  vadHang: 4,
  minSpeechFrames: 5,
  // Trailing silence that ends a turn. Volley uses 30 (600 ms), but that commits
  // on a normal mid-sentence pause → "it thinks I'm finished and cuts me off".
  // 45 (900 ms) lets you breathe mid-thought without ending the turn early. Tune
  // here: lower = snappier but cuts you off sooner; higher = more patient.
  endSilenceFrames: 45,
  bargeSpeechFrames: 5,
  // Speaking-phase barge gate = vadThreshold + echoMargin * playbackLevel. Volley
  // uses 0.6, but drift's browser AEC already strips most of the agent's voice
  // from the mic, so 0.6 set the gate so high you had to shout to interrupt. 0.35
  // makes a normal-volume interruption trigger a barge while staying above the
  // residual echo (so the agent doesn't self-interrupt). Tune here if needed.
  echoMargin: 0.35,
  floorMargin: 0.0,
};

/**
 * A live DuplexCascade FSM running inside the drift wasm. One per voice session;
 * call `free()` when done. All audio in/out is f32 PCM at 24 kHz (the FSM's bus
 * rate); the controller resamples mic input up and Whisper input down.
 */
export class VadEngine {
  private constructor(
    private readonly ex: VoiceExports,
    private handle: number,
  ) {}

  /** Instantiate the voice FSM from the shared scanner module. */
  static async create(cfg: VadConfig = DEFAULT_VAD_CONFIG): Promise<VadEngine> {
    const mod = await loadScannerModule();
    // Satisfy the WASI imports the binary declares (the FSM path makes no syscalls,
    // but the module still imports them). We never call wasi.start, so nothing
    // here actually runs the CLI — the imports just need to resolve.
    const wasi = new WASI([], [], []);
    const instance = await WebAssembly.instantiate(mod, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    const ex = instance.exports as unknown as VoiceExports;
    // The voice FSM exports only exist in a wasm built from a profiler that
    // includes src/voice_wasm.rs. A bundled OFFICIAL release wasm predating that
    // change won't have them — fail soft with a clear message (the caller shows
    // it and stays in text mode) instead of crashing on an undefined export.
    if (typeof ex.vad_new !== 'function' || typeof ex.__wasm_call_ctors !== 'function') {
      throw new Error('This scanner build has no voice engine. Rebuild locally (make wasm) or update to a profiler release that includes it.');
    }
    ex.__wasm_call_ctors(); // heap init without running _start
    const handle = ex.vad_new(
      cfg.vadThreshold,
      cfg.vadHang,
      cfg.minSpeechFrames,
      cfg.endSilenceFrames,
      cfg.bargeSpeechFrames,
      cfg.echoMargin,
      cfg.floorMargin,
    );
    return new VadEngine(ex, handle);
  }

  /** Feed one 24 kHz frame (~480 samples); returns an ACT_* code. */
  pushMic(frame: Float32Array): number {
    const ptr = this.ex.vp_alloc_f32(frame.length);
    // Re-view AFTER alloc (it may have grown/detached the buffer).
    new Float32Array(this.ex.memory.buffer, ptr, frame.length).set(frame);
    const act = this.ex.vad_push_mic(this.handle, ptr, frame.length);
    this.ex.vp_free_f32(ptr, frame.length);
    return act;
  }

  setSpeaking(on: boolean): void {
    this.ex.vad_set_speaking(this.handle, on ? 1 : 0);
  }
  setThinking(): void {
    this.ex.vad_set_thinking(this.handle);
  }
  setBargeInThinking(on: boolean): void {
    this.ex.vad_set_barge_in_thinking(this.handle, on ? 1 : 0);
  }
  setOutputLevel(level: number): void {
    this.ex.vad_set_output_level(this.handle, level);
  }
  stateCode(): number {
    return this.ex.vad_state_code(this.handle);
  }
  reset(): void {
    this.ex.vad_reset(this.handle);
  }

  // Telemetry (UI meters / tuning).
  lastEnergy(): number {
    return this.ex.vad_get_last_energy(this.handle);
  }
  effectiveGate(): number {
    return this.ex.vad_get_effective_gate(this.handle);
  }
  bargeRun(): number {
    return this.ex.vad_get_barge_run(this.handle);
  }

  /** RMS of an f32 buffer (used to report agent output level for the echo gate). */
  rms(buf: Float32Array): number {
    const ptr = this.ex.vp_alloc_f32(buf.length);
    new Float32Array(this.ex.memory.buffer, ptr, buf.length).set(buf);
    const r = this.ex.vad_rms(ptr, buf.length);
    this.ex.vp_free_f32(ptr, buf.length);
    return r;
  }

  /** Resample an f32 buffer between rates (e.g. 24 kHz utterance → 16 kHz for Whisper). */
  resample(buf: Float32Array, inRate: number, outRate: number): Float32Array {
    const inPtr = this.ex.vp_alloc_f32(buf.length);
    new Float32Array(this.ex.memory.buffer, inPtr, buf.length).set(buf);
    const outLenPtr = this.ex.vp_alloc_f32(1); // scratch for the usize out-param (4 bytes)
    const outPtr = this.ex.vad_resample(inPtr, buf.length, inRate, outRate, outLenPtr);
    const outLen = new Uint32Array(this.ex.memory.buffer, outLenPtr, 1)[0];
    // Copy out BEFORE freeing (and re-view, since vad_resample allocated).
    const out = new Float32Array(this.ex.memory.buffer, outPtr, outLen).slice();
    this.ex.vp_free_f32(outPtr, outLen);
    this.ex.vp_free_f32(outLenPtr, 1);
    this.ex.vp_free_f32(inPtr, buf.length);
    return out;
  }

  free(): void {
    if (this.handle) {
      this.ex.vad_free(this.handle);
      this.handle = 0;
    }
  }
}
