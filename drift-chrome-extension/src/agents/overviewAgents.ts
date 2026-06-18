// OVERVIEW AGENTS — two SINGLE-RESPONSIBILITY agents that write the handover's Level 1 and
// Level 2 in plain human LOGIC (what the file does and where it fits), never graph metrics
// or a bare symbol list. Each owns ONE level end-to-end: its focused prompt, its (single)
// generation, and the de-noising of the reply.
//
// Why two agents instead of one combined header: the small on-device model produces a far
// better single sentence when it is NOT also juggling the per-spot `[H<n>]` annotations
// (which stay with the walkthrough's annotator). Splitting the work is what turns the
// useless "wired into the call-graph" / "Defines a, b, c" lines into real summaries.
//
// COST: handover.ts runs these SEQUENTIALLY — one model generation at a time, never
// concurrently — so only a single forward pass is ever in flight (kind to GPU/CPU/memory).
// fileBriefing.composeOverview applies the quality gate + grounded fallback to the output.

import type { BrainRuntime } from '../core/brainRuntime';
import type { ChatTurn } from '../core/chatContext';

const basename = (p: string): string => p.split('/').pop() ?? p;

/** Keep the agents cheap: a short answer is all a one/two-sentence summary needs, so the
 *  generation stays fast and light (the user's machine runs hot otherwise). */
const SUMMARY_MAX_TOKENS = 96;

export interface OverviewAgentInput {
  brain: BrainRuntime;
  signal: AbortSignal;
  /** The changed file's path. */
  path: string;
  /** Human verb for the change (adds / updates / removes / refactors). */
  verb: string;
  /** How the file fits the change (fileBriefing.correlationContext), or '' — gives the
   *  Level 1 agent the architectural role without leaking the whole-PR theme. */
  context: string;
  /** The file's changed code (the numbered spots / diff) — what the sentence is grounded in. */
  code: string;
}

/** Strip a leaked label / annotation tag the small model sometimes prepends, so only the
 *  sentence(s) remain. The quality gate (descriptionQuality) does the rest downstream. */
function denoise(raw: string): string {
  return raw
    .replace(/^\s*(?:level\s*[12]|pr|file|detail|answer|summary|overview)\s*[:\-]\s*/i, '')
    .replace(/\[\s*[HSL]\s*\d+[\s\S]*$/i, '') // drop any [H0]/[S1]/[L2…] annotation + trailing
    .trim();
}

async function summarize(input: OverviewAgentInput, system: string, user: string): Promise<string> {
  const messages: ChatTurn[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  const raw = await input.brain.generate(messages, { signal: input.signal, maxTokens: SUMMARY_MAX_TOKENS }).catch(() => '');
  return denoise(raw.trim());
}

// ── LEVEL 1 AGENT — "the change, in context" ────────────────────────────────────
export const LEVEL1_SYSTEM =
  'You write LEVEL 1 of a code walkthrough: ONE plain-English sentence saying what this pull request does to a file AND the file\'s role in the system. ' +
  'Lead with the action verb (Adds / Updates / Removes / Refactors). Say the real behavior and where the file sits in the flow, the way a senior engineer would explain it out loud. ' +
  'RULES: exactly ONE sentence, at most 30 words. Do NOT mention line counts, "+/−", call-graphs, nodes, or the word "file". Output ONLY the sentence.';

/** Summarize Level 1 — what the PR changes here + the file's architectural role. */
export async function runLevel1Agent(input: OverviewAgentInput): Promise<string> {
  const user =
    `${input.context ? input.context + '\n\n' : ''}` +
    `The PR ${input.verb} ${input.path}. Here is its changed code:\n\n${input.code}\n\nWrite Level 1.`;
  return summarize(input, LEVEL1_SYSTEM, user);
}

// ── LEVEL 2 AGENT — "what the file is responsible for" ───────────────────────────
export const LEVEL2_SYSTEM =
  'You write LEVEL 2 of a code walkthrough: one or two plain-English sentences describing what a source file is RESPONSIBLE for — the job it does. ' +
  'Name its key functions/types and say what each contributes (NOT a bare list of names). Explain it the way a senior engineer would in a review. ' +
  'RULES: at most 40 words. Do NOT start with "This file". Do NOT mention line counts, "+/−", call-graphs, or nodes. Output ONLY the sentence(s).';

/** Summarize Level 2 — the file's responsibility, naming what its key symbols do. */
export async function runLevel2Agent(input: OverviewAgentInput): Promise<string> {
  const user = `File ${input.path}. Here is its code:\n\n${input.code}\n\nWhat is ${basename(input.path)} responsible for? Write Level 2.`;
  return summarize(input, LEVEL2_SYSTEM, user);
}

// ── live status (the "Summarizing level 1…" line, with Claude-CLI-style varied words) ──
const SUMMARY_WORDS = ['Summarizing', 'Distilling', 'Synthesizing', 'Crystallizing', 'Condensing', 'Capturing', 'Framing', 'Composing', 'Unpacking', 'Boiling down'];

/** A short, varied progress line for the level being summarized — e.g. "Distilling level
 *  1…", "Synthesizing level 2…" — so the UI tells the reviewer exactly what's running. */
export function summaryStatus(level: 1 | 2): string {
  const word = SUMMARY_WORDS[Math.floor(Math.random() * SUMMARY_WORDS.length)];
  return `${word} level ${level}…`;
}
