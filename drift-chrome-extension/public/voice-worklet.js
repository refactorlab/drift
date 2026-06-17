// Voice I/O AudioWorklet for the side-panel voice mode. Runs on the realtime
// audio thread. Two jobs:
//   • CAPTURE: accumulate mic input into ~20 ms hops (at the AudioContext rate)
//     and post each hop as a Float32Array to the controller (drift replaces
//     Volley's SharedArrayBuffer mic ring with postMessage — the side panel is
//     not cross-origin-isolated, so SAB is unavailable, and a 20 ms frame is a
//     trivial amount of data to copy).
//   • PLAYBACK: receive synthesized TTS PCM (already resampled to the context
//     rate by the controller) and play it out; a `flush` empties the queue
//     instantly for barge-in. Posts `playback-idle` when the queue drains so the
//     controller can flip the FSM out of Speaking.
//
// No allocations in process() beyond the per-hop frame copy that must be
// transferred out.

class VoiceIO extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    // Hop = 20 ms at the context rate (matches the FSM's 20 ms analysis frame
    // once the controller resamples context-rate → 24 kHz).
    this.hop = opts.hop || Math.max(1, Math.round(sampleRate * 0.02));
    this.acc = new Float32Array(this.hop);
    this.accLen = 0;

    // Playback queue: a list of Float32Array chunks + a read cursor into the head.
    this.queue = [];
    this.readPos = 0;
    this.wasPlaying = false;

    // Playback level meter: accumulate output energy and post an RMS every few
    // render quanta so the UI orb can animate "speaking" from REAL agent audio.
    this.outAcc = 0;
    this.outN = 0;
    this.outBlocks = 0;

    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'play' && m.samples) {
        this.queue.push(new Float32Array(m.samples));
      } else if (m.type === 'flush') {
        this.queue.length = 0;
        this.readPos = 0;
      } else if (m.type === 'query-idle') {
        // The controller finished synthesizing a reply and is asking whether
        // playback has already drained, so it can end Speaking without waiting
        // for a drain event that may have already fired. Answer only if idle.
        if (this.queue.length === 0) this.port.postMessage({ type: 'playback-idle' });
      }
    };
  }

  process(inputs, outputs) {
    // ── Capture mic → 20 ms hops ──
    const input = inputs[0];
    if (input && input[0]) {
      const chan = input[0];
      for (let i = 0; i < chan.length; i++) {
        this.acc[this.accLen++] = chan[i];
        if (this.accLen === this.hop) {
          const frame = this.acc.slice(0); // copy; transfer ownership out
          this.port.postMessage({ type: 'frame', samples: frame.buffer }, [frame.buffer]);
          this.accLen = 0;
        }
      }
    }

    // ── Playback queued TTS PCM ──
    const output = outputs[0];
    if (output && output[0]) {
      const out = output[0];
      let n = 0;
      while (n < out.length && this.queue.length) {
        const head = this.queue[0];
        const avail = head.length - this.readPos;
        const take = Math.min(avail, out.length - n);
        out.set(head.subarray(this.readPos, this.readPos + take), n);
        this.readPos += take;
        n += take;
        if (this.readPos >= head.length) {
          this.queue.shift();
          this.readPos = 0;
        }
      }
      // Zero-fill the remainder (silence) so we don't replay stale buffer data.
      for (; n < out.length; n++) out[n] = 0;

      const playing = this.queue.length > 0;

      // Output level meter (for the UI orb's "speaking" animation). Accumulate
      // energy of what we just played and post an RMS ~every 8 quanta (~20–40 Hz)
      // while audio is flowing; stay silent when idle to avoid chatter.
      if (playing || this.wasPlaying) {
        for (let i = 0; i < out.length; i++) this.outAcc += out[i] * out[i];
        this.outN += out.length;
        if (++this.outBlocks >= 8) {
          const rms = this.outN ? Math.sqrt(this.outAcc / this.outN) : 0;
          this.port.postMessage({ type: 'out-level', level: rms });
          this.outAcc = 0;
          this.outN = 0;
          this.outBlocks = 0;
        }
      }

      if (this.wasPlaying && !playing) this.port.postMessage({ type: 'playback-idle' });
      this.wasPlaying = playing;
    }

    return true; // keep the processor alive
  }
}

registerProcessor('voice-io', VoiceIO);
