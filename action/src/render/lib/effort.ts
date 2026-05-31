// Review-effort estimate — a deterministic 1–5 "how much careful human review
// does this PR warrant" score, plus a coarse time band and the reasons behind
// it. This is Drift's answer to Qodo's `estimated_effort_to_review_[1-5]`, but
// where Qodo asks an LLM to guess, we DERIVE it from the static facts the
// scanner already produced — size, call-graph blast radius, complexity/tech
// debt, correctness findings, and regressions — so the score is reproducible,
// explainable, and testable. Drives the lead "🧮 Review effort N/5" KPI badge
// and the one-line time estimate in the TL;DR.
//
// Pure function of PrFacts (no language/report coupling) so it unit-tests
// trivially and can never disagree with the header/checklist that share facts.

import type { PrFacts } from './facts.ts';
import { COLOR } from './severity.ts';
import { int, signedInt, plural } from './format.ts';

export type EffortScore = 1 | 2 | 3 | 4 | 5;

export type ReviewEffort = {
  score: EffortScore;
  /** A single word a reviewer can act on at a glance. */
  label: 'trivial' | 'easy' | 'moderate' | 'involved' | 'demanding';
  /** Coarse, defensible time band — no false precision. */
  minutes: string;
  /** Top reasons the score is what it is (already prioritised, ≤ 3). */
  drivers: string[];
  /** shields.io colour (no `#`) tracking the score's severity. */
  color: string;
};

const LABEL: Record<EffortScore, ReviewEffort['label']> = {
  1: 'trivial',
  2: 'easy',
  3: 'moderate',
  4: 'involved',
  5: 'demanding',
};

// Coarse bands, not point estimates — a reviewer wants "is this 5 minutes or an
// hour", not a fake "~27 min". Tuned to a focused single-reviewer pass.
const MINUTES: Record<EffortScore, string> = {
  1: '≈ 5 min',
  2: '≈ 10 min',
  3: '≈ 20 min',
  4: '≈ 30–45 min',
  5: '≈ 60 min+',
};

// Score → colour: easy is green, moderate informational-blue, involved amber,
// demanding red. Mirrors the rest of the unified palette.
const SCORE_COLOR: Record<EffortScore, string> = {
  1: COLOR.green,
  2: COLOR.green,
  3: COLOR.blue,
  4: COLOR.amber,
  5: COLOR.red,
};

/**
 * Estimate review effort from the normalised PR facts. The weights are a
 * deliberate, documented heuristic — each clause maps to a real reason a human
 * review takes longer: more surface area, wider blast radius, gnarlier code,
 * and findings that demand careful judgement rather than a skim.
 */
export function reviewEffort(f: PrFacts): ReviewEffort {
  let pts = 0;

  // ── surface area — files touched ────────────────────────────────────────
  const files = f.changedFiles;
  if (files > 40) pts += 2;
  else if (files > 15) pts += 1.5;
  else if (files > 6) pts += 1;
  else pts += 0.5;

  // ── surface area — added LOC (null when there's no money axis; lean on
  //    files alone in that case) ───────────────────────────────────────────
  const loc = f.locAdded ?? 0;
  if (loc > 1000) pts += 2;
  else if (loc > 400) pts += 1.5;
  else if (loc > 150) pts += 1;
  else if (loc > 0) pts += 0.5;

  // ── blast radius — entry points that reach the change ───────────────────
  if (f.affectedRoots > 30) pts += 1;
  else if (f.affectedRoots > 12) pts += 0.5;

  // ── tech debt in the touched code — harder to hold in your head ─────────
  const debt = f.highComplexity + f.longFunctions;
  pts += Math.min(1.5, debt * 0.25);

  // ── findings that demand judgement, not a skim ──────────────────────────
  pts += Math.min(2, f.correctness.length * 0.9);
  if (f.regressedAxes.length > 0) pts += Math.min(1, f.regressedAxes.length * 0.5);
  if (f.risksToAddress > 0) pts += Math.min(1, f.risksToAddress * 0.2);

  // ── untested code ships without a safety net — you must reason it through
  if (f.newTestFiles === 0 && loc > 150) pts += 0.5;

  const score: EffortScore = pts >= 7 ? 5 : pts >= 5 ? 4 : pts >= 3 ? 3 : pts >= 1.5 ? 2 : 1;

  return {
    score,
    label: LABEL[score],
    minutes: MINUTES[score],
    drivers: drivers(f),
    color: SCORE_COLOR[score],
  };
}

/** The ≤ 3 biggest reasons, in the order a reviewer would care about them. */
function drivers(f: PrFacts): string[] {
  const out: string[] = [];

  if (f.correctness.length > 0) {
    out.push(`${f.correctness.length} ${plural(f.correctness.length, 'correctness issue')}`);
  }
  if (f.regressedAxes.length > 0) {
    out.push(`${f.regressedAxes.length} ${plural(f.regressedAxes.length, 'axis', 'axes')} regressed`);
  }
  const debt = f.highComplexity + f.longFunctions;
  if (debt > 0) out.push(`${debt} complex/long ${plural(debt, 'fn')}`);
  if (f.changedFiles > 6) out.push(`${int(f.changedFiles)} files`);
  if (f.locAdded !== null && f.locAdded > 0) out.push(`${signedInt(f.locAdded)} LOC`);
  if (f.affectedRoots > 12) out.push(`${int(f.affectedRoots)} entry points`);

  // Always say SOMETHING — a tiny clean PR still gets one honest driver.
  if (out.length === 0) {
    out.push(`${int(f.changedFiles)} ${plural(f.changedFiles, 'file')}`);
  }
  return out.slice(0, 3);
}
