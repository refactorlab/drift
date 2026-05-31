// Footer — attribution + tool version + (optional) inline audio-summary link.
// The "🔊 Listen" link is the artifact URL of a non-zipped WAV (DRIFT_AUDIO_URL,
// threaded in from the action); absent → omitted, so this is fail-soft.
//
// IMPORTANT — GitHub Actions artifact URLs return HTTP 404 to unauthenticated
// viewers EVEN ON PUBLIC REPOS. Anyone clicking the link without a logged-in
// GitHub session (incognito tab, signed-out, fresh device) sees "Not Found"
// and reasonably reports the link as broken. The footer wording must set
// that expectation explicitly so reviewers know to either log in or have
// their colleague share an unauth-public link. Confirmed live: a 307 → 404
// redirect from /actions/runs/N/artifacts/M when unauthenticated, returning
// a 9-byte "Not Found" body with text/plain Content-Type.

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

export function renderFooter(gen: Generator, audioUrl?: string, audioMp4Url?: string): string {
  const url = audioUrl?.trim();
  const mp4 = audioMp4Url?.trim();
  // Footer audio segment. Honest UX wording, because:
  //   1. Artifact URLs 404 for unauthenticated viewers (GitHub gates them
  //      regardless of repo visibility) — verified live (307 → 404 with
  //      "Not Found" body).
  //   2. GitHub's markdown sanitizer strips <audio> tags in comments
  //      universally, so no host produces an inline player for raw WAVs.
  //   3. The ONLY host whose URLs auto-embed a <video> player in comments
  //      is github.com/user-attachments/assets/<hash>, which the workflow
  //      GITHUB_TOKEN cannot write to (only the web UI session can).
  // What we CAN do: ship an MP4 sibling so a logged-in reviewer can
  // drag-drop it into a reply comment and get GitHub's native <video>
  // player there. The footer states this affordance honestly: no false
  // "click to listen" promise that would 404 in incognito.
  let audio = '';
  if (url) {
    audio = ` · 🔊 <a href="${escapeAttr(url)}">Listen (WAV)</a>`;
    if (mp4) {
      audio += ` · <a href="${escapeAttr(mp4)}">MP4</a>`;
    }
    audio += ' <sup>(sign in to GitHub to download';
    if (mp4) {
      audio += '; drop the MP4 into a reply for an inline player';
    }
    audio += ')</sup>';
  }
  return (
    `<sub>Posted by <a href="https://drift.dev">Drift</a> · static-analysis report from ` +
    `<code>${escapeText(gen.tool)}</code> v${escapeText(gen.version)}${audio}</sub>`
  );
}
