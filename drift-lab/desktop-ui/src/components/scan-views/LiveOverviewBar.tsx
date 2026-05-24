// Headline strip rendered above the report tabs on the LiveScan page.
// Four cards, all derived from the new `runtime` + `rightNow` fields
// on `EventLogReport`:
//
//   1. Memory          — current RSS + sparkline + peak label
//   2. CPU             — current loadavg + sparkline + peak label
//   3. Active stack    — leaf-frame name + file:line + service/pod
//                        (answers the user's "where am I currently
//                        running mostly" question, refreshed every
//                        aggregate tick)
//   4. Spikes (60s)    — count of memory readings above the rolling
//                        2σ threshold; shows "all calm" when zero
//
// The bar is always rendered — when the source events.log doesn't
// carry memory_bytes (legacy file), the memory + spike cards
// gracefully render placeholder text instead of disappearing, so the
// layout below stays stable.

import type {
  EventLogReport,
  EventLogRuntimeSample,
} from "../../lib/tauri";
import MicroSparkline from "./MicroSparkline";

interface Props {
  report: EventLogReport;
}

export default function LiveOverviewBar({ report }: Props): JSX.Element {
  const rt = report.runtime;
  const rn = report.rightNow;

  const hasMemory = rt.current !== null && rt.current.memoryBytes > 0;
  const memSeries = rt.samples.map((s) => s.memoryBytes);
  const cpuSeries = rt.samples.map((s) => s.cpu);
  const hasCpu = rt.current !== null && (rt.current.cpu > 0 || rt.peakCpu > 0);

  const memTrend = trendOf(rt.samples, "memoryBytes");
  const cpuTrend = trendOf(rt.samples, "cpu");

  return (
    <div className="live-overview-bar" role="region" aria-label="live overview">
      <OverviewCard
        title="Memory"
        primary={hasMemory ? formatBytes(rt.current!.memoryBytes) : "—"}
        secondary={
          hasMemory
            ? `peak ${formatBytes(rt.peakMemoryBytes)}`
            : "no memory data on this stream"
        }
        trend={memTrend}
        accent="memory"
        sparkline={
          hasMemory ? (
            <MicroSparkline values={memSeries} ariaLabel="memory" />
          ) : null
        }
      />
      <OverviewCard
        title="CPU load"
        primary={hasCpu ? rt.current!.cpu.toFixed(2) : "—"}
        secondary={
          hasCpu
            ? `peak ${rt.peakCpu.toFixed(2)} · 1-min loadavg`
            : "no cpu data on this stream"
        }
        trend={cpuTrend}
        accent="cpu"
        sparkline={
          hasCpu ? <MicroSparkline values={cpuSeries} ariaLabel="cpu" /> : null
        }
      />
      <OverviewCard
        title="Where am I running"
        primary={rn?.leafName ?? "—"}
        secondary={describeRightNow(rn)}
        accent="stack"
        muted={rn?.leafIsSystem === true}
      />
      <OverviewCard
        title={`Spikes (last ~${formatWindowSeconds(60_000_000)})`}
        primary={String(rt.spikeCountRecent)}
        secondary={
          rt.spikeCountRecent === 0
            ? "memory steady (no >2σ readings)"
            : `${rt.spikeCountRecent} memory reading${
                rt.spikeCountRecent === 1 ? "" : "s"
              } above ~2σ baseline`
        }
        accent={rt.spikeCountRecent > 0 ? "warn" : "calm"}
      />
    </div>
  );
}

type Trend = "up" | "down" | "flat" | "unknown";
type Accent = "memory" | "cpu" | "stack" | "warn" | "calm";

interface CardProps {
  title: string;
  primary: string;
  secondary: string;
  trend?: Trend;
  accent: Accent;
  sparkline?: JSX.Element | null;
  muted?: boolean;
}

function OverviewCard({
  title,
  primary,
  secondary,
  trend,
  accent,
  sparkline,
  muted,
}: CardProps) {
  return (
    <section
      className={`live-overview-card live-overview-card--${accent}${muted ? " muted" : ""}`}
      aria-label={title}
    >
      <div className="live-overview-card-head">
        <span className="live-overview-card-title">{title}</span>
        {trend && trend !== "unknown" && (
          <span
            className={`live-overview-trend live-overview-trend--${trend}`}
            title={`${trend} over the visible window`}
            aria-label={`trend ${trend}`}
          >
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "■"}
          </span>
        )}
      </div>
      <div className="live-overview-card-primary" title={primary}>
        {primary}
      </div>
      <div className="live-overview-card-secondary">{secondary}</div>
      {sparkline && (
        <div className="live-overview-card-sparkline">{sparkline}</div>
      )}
    </section>
  );
}

/** Pick a single-line description of the right-now stack. */
function describeRightNow(
  rn: EventLogReport["rightNow"] | undefined,
): string {
  if (!rn) return "waiting for first stack…";
  const parts: string[] = [];
  if (rn.leafFile) {
    const base = basename(rn.leafFile);
    parts.push(rn.leafLine != null ? `${base}:${rn.leafLine}` : base);
  }
  if (rn.service) parts.push(rn.service);
  if (rn.pod && rn.pod !== rn.service) parts.push(rn.pod);
  if (rn.leafIsSystem) parts.push("system frame");
  if (rn.stackDepth > 1) parts.push(`depth ${rn.stackDepth}`);
  return parts.length > 0 ? parts.join(" · ") : "stack info unavailable";
}

/** Trend = sign of (last - first) ignoring tiny wiggles (< 1% of range). */
function trendOf(
  samples: readonly EventLogRuntimeSample[],
  field: "memoryBytes" | "cpu",
): Trend {
  if (samples.length < 4) return "unknown";
  const first = samples[Math.floor(samples.length / 4)][field];
  const last = samples[samples.length - 1][field];
  if (first === 0 && last === 0) return "unknown";
  const denom = Math.max(Math.abs(first), Math.abs(last), 1);
  const delta = (last - first) / denom;
  if (delta > 0.05) return "up";
  if (delta < -0.05) return "down";
  return "flat";
}

/** Human-friendly bytes. We render at most 3 significant digits and
 *  pick the largest unit that keeps the value < 1024 in that unit. */
function formatBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const precision = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(precision)} ${units[i]}`;
}

function formatWindowSeconds(us: number): string {
  const s = Math.round(us / 1_000_000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return m === 1 ? "1 min" : `${m} min`;
}

function basename(p: string): string {
  // Match the rest of the UI's basename helper — handles both / and \.
  const seg = p.split(/[\\/]/);
  return seg[seg.length - 1] || p;
}
