// One-sentence headline derived live from the report. Sits between
// the overview cards and the flamegraph and gives the developer a
// plain-English read of "what should I worry about right now?".
//
// Strategy: pick the single most useful observation we can make from
// the runtime + functions data, in priority order:
//
//   1. Spikes in the last minute → "Memory spiked X times in the
//      last minute (peak P, baseline B)"
//   2. Big shift in the hot function vs all-time → "Currently
//      spending X% in F (up from Y% all-time)"
//   3. Memory drift up/down → "Memory growing at +X MB/min over the
//      last minute"
//   4. Baseline calm → "All quiet: top is F at X% of cpu time"
//
// Fall-through to "Waiting for samples…" until at least one event
// with a stack has arrived. The strip never grows beyond one line —
// the goal is to be the thing a developer's eyes hit first.

import type { EventLogReport } from "../../lib/tauri";

interface Props {
  report: EventLogReport;
}

export default function LiveStoryStrip({ report }: Props): JSX.Element | null {
  const story = pickStory(report);
  if (!story) return null;
  return (
    <div
      className={`live-story-strip live-story-strip--${story.tone}`}
      role="status"
      aria-live="polite"
    >
      <span className="live-story-strip-glyph" aria-hidden>
        {story.tone === "warn"
          ? "⚠"
          : story.tone === "watch"
            ? "◉"
            : "✦"}
      </span>
      <span className="live-story-strip-text">{story.text}</span>
    </div>
  );
}

interface Story {
  text: string;
  /** Drives accent color. `warn` = something is on fire; `watch` =
   *  notable shift; `calm` = nothing to do. */
  tone: "calm" | "watch" | "warn";
}

function pickStory(report: EventLogReport): Story | null {
  if (report.totalEvents === 0) {
    return { text: "Waiting for first sample…", tone: "calm" };
  }

  const rt = report.runtime;

  // (1) Spike storm wins.
  if (rt.spikeCountRecent >= 2) {
    return {
      tone: "warn",
      text: `Memory spiked ${rt.spikeCountRecent} times in the last minute — peak ${formatBytes(
        rt.peakMemoryBytesRecent,
      )} vs baseline floor ${formatBytes(rt.minMemoryBytesRecent)}.`,
    };
  }

  // (2) Hot-function shift — find the live top1 and compare its
  // share of recent vs all-time.
  const recentTopShift = topShift(report);
  if (recentTopShift) {
    const { qualname, recentPct, allTimePct } = recentTopShift;
    const delta = recentPct - allTimePct;
    if (Math.abs(delta) >= 8) {
      const arrow = delta > 0 ? "up" : "down";
      return {
        tone: "watch",
        text: `Currently spending ${recentPct.toFixed(0)}% of time in \`${qualname}\` (${arrow} from ${allTimePct.toFixed(0)}% all-time).`,
      };
    }
  }

  // (3) Memory drift. Compare oldest visible sample to current.
  if (rt.samples.length >= 4 && rt.current) {
    const head = rt.samples[Math.floor(rt.samples.length / 4)].memoryBytes;
    const tail = rt.current.memoryBytes;
    if (head > 0 && tail > 0) {
      const diff = tail - head;
      const denom = Math.max(head, 1);
      const pct = (diff / denom) * 100;
      if (pct >= 10) {
        return {
          tone: "watch",
          text: `Memory growing — ${formatBytes(diff)} (+${pct.toFixed(0)}%) over the visible window.`,
        };
      }
      if (pct <= -10) {
        return {
          tone: "calm",
          text: `Memory dropped ${formatBytes(-diff)} (${pct.toFixed(0)}%) — likely GC or workload settling.`,
        };
      }
    }
  }

  // (4) Calm baseline.
  if (recentTopShift) {
    return {
      tone: "calm",
      text: `All steady — top is \`${recentTopShift.qualname}\` at ${recentTopShift.recentPct.toFixed(0)}% over the last ${formatSeconds(report.recentWindowUs)}.`,
    };
  }

  return null;
}

function topShift(
  report: EventLogReport,
): { qualname: string; recentPct: number; allTimePct: number } | null {
  let recentTop = report.functions[0];
  let recentSum = 0;
  let allTimeSum = 0;
  for (const f of report.functions) {
    if (f.recentCumulativeUs > (recentTop?.recentCumulativeUs ?? 0)) {
      recentTop = f;
    }
    recentSum += f.recentCumulativeUs;
    allTimeSum += f.cumulativeUs;
  }
  if (!recentTop || recentTop.recentCumulativeUs === 0 || recentSum === 0) {
    return null;
  }
  const recentPct = (100 * recentTop.recentCumulativeUs) / recentSum;
  const allTimePct =
    allTimeSum > 0 ? (100 * recentTop.cumulativeUs) / allTimeSum : 0;
  return {
    qualname: recentTop.qualname,
    recentPct,
    allTimePct,
  };
}

function formatBytes(b: number): string {
  if (!Number.isFinite(b) || b === 0) return "0 B";
  const sign = b < 0 ? "-" : "";
  const abs = Math.abs(b);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = abs;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const precision = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${sign}${v.toFixed(precision)} ${units[i]}`;
}

function formatSeconds(us: number): string {
  const s = Math.round(us / 1_000_000);
  return `${s} s`;
}
