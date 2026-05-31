// Merge-confidence — a deterministic 0–5 "how safe is this to merge" score,
// the inverse-risk companion to review-effort. Greptile's published data shows
// a single 0–5 confidence gauge lifted author action-rate (30%→43%); ours is
// grounded in the static call graph + value model rather than an LLM guess, so
// it's reproducible and explainable. 5 = ship with confidence, 0 = do not merge.
//
// Pure function of PrFacts (+ the shared review-effort), so it reads the SAME
// inputs as the header/checklist and can never tell a contradictory story
// (a 5/5-effort PR can't also be 5/5 confidence — effort feeds a penalty here).

import type { PrFacts } from './facts.ts';
import { COLOR } from './severity.ts';
import { reviewEffort } from './effort.ts';
import { plural, int } from './format.ts';

export type ConfidenceScore = 0 | 1 | 2 | 3 | 4 | 5;

export type MergeConfidence = {
  score: ConfidenceScore;
  /** Greptile-style rubric word. */
  label: string;
  /** shields.io colour (no `#`). */
  color: string;
  /** The ≤3 biggest reasons it isn't a 5 (empty when it is). */
  drivers: string[];
};

const LABEL: Record<ConfidenceScore, string> = {
  5: 'ship with confidence',
  4: 'minor polish',
  3: 'review closely',
  2: 'significant concerns',
  1: 'high risk',
  0: 'do not merge',
};

/** Deterministic 0–5 merge-confidence from the normalised facts. */
export function mergeConfidence(f: PrFacts): MergeConfidence {
  let pts = 5;

  // A real correctness finding is the single biggest hit to confidence.
  pts -= Math.min(3, f.correctness.length * 1.0);

  // Value regressions and gating risks each chip away.
  pts -= Math.min(1.5, f.regressedAxes.length * 0.5);
  pts -= Math.min(1.5, f.risksToAddress * 0.5);

  // Untested reach: the fraction of touched entry points with no test covering
  // them in the call graph — a precise, call-graph-grounded penalty.
  if (f.affectedRoots > 0 && f.uncoveredRoots.length > 0) {
    const frac = Math.min(1, f.uncoveredRoots.length / f.affectedRoots);
    pts -= frac; // up to −1
  } else if (f.newTestFiles === 0 && f.locAdded !== null && f.locAdded > 150) {
    pts -= 0.5; // no call-graph data, but a big diff shipped with no tests
  }

  // A demanding review is itself a confidence drag (more places to be wrong).
  const effort = reviewEffort(f).score;
  if (effort >= 5) pts -= 0.5;
  else if (effort === 4) pts -= 0.25;

  const score = clampScore(Math.round(pts));

  return { score, label: LABEL[score], color: scoreColor(score), drivers: drivers(f) };
}

function scoreColor(score: ConfidenceScore): string {
  if (score >= 4) return COLOR.green;
  if (score === 3) return COLOR.blue;
  if (score === 2) return COLOR.amber;
  return COLOR.red;
}

/** The ≤3 biggest reasons confidence isn't a 5, in priority order. */
function drivers(f: PrFacts): string[] {
  const out: string[] = [];
  if (f.correctness.length > 0) out.push(`${f.correctness.length} ${plural(f.correctness.length, 'correctness issue')}`);
  if (f.affectedRoots > 0 && f.uncoveredRoots.length > 0) {
    out.push(`${int(f.uncoveredRoots.length)}/${int(f.affectedRoots)} reached ${plural(f.affectedRoots, 'root')} untested`);
  } else if (f.newTestFiles === 0 && f.locAdded !== null && f.locAdded > 0) {
    out.push('no new tests');
  }
  if (f.regressedAxes.length > 0) out.push(`${f.regressedAxes.length} ${plural(f.regressedAxes.length, 'axis', 'axes')} regressed`);
  if (f.risksToAddress > 0) out.push(`${f.risksToAddress} gating ${plural(f.risksToAddress, 'risk')}`);
  return out.slice(0, 3);
}

function clampScore(n: number): ConfidenceScore {
  return Math.max(0, Math.min(5, n)) as ConfidenceScore;
}
