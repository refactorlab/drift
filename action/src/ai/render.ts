// Render the body of a single inline review comment for an AI
// suggestion. The trailing ```suggestion``` block is what gives
// GitHub the "Apply suggestion" button — it MUST live inside a
// review comment (not an issue comment) for the button to render.
//
// Format documented at:
//   https://docs.github.com/articles/incorporating-feedback-in-your-pull-request

import type { AISuggestion } from './schema.ts';
import { suggestionBlock, unwrapFence } from '../suggestion-fence.ts';

const CATEGORY_BADGE: Record<'A' | 'B' | 'C', string> = {
  A: '🅐 Optimization',
  B: '🅑 Product correctness',
  C: '🅒 Framework misuse',
};

export function renderAISuggestionBody(s: AISuggestion, model: string): string {
  const confidencePct = Math.floor(s.confidence * 100);
  const ref = s.references[0];
  const refLabel = ref.title ?? shortenUrl(ref.url);

  return [
    `${CATEGORY_BADGE[s.category]} · 🤖 \`${model}\` · confidence ${confidencePct}%`,
    '',
    s.why_it_matters,
    '',
    `Reference: [${refLabel}](${ref.url})`,
    '',
    // Dynamic fence so backticks inside the replacement code can't terminate
    // the suggestion early; unwrap a fence the model may have added itself.
    suggestionBlock(unwrapFence(s.after_code)),
  ].join('\n');
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}
