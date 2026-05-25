import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ActiveModelBadge from "../components/ActiveModelBadge";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import MagicOrb from "../components/MagicOrb";
import OpenDashboardButton from "../components/OpenDashboardButton";
import Orbs from "../components/Orbs";
import EntryPicker from "../components/scan-summary/EntryPicker";
import ScanSummary from "../components/scan-summary/ScanSummary";
import SuggestionStream, {
  type SuggestionRowVM,
} from "../components/scan-summary/SuggestionStream";
import type { Report } from "../components/scan-summary/types";
import {
  deleteStaticScan,
  listSavedSuggestions,
  listSuggestionVersions,
  listScanFindings,
  loadStaticScan,
  onScanSuggestion,
  onScanSuggestionDelta,
  onScanSuggestionDone,
  onScanSuggestionStart,
  restartScanFromCache,
  startScanFindingSuggestion,
  startStaticScan,
  stopScanFindingSuggestion,
  type ListedFinding,
  type SavedSuggestion,
  type ScanPickerRoot,
  type ScanSuggestionDeltaPayload,
  type ScanSuggestionDone,
  type ScanSuggestionPayload,
  type ScanSuggestionStartPayload,
} from "../lib/tauri";
import { useRunStore } from "../store/runStore";

/**
 * Static-scan report — loads a saved scan from `~/.drift/scans/<scanId>.json`
 * and renders the summary cards. **No automatic suggestion stream**: each
 * finding row carries a "Study this" button; the user opts into the LLM
 * round-trip per-finding, and multiple findings can be in flight at once
 * (each one is its own `(scan_id, index)` stream on the Rust side).
 *
 * ## Re-run affordances
 *
 * The header carries two buttons that act on the *current* saved scan:
 *   - **Pick another entry** — visible only when the saved envelope has a
 *     non-empty `pickerRoots` cache. Opens the EntryPicker inline against
 *     the cached candidate set, then calls `restartScanFromCache` (skips
 *     the discovery phase + picker pause). The new scan runs via the
 *     shared App-level subscription pipeline — we seed the runStore with
 *     `beginStaticScan(newId)` and navigate to `/` so the canonical
 *     running view in Home picks it up.
 *   - **Scan entirely new** — discards every cache for this scan and
 *     re-runs the full discovery flow against the project root captured
 *     in the saved report. Same handoff: seed runStore, navigate to `/`.
 *     Use this when the code has drifted since the cached roots were
 *     taken, or when you just want a guaranteed clean slate.
 *
 * ## Mount-time flow
 *
 *   1. Page mounts → `loadStaticScan(scanId)` + `listScanFindings(scanId)`
 *      fire in parallel; show loading orb.
 *   2. Data lands → fade in `<ScanSummary>` and the findings list. No LLM
 *      activity yet.
 *   3. User clicks "Study this" on a row → backend opens a per-finding
 *      stream; events keyed by `index` populate the matching row.
 *   4. Stream finishes (or user clicks Stop on that row) → the row's
 *      `isStreaming` flag clears.
 */

/** What the page is showing right now.
 *
 *  - `report`: the default — the saved scan with its findings list.
 *  - `picking`: user clicked "Pick another entry"; render the cached
 *    EntryPicker inline. On pick we hand off to Home (via the runStore)
 *    where the canonical running view + IPC subscriptions live.
 */
type Phase = { kind: "report" } | { kind: "picking" };

export default function ScanReportPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  // The static-scan running view + its IPC subscriptions live in Home /
  // App, fed by the runStore. To kick off a rescan from this page we just
  // pre-set the store so Home renders the running view immediately on
  // navigate — keeps the lifecycle/wiring in exactly one place.
  const beginStaticScan = useRunStore((s) => s.beginStaticScan);
  const setProjectPath = useRunStore((s) => s.setProjectPath);

  const [report, setReport] = useState<Report | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pickerRoots, setPickerRoots] = useState<ScanPickerRoot[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [findings, setFindings] = useState<ListedFinding[] | null>(null);
  const [findingsError, setFindingsError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>({ kind: "report" });
  const [restartError, setRestartError] = useState<string | null>(null);

  // Pin the active scan id for the event filters.
  const scanIdRef = useRef<string | undefined>(scanId);
  useEffect(() => {
    scanIdRef.current = scanId;
  }, [scanId]);

  // Streaming row state — ref-backed, RAF-flushed. Keyed on the finding
  // index (matches the backend's per-row identity).
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

  // Per-row request flags so we can disable Study This while a stream is
  // mid-flight (and show Stop in its place). The set lives outside the
  // RAF-flushed map so a click flips immediately, not on the next frame.
  const [studying, setStudying] = useState<Set<number>>(new Set());

  // Count of saved suggestions rehydrated on mount. Surfaced as a small
  // badge near the header so the user can immediately verify that prior
  // "Study this" output was found on disk — without it, an empty rows
  // map is ambiguous between "nothing was ever studied" and "the load
  // silently failed". `null` means "rehydration hasn't finished yet".
  const [savedSuggestionsCount, setSavedSuggestionsCount] = useState<number | null>(null);

  // Load the saved scan + canonical finding list + persisted suggestions
  // once on mount. All three requests are independent so they fire in
  // parallel; the RAF flush coalesces the seed into a single paint.
  useEffect(() => {
    if (!scanId) return;
    let cancelled = false;

    // Wipe per-page state tied to the *previous* scanId before we start
    // loading the new one. Without this, navigating from /scan/A to
    // /scan/B (e.g. via "Pick another entry") would briefly render A's
    // suggestion rows under B's findings until B's saved-suggestions
    // load arrives and overwrites them by index — a confusing flash.
    rowsRef.current.clear();
    setStudying((prev) => (prev.size === 0 ? prev : new Set()));
    scheduleFlush();

    (async () => {
      try {
        const stored = await loadStaticScan(scanId);
        if (cancelled) return;
        setReport(stored.report as Report);
        setSavedAt(stored.savedAt);
        setPickerRoots(stored.pickerRoots ?? []);
        setLoadError(null);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    (async () => {
      try {
        const f = await listScanFindings(scanId);
        if (cancelled) return;
        setFindings(f);
        setFindingsError(null);
      } catch (e) {
        if (cancelled) return;
        setFindingsError(e instanceof Error ? e.message : String(e));
      }
    })();
    // Rehydrate any LLM suggestions previously persisted to
    // ~/.drift/scans/<scanId>/code-suggestions/<index>.json. We seed the
    // RAF-flushed rows map directly so the UI shows the saved bodies on
    // first paint — no re-billing the model just to look at what was
    // already generated. An empty list (no Study This was ever clicked,
    // or the scan predates persistence) is the not-populated case, not an
    // error.
    (async () => {
      try {
        // Two-step load:
        //   1. `listSavedSuggestions` returns the LATEST version of every
        //      finding that has any history (lightweight; one IPC call).
        //   2. For each of those indices, fetch the full version history
        //      in parallel so the UI can immediately step backwards
        //      through prior bodies without an extra round-trip on click.
        //
        // The parallelism cap is the finding count (~24 max via
        // suggester::MAX_FINDINGS); each call is a small read_dir + a
        // few JSON parses. Total cost stays under ~50ms even cold.
        const latestPerIndex = await listSavedSuggestions(scanId);
        if (cancelled) return;
        setSavedSuggestionsCount(latestPerIndex.length);
        if (latestPerIndex.length === 0) return;
        const histories = await Promise.all(
          latestPerIndex.map((s) =>
            listSuggestionVersions(scanId, s.index)
              .then((versions) => ({ index: s.index, versions }))
              .catch(() => ({ index: s.index, versions: [s] as SavedSuggestion[] })),
          ),
        );
        if (cancelled) return;
        const byIndex = new Map(histories.map((h) => [h.index, h.versions]));
        for (const s of latestPerIndex) {
          // `listSuggestionVersions` returns newest-first; cursor 0 is
          // the latest body, which mirrors `listSavedSuggestions` for
          // a finding with no concurrent writes. Pull the displayed
          // body out of the versions array so the rendered view stays
          // self-consistent if the two sources ever drift.
          const versions = byIndex.get(s.index) ?? [s];
          rowsRef.current.set(s.index, {
            index: s.index,
            source: s.source,
            kind: s.kind,
            severity: s.severity,
            file: s.file,
            line: s.line,
            name: s.name,
            body: versions[0]?.suggestion ?? s.suggestion,
            isStreaming: false,
            versions,
            cursor: 0,
          });
        }
        scheduleFlush();
      } catch (e) {
        // Disk hiccup is non-fatal — the user can still click Study This
        // to regenerate. Surface in the console for diagnostics, don't
        // block the page. Mark the count as "zero loaded" so the badge
        // distinguishes this from the "still loading" case.
        console.warn("listSavedSuggestions failed:", e);
        if (!cancelled) setSavedSuggestionsCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanId, scheduleFlush]);

  // Reset the count when navigating between scans so the badge doesn't
  // briefly display the previous scan's number under the new id.
  useEffect(() => {
    setSavedSuggestionsCount(null);
  }, [scanId]);

  // Suggestion-stream subscriptions, installed once for the page lifetime.
  useEffect(() => {
    const cleanup: Array<() => void> = [];
    const isMine = (id: string) => scanIdRef.current === id;
    (async () => {
      cleanup.push(
        await onScanSuggestionStart((s: ScanSuggestionStartPayload) => {
          if (!isMine(s.scanId)) return;
          // Preserve any prior versions array (the user might have history
          // from earlier studies) — only the body + isStreaming flip.
          const prior = rowsRef.current.get(s.index);
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
            versions: prior?.versions ?? [],
            cursor: 0,
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
          // Stream just finalized — the backend has appended a new version
          // to `<scan_id>/code-suggestions/<index>/v<N>.json`. Refresh the
          // row's full version history so ← / → immediately surface the
          // older bodies. We do this async; the body is already settled
          // from the event payload, so the user sees the new version
          // before the version-list reload completes.
          const prior = rowsRef.current.get(s.index);
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
            versions: prior?.versions ?? [],
            cursor: 0,
          });
          scheduleFlush();
          // Best-effort version-history refresh — failure leaves the
          // prior list in place (still functional, just stale by one).
          const sid = scanIdRef.current;
          if (sid) {
            listSuggestionVersions(sid, s.index)
              .then((versions) => {
                const row = rowsRef.current.get(s.index);
                if (!row || row.isStreaming) return;
                row.versions = versions;
                row.cursor = 0;
                if (versions[0]?.suggestion) row.body = versions[0].suggestion;
                scheduleFlush();
              })
              .catch(() => {
                // Silent — UI already has the new body via the event.
              });
          }
        }),
      );
      cleanup.push(
        await onScanSuggestionDone((d: ScanSuggestionDone) => {
          if (!isMine(d.scanId)) return;
          // The done event doesn't carry the index (it counts total/failed
          // for the run). For a single-finding run the row's own
          // `scan://suggestion` event already cleared `isStreaming`; we
          // just need to drop the per-row "studying" flag for whichever
          // index just finalized. The row body itself is authoritative —
          // any row that isn't streaming is no longer "studying".
          setStudying((prev) => {
            if (prev.size === 0) return prev;
            const next = new Set(prev);
            for (const idx of prev) {
              const row = rowsRef.current.get(idx);
              if (row && !row.isStreaming) next.delete(idx);
            }
            return next;
          });
        }),
      );
    })();
    return () => {
      cleanup.forEach((fn) => fn());
    };
  }, [scheduleFlush]);

  const handleStudy = useCallback(
    async (index: number) => {
      if (!scanId) return;
      if (studying.has(index)) return;
      // Reset any prior body for this index — the user is re-running. Seed
      // a minimal row so the UI shows the streaming spinner instantly,
      // before the backend emits its first `suggestion-start` event.
      const seed = findings?.[index];
      if (seed) {
        // Preserve any prior versions on re-study so the user can flip
        // back to older bodies while the new stream is in flight.
        const prior = rowsRef.current.get(index);
        rowsRef.current.set(index, {
          index,
          source: seed.source,
          kind: seed.kind,
          severity: seed.severity,
          file: seed.file,
          line: seed.line,
          name: seed.name,
          body: "",
          isStreaming: true,
          versions: prior?.versions ?? [],
          cursor: 0,
        });
        scheduleFlush();
      }
      setStudying((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
      try {
        await startScanFindingSuggestion(scanId, index);
      } catch (e) {
        // Surface the error inline on the row and drop the studying flag.
        const msg = e instanceof Error ? e.message : String(e);
        const row = rowsRef.current.get(index);
        if (row) {
          row.body = `⚠ ${msg}`;
          row.isStreaming = false;
          scheduleFlush();
        }
        setStudying((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    },
    [scanId, studying, findings, scheduleFlush],
  );

  const handleStopStudy = useCallback(
    async (index: number) => {
      if (!scanId) return;
      try {
        await stopScanFindingSuggestion(scanId, index);
      } catch {
        // Best-effort — the suggestion-done event still flips the flag.
      }
    },
    [scanId],
  );

  /// Step the version cursor for one row. `direction = -1` moves toward
  /// newer (toward cursor 0); `+1` moves toward older. Bounds-checked
  /// against the row's `versions.length`; out-of-range steps are no-ops.
  /// Updates `body` to mirror `versions[cursor]` so the renderer doesn't
  /// have to know about version state — keeps the row component's
  /// concern boundary clean (it just renders `body`).
  const handleCursorStep = useCallback(
    (index: number, direction: -1 | 1) => {
      const row = rowsRef.current.get(index);
      if (!row || row.isStreaming) return;
      const next = row.cursor + direction;
      if (next < 0 || next >= row.versions.length) return;
      row.cursor = next;
      const version = row.versions[next];
      if (version) row.body = version.suggestion;
      scheduleFlush();
    },
    [scheduleFlush],
  );

  // Reset transient phase/error state when the route's scanId changes —
  // landing on a fresh report should never carry over a stale picker view.
  useEffect(() => {
    setPhase({ kind: "report" });
    setRestartError(null);
  }, [scanId]);

  // Resolve the project root from the saved report — used by "Rescan
  // entirely" as the path to hand back into `start_static_scan`.
  const projectPath: string | null =
    (report as { generator?: { source_root?: string | null } } | null)?.generator?.source_root ??
    null;

  const handlePickAnother = useCallback(() => {
    setRestartError(null);
    setPhase({ kind: "picking" });
  }, []);

  const handlePickFromCache = useCallback(
    async (root: ScanPickerRoot) => {
      if (!scanId) return;
      try {
        const newId = await restartScanFromCache(scanId, root.index);
        // Seed the runStore so Home's running view picks up the in-flight
        // scan immediately on render. The App-level subscription is the
        // single owner of `scan://*` events, so we don't subscribe here.
        beginStaticScan(newId);
        if (projectPath) setProjectPath(projectPath);
        navigate("/");
      } catch (e) {
        setRestartError(e instanceof Error ? e.message : String(e));
        setPhase({ kind: "report" });
      }
    },
    [scanId, beginStaticScan, setProjectPath, projectPath, navigate],
  );

  const handleRescanEntirely = useCallback(async () => {
    if (!projectPath) {
      setRestartError("scan has no recorded project path — rescan from Home");
      return;
    }
    try {
      const newId = await startStaticScan(projectPath);
      beginStaticScan(newId);
      setProjectPath(projectPath);
      navigate("/");
    } catch (e) {
      setRestartError(e instanceof Error ? e.message : String(e));
    }
  }, [projectPath, beginStaticScan, setProjectPath, navigate]);

  const hasCachedRoots = pickerRoots.length > 0;

  // Snapshot rows for the render — read once per RAF flush.
  const rows = rowsRef.current;

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
              {savedSuggestionsCount !== null && savedSuggestionsCount > 0 && (
                <>
                  {" · "}
                  <span
                    className="scan-saved-badge"
                    title="LLM 'Study this' output that was generated on a previous visit and reloaded from disk. Click any row's body to see the saved analysis without re-billing the model."
                  >
                    {savedSuggestionsCount} saved suggestion
                    {savedSuggestionsCount === 1 ? "" : "s"} loaded
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="scan-page-actions">
            <ActiveModelBadge compact />
            {phase.kind === "report" && report && scanId && (
              <>
                {/*
                  Primary "Open profiler dashboard" affordance — deep-links
                  into the bundled viewer's full Scan Report page (flame
                  graph + call tree + call graph + hot paths + insights)
                  for THIS scan. The desktop-app ScanReport above is the
                  curated findings + "Study this" surface; the dashboard
                  is the exploratory side. Two complementary views, one
                  click between them.
                */}
                <OpenDashboardButton
                  scanId={scanId}
                  target="in-app"
                  variant="primary"
                  label="Open profiler dashboard"
                  title="Open the rich profiler dashboard for this scan — flame graph, call tree, call graph, hot paths, smells, and structured insights. Stays inside the app."
                />
                <OpenDashboardButton
                  scanId={scanId}
                  target="browser"
                  variant="ghost"
                  label="Open in browser"
                  title="Open the same dashboard in your default browser — useful for devtools, bookmarking, or viewing alongside the app."
                />
              </>
            )}
            {phase.kind === "report" && report && (
              <>
                {hasCachedRoots && (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={handlePickAnother}
                    title={`Use cached entries — pick from ${pickerRoots.length} candidates this scan already discovered. Skips re-walking the codebase.`}
                  >
                    ↻ Pick another entry (cached)
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={handleRescanEntirely}
                  disabled={!projectPath}
                  title={
                    projectPath
                      ? "Scan entirely new — discards every cached entry from this scan, re-walks the codebase, re-discovers entry roots from scratch, then prompts you to pick a fresh entry to profile."
                      : "Project path missing from saved scan"
                  }
                >
                  ✨ Scan entirely new
                </button>
              </>
            )}
            <button type="button" className="ghost-btn" onClick={() => navigate("/")}>
              ← Home
            </button>
            {scanId && (
              <ConfirmDeleteButton
                label="Delete scan"
                confirmLabel="Confirm delete"
                title="Permanently remove this scan from ~/.drift/scans/. Any saved 'Study this' suggestions are deleted too. This cannot be undone."
                onConfirm={async () => {
                  await deleteStaticScan(scanId);
                  navigate("/");
                }}
              />
            )}
          </div>
        </div>

        {restartError && (
          <div className="report-error" style={{ marginTop: 18 }}>
            {restartError}
          </div>
        )}

        {loadError && (
          <div className="report-error" style={{ marginTop: 18 }}>
            {loadError}
          </div>
        )}

        {!report && !loadError && <ReportLoading />}

        {phase.kind === "picking" && (
          <div className="scan-report-body" style={{ marginTop: 16 }}>
            <div className="scan-picker-card">
              <EntryPicker
                roots={pickerRoots}
                onPick={handlePickFromCache}
                heading={`Pick another entry — ${pickerRoots.length} cached candidates · no re-discovery`}
              />
              <div style={{ marginTop: 12, textAlign: "right" }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setPhase({ kind: "report" })}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {phase.kind === "report" && report && (
          <div className="scan-report-body">
            <ScanSummary report={report} />

            <SuggestionStream
              findings={findings}
              findingsError={findingsError}
              rows={rows}
              studying={studying}
              onStudy={handleStudy}
              onStop={handleStopStudy}
              onCursorStep={handleCursorStep}
            />
          </div>
        )}
      </div>
    </div>
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
        Reading the saved analysis from disk. Click "Study this" on any
        finding to ask the model for a fix.
      </div>
    </div>
  );
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
