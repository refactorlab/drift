// Parse + validate the AI inference output.
//
// GPT-5 occasionally:
//   - wraps the JSON in a ```json ... ``` fence even when told not to
//   - prepends a sentence like "Here are the suggestions:"
//   - returns a bare array `[...]` instead of `{suggestions: [...]}`
//   - returns an object with extra keys
//
// This parser tolerates all of those, validates against the envelope
// schema (hand-rolled — same shape as ai/schema.ts), and returns a
// canonical `AISuggestion[]`.

import {
  passesAIQualityBar,
  type AISuggestion,
  type AISuggestionEnvelope,
} from './schema.ts';

export type ParseSuccess = {
  ok: true;
  suggestions: AISuggestion[];   // all quality-bar-passing (diff filter + cap applied by the caller)
  total: number;                 // before quality bar
  passing: number;               // after quality bar
};

export type ParseFailure = {
  ok: false;
  reason: string;
  rawPreview: string;
};

export type ParseResult = ParseSuccess | ParseFailure;

const FENCE_OPEN = /^[\s\S]*?```(?:json|JSON)?\s*\n/;
const FENCE_CLOSE = /\n```\s*$/;

/**
 * Strip surrounding markdown fences and free-text preamble. Returns
 * the inner JSON text. If no fence is found, returns the input
 * trimmed.
 */
export function stripFence(raw: string): string {
  let s = raw.trim();
  // Common preamble: "Here are the suggestions:\n\n```json\n[...]\n```"
  // Look for the first ``` and last ``` and take what's between.
  const firstFence = s.indexOf('```');
  const lastFence = s.lastIndexOf('```');
  if (firstFence !== -1 && lastFence !== -1 && lastFence > firstFence) {
    s = s.slice(firstFence, lastFence + 3);
    s = s.replace(FENCE_OPEN, '').replace(FENCE_CLOSE, '');
    return s.trim();
  }
  return s;
}

/**
 * Accept both `[...]` and `{"suggestions": [...]}` shapes. Return a
 * normalized envelope.
 */
function normalize(parsed: unknown): AISuggestionEnvelope | null {
  if (Array.isArray(parsed)) return { suggestions: parsed as AISuggestion[] };
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { suggestions?: unknown }).suggestions)) {
    return parsed as AISuggestionEnvelope;
  }
  return null;
}

/**
 * Hand-written validator mirroring ai/schema.ts.
 * Returns the path of the first invalid field, or null on success.
 */
function validateSuggestion(s: unknown, idx: number): string | null {
  if (!s || typeof s !== 'object') return `suggestions[${idx}] not an object`;
  const o = s as Record<string, unknown>;

  if (typeof o.file !== 'string' || o.file.length === 0)
    return `suggestions[${idx}].file must be a non-empty string`;
  if (typeof o.line !== 'number' || !Number.isInteger(o.line) || o.line < 1)
    return `suggestions[${idx}].line must be an integer ≥ 1`;
  if (o.start_line !== undefined &&
    (typeof o.start_line !== 'number' || !Number.isInteger(o.start_line) || o.start_line < 1))
    return `suggestions[${idx}].start_line must be an integer ≥ 1`;
  if (o.category !== 'A' && o.category !== 'B' && o.category !== 'C')
    return `suggestions[${idx}].category must be 'A' | 'B' | 'C'`;
  if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 1)
    return `suggestions[${idx}].confidence must be a number in [0,1]`;
  if (typeof o.why_it_matters !== 'string' || o.why_it_matters.length < 10)
    return `suggestions[${idx}].why_it_matters must be a string of ≥ 10 chars`;
  if (!Array.isArray(o.references) || o.references.length === 0)
    return `suggestions[${idx}].references must be a non-empty array`;
  const r0 = o.references[0] as Record<string, unknown> | undefined;
  if (!r0 || typeof r0.url !== 'string' || r0.url.length === 0)
    return `suggestions[${idx}].references[0].url must be a non-empty string`;
  if (typeof o.after_code !== 'string' || o.after_code.length === 0)
    return `suggestions[${idx}].after_code must be a non-empty string`;

  // start_line ≤ line (multi-line range invariant)
  if (typeof o.start_line === 'number' && o.start_line > o.line)
    return `suggestions[${idx}].start_line must be ≤ line`;

  return null;
}

/**
 * Parse, validate, and filter by quality bar. Does NOT cap or anchor to
 * the diff — those are the caller's concern (filter-then-cap, so the
 * cap counts only postable suggestions).
 */
export function parseAIOutput(raw: string): ParseResult {
  const inner = stripFence(raw);
  const preview = inner.slice(0, 400);

  if (inner.length === 0) {
    return { ok: false, reason: 'empty AI output', rawPreview: preview };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(inner);
  } catch (e) {
    return {
      ok: false,
      reason: `JSON parse failed: ${(e as Error).message}`,
      rawPreview: preview,
    };
  }

  const env = normalize(parsed);
  if (!env) {
    return {
      ok: false,
      reason:
        'parsed value is neither an array nor an object with `suggestions[]`',
      rawPreview: preview,
    };
  }

  // Schema-validate each item.
  for (let i = 0; i < env.suggestions.length; i += 1) {
    const err = validateSuggestion(env.suggestions[i], i);
    if (err) {
      return { ok: false, reason: err, rawPreview: preview };
    }
  }

  const total = env.suggestions.length;
  const passing = env.suggestions.filter(passesAIQualityBar);

  return {
    ok: true,
    suggestions: passing,
    total,
    passing: passing.length,
  };
}
