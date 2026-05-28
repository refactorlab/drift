// Footer — attribution + tool version + (optional) inline audio-summary link.
// The "🔊 Listen" link is the artifact URL of a non-zipped WAV (DRIFT_AUDIO_URL,
// threaded in from the action); absent → omitted, so this is fail-soft.

import type { Generator } from '../../report.ts';

/**
 * URL-attribute safe-encoding for HTML interpolation. The footer emits
 * `<a href="${audioUrl}">…</a>` — a `"` (or `<`, `&`) in the URL would escape
 * the attribute and allow arbitrary attribute injection (e.g. `onclick=`).
 * Encode `&`/`<`/`>`/`"` so the attribute always closes safely.
 *
 * Defense-in-depth: the URL normally comes from upload-artifact@v7 (trusted),
 * but env-var inputs to actions are user-influenced and GitHub-flavored
 * Markdown does NOT sanitise raw HTML the same way it sanitises markdown links.
 */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Tool/version come from the scanner — escape the same way for `<code>…</code>`. */
function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderFooter(gen: Generator, audioUrl?: string): string {
  const url = audioUrl?.trim();
  const audio = url
    ? ` · 🔊 <a href="${escapeAttr(url)}">Listen to the spoken summary</a> (Piper TTS · WAV)`
    : '';
  return (
    `<sub>Posted by <a href="https://drift.dev">Drift</a> · static-analysis report from ` +
    `<code>${escapeText(gen.tool)}</code> v${escapeText(gen.version)}${audio}</sub>`
  );
}
