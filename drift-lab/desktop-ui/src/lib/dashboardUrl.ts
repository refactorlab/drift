import { useEffect, useState } from "react";

import { getHttpServerUrl } from "./tauri";

/**
 * Single source of truth for everything the desktop UI needs to reach the
 * bundled static-profiler viewer (served at `http://localhost:<port>/` by
 * the in-process axum server).
 *
 * Three concerns live here, intentionally separated:
 *
 *   1. {@link useHttpServerUrl} — React hook that polls the backend until
 *      it knows the bind port. The HTTP server binds in a background task,
 *      so on first launch the URL may not be available for ~100ms after
 *      mount. The hook owns that backoff so call sites just consume the
 *      `string | null` result.
 *
 *   2. {@link buildDashboardUrl} — pure URL composer. Takes a base URL +
 *      optional scanId and returns the deep-link into the viewer. Pure so
 *      it's trivially testable and shareable between the "open in browser"
 *      and "open in iframe" flows.
 *
 *   3. {@link openExternalUrl} — opener with graceful fallback. Prefers
 *      `@tauri-apps/plugin-opener` (correct path in the packaged app),
 *      falls back to `window.open` (so the same code works in `vite dev`
 *      where the plugin isn't installed).
 *
 * Keeping these as three small functions instead of one big "openDashboard"
 * helper means the in-app iframe page can reuse (1)+(2) without dragging
 * the external-opener in, and the existing `LocalServerLinks` row can
 * reuse (3) without re-importing the plugin in two places.
 */

/// Maximum polling attempts on first launch. At ~300ms each (see backoff
/// below) this caps total wait at ~3s — well past the typical sub-second
/// bind time, and short enough that a truly broken server surfaces as a
/// disabled button instead of an indefinite spinner.
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 300;

/**
 * React hook that resolves the local HTTP server's base URL (e.g.
 * `http://127.0.0.1:5151`). Returns `null` while the server is still
 * binding so callers can render a disabled state with a helpful tooltip.
 *
 * Multiple components calling this in parallel is fine — each manages its
 * own polling, and the backend command is cheap (just reads a `OnceCell`).
 * A shared subscription would be a micro-optimisation; we'd buy complexity
 * for ~3 redundant IPC calls on first paint.
 */
export function useHttpServerUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let attempt = 0;
    const tick = async () => {
      if (!alive) return;
      const next = await getHttpServerUrl().catch(() => null);
      if (!alive) return;
      if (next) {
        setUrl(next);
        return;
      }
      attempt += 1;
      if (attempt < MAX_POLL_ATTEMPTS) {
        setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    tick();
    return () => {
      alive = false;
    };
  }, []);

  return url;
}

/**
 * Compose the viewer URL for a given scan.
 *
 *   - No `scanId`           → `<base>/`             (fixture index)
 *   - `scanId` provided     → `<base>/scan/<id>/report` (full Scan Report
 *                              page — flame graph + call tree + insights)
 *
 * Pure function: same inputs always yield the same string. The viewer's
 * Router (`drift-static-profiler/viewer/src/Router.tsx`) is the schema
 * source — any URL change there must be mirrored here.
 */
export function buildDashboardUrl(base: string, scanId?: string): string {
  const trimmed = base.replace(/\/+$/, "");
  if (!scanId) return `${trimmed}/`;
  return `${trimmed}/scan/${encodeURIComponent(scanId)}/report`;
}

/**
 * Open a URL in the user's default browser. Falls back to `window.open`
 * when the tauri-plugin-opener isn't reachable (typical in `vite dev`
 * where the desktop runtime isn't wrapping the page).
 *
 * Errors are swallowed: an `openUrl` failure is always recoverable by the
 * fallback, and the only remaining failure mode (popup blocker on the
 * dev page) is best surfaced as nothing happening rather than a thrown
 * exception that drops the caller's UI.
 */
export async function openExternalUrl(target: string): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(target);
  } catch {
    window.open(target, "_blank", "noopener,noreferrer");
  }
}
