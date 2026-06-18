import { describe, expect, it } from 'vitest';
import {
  beatAtElapsed,
  beatDwellMs,
  beatStartOffsets,
  clockElapsed,
  fmtClock,
  leadMs,
  MIN_BEAT_DWELL_MS,
  planDurationMs,
  VOICE_LEAD_MS,
} from './presentationClock';

const beats = (...dwells: number[]) => dwells.map((dwellMs) => ({ dwellMs }));

describe('beatDwellMs', () => {
  it('floors each dwell at the page scroller minimum', () => {
    expect(beatDwellMs({ dwellMs: 100 })).toBe(MIN_BEAT_DWELL_MS);
    expect(beatDwellMs({ dwellMs: 4000 })).toBe(4000);
  });
});

describe('leadMs', () => {
  it('gives voice a lead and text none (mirrors the page scroller)', () => {
    expect(leadMs('voice')).toBe(VOICE_LEAD_MS);
    expect(leadMs('text')).toBe(0);
  });
});

describe('beatStartOffsets', () => {
  it('accumulates floored dwells after the mode lead', () => {
    // dwells 1000, 500(→900), 3000 ; text lead 0
    expect(beatStartOffsets(beats(1000, 500, 3000), 'text')).toEqual([0, 1000, 1900]);
    // voice adds the 700ms lead to every offset
    expect(beatStartOffsets(beats(1000, 500, 3000), 'voice')).toEqual([700, 1700, 2600]);
  });
});

describe('planDurationMs', () => {
  it('is the last beat end; 0 for an empty plan', () => {
    expect(planDurationMs(beats(1000, 2000), 'text')).toBe(3000);
    expect(planDurationMs(beats(1000, 2000), 'voice')).toBe(3700);
    expect(planDurationMs([], 'text')).toBe(0);
  });
});

describe('beatAtElapsed', () => {
  const plan = beats(1000, 2000, 1500); // text offsets [0,1000,3000], ends 4500
  it('maps elapsed time to the on-screen beat + its remaining dwell', () => {
    expect(beatAtElapsed(plan, 'text', 0)).toEqual({ index: 0, remainingMs: 1000 });
    expect(beatAtElapsed(plan, 'text', 500)).toEqual({ index: 0, remainingMs: 500 });
    expect(beatAtElapsed(plan, 'text', 1000)).toEqual({ index: 1, remainingMs: 2000 });
    expect(beatAtElapsed(plan, 'text', 2999)).toEqual({ index: 1, remainingMs: 1 });
    expect(beatAtElapsed(plan, 'text', 3000)).toEqual({ index: 2, remainingMs: 1500 });
  });
  it('clamps past the end to the last beat with 0 remaining', () => {
    expect(beatAtElapsed(plan, 'text', 99999)).toEqual({ index: 2, remainingMs: 0 });
  });
  it('within the voice lead, shows beat 0', () => {
    expect(beatAtElapsed(plan, 'voice', 300)).toEqual({ index: 0, remainingMs: 1000 });
  });
});

describe('clockElapsed (timeline playhead position)', () => {
  it('advances with wall time while running, clamped to [0, totalMs]', () => {
    const clock = { totalMs: 10000, baseMs: 2000, runningSince: 1000 };
    expect(clockElapsed(clock, 1000)).toBe(2000); // at the sync instant → baseMs
    expect(clockElapsed(clock, 4000)).toBe(5000); // +3000 wall → 2000+3000
    expect(clockElapsed(clock, 99999)).toBe(10000); // clamped to totalMs
  });
  it('freezes at baseMs when paused (runningSince null)', () => {
    expect(clockElapsed({ totalMs: 10000, baseMs: 4200, runningSince: null }, 99999)).toBe(4200);
  });
});

describe('fmtClock', () => {
  it('formats ms as m:ss', () => {
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(4800)).toBe('0:05'); // rounds to seconds
    expect(fmtClock(60000)).toBe('1:00');
    expect(fmtClock(125000)).toBe('2:05');
  });
});
