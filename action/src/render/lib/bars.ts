// Block-element bars — they render everywhere (no chart dependency) and carry
// the magnitude even when GitHub fails to draw a Mermaid chart.

import { clamp } from './format.ts';

// Left-aligned partial blocks, index 1..7 = eighths (1/8 … 7/8). Index 0 unused.
//   ▏ 1/8 · ▎ 2/8 · ▍ 3/8 · ▌ 4/8 · ▋ 5/8 · ▊ 6/8 · ▉ 7/8 · █ 8/8
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const;
const FULL = '█';
const EMPTY = '░';

/**
 * A `cells`-wide bar of `|value| / max`, with ⅛-block sub-character precision
 * (so 2.65 cells renders `██▋`, not a rounded `███`). Always exactly `cells`
 * glyphs wide. `max <= 0` (or non-finite) → an empty track.
 *
 * Used for the per-axis magnitude bars in the value card: each axis is drawn
 * relative to the largest |Δ| across axes, matching the template's
 * "bars show |Δ| relative to the largest axis, ⅛-block precision".
 */
export function magnitudeBar(value: number, max: number, cells = 10): string {
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(value)) {
    return EMPTY.repeat(cells);
  }
  const frac = clamp(Math.abs(value) / max, 0, 1);
  const eighths = Math.round(frac * cells * 8);
  const full = Math.floor(eighths / 8);
  const rem = eighths % 8;
  const head = FULL.repeat(full) + EIGHTHS[rem];
  const used = full + (rem > 0 ? 1 : 0);
  return head + EMPTY.repeat(Math.max(0, cells - used));
}

// Sparkline blocks, low→high (eighths of height). Zero-dependency, renders in
// any monospace context — used for the cross-push merge-confidence trend.
const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

/**
 * A Unicode block sparkline of `nums`, scaled to the series' own min→max so the
 * SHAPE of the trend is visible even for a narrow value range. With <2 points
 * there's no trend to draw → empty string. Non-finite values are dropped.
 *
 * `sparkline([1,2,3,4,5]) → "▁▃▄▆█"`. Used for the merge-confidence trend across
 * the last N pushes (each value already clamped 0–5 by the caller).
 */
export function sparkline(nums: number[]): string {
  const xs = nums.filter((n) => Number.isFinite(n));
  if (xs.length < 2) return '';
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const span = hi - lo;
  return xs
    .map((n) => {
      const frac = span === 0 ? 1 : (n - lo) / span; // flat series → mid/full bar
      const idx = clamp(Math.round(frac * (SPARK.length - 1)), 0, SPARK.length - 1);
      return SPARK[idx];
    })
    .join('');
}

/**
 * A simple filled/empty progress track: `progressBar(0,5) → "░░░░░░░░░░"`,
 * `progressBar(5,5) → "██████████"`. Used for the merge-readiness line, which
 * GitHub itself re-tallies as the author checks boxes off.
 */
export function progressBar(done: number, total: number, cells = 10): string {
  if (total <= 0) return EMPTY.repeat(cells);
  const filled = clamp(Math.round((done / total) * cells), 0, cells);
  return FULL.repeat(filled) + EMPTY.repeat(cells - filled);
}
