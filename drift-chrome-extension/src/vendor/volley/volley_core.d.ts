/* tslint:disable */
/* eslint-disable */

/**
 * The control engine that lives in the audio worker.
 */
export class Engine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Samples per analysis frame (20 ms @ 24 kHz = 480).
     */
    frameSize(): number;
    /**
     * Frames accumulated toward a barge-in (0..barge_speech_frames) — barge "progress".
     */
    getBargeRun(): number;
    /**
     * The effective threshold/gate used on the most recent frame (includes the echo term while
     * Speaking and the adaptive noise floor when enabled).
     */
    getEffectiveGate(): number;
    /**
     * RMS energy of the most recent mic frame.
     */
    getLastEnergy(): number;
    /**
     * Why the last non-None action fired: 0=none 1=onset 2=end-silence 3=barge.
     */
    getLastReason(): number;
    /**
     * Current adaptive noise-floor estimate (0 unless floor_margin > 0).
     */
    getNoiseFloor(): number;
    /**
     * Construct with default DuplexCascade timing.
     */
    constructor();
    /**
     * Feed one mic frame; returns 0=none, 1=user-started, 2=commit, 3=barge-in.
     */
    pushMic(frame: Float32Array): number;
    reset(): void;
    /**
     * Audio bus sample rate (24 000).
     */
    sampleRate(): number;
    /**
     * Enable/disable barge-in DURING Thinking. Worker sets this `false` for slow remote brains
     * (e.g. the Claude CLI bridge) so a multi-second think-wait isn't aborted by ambient mic
     * energy; `true` (default) keeps full-duplex for near-instant local brains. Speaking-phase
     * barge-in is unaffected either way.
     */
    setBargeInThinking(on: boolean): void;
    /**
     * JS reports the RMS of the audio the agent is currently playing (for the
     * echo-aware barge-in gate). Set 0 when silent.
     */
    setOutputLevel(level: number): void;
    /**
     * JS reports the agent's TTS started / stopped playing.
     */
    setSpeaking(speaking: boolean): void;
    /**
     * JS reports the brain/TTS pipeline started after a commit.
     */
    setThinking(): void;
    /**
     * Current state: 0=listening, 1=thinking, 2=speaking.
     */
    stateCode(): number;
    /**
     * Construct with explicit timing (all counts in 20 ms frames).
     */
    static withConfig(vad_threshold: number, vad_hang: number, min_speech_frames: number, end_silence_frames: number, barge_speech_frames: number, echo_margin: number, floor_margin: number): Engine;
}

/**
 * Resample a PCM frame between rates (the worker uses 24 kHz → 16 kHz for Whisper).
 */
export function resample(frame: Float32Array, in_rate: number, out_rate: number): Float32Array;

/**
 * RMS energy helper (the JS worker uses it to report the agent's output level).
 */
export function rmsEnergy(frame: Float32Array): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_engine_free: (a: number, b: number) => void;
    readonly engine_frameSize: (a: number) => number;
    readonly engine_getBargeRun: (a: number) => number;
    readonly engine_getEffectiveGate: (a: number) => number;
    readonly engine_getLastEnergy: (a: number) => number;
    readonly engine_getLastReason: (a: number) => number;
    readonly engine_getNoiseFloor: (a: number) => number;
    readonly engine_new: () => number;
    readonly engine_pushMic: (a: number, b: number, c: number) => number;
    readonly engine_reset: (a: number) => void;
    readonly engine_sampleRate: (a: number) => number;
    readonly engine_setBargeInThinking: (a: number, b: number) => void;
    readonly engine_setOutputLevel: (a: number, b: number) => void;
    readonly engine_setSpeaking: (a: number, b: number) => void;
    readonly engine_setThinking: (a: number) => void;
    readonly engine_stateCode: (a: number) => number;
    readonly engine_withConfig: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly resample: (a: number, b: number, c: number, d: number) => [number, number];
    readonly rmsEnergy: (a: number, b: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
