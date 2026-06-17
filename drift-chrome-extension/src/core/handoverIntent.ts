// Deterministic intent parsing for the PR-handover walkthrough. The on-device
// router (a 1.5B model) cannot be trusted to tell "next" / "proceed" / "yes" /
// "go to auth.ts" apart from a fresh PR question, so we resolve the walkthrough's
// CONTROL utterances in code — the same "restrict tool calls deterministically"
// principle as isMetaQuestion (chatTools.ts). `parseHandoverIntent` returns null
// for anything that isn't a control utterance, so an off-topic question asked
// mid-walkthrough falls through to the normal lenses (and the session survives, so
// "resume" still works afterward).

import { findStepIndex } from '../state/handoverSession';

export type HandoverAction =
  | { kind: 'start' } // begin a guided walkthrough
  | { kind: 'next' } // advance to the next file (incl. "proceed"/"yes")
  | { kind: 'prev' } // go back one file
  | { kind: 'goto'; file: string } // jump to a named file
  | { kind: 'resume' } // re-open where we left off
  | { kind: 'stop' } // exit the walkthrough
  | { kind: 'status' }; // show the plan / position / what's left

const QUESTION = /^(what|why|how|who|when|where|which|is|are|was|were|does|do|did|can|could|should|would|explain|tell|describe)\b/;

const STOP = /\b(stop|exit|quit|cancel|leave|end)\b(?:[\s\w]*\b(handover|walk\s?through|walkthrough|tour|review|mode))?/;
const isBareStop = (t: string) => /^(stop|exit|quit|cancel|nevermind|never mind)[.!]?$/.test(t);

// "handover" / "walkthrough" / "guided review|tour" wording → always a START.
const START_WORDS = /\b(?:hand\s?over|handover|walkthrough|guided (?:review|walkthrough|walk-through|tour))\b/;
// "walk/take/guide me through" only STARTS a walkthrough when the object is the PR
// ITSELF — NOT "walk me through the architecture / the auth flow" (those are
// explain/lens requests). Object = pr / changes / files / diff / pull request / review.
const START_THROUGH = /\b(?:walk|take|guide) me through\b[\s\w]*\b(?:pr|pull request|changes?|files?|diff|review)\b/;
const START_VERB = /\b(?:start|begin|do|run|give me)\s+(?:a |an |the )?(?:pr )?(?:handover|walkthrough|walk\s?through|guided (?:review|tour|walkthrough)|tour)\b/;
const START_PR = /\bpr handover(?: mode)?\b/;
const START_REVIEW = /\b(?:review|go through)\s+(?:this |the )?(?:pr|changes?|files?|diff|pull request)\b[\s\w]*\b(?:step by step|file by file|with me|together)\b/;
const START_BYFILE = /\b(?:file by file|step by step)\s+(?:review|walkthrough|tour)\b/;
const isStart = (t: string) =>
  START_WORDS.test(t) || START_THROUGH.test(t) || START_VERB.test(t) || START_PR.test(t) || START_REVIEW.test(t) || START_BYFILE.test(t);

const isResume = (t: string) =>
  /\bresume\b/.test(t) ||
  /\bpick up where (?:we|i) (?:left off|stopped)\b/.test(t) ||
  /\bwhere (?:were|did) we(?: leave off| stop)?\b/.test(t) ||
  /\b(?:continue|carry on|get back to)\b[\s\w]*\b(?:handover|walkthrough|walk\s?through|tour|review)\b/.test(t);

const isStatus = (t: string) =>
  /\bwhere are we\b/.test(t) ||
  /\bwhat'?s (?:the |our )?(?:plan|status)\b/.test(t) ||
  /\bwhat'?s (?:next|left|remaining|coming(?: up)?)\b/.test(t) ||
  /\bwhat (?:files?|else) (?:is|are|s) (?:left|remaining|coming)\b/.test(t) ||
  /\bhow (?:far|much)\b/.test(t) ||
  /\b(?:show|see|list)(?: me)? (?:all |the )?(?:remaining |rest of (?:the )?)?(?:files?|steps?|plan|execution plan)\b/.test(t);

const isPrev = (t: string) =>
  /^(?:back|prev|previous)\b/.test(t) || /\b(?:go back|back up|previous file|last file|go to the previous)\b/.test(t);

// A WHOLE-message acknowledgement → advance. Checked on the RAW text (before filler
// stripping) so "yeah"/"ok" aren't stripped away and lost.
const AFFIRMATIVE_ONLY =
  /^(?:yes|yep|yeah|yup|ya|ok|okay|k|sure|sounds good|got it|good|great|perfect|alright|all right|right|do it|please do|go for it|lgtm|go|next|proceed|continue|go on|go ahead|keep going|move on|onward|carry on)[\s!.]*$/;

// Leading conversational filler people (and ASR) prepend to a command — "So go to
// the next file", "Yeah, continue…", "Okay, next". Stripped so the anchored command
// patterns match the real instruction underneath.
const FILLER_LEAD =
  /^(?:so|well|umm?|uhh?|okay|ok|yeah|yep|yup|ya|right|alright|all right|please|hey|now|and|but|like|just|then|cool|nice|great|sure|good|mm+|hmm+|i think|i guess|maybe|let'?s see|you know)\b[\s,.:!]*/;
function stripFiller(t: string): string {
  let s = t;
  for (let i = 0; i < 5; i++) {
    const n = s.replace(FILLER_LEAD, '').trim();
    if (n === s) break;
    s = n;
  }
  return s;
}

// "Advance to the next file" phrasings — checked BEFORE goto so "go to the next
// file" is NEXT, not a goto of a file literally named "next". Requires "next" to sit
// in a command context (next + noun, or a motion verb → "to the next"), so a real
// question like "what does next() do" is NOT swallowed.
const isAdvance = (t: string) =>
  /\b(?:the )?next (?:file|one|change|diff|step|item)\b/.test(t) || // "next file", "the next one"
  /\b(?:go|move|skip|jump|continue|head|take me)\s+(?:on |over |ahead |right )?(?:to|onto|on to)\s+(?:the\s+)?next\b/.test(t); // "go to the next", "skip to next"

// Bare/prefix advance words (after filler stripping): "proceed", "continue", "go".
const isNext = (t: string) =>
  /^(?:next|proceed|continue|go on|go ahead|keep going|move on|onward|go|let'?s go|lets go|carry on)\b/.test(t);

const GOTO_VERB =
  /\b(?:go to|goto|open|show me|jump to|take me to|navigate to|bring up|pull up|view|let'?s (?:look at|see|open|review)|look at)\s+(.+)$/;

/** Strip filler around a goto target ("the auth.ts file please" → "auth.ts"). */
function cleanTarget(raw: string): string {
  return raw
    .trim()
    .replace(/[.?!]+$/, '')
    .replace(/^(?:the|that|this|my|file|to)\s+/i, '')
    .replace(/\s+(?:file|please|now|next)$/i, '')
    .replace(/^['"`]|['"`]$/g, '')
    .trim();
}

const looksLikeFile = (s: string) => /[\w-]+\.[a-z0-9]{1,6}$/i.test(s) || s.includes('/');

/**
 * Classify a handover control utterance, or null if it isn't one. `steps` (a plan
 * preview) lets a bare filename ("auth.ts") or a partial name ("the auth file")
 * resolve to a goto; without them, goto needs a file-looking target or an explicit
 * verb. Order matters: stop/start/resume/status are checked before next so
 * "what's next" reads as status and "go to auth.ts" as goto, not "next".
 */
export function parseHandoverIntent(text: string, steps?: Array<{ path: string }>): HandoverAction | null {
  const raw = text.trim().toLowerCase();
  if (!raw) return null;
  // A whole-message acknowledgement → advance (checked on RAW so it isn't stripped).
  if (AFFIRMATIVE_ONLY.test(raw)) return { kind: 'next' };
  const t = stripFiller(raw);
  if (!t) return null;

  if (isBareStop(t) || (STOP.test(t) && /\b(handover|walk\s?through|walkthrough|tour|review|mode)\b/.test(t)))
    return { kind: 'stop' };
  // Resume BEFORE start so "continue/resume the walkthrough" isn't read as a fresh start.
  if (isResume(t)) return { kind: 'resume' };
  if (isStart(t)) return { kind: 'start' };
  if (isStatus(t)) return { kind: 'status' };
  if (isPrev(t)) return { kind: 'prev' };
  // Advance BEFORE goto so "go to the next file" advances, not gotos a file named "next".
  if (isAdvance(t)) return { kind: 'next' };

  // Explicit "go to <X>" — only a goto when the target is a real/likely file.
  const m = t.match(GOTO_VERB);
  if (m) {
    const target = cleanTarget(m[1]);
    if (target && !/^next\b|^the next\b/.test(target)) {
      if ((steps && findStepIndex(steps, target) >= 0) || looksLikeFile(target)) return { kind: 'goto', file: target };
    }
  }

  if (isNext(t)) return { kind: 'next' };

  // A bare filename ("auth.ts", "the Chat.tsx file") with no question → goto.
  if (steps && !QUESTION.test(t)) {
    const bare = cleanTarget(t);
    if ((looksLikeFile(bare) || bare.length >= 3) && findStepIndex(steps, bare) >= 0) return { kind: 'goto', file: bare };
  }

  return null;
}
