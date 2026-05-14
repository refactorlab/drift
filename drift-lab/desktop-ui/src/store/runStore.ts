import { create } from "zustand";

import type { Entry as AgentLogEntry } from "../components/ReasoningLog";
import {
  reduceProgress,
  type OverallStats,
  type PhaseRow,
} from "../components/scan-summary/ScanProgress";
import type {
  AgentMode,
  BlockedQuestion,
  LogLine,
  ScanPickerRoot,
  ScanProgress as ScanProgressEvent,
  TelemetrySample,
  VisibilityMap,
} from "../lib/tauri";

/** Cap on retained samples. ~600 = 5 minutes at the backend's 2 Hz cadence —
 *  any longer and the sparkline becomes unreadable anyway. */
const TELEMETRY_CAP = 600;
/** Cap on retained log lines. A debug-level scan can emit a few hundred per
 *  minute; 2000 covers ~10 minutes before the oldest start rolling out. */
const LOG_CAP = 2000;

export type StepStatus = "pending" | "active" | "done" | "error";

export interface StepState {
  title: string;
  detail: string;
  status: StepStatus;
  durationMs?: number;
}

export interface RunResult {
  runId: string;
  issuesFound: number;
  criticalCount: number;
}

/** Inputs the user picked for the most-recent run. Persisted on the store so
 *  the Rerun button on the Report and Done views can replay the same scan
 *  without making the user re-enter anything. */
export interface RunParams {
  projectPath: string;
  mode: AgentMode;
  goalPrompt?: string;
}

/**
 * Static-scan lifecycle. Lifted out of the Home component (where it used to
 * live as `useState`) so navigating to Settings and back doesn't drop a
 * scan-in-progress — Home re-mounts and re-reads this state.
 *
 *   idle     → before any scan was started
 *   running  → backend has a scan in flight (or parked at the picker)
 *   complete → backend finalized; Home will navigate to /scan/:scanId
 *              the next time it renders, then reset to idle
 *   error    → backend emitted scan://error (includes user-pressed-Stop)
 */
export type StaticScanState =
  | { kind: "idle" }
  | {
      kind: "running";
      scanId: string;
      /** Reduced phase timeline — derived from `scan://progress` events. */
      rows: PhaseRow[];
      /** Latest pipeline heartbeat (driven by `overall` events). Null until
       *  the first heartbeat arrives. Persisted on the store so navigation
       *  away to /settings and back doesn't briefly drop the overall bar. */
      overall: OverallStats | null;
      /** Picker roots once discovery completes; null while still walking/parsing. */
      roots: ScanPickerRoot[] | null;
      /** The entry the user picked from the picker (or null until they pick). */
      pickedRoot: ScanPickerRoot | null;
    }
  | { kind: "complete"; scanId: string }
  | { kind: "error"; message: string };

interface RunStore {
  projectPath: string;
  setProjectPath: (p: string) => void;

  runId: string | null;
  isRunning: boolean;
  error: string | null;
  result: RunResult | null;

  steps: StepState[];

  /** Streaming agent reasoning + tool log. Lives on the store so the Report
   *  page can read it after the live `Home` view unmounts. */
  logEntries: AgentLogEntry[];
  /** Rolling-window telemetry samples for the live TelemetryPane sparklines.
   *  Capped at {@link TELEMETRY_CAP}; oldest drop when full. */
  telemetrySamples: TelemetrySample[];
  /** Rolling-window backend tracing lines, mirroring what's on stderr.
   *  Capped at {@link LOG_CAP}. */
  backendLog: LogLine[];
  /** Currently-in-flight `ask_user` question, or null. While set the
   *  BlockedModal is open and the run is parked. */
  blockedQuestion: BlockedQuestion | null;
  /** Structured "visibility map" delivered just before `RunComplete`. Null
   *  until the backend emits `run://report`. */
  visibilityMap: VisibilityMap | null;
  /** Inputs to replay the same scan. Set when a run starts. */
  runParams: RunParams | null;
  /** Wall-clock UTC ms when the most-recent scan started — Report uses it to
   *  show "ran X seconds ago". */
  startedAt: number | null;
  /** Wall-clock UTC ms when the most-recent scan ended (success or fail). */
  endedAt: number | null;

  /* Internal mutators used by the IPC bridge. Pages should rely on these
   * instead of touching state directly. */
  beginRun: (runId: string, params: RunParams) => void;
  applyStep: (update: { index: number; status: StepStatus; detail?: string; durationMs?: number }) => void;
  finishRun: (result: RunResult) => void;
  failRun: (message: string) => void;
  reset: () => void;
  setLogEntries: (entries: AgentLogEntry[]) => void;
  pushTelemetry: (sample: TelemetrySample) => void;
  pushLogLine: (line: LogLine) => void;
  setBlockedQuestion: (q: BlockedQuestion | null) => void;
  setVisibilityMap: (map: VisibilityMap) => void;

  /** Static-scan state, used by the Home page's running view. The mutators
   *  below are called by `useStaticScanSubscription` in `App` — install once
   *  at the top of the tree so events keep landing even when Home unmounts. */
  staticScan: StaticScanState;
  beginStaticScan: (scanId: string) => void;
  applyStaticScanEvent: (ev: ScanProgressEvent) => void;
  applyStaticScanEntries: (scanId: string, roots: ScanPickerRoot[]) => void;
  applyStaticScanPicked: (root: ScanPickerRoot) => void;
  applyStaticScanComplete: (scanId: string) => void;
  applyStaticScanError: (scanId: string, message: string) => void;
  resetStaticScan: () => void;
}

/** 6-stage UI timeline. The agent's internal 10-step recipe (in the system
 *  prompt) maps onto these — each visible stage may bundle 1-2 internal
 *  steps. Keep in sync with `agent::workflow::tool_to_step_index` in Rust. */
const DEFAULT_STEPS: StepState[] = [
  { title: "Understanding code",   detail: "Waiting…", status: "pending" },
  { title: "Locating how to run",  detail: "Waiting…", status: "pending" },
  { title: "Setting up runtime",   detail: "Waiting…", status: "pending" },
  { title: "Running + profiling",  detail: "Waiting…", status: "pending" },
  { title: "Building thesis",      detail: "Waiting…", status: "pending" },
  { title: "Reporting",            detail: "Waiting…", status: "pending" },
];

export const useRunStore = create<RunStore>((set) => ({
  projectPath: "/Users/jdoe/projects/checkout-service",
  setProjectPath: (p) => set({ projectPath: p }),

  runId: null,
  isRunning: false,
  error: null,
  result: null,

  steps: DEFAULT_STEPS.map((s) => ({ ...s })),

  logEntries: [],
  telemetrySamples: [],
  backendLog: [],
  blockedQuestion: null,
  visibilityMap: null,
  runParams: null,
  startedAt: null,
  endedAt: null,

  beginRun: (runId, params) =>
    set({
      runId,
      isRunning: true,
      error: null,
      result: null,
      steps: DEFAULT_STEPS.map((s) => ({ ...s })),
      logEntries: [],
      telemetrySamples: [],
      backendLog: [],
      blockedQuestion: null,
      visibilityMap: null,
      runParams: params,
      startedAt: Date.now(),
      endedAt: null,
    }),

  applyStep: ({ index, status, detail, durationMs }) =>
    set((state) => {
      const steps = state.steps.slice();
      const current = steps[index];
      if (!current) return state;
      steps[index] = {
        ...current,
        status,
        detail: detail ?? current.detail,
        durationMs: durationMs ?? current.durationMs,
      };
      return { steps };
    }),

  finishRun: (result) => set({ isRunning: false, result, endedAt: Date.now() }),
  failRun: (message) => set({ isRunning: false, error: message, endedAt: Date.now() }),
  reset: () =>
    set({
      runId: null,
      isRunning: false,
      error: null,
      result: null,
      steps: DEFAULT_STEPS.map((s) => ({ ...s })),
      logEntries: [],
      telemetrySamples: [],
      backendLog: [],
      blockedQuestion: null,
      visibilityMap: null,
      runParams: null,
      startedAt: null,
      endedAt: null,
    }),
  setLogEntries: (entries) => set({ logEntries: entries }),
  pushTelemetry: (sample) =>
    set((state) => {
      const next = state.telemetrySamples.concat(sample);
      if (next.length > TELEMETRY_CAP) {
        next.splice(0, next.length - TELEMETRY_CAP);
      }
      return { telemetrySamples: next };
    }),
  pushLogLine: (line) =>
    set((state) => {
      const next = state.backendLog.concat(line);
      if (next.length > LOG_CAP) {
        next.splice(0, next.length - LOG_CAP);
      }
      return { backendLog: next };
    }),
  setBlockedQuestion: (q) => set({ blockedQuestion: q }),
  setVisibilityMap: (map) => set({ visibilityMap: map }),

  staticScan: { kind: "idle" },
  beginStaticScan: (scanId) =>
    set({
      staticScan: {
        kind: "running",
        scanId,
        rows: [],
        overall: null,
        roots: null,
        pickedRoot: null,
      },
    }),
  applyStaticScanEvent: (ev) =>
    set((state) => {
      // Filter to the active scan; events for stale scan ids (e.g. a fresh
      // scan started before the old one's stream fully drained) are
      // ignored so the timeline never contaminates across runs.
      if (
        state.staticScan.kind !== "running" ||
        state.staticScan.scanId !== ev.scanId
      ) {
        return state;
      }
      // Pipeline heartbeat lives in its own slot (the overall bar lives
      // above the per-phase timeline). Other variants flow through the
      // row reducer; `reduceProgress` returns identity for `overall` so
      // we don't double-handle it.
      if (ev.kind === "overall") {
        return {
          staticScan: {
            ...state.staticScan,
            overall: {
              phaseIndex: ev.phaseIndex,
              phaseTotalHint: ev.phaseTotalHint,
              elapsedMs: ev.elapsedMs,
              receivedAt: Date.now(),
            },
          },
        };
      }
      return {
        staticScan: {
          ...state.staticScan,
          rows: reduceProgress(state.staticScan.rows, ev),
        },
      };
    }),
  applyStaticScanEntries: (scanId, roots) =>
    set((state) => {
      if (
        state.staticScan.kind !== "running" ||
        state.staticScan.scanId !== scanId
      ) {
        return state;
      }
      return { staticScan: { ...state.staticScan, roots } };
    }),
  applyStaticScanPicked: (root) =>
    set((state) => {
      if (state.staticScan.kind !== "running") return state;
      return { staticScan: { ...state.staticScan, pickedRoot: root } };
    }),
  applyStaticScanComplete: (scanId) =>
    set((state) => {
      // Defensive: only transition if this completion is for the active
      // scan. A late-arriving complete event for an old scan would
      // otherwise overwrite a freshly-started one.
      if (
        state.staticScan.kind === "running" &&
        state.staticScan.scanId !== scanId
      ) {
        return state;
      }
      return { staticScan: { kind: "complete", scanId } };
    }),
  applyStaticScanError: (scanId, message) =>
    set((state) => {
      if (
        state.staticScan.kind === "running" &&
        state.staticScan.scanId !== scanId
      ) {
        return state;
      }
      return { staticScan: { kind: "error", message } };
    }),
  resetStaticScan: () => set({ staticScan: { kind: "idle" } }),
}));
