import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import IcicleChart from "../components/IcicleChart";
import Orbs from "../components/Orbs";
import {
  aggregateEventLog,
  downloadEventLog,
  listEventLogs,
  onLiveEventAgg,
  onLiveEventErr,
  selectEventLogFile,
  startLiveEventScan,
  stopLiveEventScan,
  type EventLogFunctionStat,
  type EventLogMeta,
  type EventLogReport,
  type EventLogTreeNode,
} from "../lib/tauri";

/** Default observability-server URL the "Download" button hits. The
 *  user can override via the prompt that opens on click; we keep the
 *  default here so the common case (local dev / Tilt) is a single click. */
const DEFAULT_OBS_URL = "http://localhost:8080/events/log";

/**
 * `events.log` profiling viewer — snakeviz-style icicle chart over the
 * call graph plus a per-function table. Two entry points:
 *
 *   - **scan list**: every `.log` / `.jsonl` file in `~/.drift/event_logs/`
 *     is listed in the left rail. Click a row to load a one-shot
 *     aggregation of the file.
 *   - **live_scan**: pick a file via the system dialog; the backend
 *     re-aggregates every ~1s and pushes a fresh report over
 *     `event_log://aggregate`. The UI just listens — the aggregation lives
 *     server-side so the JSON over the wire stays small.
 *
 * View shape (top → bottom):
 *
 *   header  : breadcrumb + run button + live status
 *   summary : total time / events / services
 *   icicle  : flamegraph of the tree (click a bar to zoom; reset to home)
 *   table   : per-qualname rollup, sortable
 *
 * The page picks its mode from the active `scan` state — there is no
 * top-level "live or static" tab. A live scan that errors falls back to
 * the last successful aggregate so the chart doesn't flash empty.
 */
type Mode =
  | { kind: "idle" }
  | { kind: "loading"; path: string }
  | { kind: "static"; path: string; report: EventLogReport }
  | {
      kind: "live";
      path: string;
      liveScanId: string;
      report: EventLogReport | null;
      lastError: string | null;
    }
  | { kind: "error"; message: string };

export default function LiveScanPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<EventLogMeta[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const liveIdRef = useRef<string | null>(null);

  const refreshLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const ls = await listEventLogs();
      setLogs(ls);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  // Stop any live tail on unmount. The Rust side also drops the registry
  // entry when the cancel token fires; doing it here covers UI-only
  // teardowns (navigation, error path).
  useEffect(() => {
    return () => {
      if (liveIdRef.current) {
        stopLiveEventScan(liveIdRef.current).catch(() => undefined);
        liveIdRef.current = null;
      }
    };
  }, []);

  // Subscribe to the live aggregator's events. We register unconditionally
  // and filter by liveScanId in the callback — keeps the listener identity
  // stable across mode flips so we never miss the first frame.
  useEffect(() => {
    const cleanup: Array<() => void> = [];
    (async () => {
      cleanup.push(
        await onLiveEventAgg((p) => {
          setMode((cur) => {
            if (cur.kind !== "live" || cur.liveScanId !== p.liveScanId) return cur;
            return { ...cur, report: p.report, lastError: null };
          });
        }),
      );
      cleanup.push(
        await onLiveEventErr((p) => {
          setMode((cur) => {
            if (cur.kind !== "live" || cur.liveScanId !== p.liveScanId) return cur;
            return { ...cur, lastError: p.message };
          });
        }),
      );
    })();
    return () => {
      cleanup.forEach((fn) => fn());
    };
  }, []);

  const loadStatic = useCallback(async (path: string) => {
    // If a live scan is running, drop it first — we only support one
    // active view at a time.
    if (liveIdRef.current) {
      await stopLiveEventScan(liveIdRef.current).catch(() => undefined);
      liveIdRef.current = null;
    }
    setMode({ kind: "loading", path });
    try {
      const report = await aggregateEventLog(path);
      setMode({ kind: "static", path, report });
    } catch (e) {
      setMode({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const startLive = useCallback(async () => {
    // System dialog → start tail → mode flip. Any prior live id is
    // cancelled by `start_live_event_scan`'s caller (us).
    const path = await selectEventLogFile();
    if (!path) return;
    if (liveIdRef.current) {
      await stopLiveEventScan(liveIdRef.current).catch(() => undefined);
      liveIdRef.current = null;
    }
    try {
      const id = await startLiveEventScan(path);
      liveIdRef.current = id;
      setMode({
        kind: "live",
        path,
        liveScanId: id,
        report: null,
        lastError: null,
      });
    } catch (e) {
      setMode({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  /** Download `events.log` from a running observability-server and load
   *  it as a static report. Same downstream code path as picking a
   *  local file — the Rust side saves the bytes to
   *  `~/.drift/event_logs/downloaded-<stamp>.jsonl` and we then
   *  `aggregateEventLog` that path.
   *
   *  Errors surface in the existing `mode = error` view so we don't
   *  need a new toast surface. */
  const downloadFromUrl = useCallback(async () => {
    // window.prompt is intentionally minimal — anything fancier (modal,
    // history dropdown) is design polish, not a blocker. The default
    // URL covers the Tilt / docker-compose setups documented in
    // drift-observability/.
    const url = window.prompt(
      "Observability-server URL (/events/log):",
      DEFAULT_OBS_URL,
    );
    if (!url) return;
    setMode({ kind: "loading", path: url });
    try {
      const dl = await downloadEventLog(url);
      // Refresh the rail so the new file shows up under "Past scans".
      refreshLogs();
      // Load the freshly-downloaded file as a static report.
      const report = await aggregateEventLog(dl.path);
      setMode({ kind: "static", path: dl.path, report });
    } catch (e) {
      setMode({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [refreshLogs]);

  const stopLive = useCallback(async () => {
    if (!liveIdRef.current) return;
    await stopLiveEventScan(liveIdRef.current).catch(() => undefined);
    liveIdRef.current = null;
    setMode((cur) => {
      if (cur.kind !== "live") return cur;
      // Preserve last report as a static view.
      if (cur.report) {
        return { kind: "static", path: cur.path, report: cur.report };
      }
      return { kind: "idle" };
    });
  }, []);

  const activeReport: EventLogReport | null =
    mode.kind === "static"
      ? mode.report
      : mode.kind === "live"
      ? mode.report
      : null;

  return (
    <div className="stage stage--running live-scan-page">
      <Orbs />

      <div className="live-scan-head">
        <div>
          <h1>Live scan · event log profiler</h1>
          <div className="muted">
            Aggregates a drift <code>events.log</code> into a snakeviz-style
            icicle chart. Live mode polls the file once a second.
          </div>
        </div>
        <div className="live-scan-actions">
          {mode.kind === "live" ? (
            <button type="button" className="ghost-btn" onClick={stopLive}>
              ■ Stop live scan
            </button>
          ) : (
            <button type="button" className="primary-btn" onClick={startLive}>
              ⏵ live_scan
            </button>
          )}
          <button
            type="button"
            className="ghost-btn"
            onClick={downloadFromUrl}
            title="Fetch events.log from a running observability-server"
          >
            ⬇ Download from URL
          </button>
          <button type="button" className="ghost-btn" onClick={() => navigate("/")}>
            ← Home
          </button>
        </div>
      </div>

      <div className="live-scan-body">
        <aside className="live-scan-rail">
          <div className="live-scan-rail-head">
            <span>Past scans</span>
            <button
              type="button"
              className="ghost-btn live-scan-refresh"
              onClick={refreshLogs}
              disabled={logsLoading}
              title="Re-list ~/.drift/event_logs/"
            >
              ↻
            </button>
          </div>
          {logsLoading ? (
            <div className="muted live-scan-rail-empty">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="muted live-scan-rail-empty">
              No event logs in <code>~/.drift/event_logs/</code>. Drop a
              <code> events.log</code> there or click <strong>live_scan</strong>
              {" "}to pick one anywhere.
            </div>
          ) : (
            <ul className="live-scan-rail-list">
              {logs.map((l) => {
                const active =
                  (mode.kind === "static" || mode.kind === "live" ||
                    mode.kind === "loading") &&
                  (mode as { path?: string }).path === l.path;
                return (
                  <li
                    key={l.path}
                    className={
                      active ? "live-scan-rail-row live-scan-rail-row--active"
                        : "live-scan-rail-row"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => loadStatic(l.path)}
                      title={l.path}
                    >
                      <div className="live-scan-rail-row-name">
                        {l.displayName}
                      </div>
                      <div className="muted live-scan-rail-row-meta">
                        {formatBytes(l.sizeBytes)}
                        {l.modifiedIso && (
                          <> · {formatRelative(l.modifiedIso)}</>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="live-scan-main">
          {mode.kind === "idle" && (
            <div className="live-scan-empty">
              <div className="live-scan-empty-title">No scan loaded</div>
              <div className="muted">
                Pick a past scan on the left or click <strong>live_scan</strong>
                {" "}to start a 1-second poll over any{" "}
                <code>events.log</code>.
              </div>
            </div>
          )}
          {mode.kind === "loading" && (
            <div className="live-scan-empty">
              <div className="live-scan-empty-title">Aggregating…</div>
              <div className="muted">{mode.path}</div>
            </div>
          )}
          {mode.kind === "error" && (
            <div className="report-error">{mode.message}</div>
          )}
          {(mode.kind === "static" || mode.kind === "live") && activeReport && (
            <ReportView
              report={activeReport}
              live={mode.kind === "live"}
              liveError={
                mode.kind === "live" ? mode.lastError : null
              }
              path={mode.path}
            />
          )}
          {mode.kind === "live" && !activeReport && (
            <div className="live-scan-empty">
              <div className="live-scan-empty-title">Waiting for first sample…</div>
              <div className="muted">
                Tailing <code>{mode.path}</code> at ~1Hz.
                {mode.lastError && (
                  <>
                    {" "}
                    <span className="report-error-inline">
                      Last error: {mode.lastError}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface ReportViewProps {
  report: EventLogReport;
  live: boolean;
  liveError: string | null;
  path: string;
}

function ReportView({ report, live, liveError, path }: ReportViewProps) {
  const [sortKey, setSortKey] = useState<keyof EventLogFunctionStat>(
    "cumulativeUs",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<EventLogTreeNode | null>(null);

  const sorted = useMemo(() => {
    const list = report.functions.slice();
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [report.functions, sortKey, sortDir]);

  const toggleSort = (key: keyof EventLogFunctionStat) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="live-scan-report">
      <div className="live-scan-summary">
        <div>
          <span className="live-scan-summary-label">file</span>
          <span className="live-scan-summary-value" title={path}>
            {basename(path)}
          </span>
        </div>
        <div>
          <span className="live-scan-summary-label">duration</span>
          <span className="live-scan-summary-value">
            {formatUs(report.durationUs)}
          </span>
        </div>
        <div>
          <span className="live-scan-summary-label">calls</span>
          <span className="live-scan-summary-value">
            {report.totalCalls.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="live-scan-summary-label">events</span>
          <span className="live-scan-summary-value">
            {report.totalEvents.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="live-scan-summary-label">services</span>
          <span className="live-scan-summary-value">
            {report.services.length === 0 ? "—" : report.services.join(", ")}
          </span>
        </div>
        {live && (
          <div className="live-scan-summary-live">
            <span className="live-pulse" />
            live · re-aggregating ~1Hz
            {liveError && (
              <span className="report-error-inline"> · {liveError}</span>
            )}
          </div>
        )}
      </div>

      <div className="live-scan-chart">
        <IcicleChart
          root={report.tree}
          onNodeClick={(node) => setSelected(node)}
        />
      </div>

      <div className="live-scan-table-wrap">
        <table className="live-scan-table">
          <thead>
            <tr>
              <Th k="qualname" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>
                qualname
              </Th>
              <Th k="ncalls" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">
                ncalls
              </Th>
              <Th k="totalUs" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">
                tottime (self)
              </Th>
              <Th k="cumulativeUs" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">
                cumtime
              </Th>
              <Th k="percallUs" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">
                percall
              </Th>
              <Th k="errors" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">
                errors
              </Th>
              <Th k="cpuAvg" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">
                cpu
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="muted live-scan-table-empty">
                  No paired calls yet — waiting for end events.
                </td>
              </tr>
            )}
            {sorted.map((f) => {
              const highlighted = selected?.name === f.qualname;
              return (
                <tr
                  key={f.qualname}
                  className={highlighted ? "live-scan-row live-scan-row--hi" : "live-scan-row"}
                  title={f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : ""}
                >
                  <td>{f.qualname}</td>
                  <td className="num">{f.ncalls}</td>
                  <td className="num">{formatUs(f.totalUs)}</td>
                  <td className="num">{formatUs(f.cumulativeUs)}</td>
                  <td className="num">{formatUs(f.percallUs)}</td>
                  <td className="num">{f.errors > 0 ? f.errors : "—"}</td>
                  <td className="num">{f.cpuAvg === null ? "—" : f.cpuAvg.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ThProps {
  k: keyof EventLogFunctionStat;
  sortKey: keyof EventLogFunctionStat;
  sortDir: "asc" | "desc";
  onClick: (k: keyof EventLogFunctionStat) => void;
  align?: "left" | "right";
  children: React.ReactNode;
}
function Th({ k, sortKey, sortDir, onClick, align, children }: ThProps) {
  const active = k === sortKey;
  return (
    <th
      onClick={() => onClick(k)}
      style={{ textAlign: align ?? "left", cursor: "pointer" }}
      className={active ? "live-scan-th live-scan-th--active" : "live-scan-th"}
    >
      {children}
      {active && <span className="live-scan-th-arrow">{sortDir === "asc" ? " ↑" : " ↓"}</span>}
    </th>
  );
}

// ---------- formatters ----------------------------------------------------

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatUs(us: number): string {
  if (us <= 0) return "0";
  if (us < 1000) return `${us.toFixed(0)} μs`;
  if (us < 1_000_000) return `${(us / 1000).toFixed(2)} ms`;
  return `${(us / 1_000_000).toFixed(3)} s`;
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}
