import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ActiveModelBadge from "../components/ActiveModelBadge";
import MagicOrb from "../components/MagicOrb";
import Orbs from "../components/Orbs";
import ScanSummary from "../components/scan-summary/ScanSummary";
import SuggestionStream, {
  type SuggestionRowVM,
} from "../components/scan-summary/SuggestionStream";
import type { Report } from "../components/scan-summary/types";
import {
  loadStaticScan,
  onScanSuggestion,
  onScanSuggestionDelta,
  onScanSuggestionDone,
  onScanSuggestionStart,
  startScanSuggestions,
  stopScanSuggestions,
  type ScanSuggestionDeltaPayload,
  type ScanSuggestionDone,
  type ScanSuggestionPayload,
  type ScanSuggestionStartPayload,
} from "../lib/tauri";

/**
 * Static-scan report — loads a saved scan from `~/.drift/scans/<scanId>.json`
 * and renders the summary cards. The LLM suggestion stream **auto-starts**
 * once the report is loaded; the user sees diffs flowing in immediately
 * after navigation, no extra click. A Stop button cancels the in-flight
 * stream — both the React state and the Rust task tear down cleanly.
 *
 * ## Mount-time flow
 *
 *   1. Page mounts → `loadStaticScan(scanId)` fires; show loading orb.
 *   2. JSON lands → fade in `<ScanSummary>` + kick `startScanSuggestions`.
 *   3. Suggestions stream via `scan://suggestion-{start,delta}` events.
 *   4. User clicks Stop → `stopScanSuggestions(scanId)` → Rust drops the
 *      provider stream future → `scan://suggestion-done` arrives → UI
 *      flips to "Regenerate code suggestions".
 *
 * The backend is idempotent on `start_scan_suggestions` so re-renders /
 * remounts that auto-start a second time silently no-op rather than
 * spawning duplicate drivers.
 *
 * ## Streaming architecture (unchanged from the previous pass)
 *
 *   - `scan://suggestion-start` → row metadata pushed into `rowsRef`.
 *   - `scan://suggestion-delta` → text appended to the row in the ref.
 *   - `scan://suggestion`       → final body, clears `isStreaming`.
 *
 * All three handlers mutate the same `Map` ref synchronously and schedule
 * a single `requestAnimationFrame` flush via the tick reducer — so React
 * commits one paint per frame regardless of token rate.
 */
export default function ScanReportPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<Report | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [suggestionDone, setSuggestionDone] =
    useState<ScanSuggestionDone | null>(null);
  const [suggestionsStarted, setSuggestionsStarted] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  // Pin the active scan id for the event filters.
  const scanIdRef = useRef<string | undefined>(scanId);
  useEffect(() => {
    scanIdRef.current = scanId;
  }, [scanId]);

  // Streaming row state — ref-backed, RAF-flushed.
  const rowsRef = useRef<Map<number, SuggestionRowVM>>(new Map());
  const [, bumpTick] = useReducer((n: number) => (n + 1) | 0, 0);
  const flushScheduled = useRef(false);
  const scheduleFlush = useCallback(() => {
    if (flushScheduled.current) return;
    flushScheduled.current = true;
    requestAnimationFrame(() => {
      flushScheduled.current = false;
      bumpTick();
    });
  }, []);

  // Load the saved scan once on mount (or on scanId change). Failure is
  // surfaced inline — typically means the user navigated to a deleted id.
  useEffect(() => {
    if (!scanId) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadStaticScan(scanId);
        if (cancelled) return;
        setReport(stored.report as Report);
        setSavedAt(stored.savedAt);
        setLoadError(null);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  // Suggestion-stream subscriptions, installed once for the page lifetime.
  useEffect(() => {
    const cleanup: Array<() => void> = [];
    const isMine = (id: string) => scanIdRef.current === id;
    (async () => {
      cleanup.push(
        await onScanSuggestionStart((s: ScanSuggestionStartPayload) => {
          if (!isMine(s.scanId)) return;
          rowsRef.current.set(s.index, {
            index: s.index,
            source: s.source,
            kind: s.kind,
            severity: s.severity,
            file: s.file,
            line: s.line,
            name: s.name,
            body: "",
            isStreaming: true,
          });
          scheduleFlush();
        }),
      );
      cleanup.push(
        await onScanSuggestionDelta((d: ScanSuggestionDeltaPayload) => {
          if (!isMine(d.scanId)) return;
          const row = rowsRef.current.get(d.index);
          if (!row) return;
          row.body += d.delta;
          scheduleFlush();
        }),
      );
      cleanup.push(
        await onScanSuggestion((s: ScanSuggestionPayload) => {
          if (!isMine(s.scanId)) return;
          rowsRef.current.set(s.index, {
            index: s.index,
            source: s.source,
            kind: s.kind,
            severity: s.severity,
            file: s.file,
            line: s.line,
            name: s.name,
            body: s.suggestion,
            isStreaming: false,
          });
          scheduleFlush();
        }),
      );
      cleanup.push(
        await onScanSuggestionDone((d) => {
          if (!isMine(d.scanId)) return;
          setSuggestionDone(d);
          setStopping(false);
        }),
      );
    })();
    return () => {
      cleanup.forEach((fn) => fn());
    };
  }, [scheduleFlush]);

  // A run is "in flight" between Generate-click and the page-level done
  // event. Derive both the guard for handleStart and the Stop button
  // visibility from this same value so they can't disagree.
  const isSuggestionRunning = suggestionsStarted && !suggestionDone;

  const handleStartSuggestions = useCallback(async () => {
    if (!scanId || isSuggestionRunning) return;
    rowsRef.current = new Map();
    setSuggestionDone(null);
    setSuggestionError(null);
    setSuggestionsStarted(true);
    setStopping(false);
    scheduleFlush();
    try {
      await startScanSuggestions(scanId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSuggestionError(msg);
      setSuggestionsStarted(false);
    }
  }, [scanId, isSuggestionRunning, scheduleFlush]);

  // Cancel an in-flight stream. The backend drops the HTTP connection
  // immediately; we wait for the `suggestion-done` event to flip the
  // run-state flag (single source of truth — don't optimistically set
  // suggestionDone here, the event path keeps the state honest).
  const handleStopSuggestions = useCallback(async () => {
    if (!scanId || !isSuggestionRunning || stopping) return;
    setStopping(true);
    try {
      await stopScanSuggestions(scanId);
    } catch (e) {
      // Stopping is best-effort; if the IPC call fails, surface it but
      // let the user retry. Don't fake suggestionDone here either.
      setStopping(false);
      setSuggestionError(e instanceof Error ? e.message : String(e));
    }
  }, [scanId, isSuggestionRunning, stopping]);

  // Auto-start once the report has loaded. This is the change from the
  // previous version where the user had to click Generate. The guard chain:
  //   - scanId present (URL has the slug)
  //   - report loaded (we have something to suggest against)
  //   - suggestionsStarted still false (we haven't kicked off yet this mount)
  //   - no load error
  // The backend's `start_scan_suggestions` is idempotent for the same
  // scan_id, so a remount mid-stream won't spawn a duplicate driver.
  useEffect(() => {
    if (!scanId || !report || suggestionsStarted || loadError) return;
    void handleStartSuggestions();
  }, [scanId, report, suggestionsStarted, loadError, handleStartSuggestions]);

  // Snapshot rows for the render — read once per RAF flush.
  const rows = sortedRows(rowsRef.current);

  return (
    <div className="scan-page">
      <Orbs />
      <div className="scan-page-card">
        <div className="scan-page-head">
          <div>
            <h1>Scan report</h1>
            <div className="muted">
              {scanId && <>scan id <code>{scanId.slice(0, 8)}…</code></>}
              {savedAt && (
                <>
                  {" · saved "}
                  <span title={savedAt}>{formatSavedAt(savedAt)}</span>
                </>
              )}
            </div>
          </div>
          <div className="scan-page-actions">
            <ActiveModelBadge compact />
            <button type="button" className="ghost-btn" onClick={() => navigate("/")}>
              ← Home
            </button>
          </div>
        </div>

        {loadError && (
          <div className="report-error" style={{ marginTop: 18 }}>
            {loadError}
          </div>
        )}

        {!report && !loadError && <ReportLoading />}

        {report && (
          <div className="scan-report-body">
            <ScanSummary report={report} />

            <div className="scan-suggestions-cta">
              <SuggestionActionButton
                isRunning={isSuggestionRunning}
                stopping={stopping}
                done={!!suggestionDone}
                onStart={handleStartSuggestions}
                onStop={handleStopSuggestions}
              />
              {suggestionError && (
                <span style={{ color: "#c82626", fontSize: 12 }}>
                  {suggestionError}
                </span>
              )}
            </div>

            {suggestionsStarted && (
              <SuggestionStream
                rows={rows}
                isDone={!!suggestionDone}
                totalExpected={suggestionDone?.total ?? null}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Action affordance for the suggestion phase. Single component to keep the
 * three button states ("auto-starting", "stop", "regenerate") in one place;
 * any future change to the wording or styling lands here, not split across
 * three sites in the JSX.
 */
function SuggestionActionButton({
  isRunning,
  stopping,
  done,
  onStart,
  onStop,
}: {
  isRunning: boolean;
  stopping: boolean;
  done: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  if (isRunning) {
    return (
      <button
        type="button"
        className="scan-stop-btn"
        onClick={onStop}
        disabled={stopping}
        title="Cancel the in-flight LLM suggestions. The current row finalizes with whatever was streamed so far."
      >
        <span className="scan-stop-btn-icon" aria-hidden />
        {stopping ? "Stopping…" : "Stop generating"}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="scan-start-btn"
      onClick={onStart}
      title="Re-run the LLM suggestion pass for this scan."
    >
      {done ? "Regenerate code suggestions" : "Generate code suggestions"}
    </button>
  );
}

/**
 * Loading affordance shown while the saved scan JSON is being fetched.
 * Centered orb with a pulsing aria-live label — modern, clean, matches the
 * Home running view's visual register (orb + caption). Fades in over 280ms
 * so the transition from navigate→render→content feels intentional rather
 * than flashing.
 */
function ReportLoading() {
  return (
    <div className="scan-report-loading" role="status" aria-live="polite">
      <MagicOrb />
      <div className="scan-report-loading-label">Loading scan…</div>
      <div className="scan-report-loading-sub muted">
        Reading the saved analysis from disk. Suggestions will start streaming
        the moment it's ready.
      </div>
    </div>
  );
}

/** Stable, ascending-by-index snapshot of the row map. Pure — easy to test. */
function sortedRows(map: Map<number, SuggestionRowVM>): SuggestionRowVM[] {
  const out = Array.from(map.values());
  out.sort((a, b) => a.index - b.index);
  return out;
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
