// Unified severity palette + composite-status logic, documented once and
// reused everywhere (badges, value card, legend). Colours are GitHub Primer
// hexes (no leading #) so they double as shields.io badge colours.

import type { ValueAxis, ValueAxisBar } from '../../report.ts';

export const COLOR = {
  green: '2ea043', // improvement / ship
  amber: 'd29922', // mixed / monitor
  red: 'd1242f', // regression / act
  blue: '58a6ff', // neutral-informational
  grey: '8b949e', // muted / flat
  brand: 'ff6b3d', // Drift / Andy brand orange — brand chips & agent-ready badge
} as const;

/** Direction → leading status emoji (🟢 improvement · 🔴 regression · ⚪ flat). */
export function directionEmoji(direction: 'up' | 'down' | 'neutral'): string {
  return direction === 'up' ? '🟢' : direction === 'down' ? '🔴' : '⚪';
}

/** Direction → one-word status used under each axis value. */
export function directionWord(direction: 'up' | 'down' | 'neutral'): string {
  return direction === 'up' ? 'improved' : direction === 'down' ? 'regressed' : 'no change';
}

export type Composite = {
  /** 🟢 / 🟡 / 🔴 / ⚪ */
  emoji: string;
  /** improved · mixed · regressed · no change */
  label: string;
  /** shields.io colour (no #) */
  color: string;
  /** true when at least one axis improved AND at least one regressed */
  mixed: boolean;
};

type Directional = Pick<ValueAxis, 'direction'> | ValueAxisBar;

/**
 * Composite verdict from the per-axis directions. The key fidelity rule from
 * the template: a big customer gain that masks a money regression is NOT green
 * — divergent signs are **amber "mixed"**. Pure improvement is green, pure
 * regression red, all-flat grey.
 */
export function compositeStatus(axes: Directional[] | undefined): Composite {
  const ups = (axes ?? []).filter((a) => a.direction === 'up').length;
  const downs = (axes ?? []).filter((a) => a.direction === 'down').length;
  if (ups > 0 && downs > 0) return { emoji: '🟡', label: 'mixed', color: COLOR.amber, mixed: true };
  if (downs > 0) return { emoji: '🔴', label: 'regressed', color: COLOR.red, mixed: false };
  if (ups > 0) return { emoji: '🟢', label: 'improved', color: COLOR.green, mixed: false };
  return { emoji: '⚪', label: 'no change', color: COLOR.grey, mixed: false };
}

/** Largest |Δ%| across axes — the denominator for the magnitude bars. */
export function maxAbsDelta(axes: { delta_percent: number }[] | undefined): number {
  return (axes ?? []).reduce((m, a) => Math.max(m, Math.abs(a.delta_percent)), 0);
}
