// The PR-handover walkthrough SESSION — the cursor + ordered plan that lets the
// guided review (chatTools.ts `pr_handover_mode`) stop at each file, resume where
// it left off, and jump to any file. Persisted per-PR in chrome.storage.local
// (key `drift:handover:<prUrl>`, same scheme as prContext.ts) so a reload or a
// switch away-and-back resumes the same walkthrough.
//
// The state TRANSITIONS (advance / prev / goto / done) are PURE — they take a
// session and return a new one — so the walkthrough logic is unit-testable
// without chrome. Persistence is a thin get/set/clear wrapper on top.

/** How architecturally central a changed file is — drives walk order + grouping. */
export type HandoverTier = 'critical' | 'core' | 'support' | 'minor';

/** One stop in the walkthrough: a changed file, why it matters, and (once the
 *  session is built) its precomputed GitHub diff anchor for instant navigation. */
export interface HandoverStep {
  path: string;
  /** Change code from the scan (A/M/D/R/C/T). */
  code: string;
  tier: HandoverTier;
  /** One-line WHY this file matters — from the scan's key-file `why`, or synthesized. */
  rationale: string;
  additions: number;
  deletions: number;
  /** `diff-<sha256(path)>` (filled by attachAnchors when the session is built). */
  anchor?: string;
}

export interface HandoverSession {
  prUrl: string;
  /** Head SHA the plan was built against — rebuilt if the PR head moved. */
  sha: string;
  /** Ordered high→low (critical first). */
  steps: HandoverStep[];
  /** Index of the current step; -1 = at the overview, not yet in a file. */
  cursor: number;
  status: 'active' | 'done';
  startedAt: number;
}

const PREFIX = 'drift:handover:';
const key = (url: string) => `${PREFIX}${url}`;

// ── persistence ───────────────────────────────────────────────────────────────

export async function getHandoverSession(url: string): Promise<HandoverSession | null> {
  const k = key(url);
  return ((await chrome.storage.local.get(k))[k] as HandoverSession | undefined) ?? null;
}

export async function setHandoverSession(session: HandoverSession): Promise<void> {
  await chrome.storage.local.set({ [key(session.prUrl)]: session });
}

export async function clearHandoverSession(url: string): Promise<void> {
  await chrome.storage.local.remove(key(url));
}

/** Does a handover session EXIST for this PR (active OR completed)? Gates the
 *  deterministic router short-circuit so "next"/"proceed"/"resume" capture routing
 *  while a walkthrough is in progress — and still after it finishes, so the
 *  reviewer can revisit files until they explicitly stop (which clears it). */
export async function hasHandoverSession(url: string): Promise<boolean> {
  return !!(await getHandoverSession(url));
}

// ── pure transitions ──────────────────────────────────────────────────────────

/** The step the cursor is on, or null at the overview / out of range. */
export function currentStep(s: HandoverSession): HandoverStep | null {
  return s.cursor >= 0 && s.cursor < s.steps.length ? s.steps[s.cursor] : null;
}

export function isDone(s: HandoverSession): boolean {
  return s.status === 'done';
}

/** Move to the next file. Advancing past the last file completes the walkthrough
 *  (status → 'done', cursor stays on the last step). */
export function advance(s: HandoverSession): HandoverSession {
  const next = s.cursor + 1;
  if (next >= s.steps.length) return { ...s, cursor: Math.max(0, s.steps.length - 1), status: 'done' };
  return { ...s, cursor: next, status: 'active' };
}

/** Move to the previous file (clamped at the first). Re-activates a done session. */
export function prev(s: HandoverSession): HandoverSession {
  return { ...s, cursor: Math.max(0, s.cursor - 1), status: 'active' };
}

/** Jump to a specific step index (clamped). Re-activates a done session. */
export function gotoIndex(s: HandoverSession, i: number): HandoverSession {
  const cursor = Math.max(0, Math.min(i, s.steps.length - 1));
  return { ...s, cursor, status: 'active' };
}

/** Steps not yet visited (after the cursor) — for a "what's left" summary. */
export function remainingSteps(s: HandoverSession): HandoverStep[] {
  return s.steps.slice(Math.max(0, s.cursor + 1));
}

/** Find the step a free-text query names — exact path, then basename, then a
 *  path/basename substring. -1 when nothing matches. Mirrors the iterative
 *  agent's whole-token file matching so "auth.ts" picks `src/auth.ts`. Accepts
 *  anything with a `path` so the intent parser can reuse it on plan previews. */
export function findStepIndex(steps: Array<{ path: string }>, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return -1;
  const base = (p: string) => p.split('/').pop() ?? p;
  const byExact = steps.findIndex((s) => s.path.toLowerCase() === q);
  if (byExact >= 0) return byExact;
  const byBase = steps.findIndex((s) => base(s.path).toLowerCase() === q);
  if (byBase >= 0) return byBase;
  // Substring fallback — only for a reasonably specific query (avoid matching "s").
  if (q.length >= 3) {
    const bySub = steps.findIndex((s) => s.path.toLowerCase().includes(q) || q.includes(base(s.path).toLowerCase()));
    if (bySub >= 0) return bySub;
  }
  return -1;
}
