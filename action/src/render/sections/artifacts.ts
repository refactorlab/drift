// Scan-artifacts accordion — a collapsed-by-default <details> at the very bottom
// of the sticky comment that links the machine-readable artifacts this run
// uploaded: the COMPLETE scanner report (pr-scan.json — uncapped, unlike the
// size-capped comment) and the scan-context bundle (pr-scan-context.json).
// Rendered in the smallest text (<sub>) so it reads as a quiet footnote, not a
// section. Both links are GitHub Actions artifact URLs (DRIFT_SCAN_JSON_URL /
// DRIFT_SCAN_CONTEXT_URL, threaded in from the action).
//
// Fail-soft: when NEITHER URL is present (artifacts disabled, upload failed, or
// upload-artifact@v7 returned an empty url) this returns '' and the caller drops
// it from the footer block — the comment renders exactly as before.
//
// IMPORTANT — same caveat as the audio footer: GitHub Actions artifact URLs
// return HTTP 404 to UNAUTHENTICATED viewers even on public repos (a logged-out
// / incognito click sees "Not Found"). The accordion states the login
// requirement up-front so a reviewer doesn't report the link as broken.

import { escapeHtml } from '../lib/format.ts';

export type ScanArtifactUrls = {
  /** Artifact URL of the raw scanner report, surfaced as `pr-scan.json`. */
  scanJsonUrl?: string;
  /** Artifact URL of the scan-context bundle, surfaced as `pr-scan-context.json`. */
  scanContextUrl?: string;
};

/**
 * Render the collapsed scan-artifacts accordion, or '' when there's nothing to
 * link. `escapeHtml` closes each `href` attribute safely — the URLs are
 * env-influenced and GitHub-flavored Markdown does not sanitise raw HTML the way
 * it sanitises markdown links.
 */
export function renderScanArtifacts(opts: ScanArtifactUrls): string {
  const json = opts.scanJsonUrl?.trim();
  const context = opts.scanContextUrl?.trim();
  if (!json && !context) return '';

  const links: string[] = [];
  if (json) links.push(`<a href="${escapeHtml(json)}">pr-scan.json</a>`);
  if (context) links.push(`<a href="${escapeHtml(context)}">pr-scan-context.json</a>`);

  // Collapsed <details>; both the summary and the body use <sub> (smallest
  // text). The blank lines around the body are required so GitHub renders the
  // inner HTML inside the disclosure rather than as a literal line.
  return (
    `<details>\n` +
    `<summary><sub>📎 Scan artifacts (JSON)</sub></summary>\n\n` +
    `<sub>${links.join(' · ')} — machine-readable scanner report + scan context. ` +
    `Sign in to GitHub to download.</sub>\n\n` +
    `</details>`
  );
}
