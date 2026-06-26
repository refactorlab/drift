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
import type { ChatTurn } from '../core/chatContext';
import { logger } from '../core/debug';

const log = logger('handover');
import { buildHandoverPlan, formatHandoverPlan } from './handoverPlan';
import {
  analyzeDiff,
  syntheticAddedDiff,
  buildSections,
  buildSymbolSections,
  parseHunkNotes,
  buildPresentBeats,
  buildOverviewBeat,
  TEXT_WPM,
  VOICE_WPM,
  type PresentBeat,
  type PresentSection,
  type DiffHunk,
  type FilePresentation,
  type FileOverview,
  type FileSymbol,
} from './scrollPlan';
import { asScanOutput } from '../core/scanOutput';
import { parseHandoverIntent } from '../core/handoverIntent';
import { getPrFile } from '../state/prFileStore';
import { buildFileCorrelation, correlationContext, composeOverview, changeVerb } from './fileBriefing';
import { runLevel1Agent, runLevel2Agent, summaryStatus } from './overviewAgents';
import { collectFileDiff } from './changeCollector';
import { summarizeChange } from './changeSummary';
import { tightenDescription } from './descriptionQuality';
import { DEEP_DIVE_SYSTEM, buildDeepDivePrompt, deepDiveOverview, parseDeepDiveAnswer, rankSectionsByQuery } from './deepDive';
import { buildRiskBrief, formatRiskBrief } from './riskBrief';

/** Cap the symbol menu shown to the model (token budget). */
const MAX_SYMBOL_MENU = 40;

/** Whole-file tree-sitter roots (no useful "spot"). */
const MODULE_KINDS = new Set(['module', 'program', 'source_file', 'translation_unit']);

/** The changed file's tree-sitter symbols from the scan's `pr_symbols`, or []. Match
 *  is exact first, then a PATH-BOUNDARY-safe suffix (the leading "/" stops
 *  "voicePrompt.ts" from matching "…/voicePrompt.test.ts" or vice-versa, and a bare
 *  basename from matching many files). */
function symbolsForPath(rec: ScanRecord, path: string): FileSymbol[] {
  const list = asScanOutput(rec.scan)?.pr_symbols ?? [];
  const hit =
    list.find((f) => f.path === path) ??
    list.find((f) => f.path.endsWith('/' + path) || path.endsWith('/' + f.path));
  // Drop SYNTHETIC tree-sitter nodes — the whole-file root (`<module>`) and unnamed
  // closures (`<anonymous@23>`). They make useless section labels ("The function
  // <anonymous@70>") and pollute the Level-2 "Defines …" list; only real, namable symbols
  // are useful spots. (`<…>` covers both; MODULE_KINDS catches a named file root.)
  return (hit?.symbols ?? []).filter((s) => !s.name.startsWith('<') && !MODULE_KINDS.has(s.kind));
}
import {
  getHandoverSession,
  setHandoverSession,
  clearHandoverSession,
  currentStep,
  advance,
  prev,
  gotoIndex,
  deepen,
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
  runScrollPlanThroughFile,
  diffAnchor,
  type ActiveTabLocation,
  type NavResult,
} from '../core/prNavigate';

/** The Level-3 ANNOTATOR prompt. The SECTIONS are always built deterministically (hunks or
 *  symbols), so the model NEVER picks a spot — it only ANNOTATES each fixed `[H<n>]` with a
 *  plain-words note. Level 1 + Level 2 are NOT produced here: two dedicated agents
 *  (overviewAgents.ts) own those, so the model isn't splitting attention between the
 *  overview and the per-spot notes (the cause of the useless Level 1/2 lines). */
const PRESENT_SYSTEM =
  'You are annotating the key SPOTS of ONE file in a pull request. Each spot is tagged `[H<n>]` with its code (a diff shows − removed / + added lines). Reply with ONE line per tag, IN ORDER and nothing else:\n' +
  '[H0] <in PLAIN WORDS, what spot 0 does and the single thing to verify>\n' +
  '[H1] <…>\n' +
  'one `[H<n>]` line for EVERY tag. Name the real functions/types (NOT just the symbol name). No preamble, no markdown, no bullets, no code fences.';

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
  /** For a file step: the clickable presentation beats (line ranges + labels) so the
   *  chat can render breathing buttons that replay the scroll+highlight from a spot. */
  presentation?: FilePresentation;
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

/** The grounded risk brief that LEADS the handover — the scan's act-before-merge items,
 *  critical metrics and impact-ranked findings, surfaced BEFORE the file plan so the reviewer
 *  knows what's at stake going in (and so those act-before items frame WHY the plan orders
 *  files the way it does). Emitted VERBATIM from the deterministic brief — the exact, grounded
 *  text `explain_risk` produces, never the model's — so the walkthrough opens on real signals
 *  rather than a confabulated "looks fine". Null when the payload isn't a scan (skip silently). */
function riskLead(rec: ScanRecord): { content: string; spoken: string } | null {
  const brief = buildRiskBrief(rec.scan);
  return brief ? formatRiskBrief(brief) : null;
}

/** Prepend the OVERVIEW lead beat (the Level 1 + Level 2 top-of-file sweep) to the change
 *  beats, sweeping down to the first change. `leadText` is the intro header shown above the
 *  box — its reading time is folded into the start dwell. Empty in → empty out. */
function withOverviewBeat(overview: FileOverview, changeBeats: PresentBeat[], wpm: number, leadText: string): PresentBeat[] {
  if (!changeBeats.length) return [];
  return [buildOverviewBeat(overview, changeBeats[0].startLine, wpm, leadText), ...changeBeats];
}

/** Cap a code reference shown to the model (token budget). */
const capRef = (s: string): string => (s.length > 700 ? `${s.slice(0, 700)}\n…` : s);

/** Render the deterministic sections as the numbered `[H<n>]` spot list the model
 *  annotates — shared by the walkthrough and the deep dive. */
const listSpots = (sections: PresentSection[]): string =>
  sections.map((s, i) => `[H${i}] ${s.label} (lines ${s.startLine}-${s.endLine}):\n${capRef(s.ref)}`).join('\n\n');

/** What a file's diff/symbols resolve to — the SHARED grounding both the walkthrough and
 *  the deep dive build on. `ok:false` means there's genuinely nothing to show (re-scan). */
interface FileSections {
  ok: boolean;
  file: Awaited<ReturnType<typeof getPrFile>>;
  symbols: FileSymbol[];
  sections: PresentSection[];
}

/** Load a file from the scan cache and turn it into deterministic walkthrough sections —
 *  the changed HUNKS (anchored on real changed lines), else its top SYMBOLS, else a
 *  synthetic diff from its content. Never invents: with no diff/symbols/content, ok:false.
 *  ONE source of truth so the walkthrough and the deep dive ground identically. */
async function loadFileSections(input: HandoverTurnInput, step: HandoverStep): Promise<FileSections> {
  const file = await getPrFile(input.rec.url, input.rec.sha, step.path).catch(() => null);
  // Two independent anchors: the tree-sitter symbol map (exact spans + names) and the
  // numbered diff. EITHER alone is enough — a missing diff cache OR an unsupported
  // language can't suppress the walkthrough.
  const symbols = symbolsForPath(input.rec, step.path).slice(0, MAX_SYMBOL_MENU);
  // Ground on the REAL per-file diff: the scan cache, else COLLECTED from GitHub's `.diff`
  // when the cache dropped this file (a key file on a big PR, an evicted sha). Without it
  // the walkthrough had no before/after and every Level-3 note degraded to "Change in X".
  const realDiff = file?.diff?.trim()
    ? file.diff
    : await collectFileDiff({ pr: input.pr, url: input.rec.url, sha: input.rec.sha, path: step.path, signal: input.signal });
  // Only when there's no real diff at all do we synthesize an all-added diff from the file's
  // CONTENT — a NEW file is ENTIRELY its change — so we still anchor on real lines, NEVER on
  // the model's guess of what a file named X contains.
  const diffText = realDiff || (file?.content?.trim() ? syntheticAddedDiff(file.content) : '');
  const { hunks } = diffText ? analyzeDiff(diffText) : { hunks: [] as DiffHunk[] };
  log(`sections ${step.path}: ${symbols.length} symbol(s), ${hunks.length} hunk(s), diff=${!!realDiff}, content=${!!file?.content}`);
  if (!symbols.length && !hunks.length) return { ok: false, file, symbols, sections: [] };
  // A real diff (cached or collected) → the changed HUNKS; else top SYMBOLS (code shown so
  // the model can describe it); else the synthetic hunks. Anonymous/file-node symbols are
  // already filtered out.
  const sections =
    realDiff && hunks.length ? buildSections(hunks, symbols) : symbols.length ? buildSymbolSections(symbols, file?.content ?? '') : buildSections(hunks, symbols);
  return { ok: true, file, symbols, sections };
}

/**
 * Build the LIVE PRESENTATION for a file as a 3-LEVEL playbook: an OVERVIEW (Level 1 =
 * the PR's change to this file + its role in the flow, Level 2 = what the file does)
 * ABOVE the per-change SECTIONS (Level 3). Turned into scroll-and-highlight beats paced
 * to how long each note reads/speaks. With no diff/symbols/content, it says so honestly.
 */
async function buildPresentation(
  input: HandoverTurnInput,
  step: HandoverStep,
  leadText: string,
): Promise<{ content: string; beats: PresentBeat[]; overview?: FileOverview }> {
  const wpm = input.mode === 'voice' ? VOICE_WPM : TEXT_WPM;
  const { ok, symbols, sections } = await loadFileSections(input, step);
  // No symbols, no diff, AND no readable content → say so HONESTLY rather than let the
  // small model invent functions that aren't there.
  if (!ok) {
    return {
      content: `I couldn't read the changes in ${basename(step.path)} from the scan cache — re-scan the PR and I'll walk you through it.`,
      beats: [],
    };
  }

  // THREE focused generations, run STRICTLY SEQUENTIALLY (one model pass at a time — never
  //  concurrent, to stay light on GPU/CPU/memory):
  //   1. the ANNOTATOR — one `[H<n>]` note per fixed spot (Level 3).
  //   2. the LEVEL 1 AGENT — what the PR does here + the file's role (Level 1).
  //   3. the LEVEL 2 AGENT — what the file is responsible for (Level 2).
  //  The FILE-SCOPED correlation (key `why`, the area it lives under, its own symbols in the
  //  delta) gives Level 1 its architectural role — never the whole-PR theme. The changed
  //  CODE is the single grounding both agents and the annotator share.
  const correlation = buildFileCorrelation(input.rec, step, symbols);
  const context = correlationContext(correlation);
  const code = listSpots(sections);

  const annotatorMsg: ChatTurn[] = [
    { role: 'system', content: PRESENT_SYSTEM },
    { role: 'user', content: `File ${step.path}. Annotate each numbered spot, in order.\n\n${code}` },
  ];
  const raw = (await input.brain.generate(annotatorMsg, { signal: input.signal }).catch(() => '')).trim();
  // Level 3: the model's annotation per spot, or — only if it skipped one — the spot's own
  // signature / first changed line (never a bare "The function X").
  const notes = parseHunkNotes(raw);
  const segs = sections.map((s, i) => ({ ...s, note: notes.get(i) || summarizeChange(s.ref, s.label) }));

  // Level 1 then Level 2 — two dedicated agents, SEQUENTIAL, each surfacing what's running.
  const agentInput = { brain: input.brain, signal: input.signal, path: step.path, verb: changeVerb(step.code), context, code };
  input.onProgress(summaryStatus(1));
  const level1 = await runLevel1Agent(agentInput);
  input.onProgress(summaryStatus(2));
  const level2 = await runLevel2Agent(agentInput);
  // Compose: the agents' words, gated for quality, with the grounded fallback for any gap.
  const overview = composeOverview(level1, level2, step, correlation, symbols);

  // Lead with an OVERVIEW beat: while Level 1 + Level 2 are read, the page starts at the
  // TOP of the file and slow-scrolls (reading-speed paced) down to the first change — THEN
  // the change beats take over. The overview's reading time is now its OWN timeline segment
  // (no longer hidden inside the first change's dwell), so the timeline reflects it, and the
  // chat clock + in-page scroller consume the SAME beats so they stay in lockstep.
  const beats = withOverviewBeat(overview, buildPresentBeats(segs, wpm), wpm, leadText);

  log(`present ${step.path}: → ${beats.length} beat(s) [${beats.map((b) => b.label).join(', ')}]`);
  // The content is what voice SPEAKS (and what a beat-less message shows). It must carry
  // ALL THREE levels, in order: Level 1 (the PR's change to this file) + Level 2 (what the
  // file does) + the Level-3 section notes. Level 2 was being dropped here — so the TTS
  // never read "what the file does" even though it's shown visually, AND it drifted the
  // scroll: beat 0's dwell ALREADY reserves the reading time for `prChange + purpose`
  // (above), so omitting purpose from the audio left the highlight running ahead of the voice.
  const overviewText = [overview.prChange, overview.purpose].filter(Boolean).join('\n\n');
  const content = `${overviewText}\n\n${segs.map((s) => `${s.label} — ${s.note}`).join('\n')}`;
  return { content, beats, overview };
}

/**
 * Build a DEEP DIVE on the CURRENT file: a focused, repeatable sub-timeline driven by the
 * reviewer's question. Reuses the SAME grounding as the walkthrough (loadFileSections), but
 * RANKS the sections by relevance to the question and frames the reply as an ANSWER over
 * the few that matter. Each call is independent on the same file, so the reviewer goes
 * deeper and deeper. With nothing readable, it says so rather than fabricate.
 */
async function buildDeepDive(
  input: HandoverTurnInput,
  step: HandoverStep,
  query: string,
  depth: number,
  leadText: string,
): Promise<{ content: string; beats: PresentBeat[]; overview?: FileOverview }> {
  const wpm = input.mode === 'voice' ? VOICE_WPM : TEXT_WPM;
  const { ok, symbols, sections } = await loadFileSections(input, step);
  if (!ok) {
    return { content: `I couldn't read ${basename(step.path)} to dig deeper — re-scan the PR and ask again.`, beats: [] };
  }
  // Focus on the spots most relevant to the question (all of them for a generic "deeper").
  const focused = rankSectionsByQuery(sections, query);
  const messages: ChatTurn[] = [
    { role: 'system', content: DEEP_DIVE_SYSTEM },
    { role: 'user', content: buildDeepDivePrompt(step, query, listSpots(focused)) },
  ];
  const raw = (await input.brain.generate(messages, { signal: input.signal }).catch(() => '')).trim();

  const correlation = buildFileCorrelation(input.rec, step, symbols);
  const overview = deepDiveOverview(tightenDescription(parseDeepDiveAnswer(raw), { maxSentences: 3 }), step, correlation, symbols, depth);
  const notes = parseHunkNotes(raw);
  const segs = focused.map((s, i) => ({ ...s, note: notes.get(i) || summarizeChange(s.ref, s.label) }));

  // Same overview-led timeline as the walkthrough: a top-of-file slow sweep while the
  // ANSWER (Level 1) + role (Level 2) are read, then the focused spots.
  const beats = withOverviewBeat(overview, buildPresentBeats(segs, wpm), wpm, leadText);
  log(`deepdive ${step.path} (depth ${depth}): → ${beats.length} beat(s) for "${query.slice(0, 40)}"`);
  const overviewText = [overview.prChange, overview.purpose].filter(Boolean).join('\n\n');
  const content = `${overviewText}\n\n${segs.map((s) => `${s.label} — ${s.note}`).join('\n')}`;
  return { content, beats, overview };
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

  // ── DEEPER (a focused, REPEATABLE dive on the CURRENT file, driven by a question) ──
  if (intent.kind === 'deeper') {
    const step = currentStep(session);
    if (!step) {
      await persist(session);
      return {
        content: `We're still at the overview — say "next" (or name a file) to open one, then ask me to go deeper.`,
        summary: 'Pick a file first',
        handoverActive: true,
      };
    }
    session = deepen(session, intent.query); // bumps per-file depth (resets when files change)
    const depth = session.focus?.depth ?? 1;
    // Keep the reviewer on this file (they may have scrolled away during questions).
    const already = loc?.onThisPr && loc.anchor === step.anchor;
    const nav: NavResult = already
      ? { ok: true }
      : (onProgress(`opening ${step.path}…`), await navigateToPrFile(pr, step.path, { anchorId: step.anchor }));
    await persist(session);

    // Intro header up front so its reading time folds into the start dwell (same beats power
    // the in-page scroll + the chat clock — no drift).
    const intro = `Deeper on ${step.path} — depth ${depth}`;
    onProgress(`digging deeper into ${step.path}…`);
    const { content: explanation, beats, overview } = await buildDeepDive(input, step, intent.query, depth, intro).catch(() => ({
      content: `(Couldn't dig into ${step.path}.)`,
      beats: [] as PresentBeat[],
      overview: undefined as FileOverview | undefined,
    }));

    // A NEW focused timeline on the same file — the reviewer can keep asking to go deeper.
    let presentation: HandoverTurnResult['presentation'];
    if (nav.ok && beats.length) {
      const anchorId = step.anchor ?? (await diffAnchor(step.path));
      if (input.mode !== 'voice') void runScrollPlanThroughFile(anchorId, step.path, beats, 'text');
      presentation = { path: step.path, anchorId, beats, startedAt: Date.now(), overview };
    }
    const proceed = `Ask another question to go deeper, or say "next" to move on.`;
    if (presentation) {
      presentation.intro = intro;
      presentation.outro = proceed;
    }
    return {
      content: `${explanation}\n\n${proceed}`,
      summary: `Deeper · ${basename(step.path)} (#${depth})`,
      handoverActive: true,
      presentation,
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
    // Lead with the grounded risk brief so the walkthrough opens on what's at stake — the
    // act-before-merge items + critical metrics — THEN the file-by-file plan to work through it.
    const risk = riskLead(rec);
    const content =
      `${here}${viewing ? ` You're currently viewing ${viewing.path}.` : ''}\n\n` +
      `${risk ? `${risk.content}\n\n` : ''}` +
      `Here's the review plan — highest-level changes first, down to the routine ones:\n\n` +
      `${formatHandoverPlan(session.steps, omitted, 8)}\n\n` +
      `We'll go file by file and I'll pause after each. First up: ${first.path} — ${first.rationale}. ` +
      `Say "next" to open it (or name any file to jump there).`;
    // Voice can't bear hearing the whole list — speak the condensed risk line + a one-liner.
    const spoken =
      `${here} ${risk ? `${risk.spoken} ` : ''}I've lined up ${total} file(s), most critical first. ` +
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

  // The intro header (also the timeline's start text) — computed BEFORE the presentation so
  // its reading time is folded into the overview beat's dwell and the SAME beats power both
  // the in-page scroll and the chat clock (no drift). See buildOverviewBeat's `leadText`.
  const idxHuman = moved.cursor + 1;
  const navNote = already
    ? `You're viewing ${step.path}`
    : nav.ok
      ? `Opened ${step.path}`
      : `(Couldn't move the tab: ${nav.reason}.) ${step.path}`;
  const intro = `${navNote} — file ${idxHuman} of ${total} (${step.tier})`;

  onProgress(`reviewing ${step.path}…`);
  const { content: explanation, beats, overview } = await buildPresentation(input, step, intro).catch(() => ({
    content: `(Couldn't read ${step.path}.)`,
    beats: [] as PresentBeat[],
    overview: undefined as FileOverview | undefined,
  }));

  // LIVE-PRESENT the file: scroll to + HIGHLIGHT each important spot in turn, pausing
  // on each for as long as its note reads (text) / speaks (voice) — like a guided
  // walkthrough. Fire-and-forget (runs in the page; cancels the moment the reviewer
  // scrolls/keys/touches, so it presents but never fights them). The SAME beats power
  // the message's clickable buttons (replay the presentation from any spot).
  let presentation: HandoverTurnResult['presentation'];
  if (nav.ok && beats.length) {
    const anchorId = step.anchor ?? (await diffAnchor(step.path));
    // TEXT mode: drive the page scroll here, paced to reading speed. VOICE mode: the
    // PANEL drives the scroll from ACTUAL TTS playback (per spoken sentence) so it
    // tracks the voice — don't also run the wpm-paced page timer (it would race ahead).
    if (input.mode !== 'voice') void runScrollPlanThroughFile(anchorId, step.path, beats, 'text');
    // Stamp when the walkthrough began so the chat's active-beat highlight can re-sync
    // to the spot the page is already on (the reply bubble may render a moment later).
    presentation = { path: step.path, anchorId, beats, startedAt: Date.now(), overview };
  }

  const next = moved.steps[moved.cursor + 1];
  const proceed = next
    ? `Proceed to ${next.path}? — say "next", jump to any file, or "stop".`
    : `This is the last file (${idxHuman}/${total}). Say "next" to finish, or revisit any file.`;

  // Carry the framing on the presentation so the chat renders the structured view:
  // intro header + inline section list (the beats) + outro footer.
  if (presentation) {
    presentation.intro = intro;
    presentation.outro = proceed;
  }

  return {
    content: `${intro}.\n\n${explanation}\n\n${proceed}`,
    summary: `File ${idxHuman}/${total}: ${basename(step.path)}`,
    handoverActive: true,
    presentation,
  };
}
