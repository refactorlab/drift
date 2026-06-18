// A soft "rubber-key" tick for UI reveals — one flat triangle blip (420 Hz, low-pass),
// synthesised with the Web Audio API (no audio files, no network).
//
// SINGLE RESPONSIBILITY: own ONE lazily-created AudioContext + limiter and expose a
// `tick(when?)` that schedules a blip. Used by the change-impact graph to click as each
// node reveals. All calls are guarded so a context-less environment (jsdom tests, a
// suspended tab, no Web Audio) is a silent no-op rather than a throw.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

type WebAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** Create the context + limiter on first use. No-op when Web Audio is unavailable. */
function ensure(): void {
  if (ctx) return;
  const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext) : undefined;
  if (!Ctor) return;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.28;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    master.connect(limiter);
    limiter.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
}

/** The audio clock's current time, for scheduling a sequence of ticks. 0 if unavailable. */
export function audioNow(): number {
  ensure();
  return ctx ? ctx.currentTime : 0;
}

/** Resume the context after a user gesture (browsers start it suspended). Safe to call
 *  repeatedly; returns false when there's nothing to resume. */
export function resumeChime(): boolean {
  ensure();
  if (!ctx) return false;
  if (ctx.state === 'suspended') void ctx.resume();
  return true;
}

/** Schedule one tick. `when` is an absolute audio-clock time (see {@link audioNow});
 *  omitted → ~now. Silent no-op when Web Audio is unavailable. */
export function tick(when?: number): void {
  ensure();
  if (!ctx || !master) return;
  const t = when == null ? ctx.currentTime + 0.01 : when;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.value = 420;
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.13);
  } catch {
    // A failed schedule (e.g. context closed mid-call) is non-fatal — stay silent.
  }
}
