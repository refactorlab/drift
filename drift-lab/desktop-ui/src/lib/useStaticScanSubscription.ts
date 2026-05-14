import { useEffect } from "react";

import { useRunStore } from "../store/runStore";
import {
  onScanComplete,
  onScanEntriesReady,
  onScanError,
  onScanProgress,
} from "./tauri";

/**
 * Install the four static-scan event listeners at the top of the app tree.
 *
 * Why here and not in `StaticScanRunningView` (where they used to live):
 * the running view unmounts whenever the user navigates to Settings (or
 * any non-Home route). With the listeners on the view, every navigation
 * tore down the event subscriptions — events emitted while away were
 * silently dropped, and re-mounting Home restarted the timeline blank
 * even though the backend was still mid-scan.
 *
 * Mounting the listeners on `App` solves both halves of the bug:
 *   - the store keeps accumulating progress events regardless of which
 *     route is active, so a back-navigation to Home re-paints the full
 *     up-to-date timeline.
 *   - the store survives Home unmounts, so the "scan still running"
 *     phase is preserved across the round-trip.
 *
 * We pull the mutators off the store via `getState()` rather than the
 * usual selector hook so this effect doesn't re-subscribe on every render
 * (the listeners would otherwise tear down and re-install whenever any
 * unrelated store slice changed).
 */
export function useStaticScanSubscription(): void {
  useEffect(() => {
    const cleanup: Array<() => void> = [];
    let cancelled = false;

    (async () => {
      const handlers = [
        onScanProgress((ev) => useRunStore.getState().applyStaticScanEvent(ev)),
        onScanEntriesReady((p) =>
          useRunStore.getState().applyStaticScanEntries(p.scanId, p.roots),
        ),
        onScanComplete((p) =>
          useRunStore.getState().applyStaticScanComplete(p.scanId),
        ),
        onScanError((p) =>
          useRunStore.getState().applyStaticScanError(p.scanId, p.message),
        ),
      ];
      const resolved = await Promise.all(handlers);
      // If the effect cleaned up while we were awaiting (React strict-mode
      // double-invoke, or app teardown), drop the listeners immediately
      // instead of leaking them.
      if (cancelled) {
        resolved.forEach((fn) => fn());
        return;
      }
      cleanup.push(...resolved);
    })();

    return () => {
      cancelled = true;
      cleanup.forEach((fn) => fn());
    };
  }, []);
}
