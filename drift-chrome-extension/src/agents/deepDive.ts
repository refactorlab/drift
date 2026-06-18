// The DEEP DIVE — the pure logic for a focused, REPEATABLE sub-walkthrough of the
// CURRENT handover file, driven by the reviewer's question.
//
// Where the top-level walkthrough (handover.buildPresentation) walks EVERY changed hunk,
// a deep dive answers a SPECIFIC question: it RANKS the file's sections by relevance to
// the question, keeps the few that matter, and frames the reply as an ANSWER (Level 1)
// over those focused spots. The reviewer can keep asking — each call is independent on
// the same file, so they go deeper and deeper.
//
// This module owns only the PURE pieces (ranking, prompt, parse, overview); the
// generation + scroll wiring stays in handover.ts, the one place that does I/O.

import type { HandoverStep } from '../state/handoverSession';
import type { FileCorrelation } from './fileBriefing';
import { fallbackOverview } from './fileBriefing';
import type { FileOverview, FileSymbol, PresentSection } from './scrollPlan';

const basename = (p: string): string => p.split('/').pop() ?? p;

/** The deep-dive generation contract: a direct ANSWER, then one note per focused spot,
 *  the SAME `[H<n>]` annotation shape the top-level walkthrough uses. */
export const DEEP_DIVE_SYSTEM =
  'You are answering a reviewer\'s question about ONE file in a pull request, going deeper than the overview. You are given the question and the most relevant SPOTS, each tagged `[H<n>]` with its code (a diff shows − removed / + added lines). Reply in EXACTLY this shape and nothing else:\n' +
  'ANSWER: <2-3 sentences answering the question, grounded ONLY in the code shown — do not invent>\n' +
  '[H0] <how spot 0 relates to the answer, and the one thing to check>\n' +
  '[H1] <…>\n' +
  '…one `[H<n>]` line for EVERY tag shown, IN ORDER. Plain words, name real functions/types. No preamble, no markdown, no bullets, no code fences.';

/** Split a question into lowercased word tokens worth matching (drops short stopwords). */
function queryTokens(query: string): string[] {
  const STOP = new Set(['the', 'this', 'that', 'what', 'how', 'why', 'does', 'do', 'is', 'are', 'it', 'and', 'for', 'with', 'a', 'an', 'in', 'on', 'of', 'to', 'me', 'about', 'explain', 'tell', 'more', 'here', 'file', 'code', 'change', 'deeper']);
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOP.has(w)),
    ),
  ];
}

/** Rank the file's sections by relevance to the question — a section scores for every
 *  query token that appears in its label, symbol name, or code. The top `keep` matches
 *  are returned (in their ORIGINAL order, so the timeline still reads top-to-bottom). If
 *  NOTHING matches (a generic "go deeper"), all sections pass through unchanged. Pure. */
export function rankSectionsByQuery(sections: PresentSection[], query: string, keep = 3): PresentSection[] {
  const tokens = queryTokens(query);
  if (!tokens.length) return sections;
  const score = (s: PresentSection): number => {
    const hay = `${s.label} ${s.name ?? ''} ${s.ref}`.toLowerCase();
    return tokens.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0);
  };
  const scored = sections.map((s, i) => ({ s, i, score: score(s) }));
  const matched = scored.filter((x) => x.score > 0);
  if (!matched.length) return sections; // generic deepen → keep the whole file
  return matched
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, keep)
    .sort((a, b) => a.i - b.i) // restore reading order
    .map((x) => x.s);
}

/** The user message for a deep-dive generation: the question + the focused spots. */
export function buildDeepDivePrompt(step: HandoverStep, query: string, listedSpots: string): string {
  return `File ${step.path}. The reviewer asks: "${query}"\n\nAnswer the question, then explain each numbered spot in order.\n\n${listedSpots}`;
}

/** Pull the model's `ANSWER:` line (Level 1 for a dive). '' when it gave none. Pure. */
export function parseDeepDiveAnswer(raw: string): string {
  const m = raw.match(/^\s*ANSWER\s*[:\-]\s*(.+?)\s*$/im);
  return m ? m[1].trim() : '';
}

/** The 3-level framing for a deep dive: Level 1 is the ANSWER (or, if the model gave
 *  none, the correlation-grounded change line), Level 2 marks it a depth-N dive and keeps
 *  the file's role. Pure. */
export function deepDiveOverview(
  answer: string,
  step: HandoverStep,
  corr: FileCorrelation,
  symbols: FileSymbol[],
  depth: number,
): FileOverview {
  const fb = fallbackOverview(step, corr, symbols);
  const role = fb.purpose;
  return {
    prChange: answer || fb.prChange,
    purpose: `Deeper dive (level ${depth}) on ${basename(step.path)}. ${role}`,
  };
}
