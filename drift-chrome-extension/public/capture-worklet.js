// AudioWorklet capture processor for the Drift live voice agent. Runs on the
// real-time AUDIO THREAD — reliable for long sessions, unlike ScriptProcessorNode
// which silently stops firing after a while (that was the "stops listening + frozen
// orb after a couple turns" bug). It does NO model work: it only reframes the mic
// into fixed 480-sample frames (20 ms @ 24 kHz, matching volley-core's RENDER_FRAME)
// and posts each to the main thread, which runs the FSM. No wasm, no SharedArrayBuffer
// here → no cross-origin isolation needed.
const FRAME = 480;

class DriftCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(FRAME);
    this._fill = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this._buf[this._fill++] = ch[i];
        if (this._fill === FRAME) {
          this.port.postMessage(this._buf); // structured-clone copy to the main thread
          this._buf = new Float32Array(FRAME); // fresh buffer for the next frame
          this._fill = 0;
        }
      }
    }
    return true; // keep the processor alive
  }
}

registerProcessor('drift-capture', DriftCaptureProcessor);
