// Mic capture + playback plumbing for voice mode. Wraps getUserMedia + an
// AudioContext + the voice-io AudioWorklet (public/voice-worklet.js). The worklet
// posts ~20 ms mic frames (at the context rate) which we forward to `onFrame`;
// the controller resamples them (resample.ts) for ASR (16 kHz) or the FSM
// (24 kHz). Playback PCM is pushed to the worklet's output queue.
//
// Shared by push-to-talk (Phase 2) and the duplex voice controller (Phase 3):
// the same frame source feeds either a simple accumulator or the VAD FSM.

import { ensureMicPermission } from './micPermission';

/** chrome.runtime.getURL when in an extension; a plain path otherwise. */
function extUrl(path: string): string {
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : `/${path}`;
}

export interface MicCapture {
  /** AudioContext sample rate (mic frames + playback are at this rate). */
  readonly sampleRate: number;
  /** Queue PCM (at the context rate) for playback through the worklet. */
  play(pcm: Float32Array): void;
  /** Drop all queued playback instantly (barge-in). */
  flushPlayback(): void;
  /** Ask the worklet to emit `playback-idle` now if its queue is already empty
   *  (closes the race where a mid-reply drain fired before the reply finished). */
  requestIdleCheck(): void;
  /** Stop capture, release the mic, and close the context. */
  stop(): Promise<void>;
}

export interface CaptureHandlers {
  /** One ~20 ms mic frame at the context rate. */
  onFrame: (frame: Float32Array) => void;
  /** The worklet's output queue drained (TTS finished playing). */
  onPlaybackIdle?: () => void;
  /** RMS of the audio currently being PLAYED (for the UI orb's speaking viz). */
  onOutLevel?: (rms: number) => void;
}

/**
 * Start mic capture. Requests the mic with the browser's echo canceller / noise
 * suppression / auto-gain ON (the FSM's fixed VAD gate assumes AGC-normalized
 * input, and echo cancellation keeps the agent's own voice out of the mic).
 * Resolves once the worklet is live and frames are flowing.
 */
export async function startCapture(handlers: CaptureHandlers): Promise<MicCapture> {
  // The side panel can't host the getUserMedia prompt itself, so secure the
  // grant up front (no-op once granted) before requesting the device.
  await ensureMicPermission();

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });

  // Match Volley exactly: run the audio bus at the FSM's native 24 kHz so each
  // ~20 ms mic hop is one 480-sample analysis frame (no resample drift / energy
  // scaling), and RESUME the context. Voice mode does heavy async model loading
  // before reaching here, so the entering click's user activation has expired
  // and a freshly created AudioContext starts *suspended* — without resume(),
  // the worklet's process() never runs, no mic frames flow, and the VAD FSM sits
  // in Listening forever (never committing an utterance). This is the fix for
  // "keeps listening and never responds".
  const ctx = new AudioContext({ sampleRate: 24_000 });
  await ctx.resume();
  await ctx.audioWorklet.addModule(extUrl('voice-worklet.js'));

  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'voice-io', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { hop: Math.max(1, Math.round(ctx.sampleRate * 0.02)) },
  });

  node.port.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'frame' && m.samples) handlers.onFrame(new Float32Array(m.samples));
    else if (m.type === 'playback-idle') handlers.onPlaybackIdle?.();
    else if (m.type === 'out-level') handlers.onOutLevel?.(m.level);
  };

  // Mic → worklet (for capture). Worklet → speakers (for playback). The worklet
  // both reads its input (mic) and writes its output (TTS), so it sits between
  // the source and the destination.
  source.connect(node);
  node.connect(ctx.destination);

  return {
    sampleRate: ctx.sampleRate,
    play(pcm) {
      const buf = pcm.slice().buffer;
      node.port.postMessage({ type: 'play', samples: buf }, [buf]);
    },
    flushPlayback() {
      node.port.postMessage({ type: 'flush' });
    },
    requestIdleCheck() {
      node.port.postMessage({ type: 'query-idle' });
    },
    async stop() {
      try {
        node.port.onmessage = null;
        node.disconnect();
        source.disconnect();
        for (const t of stream.getTracks()) t.stop();
        await ctx.close();
      } catch {
        /* best-effort teardown */
      }
    },
  };
}
