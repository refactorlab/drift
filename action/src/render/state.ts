// Sticky-comment intelligence: we embed a tiny machine-readable snapshot of
// this run's per-axis drift in an HTML comment at the end of the body. On the
// next push, main.ts reads the PRIOR sticky comment, parses that snapshot, and
// hands it back to the renderer — which fills the "Since last review" line with
// per-axis deltas (e.g. 💰 ▲ +2.1pp). First run → no prior snapshot → the
// template's "first run" placeholder.

import type { ScanPrOutput, ValueAxis } from '../report.ts';
import { signedNumber } from './lib/format.ts';

export type AxisName = ValueAxis['name'];

export type DriftState = {
  v: 1;
  overall?: number;
  axes?: Partial<Record<AxisName, number>>;
};

const MARKER_RE = /<!--\s*drift:state\s+(\{[\s\S]*?\})\s*-->/;

/** Build the snapshot for THIS run from the report's value card. */
export function stateFromReport(report: ScanPrOutput): DriftState {
  const state: DriftState = { v: 1 };
  const drift = report.pr_review?.overall_drift?.percent;
  if (typeof drift === 'number') state.overall = round(drift);

  const axes = report.pr_review?.value_card?.axes;
  if (axes?.length) {
    const map: Partial<Record<AxisName, number>> = {};
    for (const a of axes) map[a.name] = round(a.delta_percent);
    state.axes = map;
  }
  return state;
}

/** Serialize to the HTML-comment marker appended at the bottom of the body. */
export function serializeState(state: DriftState): string {
  return `<!-- drift:state ${JSON.stringify(state)} -->`;
}

/**
 * Parse a prior comment body's embedded snapshot. Tolerant: any malformed or
 * absent marker → null (so a hand-edited / legacy comment never throws).
 */
export function parseState(body: string | null | undefined): DriftState | null {
  if (!body) return null;
  const m = body.match(MARKER_RE);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]) as DriftState;
    return parsed && parsed.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

const AXIS_GLYPH: Record<AxisName, string> = {
  money: '💰',
  customer: '👥',
  runtime: '⚙️',
  runtime_ux: '🎨',
};

/**
 * Render the per-axis "since last review" deltas, in percentage POINTS
 * (pp = current Δ% − prior Δ%): `💰 ▲ +2.1pp · ⚙️ ▼ −1.0pp`. Only axes that
 * actually moved are shown. Returns null when there's no comparable prior data
 * (caller then shows the first-run placeholder).
 */
export function sinceLastReview(prior: DriftState | null, current: DriftState): string | null {
  if (!prior?.axes || !current.axes) return null;
  const order: AxisName[] = ['money', 'customer', 'runtime', 'runtime_ux'];
  const parts: string[] = [];
  for (const name of order) {
    const before = prior.axes[name];
    const now = current.axes[name];
    if (typeof before !== 'number' || typeof now !== 'number') continue;
    const delta = round(now - before);
    if (delta === 0) continue;
    const arrow = delta > 0 ? '▲' : '▼';
    parts.push(`${AXIS_GLYPH[name]} ${arrow} ${signedNumber(delta)}pp`);
  }
  return parts.length ? parts.join(' · ') : null;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
