import { create } from "zustand";

import type { Entry as AgentLogEntry } from "../components/ReasoningLog";
import type { AgentMode } from "../lib/tauri";

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
}

const DEFAULT_STEPS: StepState[] = [
  { title: "Locating Docker image",        detail: "Waiting…", status: "pending" },
  { title: "Detecting language & runtime", detail: "Waiting…", status: "pending" },
  { title: "Installing profiler",          detail: "Waiting…", status: "pending" },
  { title: "Running profiling session",    detail: "Waiting…", status: "pending" },
  { title: "Analyzing bottlenecks",        detail: "Waiting…", status: "pending" },
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
      runParams: null,
      startedAt: null,
      endedAt: null,
    }),
  setLogEntries: (entries) => set({ logEntries: entries }),
}));
