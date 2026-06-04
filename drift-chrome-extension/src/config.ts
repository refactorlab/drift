// Static configuration.

export const APP_NAME = 'Drift';

// ─── Optional Google sign-in ────────────────────────────────────────────────
// Guest is the default account; connecting Google is optional. To enable it:
// 1. Google Cloud Console → Credentials → OAuth client ID → Web application.
// 2. Add the redirect URI from `chrome.identity.getRedirectURL()`
//    (https://<extension-id>.chromiumapp.org/) as an authorized redirect.
// 3. Paste the client id below. Until then the Google button is disabled and
//    the app just runs as a guest.
export const GOOGLE_CLIENT_ID = '';
export const GOOGLE_SCOPES = ['openid', 'email', 'profile'];
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** True when a real OAuth client id has been configured. */
export const HAS_GOOGLE_OAUTH = GOOGLE_CLIENT_ID.trim().length > 0;

// ─── Scanner WASM source ─────────────────────────────────────────────────────
// The scanner WASM is BUNDLED in the published store package (MV3 forbids
// executing remote code, so a runtime download is NOT the store-compliant
// default — see scannerStore.ts). The OPTIONAL, explicit "download the latest
// scanner" override (dev / sideload / always-latest) pulls the prebuilt
// `drift-static-profiler.wasm` + `drift-scanner.meta.json` assets uploaded to
// the GitHub release by drift-static-profiler-release.yml.
//
// IMPORTANT: the repo hosts SEVERAL release trains (drift-lab-v*,
// drift-static-profiler-v*, …), so the repo-wide `releases/latest` resolves to
// the desktop app — NOT the profiler — and `releases/latest/download/drift-
// static-profiler.wasm` 404s. We therefore query the releases API and pick the
// newest `drift-static-profiler-v*` tag, then download from its tag-pinned URL.
// Overridable per-device via settings.scannerUrl (an explicit base that skips
// API resolution).
export const SCANNER_RELEASES_API =
  'https://api.github.com/repos/refactorlab/drift/releases?per_page=30';
export const SCANNER_TAG_PREFIX = 'drift-static-profiler-v';
export const SCANNER_RELEASE_DOWNLOAD =
  'https://github.com/refactorlab/drift/releases/download';
