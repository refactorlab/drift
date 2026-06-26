// The ExplainerDoc — ONE deterministic, serializable description of a PR "deck",
// the data structure every renderer reads (the in-chat <DeckPlayer>, a future
// audio overview, an exported HTML/video). Pure: no LLM, no network, no chrome.
//
// It reuses the SAME scan signals the rest of drift does — buildHandoverPlan for
// the tiered file order, the scan's affected_roots + call-graph delta for scope,
// the parsed verdict for the headline — so the deck never diverges from the scan
// or the handover. The walkthrough is a sequence of typed slides; narration is a
// two-host script (A/B) so an audio overview and the on-screen captions share one
// source. AI review QUESTIONS are left as empty slots here and filled later by the
// lens agents (see chatTools `summary_presentation_deck`), keeping this module pure + testable.

import type { ScanRecord } from '../state/scanHistory';
import type { Verdict } from '../core/types';
import type { HandoverStep, HandoverTier } from '../state/handoverSession';
import { asScanOutput } from '../core/scanOutput';
import { buildHandoverPlan } from './handoverPlan';
import { isTest, isSource, isApiSurface } from './lenses';
import type { FileGraph } from '../core/changeImpactGraph';

/** Spoken words-per-minute used to pace each slide's dwell from its narration. */
export const DECK_VOICE_WPM = 150;
/** Default number of per-file deep-dive slides (critical/core first). */
export const DEFAULT_MAX_FILE_SLIDES = 4;

export type SlideKind = 'overview' | 'file' | 'graph' | 'mindmap' | 'critique';
export type Severity = 'critical' | 'important' | 'context';
export type Host = 'A' | 'B';

/** One line of the two-host narration (A and B alternate, NotebookLM-style). */
export interface NarrationLine {
  who: Host;
  text: string;
}

/** An AI-generated review question surfaced on a slide. Filled by the lens agents;
 *  empty in the pure builder. `answer`/`cites` populate when the reviewer drills in. */
export interface DeckQuestion {
  severity: Severity;
  text: string;
  /** File the question is about, shown as a pill. */
  file?: string;
  /** Grounded answer (lazy — generated when expanded). */
  answer?: string;
  /** Suggested fix / next action. */
  fix?: string;
  /** Source artifacts/files the answer is grounded in (NotebookLM-style citations). */
  cites?: string[];
}

/** A subsystem row on the scope (mindmap) slide. */
export interface DeckSubsystem {
  root: string;
  files: number;
  loc: number;
  questions: number;
  coverage: 'covered' | 'untested' | 'none';
}

/** A judgment item on the critique slide. */
export interface CritiqueItem {
  kind: 'good' | 'risk' | 'miss';
  title: string;
  detail: string;
}

export interface DeckSlide {
  kind: SlideKind;
  /** Short uppercase label, e.g. "FILE 2 / 26 · CRITICAL". */
  eyebrow: string;
  title: string;
  /** Seconds this slide dwells, derived from its narration length. */
  durationSec: number;
  narration: NarrationLine[];
  /** Present on 'file' slides. */
  path?: string;
  tier?: HandoverTier;
  additions?: number;
  deletions?: number;
  questions?: DeckQuestion[];
  subsystems?: DeckSubsystem[];
  critique?: CritiqueItem[];
  /** File-scoped change-impact graph, attached by the summary_presentation_deck tool
   *  (kept off the pure builder so this module stays free of scan-graph deps). */
  graph?: FileGraph;
}

export interface ExplainerDoc {
  prTitle: string;
  verdict: Verdict;
  verdictLabel: string;
  fileCount: number;
  slides: DeckSlide[];
  /** Sum of slide durations (seconds) — the deck's run length. */
  totalSec: number;
}

export interface BuildDeckOpts {
  maxFileSlides?: number;
}

const TIER_LABEL: Record<HandoverTier, string> = {
  critical: 'CRITICAL',
  core: 'CORE',
  support: 'SUPPORT',
  minor: 'MINOR',
};

const basename = (p: string): string => p.split('/').pop() || p;

/** Words across all narration lines → a paced dwell (min 6s so nothing flashes). */
function dwellFor(narration: NarrationLine[]): number {
  const words = narration.reduce((n, l) => n + l.text.trim().split(/\s+/).filter(Boolean).length, 0);
  return Math.max(6, Math.round((words / DECK_VOICE_WPM) * 60));
}

function slide(partial: Omit<DeckSlide, 'durationSec'>): DeckSlide {
  return { ...partial, durationSec: dwellFor(partial.narration) };
}

/** Does `path` sit under `root` (equal or directory-prefixed)? */
function underRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(root.endsWith('/') ? root : `${root}/`);
}

/** Group the changed files into subsystem rows for the scope slide. Uses the
 *  scan's affected_roots when present, else the top two path segments. Pure. */
function buildSubsystems(steps: HandoverStep[], roots: string[]): DeckSubsystem[] {
  const groupOf = (path: string): string => {
    const r = roots.find((x) => x && underRoot(path, x));
    if (r) return r;
    const parts = path.split('/');
    return parts.length > 1 ? parts.slice(0, parts.length > 2 ? 2 : 1).join('/') : path;
  };

  const groups = new Map<string, HandoverStep[]>();
  for (const s of steps) {
    const g = groupOf(s.path);
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(s);
  }

  const rows: DeckSubsystem[] = [];
  for (const [root, members] of groups) {
    const hasSource = members.some((m) => isSource(m.path) || isApiSurface(m.path));
    const hasTest = members.some((m) => isTest(m.path));
    rows.push({
      root,
      files: members.length,
      loc: members.reduce((n, m) => n + m.additions + m.deletions, 0),
      questions: 0,
      coverage: !hasSource ? 'none' : hasTest ? 'covered' : 'untested',
    });
  }
  // Heaviest subsystem first.
  rows.sort((a, b) => b.loc - a.loc || a.root.localeCompare(b.root));
  return rows;
}

/** Deterministic critique seeds from the scan (the lens agents enrich these). */
function buildCritique(steps: HandoverStep[]): CritiqueItem[] {
  const items: CritiqueItem[] = [];
  const sources = steps.filter((s) => isSource(s.path) || isApiSurface(s.path));
  const tests = steps.filter((s) => isTest(s.path));

  if (tests.length) {
    items.push({ kind: 'good', title: 'Tests included', detail: `${tests.length} test file(s) changed alongside the code.` });
  }
  // Source files whose basename has no matching test file in the change set.
  const testedStems = new Set(tests.map((t) => basename(t.path).replace(/\.(test|spec)\./, '.')));
  const untested = sources.filter((s) => !testedStems.has(basename(s.path)));
  if (untested.length) {
    const worst = [...untested].sort((a, b) => b.additions - a.additions)[0];
    items.push({
      kind: 'miss',
      title: 'Untested source changes',
      detail: `${untested.length} source file(s) ship without a matching test — e.g. ${basename(worst.path)} (+${worst.additions}).`,
    });
  }
  const biggest = [...steps].sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))[0];
  if (biggest) {
    items.push({
      kind: 'risk',
      title: 'Largest change carries the blast radius',
      detail: `${basename(biggest.path)} (+${biggest.additions}/−${biggest.deletions}) is the heaviest file — review it first.`,
    });
  }
  return items;
}

const sevForTier = (t: HandoverTier): Severity => (t === 'critical' ? 'critical' : t === 'core' ? 'important' : 'context');

/** Source/API files with no matching test file in the change set. */
function untestedSources(steps: HandoverStep[]): HandoverStep[] {
  const stems = new Set(steps.filter((s) => isTest(s.path)).map((t) => basename(t.path).replace(/\.(test|spec)\./, '.')));
  return steps.filter((s) => (isSource(s.path) || isApiSurface(s.path)) && !stems.has(basename(s.path)));
}

/** "Resolve before merge" questions for the overview — grounded in scan signals. */
function overviewQuestions(steps: HandoverStep[]): DeckQuestion[] {
  const qs: DeckQuestion[] = [];
  for (const s of untestedSources(steps).slice(0, 2)) {
    qs.push({ severity: 'critical', text: `${basename(s.path)} adds +${s.additions} with no matching test — which paths are exercised?`, file: s.path, cites: [s.path] });
  }
  const top = steps.find((s) => s.tier === 'critical') ?? steps[0];
  if (top) qs.push({ severity: sevForTier(top.tier), text: `What could break downstream from ${basename(top.path)}? ${top.rationale}.`, file: top.path, cites: [top.path] });
  return qs.slice(0, 3);
}

/** Per-file comprehension questions for a file slide. */
function fileQuestions(s: HandoverStep, untested: Set<string>): DeckQuestion[] {
  const qs: DeckQuestion[] = [];
  if (untested.has(s.path)) {
    qs.push({ severity: 'critical', text: `No test covers ${basename(s.path)} — add coverage for its main paths before merge.`, file: s.path, cites: [s.path] });
  }
  qs.push({ severity: sevForTier(s.tier), text: `What's the one thing to verify here? ${s.rationale}.`, file: s.path, cites: [s.path] });
  return qs;
}

/**
 * Build the deck doc for a scan record. Pure — deterministic from the record.
 * Slides: overview → top file deep-dives → change-impact graph (if the scan has
 * one) → scope mindmap → critique.
 */
export function buildExplainerDoc(rec: ScanRecord, opts: BuildDeckOpts = {}): ExplainerDoc {
  const maxFileSlides = opts.maxFileSlides ?? DEFAULT_MAX_FILE_SLIDES;
  const scan = asScanOutput(rec.scan);
  const steps = buildHandoverPlan(rec);
  const prTitle = rec.title || 'This pull request';
  const verdict: Verdict = rec.report?.verdict ?? 'unknown';
  const verdictLabel = rec.report?.verdictLabel ?? '';
  const fileCount = rec.changedStatus?.length ?? rec.changedFiles ?? steps.length;

  const untestedPaths = new Set(untestedSources(steps).map((s) => s.path));
  const roots = (scan?.pr_scope?.affected_roots ?? []).filter(Boolean);
  const graphNodes = scan?.pr_review?.architecture_flow?.diff_merged_structured?.nodes ?? [];
  const changedNodes = graphNodes.filter((n) => n.class === 'added' || n.class === 'changed' || n.class === 'removed');

  const slides: DeckSlide[] = [];

  // 1) Overview
  const verdictSentence = verdictLabel ? `Verdict: ${verdictLabel}.` : 'No verdict was recorded.';
  const focusFile = steps[0];
  slides.push(
    slide({
      kind: 'overview',
      eyebrow: `OVERVIEW · ${fileCount} FILES`,
      title: prTitle,
      narration: [
        { who: 'A', text: `${fileCount} files changed in this PR.` },
        { who: 'B', text: verdictSentence },
        ...(focusFile ? [{ who: 'A' as Host, text: `We open with ${basename(focusFile.path)} — ${focusFile.rationale.toLowerCase()}.` }] : []),
      ],
      questions: overviewQuestions(steps),
    }),
  );

  // 2) Per-file deep dives (critical/core first; fall back to whatever exists)
  const fileSteps = (steps.filter((s) => s.tier === 'critical' || s.tier === 'core').length
    ? steps.filter((s) => s.tier === 'critical' || s.tier === 'core')
    : steps
  ).slice(0, maxFileSlides);

  fileSteps.forEach((s, i) => {
    slides.push(
      slide({
        kind: 'file',
        eyebrow: `FILE ${i + 1} / ${fileCount} · ${TIER_LABEL[s.tier]} · +${s.additions} / −${s.deletions}`,
        title: basename(s.path),
        path: s.path,
        tier: s.tier,
        additions: s.additions,
        deletions: s.deletions,
        narration: [
          { who: 'B', text: `${basename(s.path)} — ${TIER_LABEL[s.tier].toLowerCase()}, plus ${s.additions} minus ${s.deletions}.` },
          { who: 'A', text: `${s.rationale}.` },
        ],
        questions: fileQuestions(s, untestedPaths),
      }),
    );
  });

  // 3) Change-impact graph (only when the scan actually has a call graph)
  if (changedNodes.length) {
    slides.push(
      slide({
        kind: 'graph',
        eyebrow: 'CHANGE-IMPACT',
        title: 'The blast radius, drawn',
        narration: [
          { who: 'A', text: `Here's how the change ripples through the codebase.` },
          { who: 'B', text: `${changedNodes.length} symbol(s) changed; the edges are real call relationships.` },
        ],
      }),
    );
  }

  // 4) Scope mindmap
  const subsystems = buildSubsystems(steps, roots);
  if (subsystems.length) {
    const top = subsystems[0];
    slides.push(
      slide({
        kind: 'mindmap',
        eyebrow: 'SCOPE MAP',
        title: 'What moved, by subsystem',
        narration: [
          { who: 'B', text: `Before you read line by line — here's the map by subsystem.` },
          { who: 'A', text: `${top.root} carries the most weight: ${top.files} file(s), ${top.loc} lines changed.` },
        ],
        subsystems,
      }),
    );
  }

  // 5) Critique
  const critique = buildCritique(steps);
  if (critique.length) {
    slides.push(
      slide({
        kind: 'critique',
        eyebrow: 'CRITIQUE',
        title: 'What a senior reviewer would flag',
        narration: [
          { who: 'A', text: `So if your manager skimmed this, what lands?` },
          { who: 'B', text: critique[0].detail },
        ],
        critique,
      }),
    );
  }

  const totalSec = slides.reduce((n, s) => n + s.durationSec, 0);
  return { prTitle, verdict, verdictLabel, fileCount, slides, totalSec };
}
