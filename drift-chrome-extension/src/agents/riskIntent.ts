// Deterministic intent parsing for RISK questions — the analog of
// `parseHandoverIntent` (handoverIntent.ts) and `isMetaQuestion` (chatTools.ts).
//
// Why code, not the LLM router: when the reviewer asks "explain the risk", the
// answer MUST be grounded in the scan's computed risk signals (the act-before-merge
// quadrant items, the critical gauges, the impact-ranked findings) — not freely
// generated. Left to a 1.5B router (or a strong cloud model with only a thin
// verdict line in context) the question gets answered conversationally and the
// model confabulates "no obvious risks" while the scan says "Address before merge".
// `isRiskQuestion` short-circuits those utterances to the deterministic
// `explain_risk` tool BEFORE any model sees them.
//
// Precision matters: this must NOT swallow handover control ("walk me through",
// "next"), file questions ("what does this file do"), or the file list ("which
// files changed") — those route elsewhere. Patterns therefore require an explicit
// risk referent (a risk word, or a "what could break / is it safe to merge" shape).

// Single risk-referent words/phrases — their mere presence makes it a risk question.
const RISK_WORDS =
  /\b(risk|risks|risky|riskier|riskiest|dangerous|danger|unsafe|red flags?|gotchas?|pitfalls?|land\s?mines?|fragile|fragility|blast radius|regressions?|footguns?)\b/;

// "safe / dangerous / ok to merge|ship" — the merge-safety question.
const SAFE_TO_MERGE = /\b(safe|risky|dangerous|ok|okay|fine|alright|good)\b[\s\w]{0,20}\b(to\s+)?(merge|ship|deploy|release|land)\b/;

// "is this / is it / are these changes safe|risky|dangerous" — risk even without
// an explicit merge object ("is this change safe?").
const IS_IT_SAFE = /\b(is|are)\s+(this|it|that|these|those|the)\s+(changes?|pr|code|diff|pull request)?\s*(safe|risky|dangerous|sound)\b/;

// Question shapes that ask about risk without using the word "risk".
const RISK_PHRASES: RegExp[] = [
  /\bwhat (could|can|might|may|would|will) (go wrong|break|fail|blow up|happen|bite)\b/,
  /\bwhat'?s (the )?(worst|wrong|the catch|the downside|the danger)\b/,
  /\bshould (i|we) (merge|ship|be (worried|concerned)|worry)\b/,
  /\b(can|could) (i|we) (safely )?(merge|ship|deploy)\b/,
  /\bwhat (should|do|would) (i|we) (address|fix|worry about|be (worried|concerned) about|look out for|watch (out )?for|double[- ]?check)\b/,
  /\bwhat (am i|are we|did i|did we|have i|have we) (miss|missing|missed|overlook|overlooking|overlooked)\b/,
  /\bmerge confidence\b/,
  /\bwhat'?s (blocking|stopping|holding (this|it) up)\b/,
  /\bwhy (is it|is this|does it say|address|review)\b[\s\w]{0,30}\b(address|merge|risk|before merge)\b/,
  /\bexplain (the |this |these )?(risks?|concerns?|dangers?)\b/,
  /\b(any|are there) (concerns?|issues?|problems?|things to (worry|address|fix))\b/,
  /\bwhat (are the |are |)?(concerns?|issues?|problems?|blockers?)\b/,
];

/**
 * True when the utterance is asking about the PR's RISK / merge-readiness — the
 * cases that must be grounded in the scan's computed signals. Returns false for
 * anything else (those keep their existing routing: handover control, file
 * questions, the file list, architecture, or a freeform answer).
 */
export function isRiskQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (RISK_WORDS.test(t)) return true;
  if (SAFE_TO_MERGE.test(t) || IS_IT_SAFE.test(t)) return true;
  return RISK_PHRASES.some((re) => re.test(t));
}
