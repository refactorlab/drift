// Recognising GitHub hosts — github.com AND GitHub Enterprise Server.
//
// Enterprises run GitHub Enterprise Server on their own domain. By the strong
// convention GitHub itself documents and ships (and what every enterprise we
// care about uses), that host lives at `github.<org>.<tld>`, e.g.
//   github.intuit.com   github.my-enterprise.com   github.acme.co.uk
// Chrome MV3 match patterns CANNOT express `github.*` (the host wildcard is
// only valid as the whole host or a leading `*.` label), so the content script
// matches all https pages and gates on isGithubHost() at runtime, and every
// URL the extension builds is derived from the *current* host rather than a
// hardcoded github.com — that's what makes the live scan work on enterprise.

export const PUBLIC_GITHUB_HOST = 'github.com';

/** Matches a GitHub Enterprise host: `github.` followed by ≥2 dot-separated
 *  labels (so `github.intuit.com` ✓, `github.co.uk`-style ✓, but the bare
 *  `github.com` and unrelated hosts like `gist.github.com`/`github.io` don't). */
const ENTERPRISE_HOST = /^github\.[^./]+(?:\.[^./]+)+$/i;

/**
 * Is this hostname a GitHub host we should activate on? True for the public
 * github.com and for enterprise GitHub Server hosts (`github.<org>.<tld>`).
 *
 * NOTE: the enterprise pattern is intentionally permissive — we can't enumerate
 * every company's domain. We only ever talk to whichever host the user is
 * actively browsing (credentialed fetches stay same-origin), so a non-GitHub
 * `github.foo.com` simply yields an HTML/404 response and the scan fails safe.
 */
export function isGithubHost(hostname: string = location.hostname): boolean {
  return hostname === PUBLIC_GITHUB_HOST || ENTERPRISE_HOST.test(hostname);
}

/** isGithubHost for a full URL string (e.g. a tab URL). Invalid URLs → false. */
export function isGithubUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return isGithubHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** The web origin for a host, e.g. `https://github.intuit.com`. */
export function ghWebBase(host: string = PUBLIC_GITHUB_HOST): string {
  return `https://${host}`;
}

/**
 * The REST API base for a host. Public GitHub serves it from the dedicated
 * `api.github.com`; GitHub Enterprise Server serves it from `/api/v3` on the
 * same host (there is no `api.github.<org>.<tld>`).
 */
export function ghApiBase(host: string = PUBLIC_GITHUB_HOST): string {
  return host === PUBLIC_GITHUB_HOST ? 'https://api.github.com' : `https://${host}/api/v3`;
}

/**
 * chrome.webNavigation event filter for GitHub's Turbo (pushState) PR→PR
 * navigation. UrlFilter can't take a regex, so `hostPrefix: 'github.'` matches
 * both github.com and every enterprise `github.<org>.<tld>` host. Over-matching
 * here is harmless — every event just re-runs parsePrUrl/isGithubHost, which is
 * the real gate. Filter objects are OR-ed.
 */
export const GITHUB_NAV_FILTER = { url: [{ hostPrefix: 'github.' }] };
