// Session-scoped memory of which PRs the live-scan dashboard has already handled
// (auto-scanned or auto-loaded) this run. Deliberately IN-MEMORY only: a "session"
// is the lifetime of the side-panel app instance, so the set resets when the panel
// is closed/reloaded — NOT persisted to chrome.storage like scanHistory.
//
// Why this exists: the panel stays mounted across browser tab switches; only the
// active PR (useActivePr) changes. Without this guard, returning to a PR we already
// auto-handled this session would re-fire the scan every time. The rule the user
// asked for: auto-scan on first visit this session, never again until reload.

const handled = new Set<string>();

/** True once this PR url has been auto-handled (scanned or loaded) this session. */
export function wasAutoHandled(url: string): boolean {
  return handled.has(url);
}

/** Record that this PR url has been auto-handled, so we don't re-fire on return. */
export function markAutoHandled(url: string): void {
  handled.add(url);
}

/** Test-only: clear the session set so each test starts from a clean slate. */
export function __resetSessionScans(): void {
  handled.clear();
}
