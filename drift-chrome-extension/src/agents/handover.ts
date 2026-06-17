// The PR-handover ORCHESTRATOR — one walkthrough turn. Given the user's control
// utterance (start / next / prev / goto / resume / status / stop) it:
//   1. loads or (re)builds the tiered plan + cursor (handoverSession, bound to the
//      scanned head sha so it rebuilds when the PR moves),
//   2. DRIVES THE BROWSER to the changes overview (start) or a file's diff anchor
//      (prNavigate) — noting where the reviewer already is,
//   3. EXPLAINS the file with the grounded iterative agent (one file, the cached
//      diff), and
//   4. stops with "proceed?" so the reviewer stays in control.
//
// It returns the user-facing text + whether a session still exists; the chatTools
// `pr_handover_mode` tool is a thin wrapper that feeds `rec` in and surfaces this.

import type { BrainRuntime } from '../core/brainRuntime';
import type { ScanRecord } from '../state/scanHistory';
import type { PrId } from '../core/prRefs';
import { buildArchitectureOverview } from './architecture';
import { runIterativeAgent, type IterativeLens } from './iterative-agent';
import { buildHandoverPlan, formatHandoverPlan } from './handoverPlan';
import { parseHandoverIntent } from '../core/handoverIntent';
import {
  getHandoverSession,
  setHandoverSession,
  clearHandoverSession,
  currentStep,
  advance,
  prev,
  gotoIndex,
  isDone,
  remainingSteps,
  findStepIndex,
  type HandoverSession,
  type HandoverStep,
} from '../state/handoverSession';
import {
  navigateToPrChanges,
  navigateToPrFile,
  locateActiveTab,
  attachAnchors,
  guideScrollThroughFile,
  estimateReadingMs,
  diffAnchor,
  TEXT_WPM,
  VOICE_WPM,
  type ActiveTabLocation,
  type NavResult,
} from '../core/prNavigate';

/** The task lens for a single walkthrough step — a tight, screen-oriented review
 *  of ONE file (the iterative agent grounds it in that file's cached diff). */
const HANDOVER_LENS: IterativeLens = {
  instruction:
    'Give a guided code-review walkthrough of ONE changed file. In 3–5 sentences explain what this file changes and what the reviewer is looking at on screen — the key hunks, why the change matters, and what to check. Be concrete (name functions/exports/types). No preamble; do not restate the file path.',
  answerFormat: 'Plain prose, 3–5 sentences. End with the single most important thing to verify in this file.',
};

export interface HandoverTurnInput {
  pr: PrId;
  /** The PR web URL (session + scan key). */
  url: string;
  /** The latest scan for this PR (plan source + file reads + architecture map). */
  rec: ScanRecord;
  /** The user's control utterance for this turn. */
  userText: string;
  brain: BrainRuntime;
  signal: AbortSignal;
  onProgress: (note: string) => void;
  /** Typed vs spoken — paces the guided scroll (reading vs TTS speed). */
  mode?: 'text' | 'voice';
}

export interface HandoverTurnResult {
  /** The user-facing text — shown verbatim (the full plan / explanation). */
  content: string;
  /** A CONDENSED variant for text-to-speech, when `content` is long (the start plan
   *  lists every file — fine to read, painful to hear). Voice speaks this; text
   *  always shows `content`. Omitted when `content` is already speech-sized. */
  spoken?: string;
  /** Short label for the tool-step card. */
  summary: string;
  /** A session exists after this turn (false only after "stop"). */
  handoverActive: boolean;
}

const basename = (p: string): string => p.split('/').pop() ?? p;

/** The plan file (if any) whose diff the reviewer's tab is currently showing. */
function currentlyViewing(steps: HandoverStep[], loc: ActiveTabLocation | null): HandoverStep | null {
  return loc?.anchor ? (steps.find((s) => s.anchor === loc.anchor) ?? null) : null;
}

function planHint(session: HandoverSession): string {
  const names = session.steps.slice(0, 6).map((s) => basename(s.path));
  const more = session.steps.length > names.length ? `, +${session.steps.length - names.length} more` : '';
  return `The plan covers: ${names.join(', ')}${more}. Name one to jump to it.`;
}

/** Run the grounded per-file explanation (one file, the cached diff). */
async function explainStep(input: HandoverTurnInput, step: HandoverStep): Promise<string> {
  const { answer } = await runIterativeAgent({
    brain: input.brain,
    question: `Walk me through the changes in ${step.path}.`,
    architecture: buildArchitectureOverview(input.rec),
    url: input.rec.url,
    sha: input.rec.sha,
    files: [{ path: step.path, status: step.code }],
    maxFiles: 1,
    signal: input.signal,
    onProgress: input.onProgress,
    lens: HANDOVER_LENS,
  });
  return answer.trim();
}

const persist = (s: HandoverSession): Promise<void> => setHandoverSession(s).catch(() => {});

/** Run one handover turn. Never throws for the empty/abort case. */
export async function runHandoverTurn(input: HandoverTurnInput): Promise<HandoverTurnResult> {
  const { pr, url, rec, userText, onProgress } = input;

  // 1. Load or (re)build the session, bound to the scanned head sha.
  let session = await getHandoverSession(url).catch(() => null);
  if (!session || session.sha !== rec.sha || !session.steps.length) {
    onProgress('building the walkthrough plan…');
    session = {
      prUrl: url,
      sha: rec.sha,
      steps: await attachAnchors(buildHandoverPlan(rec)),
      cursor: -1,
      status: 'active',
      startedAt: Date.now(),
    };
  }
  const total = session.steps.length;
  const omitted = Math.max(0, (rec.changedFiles ?? total) - total);

  // 2. Decide the action (default by position: fresh → start, else resume).
  const intent = parseHandoverIntent(userText, session.steps) ?? { kind: session.cursor < 0 ? 'start' : 'resume' };

  // 3. Where is the reviewer's tab right now? (so we can note "already on changes").
  const loc = await locateActiveTab(pr).catch(() => null);

  // ── STOP ──
  if (intent.kind === 'stop') {
    await clearHandoverSession(url).catch(() => {});
    return {
      content: 'Exited the handover walkthrough. Say "walk me through the PR" to start again.',
      summary: 'Handover ended',
      handoverActive: false,
    };
  }

  // ── STATUS ──
  if (intent.kind === 'status') {
    const cur = currentStep(session);
    const pos = cur ? `You're on file ${session.cursor + 1} of ${total}: ${cur.path}.` : `We're at the overview (${total} files planned).`;
    const rest = remainingSteps(session);
    const list = rest.length ? `\n\nUp next:\n${formatHandoverPlan(rest, 0, 6)}` : '\n\nThat was the last file.';
    await persist(session);
    return {
      content: `${pos}${list}\n\nSay "next" to continue, name a file to jump to, or "stop".`,
      spoken: `${pos} ${rest.length} file(s) left. Say next to continue, or name a file.`,
      summary: `File ${Math.max(0, session.cursor) + 1}/${total}`,
      handoverActive: true,
    };
  }

  // ── START (present the plan; navigate to the overview; wait for "next") ──
  if (intent.kind === 'start') {
    session = { ...session, cursor: -1, status: 'active' };
    const nav: NavResult = loc?.onChangesPage ? { ok: true } : (onProgress('opening the PR changes…'), await navigateToPrChanges(pr));
    await persist(session);
    const here = loc?.onChangesPage
      ? "You're already on the PR's changes page."
      : nav.ok
        ? "I've opened the PR's changes."
        : `(Couldn't move the tab: ${nav.reason}.)`;
    const viewing = currentlyViewing(session.steps, loc);
    const first = session.steps[0];
    const content =
      `${here}${viewing ? ` You're currently viewing ${viewing.path}.` : ''}\n\n` +
      `Here's the review plan — highest-level changes first, down to the routine ones:\n\n` +
      `${formatHandoverPlan(session.steps, omitted, 8)}\n\n` +
      `We'll go file by file and I'll pause after each. First up: ${first.path} — ${first.rationale}. ` +
      `Say "next" to open it (or name any file to jump there).`;
    // Voice can't bear hearing the whole list — speak a one-liner instead.
    const spoken =
      `${here} I've lined up ${total} file(s), most critical first. ` +
      `First up: ${first.path} — ${first.rationale}. Say next to open it, or name any file.`;
    return { content, spoken, summary: `Handover · ${total} file(s)`, handoverActive: true };
  }

  // ── MOVEMENT: next / prev / resume / goto ──
  let moved = session;
  if (intent.kind === 'next') moved = advance(session);
  else if (intent.kind === 'prev') moved = prev(session);
  else if (intent.kind === 'resume') moved = gotoIndex(session, Math.max(0, session.cursor));
  else if (intent.kind === 'goto') {
    const idx = findStepIndex(session.steps, intent.file);
    if (idx < 0) {
      await persist(session);
      return { content: `I don't see "${intent.file}" in this PR's changes. ${planHint(session)}`, summary: 'File not found', handoverActive: true };
    }
    moved = gotoIndex(session, idx);
  }

  // Advanced past the last file → complete (session kept for revisits).
  if (isDone(moved)) {
    await persist(moved);
    return {
      content: `That was the last file — the walkthrough is complete (${total} files). Say "resume" or name a file to revisit, or "stop" to exit.`,
      summary: 'Handover complete',
      handoverActive: true,
    };
  }

  // Navigate to + explain the current step.
  const step = currentStep(moved)!;
  const already = loc?.onThisPr && loc.anchor === step.anchor;
  const nav: NavResult = already ? { ok: true } : (onProgress(`opening ${step.path}…`), await navigateToPrFile(pr, step.path, { anchorId: step.anchor }));
  await persist(moved);

  onProgress(`reviewing ${step.path}…`);
  const explanation = await explainStep(input, step).catch(
    (e) => `(Couldn't read ${step.path}: ${e instanceof Error ? e.message : String(e)}.)`,
  );

  // Guided scroll THROUGH this file, paced to how long the explanation takes to read
  // (text) or speak (voice) — so the diff tracks the delivery and the reviewer sees
  // the whole file. Fire-and-forget (runs in the page; cancels on any manual scroll).
  if (nav.ok) {
    const anchorId = step.anchor ?? (await diffAnchor(step.path));
    const durationMs = estimateReadingMs(explanation, input.mode === 'voice' ? VOICE_WPM : TEXT_WPM);
    void guideScrollThroughFile(anchorId, step.path, durationMs);
  }

  const idxHuman = moved.cursor + 1;
  const navNote = already
    ? `You're viewing ${step.path}`
    : nav.ok
      ? `Opened ${step.path}`
      : `(Couldn't move the tab: ${nav.reason}.) ${step.path}`;
  const next = moved.steps[moved.cursor + 1];
  const proceed = next
    ? `Proceed to ${next.path}? — say "next", jump to any file, or "stop".`
    : `This is the last file (${idxHuman}/${total}). Say "next" to finish, or revisit any file.`;

  return {
    content: `${navNote} — file ${idxHuman} of ${total} (${step.tier}).\n\n${explanation}\n\n${proceed}`,
    summary: `File ${idxHuman}/${total}: ${basename(step.path)}`,
    handoverActive: true,
  };
}
