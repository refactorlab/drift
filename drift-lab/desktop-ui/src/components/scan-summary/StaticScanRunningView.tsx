import { useCallback, useEffect, useState } from "react";

import {
  selectEntryAndScan,
  stopStaticScan,
  type ScanPickerRoot,
} from "../../lib/tauri";
import { useRunStore } from "../../store/runStore";
import MagicOrb from "../MagicOrb";
import EntryPicker from "./EntryPicker";
import ScanProgressList, {
  type OverallStats,
  type PhaseRow,
} from "./ScanProgress";

/**
 * The Home page's "running" state for a static scan.
 *
 * Stateless w.r.t. scan lifecycle — `rows`, `overall`, `roots`,
 * `pickedRoot` come from the runStore via props. Event subscriptions live
 * in `useStaticScanSubscription` at the App level, so this view can safely
 * unmount and re-mount (e.g. when the user navigates to /settings and
 * back) without losing scan progress.
 *
 * Local state is limited to:
 *   - a wall-clock tick so the elapsed/ETA digits move between heartbeats
 *   - a "stop request in flight" flag so the Stop button can disable
 *     itself between click and the backend's confirmation event.
 */
interface Props {
  scanId: string;
  rows: PhaseRow[];
  overall: OverallStats | null;
  roots: ScanPickerRoot[] | null;
  pickedRoot: ScanPickerRoot | null;
}

export default function StaticScanRunningView({
  scanId,
  rows,
  overall,
  roots,
  pickedRoot,
}: Props) {
  const applyStaticScanPicked = useRunStore((s) => s.applyStaticScanPicked);
  const applyStaticScanError = useRunStore((s) => s.applyStaticScanError);
  const [stopping, setStopping] = useState(false);

  // 1Hz wall-clock tick — makes the elapsed/ETA digits move even when no
  // backend events arrive (e.g. mid-parse with throttle suppressing
  // progress callbacks). Cheap: a single setState/sec.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const handlePick = useCallback(
    async (root: ScanPickerRoot) => {
      applyStaticScanPicked(root);
      try {
        await selectEntryAndScan(scanId, root.index);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        applyStaticScanError(scanId, message);
      }
    },
    [scanId, applyStaticScanPicked, applyStaticScanError],
  );

  // Stop button: signals the backend to flip its cancel flag. The progress
  // sink polls the flag on every callback and panics with `CancelledByUser`
  // to unwind the rayon-driven analyzer — typically within a few ms. The
  // backend then emits `scan://error` with message "scan stopped", the
  // store transitions to error state, and Home shows the (neutral-coloured)
  // stopped panel. We optimistically disable the button here so a double-
  // click doesn't fire two stop calls back-to-back.
  const handleStop = useCallback(async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await stopStaticScan(scanId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      applyStaticScanError(scanId, message);
      setStopping(false);
    }
  }, [scanId, stopping, applyStaticScanError]);

  const isPicking = roots !== null && pickedRoot === null;
  const phaseLabel = isPicking
    ? `Pick one of ${roots.length} entry roots to analyze`
    : pickedRoot
      ? `Building focused call-tree for ${pickedRoot.name}`
      : "Discovering entry points";

  return (
    <div className="running-split">
      <div className="running-split-col running-split-col-left">
        <MagicOrb />
        <div className="scan-running-phase">{phaseLabel}</div>
        <ScanProgressList rows={rows} now={now} overall={overall} />
        <div className="scan-running-actions">
          <button
            type="button"
            className="scan-stop-btn scan-stop-btn-inline"
            onClick={handleStop}
            disabled={stopping}
            aria-label="Stop scan"
          >
            <span className="scan-stop-btn-icon" aria-hidden />
            {stopping ? "Stopping…" : "Stop"}
          </button>
        </div>
      </div>
      <div className="running-split-col running-split-col-right">
        <div className="right-pane">
          <div className="right-pane-body" style={{ padding: "0 14px 14px" }}>
            {isPicking && roots ? (
              <EntryPicker roots={roots} onPick={handlePick} />
            ) : (
              <RunningSidebarInfo pickedRoot={pickedRoot} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RunningSidebarInfo({ pickedRoot }: { pickedRoot: ScanPickerRoot | null }) {
  return (
    <div style={{ padding: "16px 4px", color: "var(--text-dim)", fontSize: 13 }}>
      {pickedRoot ? (
        <>
          <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            Focused entry
          </div>
          <code className="scan-code">{pickedRoot.name}</code>
          <div style={{ marginTop: 6, fontSize: 11.5 }}>
            {pickedRoot.file}:{pickedRoot.line} · reach {pickedRoot.reach}
          </div>
          <div style={{ marginTop: 14, fontSize: 12 }}>
            Building call tree, then assembling the findings summary. This is
            where the long compute on big projects lives.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            Static scan
          </div>
          <p>
            Walking your source tree, building a call graph, and ranking the
            top entry points. No LLM is consulted in this phase — the
            analyzer is deterministic.
          </p>
          <p style={{ marginTop: 10 }}>
            When discovery completes, the top entry roots will appear here for
            you to pick from.
          </p>
        </>
      )}
    </div>
  );
}
