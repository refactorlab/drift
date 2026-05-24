// "Where am I running mostly?" — answers the question in two columns:
//
//   Last N seconds                |  All-time
//   ──────────────────────────────|──────────────────────────
//   1. parse_request   67%        |  1. parse_request   42%
//   2. db.execute      18% ↑      |  2. db.execute      19%
//   3. json.dumps       7% ↓      |  3. handle_event   12% (out of recent top-5)
//
// The left column reflects the live `recentCumulativeUs` slice; the
// right reflects all-time `cumulativeUs`. Arrows on the LEFT column
// show whether each entry has risen / fallen / appeared compared to
// its position in the all-time top-N. Lets a developer spot a
// "function that just got hot" without watching the flamegraph.
//
// Why side-by-side rather than a single table with deltas: glance
// readability. The eye picks up "this thing is in the live column but
// not in the all-time column" faster than scanning a delta column.

import type {
  EventLogFunctionStat,
  EventLogReport,
} from "../../lib/tauri";

const TOP_N = 5;

interface Props {
  report: EventLogReport;
}

export default function WhereAmIRunningPanel({ report }: Props): JSX.Element {
  const recent = pickTop(report.functions, (f) => f.recentCumulativeUs);
  const allTime = pickTop(report.functions, (f) => f.cumulativeUs);

  // Index map for delta arrows: allTime qualname → rank (1-based).
  const allTimeRank = new Map<string, number>();
  allTime.forEach((f, i) => allTimeRank.set(f.qualname, i + 1));

  const recentTotal = recent.reduce(
    (acc, f) => acc + f.recentCumulativeUs,
    0,
  );
  const allTimeTotal = allTime.reduce((acc, f) => acc + f.cumulativeUs, 0);

  const noRecent =
    recent.length === 0 || recent.every((f) => f.recentCumulativeUs === 0);

  const windowLabel = formatWindowSeconds(report.recentWindowUs);

  return (
    <div className="where-running-panel" role="region" aria-label="hot functions">
      <div className="where-running-col">
        <header>
          <h3>Where am I running NOW</h3>
          <span className="muted">last {windowLabel}</span>
        </header>
        {noRecent ? (
          <div className="where-running-empty muted">
            No samples in the last {windowLabel} yet.
          </div>
        ) : (
          <ol className="where-running-list">
            {recent.map((f, i) => {
              const pct =
                recentTotal > 0
                  ? (100 * f.recentCumulativeUs) / recentTotal
                  : 0;
              const prev = allTimeRank.get(f.qualname);
              const arrow = arrowFor(i + 1, prev);
              return (
                <li key={f.qualname} className="where-running-row">
                  <span className="where-running-name" title={f.qualname}>
                    {f.qualname}
                  </span>
                  <span className="where-running-pct">{pct.toFixed(1)}%</span>
                  <span
                    className={`where-running-arrow where-running-arrow--${arrow.kind}`}
                    title={arrow.title}
                    aria-label={arrow.title}
                  >
                    {arrow.glyph}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="where-running-col">
        <header>
          <h3>All-time hot path</h3>
          <span className="muted">since scan started</span>
        </header>
        {allTime.length === 0 ? (
          <div className="where-running-empty muted">
            No samples yet.
          </div>
        ) : (
          <ol className="where-running-list">
            {allTime.map((f) => {
              const pct =
                allTimeTotal > 0
                  ? (100 * f.cumulativeUs) / allTimeTotal
                  : 0;
              return (
                <li key={f.qualname} className="where-running-row">
                  <span className="where-running-name" title={f.qualname}>
                    {f.qualname}
                  </span>
                  <span className="where-running-pct">{pct.toFixed(1)}%</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function pickTop(
  rows: readonly EventLogFunctionStat[],
  key: (r: EventLogFunctionStat) => number,
): EventLogFunctionStat[] {
  return rows
    .slice()
    .sort((a, b) => key(b) - key(a))
    .slice(0, TOP_N);
}

interface Arrow {
  kind: "new" | "up" | "down" | "same";
  glyph: string;
  title: string;
}

/** Compare a function's rank in the "recent" column to its rank in the
 *  "all-time" column. New = wasn't in the all-time top-N; up = climbed
 *  ≥1 position; down = fell ≥1; same = identical position. */
function arrowFor(recentRank: number, prevRank: number | undefined): Arrow {
  if (prevRank === undefined) {
    return { kind: "new", glyph: "✦", title: "new in this window" };
  }
  if (recentRank < prevRank) {
    return { kind: "up", glyph: "↑", title: `up from #${prevRank}` };
  }
  if (recentRank > prevRank) {
    return { kind: "down", glyph: "↓", title: `down from #${prevRank}` };
  }
  return { kind: "same", glyph: "·", title: "same rank as all-time" };
}

function formatWindowSeconds(us: number): string {
  const s = Math.round(us / 1_000_000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m === 1 ? "1 min" : `${m} min`;
}
