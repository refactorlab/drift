import type { ScanProgress } from "../../lib/tauri";

/**
 * Render a live timeline of the static-scan phases.
 *
 * The backend emits a heterogeneous stream of `ScanProgress` events. We
 * reduce them into a flat phase list — one row per phase that ever entered
 * — and render each with an icon, a counted bar (when known), and the
 * "current item" trailing slot.
 *
 * Reduction rules:
 *   - `walk_start` / `parse_start` / `step_start` / `phase` → push a new
 *     phase row (or activate the existing one if the same label re-enters).
 *   - `walk_progress` / `parse_progress` / `step_progress` → update the
 *     active row's counters and current item.
 *   - `walk_end` → finalize walk with the total files + bytes shown in the
 *     trailing detail string.
 *
 * The previous active row is marked `done` when the next start arrives.
 */

export interface PhaseRow {
  key: string;
  icon: string;
  label: string;
  detail: string | null;
  status: "active" | "done";
  done: number | null;
  total: number | null;
  /** ms since epoch — captured when the row first enters `active`. Used for
   *  the tqdm-style elapsed/rate/ETA stats. We deliberately don't update it
   *  on re-entry (a phase that loops back) so the displayed elapsed equals
   *  the total time spent in the phase, not just the latest pass. */
  startedAt: number;
  /** ms since epoch — captured when the row flips to `done`. After this we
   *  freeze the elapsed display so a settled row doesn't keep ticking. */
  endedAt: number | null;
}

/** Pipeline-level heartbeat derived from `overall` events. Drives the
 *  big bar above the per-phase timeline. */
export interface OverallStats {
  /** 1-based phase index of the most recent boundary. */
  phaseIndex: number;
  /** Total phases the pipeline expects (CLI uses 28). The bar caps visually
   *  at 100% even if the real count drifts. */
  phaseTotalHint: number;
  /** ms elapsed since the analysis task started in the backend. */
  elapsedMs: number;
  /** Frontend-captured timestamp of the last `overall` event, used to keep
   *  the elapsed counter ticking smoothly between heartbeats without an
   *  extra clock-skew round-trip. */
  receivedAt: number;
}

const PHASE_ICONS: Record<string, string> = {
  walking_filesystem: "🗂️",
  walk: "🗂️",
  parse: "📑",
  parsing_source: "📑",
  graph: "🕸️",
  pagerank: "📈",
  scanning_roots: "🌱",
  "scanning roots": "🌱",
  "building call graph": "🕸️",
  "building call trees": "🌲",
  "collecting entry declarations": "📦",
  "computing pagerank percentile": "📈",
};

function iconFor(label: string): string {
  const lc = label.toLowerCase();
  for (const k of Object.keys(PHASE_ICONS)) {
    if (lc.includes(k)) return PHASE_ICONS[k];
  }
  if (lc.includes("attach")) return "🏷️";
  if (lc.includes("entry")) return "📦";
  if (lc.includes("root")) return "🌱";
  if (lc.includes("tree")) return "🌲";
  if (lc.includes("graph")) return "🕸️";
  if (lc.includes("language")) return "🔤";
  if (lc.includes("hot")) return "🔥";
  if (lc.includes("write") || lc.includes("save")) return "💾";
  return "⚙️";
}

/**
 * Pure reducer — fold one event into the running phase list. Exposed
 * directly so the consumer (Scan page) can hold the array in its own state
 * and use this in a `useReducer` or a plain `useState` `.reduce`.
 */
export function reduceProgress(rows: PhaseRow[], ev: ScanProgress): PhaseRow[] {
  switch (ev.kind) {
    case "overall":
      // Pipeline heartbeat — consumed by the parent for the overall bar.
      // No per-row work; return identity so reduce() callers can pass every
      // event through the same path.
      return rows;
    case "walk_start":
      return finalizePrevious(rows, {
        key: "walk",
        icon: iconFor("walking filesystem"),
        label: "walking filesystem",
        detail: "discovering files…",
        status: "active",
        done: null,
        total: null,
        startedAt: Date.now(),
        endedAt: null,
      });
    case "walk_progress":
      return upsertActive(rows, "walk", (r) => ({
        ...r,
        detail: `${ev.filesSeen} files seen`,
      }));
    case "walk_end":
      return upsertActive(rows, "walk", (r) => ({
        ...r,
        detail: `${ev.totalFiles} files · ${humanBytes(ev.bytes)}`,
      }));
    case "parse_start":
      return finalizePrevious(rows, {
        key: "parse",
        icon: iconFor("parsing source"),
        label: "parsing source",
        detail: null,
        status: "active",
        done: 0,
        total: ev.totalSourceFiles,
        startedAt: Date.now(),
        endedAt: null,
      });
    case "parse_progress":
      return upsertActive(rows, "parse", (r) => ({
        ...r,
        done: ev.done,
        total: ev.total,
        detail: ev.current ?? r.detail,
      }));
    case "phase": {
      const key = `phase:${ev.name}`;
      return finalizePrevious(rows, {
        key,
        icon: iconFor(ev.name),
        label: ev.name,
        detail: null,
        status: "active",
        done: null,
        total: null,
        startedAt: Date.now(),
        endedAt: null,
      });
    }
    case "step_start": {
      const key = `step:${ev.label}`;
      return finalizePrevious(rows, {
        key,
        icon: iconFor(ev.label),
        label: ev.label,
        detail: null,
        status: "active",
        done: 0,
        total: ev.total,
        startedAt: Date.now(),
        endedAt: null,
      });
    }
    case "step_progress": {
      const key = `step:${ev.label}`;
      return upsertActive(rows, key, (r) => ({
        ...r,
        done: ev.done,
        total: ev.total,
        detail: ev.current ?? r.detail,
      }));
    }
  }
}

function finalizePrevious(rows: PhaseRow[], next: PhaseRow): PhaseRow[] {
  const now = next.startedAt;
  const flipped: PhaseRow[] = rows.map((r) =>
    r.status === "active"
      ? { ...r, status: "done" as const, endedAt: r.endedAt ?? now }
      : r,
  );
  // Re-entering the same phase key (e.g. parse loop after compaction): bring
  // it back to active rather than appending a duplicate. Preserve the
  // original `startedAt` so the displayed elapsed reflects the *total* time
  // spent in this phase, not just the latest pass — that's the semantic
  // users intuitively expect from a tqdm bar.
  const existingIdx = flipped.findIndex((r) => r.key === next.key);
  if (existingIdx >= 0) {
    const prev = flipped[existingIdx];
    flipped[existingIdx] = { ...next, startedAt: prev.startedAt, endedAt: null };
    return flipped;
  }
  flipped.push(next);
  return flipped;
}

function upsertActive(
  rows: PhaseRow[],
  key: string,
  fn: (r: PhaseRow) => PhaseRow,
): PhaseRow[] {
  return rows.map((r) => (r.key === key && r.status === "active" ? fn(r) : r));
}

function humanBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} kB`;
  return `${bytes} B`;
}

/** Format a duration in ms as `mm:ss` (or `h:mm:ss` past one hour), matching
 *  the tqdm-style stat panel. We round down so a counter never reads ahead
 *  of the actual elapsed time. */
export function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "--:--";
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Format an items-per-second rate. Switches to `Xs/it` (seconds per item)
 *  when the rate drops below 1/s — same convention tqdm uses for slow tasks
 *  so the number on screen always stays a single-digit integer-ish. */
export function formatRate(itemsPerSec: number): string {
  if (!isFinite(itemsPerSec) || itemsPerSec <= 0) return "?/s";
  if (itemsPerSec >= 1) {
    return itemsPerSec >= 100
      ? `${Math.round(itemsPerSec)}/s`
      : `${itemsPerSec.toFixed(1)}/s`;
  }
  const secPerItem = 1 / itemsPerSec;
  return `${secPerItem.toFixed(1)}s/it`;
}

/** Pure helper — given a row's snapshot at `now`, return the tqdm trailing
 *  stat string `[mm:ss<mm:ss, X.X/s]`. Returns `null` for rows with no
 *  numerator (spinner/atomic phases), where elapsed without ETA is shown
 *  separately to keep the visual rhythm. */
export function tqdmStats(row: PhaseRow, now: number): string | null {
  if (row.total == null || row.total <= 0 || row.done == null) return null;
  const endRef = row.endedAt ?? now;
  const elapsedMs = Math.max(0, endRef - row.startedAt);
  const rate = elapsedMs > 0 ? (row.done * 1000) / elapsedMs : 0;
  if (row.status === "done" || row.done >= row.total) {
    return `[${formatDuration(elapsedMs)}, ${formatRate(rate)}]`;
  }
  // Linear-projection ETA — same model tqdm uses. Becomes accurate after
  // a few seconds of warm-up and degrades gracefully if the rate stalls.
  const remaining = row.total - row.done;
  const etaMs = rate > 0 ? (remaining / rate) * 1000 : Infinity;
  return `[${formatDuration(elapsedMs)}<${formatDuration(etaMs)}, ${formatRate(rate)}]`;
}

/**
 * Render the reduced phase list. Stays small so the parent can compose it
 * inside whatever surface (Scan page today; could be a side panel tomorrow).
 *
 * `now` is the timestamp (ms since epoch) the parent re-renders against —
 * passing it down (vs. each row calling `Date.now()`) keeps elapsed/ETA
 * tick in lockstep across all rows and lets the parent throttle redraws
 * (e.g. once per second) without per-row state.
 *
 * `overall` is the latest pipeline heartbeat. When present the renderer
 * draws a tqdm-style aggregate bar above the per-phase rows.
 */
export default function ScanProgressList({
  rows,
  now,
  overall,
}: {
  rows: PhaseRow[];
  now: number;
  overall?: OverallStats | null;
}) {
  if (rows.length === 0 && !overall) {
    return null;
  }
  return (
    <div className="scan-progress" role="status" aria-live="polite">
      {overall && <OverallProgressBar overall={overall} rows={rows} now={now} />}
      {rows.map((r) => (
        <PhaseRowView key={r.key} row={r} now={now} />
      ))}
    </div>
  );
}

/**
 * Top-of-list pipeline bar. Three signals:
 *   - **phase X/Y** — direct from the `overall` heartbeat. Coarse but
 *     immediate.
 *   - **elapsed** — backend-stamped `elapsedMs` plus the wall-clock delta
 *     since the heartbeat arrived, so the digit keeps ticking between
 *     phase boundaries.
 *   - **ETA** — naive extrapolation from elapsed and phase-ratio. We
 *     deliberately do NOT use the active phase's per-item rate here; the
 *     ETA reflects "how long the whole pipeline takes" and per-phase
 *     rates would mislead during fast post-parse steps.
 */
function OverallProgressBar({
  overall,
  rows,
  now,
}: {
  overall: OverallStats;
  rows: PhaseRow[];
  now: number;
}) {
  const activeRow = rows.find((r) => r.status === "active") ?? null;
  // Within-phase fraction lets the bar move during the long parse step
  // instead of jumping a chunky 1/28 every few seconds.
  const inPhaseFrac =
    activeRow && activeRow.total != null && activeRow.total > 0 && activeRow.done != null
      ? Math.min(1, activeRow.done / activeRow.total)
      : 0;
  const denominator = Math.max(1, overall.phaseTotalHint);
  // (phaseIndex-1) because phaseIndex is 1-based and represents the phase
  // currently *running*, not the number *completed*.
  const completed = Math.max(0, overall.phaseIndex - 1) + inPhaseFrac;
  const pct = Math.min(100, (completed / denominator) * 100);

  const elapsedMs = overall.elapsedMs + Math.max(0, now - overall.receivedAt);
  // Project total runtime by extrapolation. Avoid divide-by-zero in the
  // first second; guard against an absurd ETA when `completed` is still
  // tiny (e.g. < 0.05 of the pipeline) by falling back to `--:--`.
  const ratio = completed / denominator;
  const totalEstMs = ratio > 0.02 ? elapsedMs / ratio : Infinity;
  const etaMs = Math.max(0, totalEstMs - elapsedMs);

  return (
    <div className="scan-progress-overall" aria-label="overall scan progress">
      <span className="scan-progress-overall-label">
        scan {overall.phaseIndex}/{overall.phaseTotalHint}
      </span>
      <span className="scan-progress-bar scan-progress-bar-overall">
        <span
          className="scan-progress-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="scan-progress-count scan-progress-overall-count">
        {Math.round(pct)}%
      </span>
      <span className="scan-progress-overall-stats">
        [{formatDuration(elapsedMs)}
        {isFinite(etaMs) ? `<${formatDuration(etaMs)}` : ""}]
      </span>
    </div>
  );
}

function PhaseRowView({ row, now }: { row: PhaseRow; now: number }) {
  const pct =
    row.total != null && row.total > 0 && row.done != null
      ? (row.done / row.total) * 100
      : null;
  const showSpinner = row.status === "active" && pct == null;
  const iconText = row.status === "done" ? "✓" : row.icon;
  const stats = tqdmStats(row, now);
  // Atomic phases (spinner-style, no denominator) still get a useful
  // "elapsed" caption — tqdm shows the same for indeterminate bars.
  const elapsedOnly =
    pct == null && row.status === "active"
      ? `[${formatDuration(now - row.startedAt)}]`
      : null;

  return (
    <div className={`scan-progress-row is-${row.status}`}>
      <span className="scan-progress-icon" aria-hidden>
        {showSpinner ? <span className="scan-progress-spinner" /> : iconText}
      </span>
      <span className="scan-progress-label">
        <span className="scan-progress-label-line">{row.label}</span>
        {row.detail && (
          <span className="scan-progress-label-detail">{row.detail}</span>
        )}
      </span>
      {pct != null ? (
        <>
          <span className="scan-progress-bar">
            <span
              className="scan-progress-bar-fill"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </span>
          <span className="scan-progress-count">
            {row.done}/{row.total}
            <span className="scan-progress-pct"> ({Math.round(pct)}%)</span>
          </span>
          {stats && <span className="scan-progress-stats">{stats}</span>}
        </>
      ) : (
        <>
          <span className="scan-progress-count">
            {row.status === "done" ? "done" : ""}
          </span>
          {elapsedOnly && (
            <span className="scan-progress-stats">{elapsedOnly}</span>
          )}
        </>
      )}
    </div>
  );
}
