// The seam between the live-scan page and "the thing that actually synthesises
// the spoken summary". The ONLY engine is the WASM build of sherpa-onnx running
// the Kokoro model in-tab (KokoroWasmTtsProvider) — the browser equivalent of
// the action's server-side `sherpa-onnx-offline-tts`. Mirrors scanProvider.ts:
// a small interface, a real provider with an injected loader (so the browser
// instantiates the bundled engine while tests inject a fake), a factory.
//
// Text → audio path: caller passes the deterministic briefing (ttsBriefing) →
// we sanitise + sentence-cap it (ttsSanitize, SSOT parity with action.yml) →
// the runtime synthesises float32 PCM → we encode a 24 kHz mono WAV (wav.ts).

import type { KokoroRuntime } from './kokoroRuntime';
import { prepareForTts } from './ttsSanitize';
import { encodeWavFromFloat32, pcmDurationSeconds, KOKORO_SAMPLE_RATE } from './wav';

// Kokoro multi-lang v1_0 English voice catalog → integer speaker id (sid).
// Copied verbatim from action.yml step 8d so the extension and the action speak
// with the SAME voice for the same `tts-voice` setting. The synth binary takes
// --sid, not a name; an unknown name fails soft to af_heart (sid 3).
export const KOKORO_VOICE_SID: Readonly<Record<string, number>> = {
  af_alloy: 0, af_aoede: 1, af_bella: 2, af_heart: 3,
  af_jessica: 4, af_kore: 5, af_nicole: 6, af_nova: 7,
  af_river: 8, af_sarah: 9, af_sky: 10, am_adam: 11,
  am_echo: 12, am_eric: 13, am_fenrir: 14, am_liam: 15,
  am_michael: 16, am_onyx: 17, am_puck: 18, am_santa: 19,
  bf_alice: 20, bf_emma: 21, bf_isabella: 22, bf_lily: 23,
  bm_daniel: 24, bm_fable: 25, bm_george: 26, bm_lewis: 27,
};

export const DEFAULT_VOICE = 'af_heart';
export const DEFAULT_SID = KOKORO_VOICE_SID[DEFAULT_VOICE];

/** Resolve a voice NAME → sid, fail-soft to af_heart on an unknown/invalid name
 *  (matches the action's `case "$TTS_VOICE"` fallback). */
export function voiceToSid(voice?: string): { voice: string; sid: number; fellBack: boolean } {
  if (voice && /^[A-Za-z0-9_]+$/.test(voice) && voice in KOKORO_VOICE_SID) {
    return { voice, sid: KOKORO_VOICE_SID[voice], fellBack: false };
  }
  return { voice: DEFAULT_VOICE, sid: DEFAULT_SID, fellBack: true };
}

export type SynthRequest = {
  /** Raw briefing prose (pre-sanitise). */
  text: string;
  /** Kokoro voice name; falls back to af_heart when unknown. */
  voice?: string;
  speed?: number;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
};

export type SynthResult = {
  /** A complete 24 kHz mono WAV ready for an <audio> src (blob/data URL). */
  wav: Uint8Array;
  durationSeconds: number;
  sampleRate: number;
  /** The voice actually used (after fail-soft). */
  voice: string;
  /** The sanitised text fed to the model (what was actually spoken). */
  spoken: string;
};

/**
 * A spoken summary that has ALREADY been synthesized (e.g. eagerly, as a step of
 * the live-scan pipeline) and is ready to play with no further model work. Passed
 * to `SpokenSummary` so the first "Listen" press plays instantly instead of
 * kicking off a lazy model load + inference. A subset of {@link SynthResult}.
 */
export type PreparedAudio = {
  /** Complete 24 kHz mono WAV bytes — wrap in a Blob for an <audio> src. */
  wav: Uint8Array;
  /** The voice actually used (after fail-soft). */
  voice: string;
  durationSeconds: number;
};

export interface TtsProvider {
  readonly id: string;
  readonly label: string;
  /** True if this engine can run right now (the WASM glue + model are staged). */
  isAvailable(): Promise<boolean>;
  /** Synthesize the briefing and resolve a playable WAV. */
  synthesize(req: SynthRequest): Promise<SynthResult>;
}

// ── Kokoro WASM provider (the real engine) ─────────────────────────────────
// Loads the sherpa-onnx Kokoro runtime once (cached, like WasmScanProvider's
// module) and synthesises against it. `loadRuntime` is injected so the browser
// instantiates the bundled engine while tests pass a fake that returns canned PCM.
export class KokoroWasmTtsProvider implements TtsProvider {
  readonly id = 'kokoro-wasm';
  readonly label = 'Kokoro TTS (WASM)';
  private runtime: Promise<KokoroRuntime> | null = null;

  constructor(private readonly loadRuntime: () => Promise<KokoroRuntime>) {}

  private get(): Promise<KokoroRuntime> {
    return (this.runtime ??= this.loadRuntime());
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.get();
      return true;
    } catch {
      this.runtime = null; // allow a later retry after the assets are staged
      return false;
    }
  }

  async synthesize(req: SynthRequest): Promise<SynthResult> {
    if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const spoken = prepareForTts(req.text);
    if (!spoken.trim()) throw new Error('nothing to speak after sanitising the briefing');

    const { voice, sid } = voiceToSid(req.voice);
    req.onProgress?.(`synthesizing · ${voice}`);

    const runtime = await this.get();
    if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // sid is the sherpa contract; voice NAME is what kokoro-js uses. Pass both.
    const pcm = await runtime.synthesize(spoken, { sid, voice, speed: req.speed ?? 1.0 });

    if (!pcm.samples?.length) throw new Error('Kokoro produced no audio samples');
    const sampleRate = pcm.sampleRate || KOKORO_SAMPLE_RATE;
    const wav = encodeWavFromFloat32(pcm.samples, sampleRate);
    const durationSeconds = pcmDurationSeconds(pcm.samples, sampleRate);
    req.onProgress?.(`${durationSeconds.toFixed(1)}s · ${(wav.length / 1024).toFixed(0)} KB`);

    return { wav, durationSeconds, sampleRate, voice, spoken };
  }
}

/** The TTS engine for this build — the real Kokoro WASM synthesizer. */
export function createTtsProvider(loadRuntime: () => Promise<KokoroRuntime>): TtsProvider {
  return new KokoroWasmTtsProvider(loadRuntime);
}
