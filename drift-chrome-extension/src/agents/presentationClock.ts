// The PRESENTATION CLOCK — the timeline that walks a handover file walkthrough
// through its beats so the CHAT's active-beat highlight stays in lockstep with the
// in-page scroll/highlight (prNavigate.runScrollPlanInPage).
//
// Division of labour: the page-side scroller owns the SCROLL (it's robust against
// GitHub's virtualised diff); this owns the CHAT highlight. Both walk the SAME beats
// with the SAME per-beat dwell + mode lead, so the button that lights up in the
// message is exactly the spot the page is dwelling on — the reviewer "sees the exact
// moment" in both the code and the transcript, in text AND voice.
//
// Pure schedule math (unit-tested) + a thin, timer-INJECTABLE driver, so tests run on
// a fake clock and never touch real wall-time.

/** The minimal beat shape the clock needs — PresentBeat (scrollPlan.ts) satisfies it. */
export interface TimedBeat {
  dwellMs: number;
}

/** Lead before the first beat — MIRRORS prNavigate.runScrollPlanThroughFile: voice
 *  gets a small lead so the scroll + highlight don't outrun the first spoken audio. */
export const VOICE_LEAD_MS = 700;
export const TEXT_LEAD_MS = 0;
export const leadMs = (mode: 'text' | 'voice'): number => (mode === 'voice' ? VOICE_LEAD_MS : TEXT_LEAD_MS);

/** The dwell the in-page scroller actually holds per beat (Math.max(900, dwellMs) in
 *  runScrollPlanInPage). Mirror it EXACTLY so chat + page never drift apart. */
export const MIN_BEAT_DWELL_MS = 900;
export const beatDwellMs = (b: TimedBeat): number => Math.max(MIN_BEAT_DWELL_MS, b.dwellMs);

/** Start offset (ms from play-start, including the mode lead) of each beat. Pure. */
export function beatStartOffsets(beats: TimedBeat[], mode: 'text' | 'voice'): number[] {
  const offs: number[] = [];
  let t = leadMs(mode);
  for (const b of beats) {
    offs.push(t);
    t += beatDwellMs(b);
  }
  return offs;
}

/** Total time to walk the whole plan (the last beat's end). Pure. */
export function planDurationMs(beats: TimedBeat[], mode: 'text' | 'voice'): number {
  if (!beats.length) return 0;
  const offs = beatStartOffsets(beats, mode);
  return offs[offs.length - 1] + beatDwellMs(beats[beats.length - 1]);
}

/** Which beat is on screen `elapsedMs` into the plan, and how long until it ends.
 *  Within the lead → beat 0 (we show it from the start); past the end → the last
 *  beat, 0 remaining. Lets a late-rendering chat bubble JUMP to the beat the page is
 *  already dwelling on (re-sync) instead of restarting from the top. Pure. */
export function beatAtElapsed(
  beats: TimedBeat[],
  mode: 'text' | 'voice',
  elapsedMs: number,
): { index: number; remainingMs: number } {
  if (!beats.length) return { index: 0, remainingMs: 0 };
  const offs = beatStartOffsets(beats, mode);
  for (let i = beats.length - 1; i >= 0; i--) {
    if (elapsedMs >= offs[i]) {
      const end = offs[i] + beatDwellMs(beats[i]);
      return { index: i, remainingMs: Math.max(0, end - elapsedMs) };
    }
  }
  return { index: 0, remainingMs: beatDwellMs(beats[0]) }; // still within the lead
}

/** A media-clock for the timeline PLAYHEAD: `baseMs` is the elapsed time at the last
 *  (re)sync, `runningSince` the wall-clock ms of that sync (null = paused / ended).
 *  Lets the timeline show a smoothly MOVING position + a current/total time readout. */
export interface MediaClock {
  totalMs: number;
  baseMs: number;
  runningSince: number | null;
}

/** Current elapsed ms, clamped to [0, totalMs], for a media-clock at wall-time `nowMs`.
 *  Pure (clock injected) — the timeline calls it each animation frame. */
export function clockElapsed(clock: MediaClock, nowMs: number): number {
  const e = clock.baseMs + (clock.runningSince != null ? nowMs - clock.runningSince : 0);
  return Math.max(0, Math.min(clock.totalMs, e));
}

/** Format ms as `m:ss` for the timeline's time labels (current / total). */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// NOTE: the per-beat setTimeout driver (runPresentationClock) was retired — the panel
// now drives the whole walkthrough off the single media-clock above (one requestAnimation
// Frame loop maps elapsed → beat → highlight + scroll), so the timeline, the inline
// buttons, and the page scroll all advance together.
