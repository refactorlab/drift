// Build the PR-handover EXECUTION PLAN: the changed files ordered high-level →
// low-level, each tagged with WHY it matters. Pure (no LLM, no network) — it reads
// the SAME scan signals architecture.ts surfaces (key files, affected roots, the
// call-graph delta) and tiers every changed file:
//
//   critical — a scan "key file" (the structurally central changes)
//   core     — source/API code that's architecturally implicated (affected root
//              or named in the call-graph delta)
//   support  — other source + tests
//   minor    — config, build, docs, dependency manifests / lockfiles
//
// Order = tier (critical→minor), then largest change first within a tier. This is
// the list the AI presents and the order it walks, so the reviewer sees the
// load-bearing changes before the plumbing. File classification reuses the lens
// helpers (one source of truth — agents/lenses.ts).

import type { ScanRecord } from '../state/scanHistory';
import { asScanOutput } from '../core/scanOutput';
import { isTest, isConfig, isDocs, isSource, isApiSurface, isDepManifest } from './lenses';
import type { HandoverStep, HandoverTier } from '../state/handoverSession';

/** Default ceiling on steps so a huge PR doesn't bloat storage / the prompt. The
 *  lowest-tier tail is dropped; the tool reports the omitted count. */
export const HANDOVER_STEP_CAP = 60;

const TIER_RANK: Record<HandoverTier, number> = { critical: 0, core: 1, support: 2, minor: 3 };

/** Is `path` under one of the affected roots? Returns the matched root (for the
 *  rationale) or null. A root matches a file it equals or prefixes (dir-wise). */
function matchedRoot(path: string, roots: string[]): string | null {
  for (const r of roots) {
    if (!r) continue;
    if (path === r || path.startsWith(r.endsWith('/') ? r : `${r}/`)) return r;
  }
  return null;
}

/** Build the tiered, ordered plan for a scan. Pure. `maxSteps` caps the list. */
export function buildHandoverPlan(rec: ScanRecord, maxSteps: number = HANDOVER_STEP_CAP): HandoverStep[] {
  const scan = asScanOutput(rec.scan);
  const review = scan?.pr_review;

  // Key files → critical, carrying the scan's `why` as the rationale.
  const keyWhy = new Map<string, string>();
  for (const g of review?.visual_summary?.key_files?.groups ?? []) {
    for (const f of g.files ?? []) {
      if (f?.path && !keyWhy.has(f.path)) keyWhy.set(f.path, (f.why ?? '').trim());
    }
  }

  const roots = (scan?.pr_scope?.affected_roots ?? []).filter(Boolean);
  // Call-graph delta — labels of added/changed/removed nodes (basenames/symbols),
  // used as a soft "this file is structurally implicated" signal.
  const touchedLabels = new Set(
    (review?.architecture_flow?.diff_merged_structured?.nodes ?? [])
      .filter((n) => n.class === 'added' || n.class === 'changed' || n.class === 'removed')
      .map((n) => (n.label ?? '').toLowerCase().trim())
      .filter(Boolean),
  );
  const hasArchSignals = roots.length > 0 || touchedLabels.size > 0;
  const labelTouched = (path: string): boolean => {
    const base = (path.split('/').pop() ?? path).toLowerCase();
    return touchedLabels.has(base) || [...touchedLabels].some((l) => l.length >= 4 && base.includes(l));
  };

  const steps: HandoverStep[] = (rec.changedStatus ?? []).map((f) => {
    const path = f.path;
    let tier: HandoverTier;
    let rationale: string;

    if (keyWhy.has(path)) {
      tier = 'critical';
      rationale = keyWhy.get(path) || 'Key file — central to this change';
    } else if (isDepManifest(path)) {
      tier = 'minor';
      rationale = 'Dependency manifest / lockfile';
    } else if (isConfig(path)) {
      tier = 'minor';
      rationale = 'Config / build change';
    } else if (isDocs(path)) {
      tier = 'minor';
      rationale = 'Documentation';
    } else if (isTest(path)) {
      tier = 'support';
      rationale = 'Test for the change';
    } else if (isSource(path) || isApiSurface(path)) {
      const root = matchedRoot(path, roots);
      if (root || labelTouched(path) || !hasArchSignals) {
        tier = 'core';
        rationale = root ? `Core change under ${root}` : 'Core source change';
      } else {
        tier = 'support';
        rationale = 'Supporting source change';
      }
    } else {
      tier = 'minor';
      rationale = 'Minor change';
    }

    return { path, code: f.code, tier, rationale, additions: f.additions, deletions: f.deletions };
  });

  const size = (s: HandoverStep) => s.additions + s.deletions;
  steps.sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] || // tier first
      size(b) - size(a) || // largest change first within a tier
      a.path.localeCompare(b.path), // stable
  );
  return steps.slice(0, Math.max(1, maxSteps));
}

/** A short, bulleted view of the plan grouped by tier — what the AI presents at
 *  the start of a walkthrough ("here's the execution plan"). Each tier is capped
 *  to `perTierCap` lines (a big PR's plan stays prompt-sized) with a "+N more"
 *  note; `omitted` files beyond the step cap are noted too, so completeness isn't
 *  over-claimed. */
export function formatHandoverPlan(steps: HandoverStep[], omitted = 0, perTierCap = 999): string {
  const tiers: Array<[HandoverTier, string]> = [
    ['critical', 'Critical'],
    ['core', 'Core'],
    ['support', 'Supporting'],
    ['minor', 'Minor'],
  ];
  const lines: string[] = [];
  for (const [tier, label] of tiers) {
    const inTier = steps.filter((s) => s.tier === tier);
    if (!inTier.length) continue;
    lines.push(`${label}:`);
    for (const s of inTier.slice(0, perTierCap)) lines.push(`- ${s.path} — ${s.rationale}`);
    if (inTier.length > perTierCap) lines.push(`- …and ${inTier.length - perTierCap} more ${label.toLowerCase()} file(s)`);
  }
  if (omitted > 0) lines.push(`(+${omitted} more lower-priority file(s) not listed — ask to jump to any of them.)`);
  return lines.join('\n');
}
