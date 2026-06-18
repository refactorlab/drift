// DESCRIPTION QUALITY — the gate between a SMALL model's free-text and the overview a
// reviewer actually reads/hears.
//
// SINGLE RESPONSIBILITY: tighten a model-written description into a short, concrete line,
// and REJECT a content-free one. It does ONE thing — judge + trim natural-language text —
// so it stays independent of the handover/architecture concerns (fileBriefing owns those).
//
// Two failure modes it fixes, both seen in the bug report ("...the voicePrompt module
// handles the generation of text-based prompts, focusing on voice recognition and
// analysis..."):
//   1. RAMBLE — the small model ignores "one sentence" and emits a paragraph. We clamp to
//      the informative head (`maxSentences`).
//   2. VACUITY — a content-free opener ("This file implements the voice prompt
//      functionality") that names no real code. We DROP a leading vacuous sentence, and if
//      nothing concrete remains we return '' so the caller falls back to the grounded,
//      deterministic line (real symbol names) instead — which is both tighter AND more
//      accurate than the model's filler.
//
// What it CANNOT do: catch a semantic hallucination that is grammatically concrete (the
// "voice recognition and analysis" invention). That is the PROMPT's job (handover.ts) —
// this gate only judges form, never truth. Pure + unit-tested.

/** Filler verbs whose object, when a generic noun, marks a content-free description. */
const FILLER_VERB =
  '(?:implements?|provides?|handles?|manages?|contains?|offers?|supports?|is\\s+responsible\\s+for|takes?\\s+care\\s+of|deals?\\s+with)';
/** Generic, information-free nouns — the tell of a non-description when they are the object
 *  (deliberately NOT "logic"/"operations": "retry logic" is a real, useful description). */
const EMPTY_NOUN = '(?:functionalit(?:y|ies)|features?|capabilit(?:y|ies)|stuff|things|aspects?|behaviou?rs?)';
/** "<filler verb> [the/various/some] [up to 3 words] <generic noun>" — e.g. "implements the
 *  voice prompt functionality", "handles various features". */
const VACUOUS = new RegExp(
  `\\b${FILLER_VERB}\\s+(?:the\\s+|a\\s+|an\\s+|various\\s+|several\\s+|some\\s+|all\\s+(?:the\\s+)?)?(?:[\\w-]+\\s+){0,3}${EMPTY_NOUN}\\b`,
  'i',
);

/** A CONCRETE code anchor — camelCase / snake_case, a call, a path/extension, or a quoted
 *  name. Its presence means the line names something specific, so it is NOT vacuous even if
 *  it also carries filler words. */
const CONCRETE_ANCHOR = /[a-z][A-Z]|[A-Za-z]_[A-Za-z]|\(\)|`[^`]+`|"[^"]+"|'[^']+'|\.[A-Za-z]{1,4}\b/;

/** Does the text name a real identifier / call / path / quoted name? */
export function hasConcreteAnchor(text: string): boolean {
  return CONCRETE_ANCHOR.test(text);
}

/** Whitespace-normalized word count. */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Too thin (< 3 words) OR a filler-verb + generic-noun non-description with NO concrete
 *  anchor to redeem it. */
export function isVacuous(text: string): boolean {
  const t = text.trim();
  if (wordCount(t) < 3) return true;
  if (hasConcreteAnchor(t)) return false;
  return VACUOUS.test(t);
}

/** Split prose into sentences. Breaks on a terminator followed by whitespace AND a capital /
 *  quote / paren — so "voicePrompt.ts is…" and "e.g. the…" stay whole (no false split on
 *  code dots or lowercase abbreviations). Pure. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z"'`(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Tighten a model-written description: drop leading VACUOUS sentences, keep the first
 *  `maxSentences` informative ones, and ensure terminal punctuation. Returns '' when the
 *  input is empty or every sentence is vacuous — the caller then uses its grounded,
 *  deterministic fallback line. Pure. */
export function tightenDescription(text: string | undefined, opts: { maxSentences: number }): string {
  if (!text) return '';
  const sentences = splitSentences(text);
  let start = 0;
  while (start < sentences.length && isVacuous(sentences[start])) start++;
  const kept = sentences.slice(start, start + Math.max(1, opts.maxSentences));
  if (!kept.length) return '';
  const joined = kept.join(' ').trim();
  return /[.!?]$/.test(joined) ? joined : `${joined}.`;
}
