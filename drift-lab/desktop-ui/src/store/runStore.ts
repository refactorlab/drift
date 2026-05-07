import { create } from "zustand";

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

interface RunStore {
  projectPath: string;
  setProjectPath: (p: string) => void;

  runId: string | null;
  isRunning: boolean;
  error: string | null;
  result: RunResult | null;

  steps: StepState[];

  /* Internal mutators used by the IPC bridge. Pages should rely on these
   * instead of touching state directly. */
  beginRun: (runId: string) => void;
  applyStep: (update: { index: number; status: StepStatus; detail?: string; durationMs?: number }) => void;
  finishRun: (result: RunResult) => void;
  failRun: (message: string) => void;
  reset: () => void;
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

  beginRun: (runId) =>
    set({
      runId,
      isRunning: true,
      error: null,
      result: null,
      steps: DEFAULT_STEPS.map((s) => ({ ...s })),
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

  finishRun: (result) => set({ isRunning: false, result }),
  failRun: (message) => set({ isRunning: false, error: message }),
  reset: () =>
    set({
      runId: null,
      isRunning: false,
      error: null,
      result: null,
      steps: DEFAULT_STEPS.map((s) => ({ ...s })),
    }),
}));
