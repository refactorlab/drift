/**
 * Thin wrapper around the Tauri 2 API. When running in a plain browser (e.g.
 * `npm run dev` outside of `tauri dev`), every command falls back to a local
 * mock so the UI is fully exercisable without the Rust side built.
 */

type StepStatus = "pending" | "active" | "done" | "error";

export interface StepUpdate {
  runId: string;
  index: number;
  status: StepStatus;
  detail?: string;
  durationMs?: number;
}

export interface RunComplete {
  runId: string;
  issuesFound: number;
  criticalCount: number;
}

export interface RunError {
  runId: string;
  message: string;
}

export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---------- Tauri-backed implementation ----------
async function realInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function realListen<T>(
  event: string,
  cb: (payload: T) => void,
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<T>(event, (e) => cb(e.payload));
  return unlisten;
}

// ---------- Mock implementation (browser dev mode) ----------
const MOCK_STEPS: { detail: string; doneDetail: string; duration: number }[] = [
  { detail: "Scanning project for Dockerfile…",       doneDetail: "Found checkout-service:latest (247 MB)", duration: 1200 },
  { detail: "Inspecting image layers…",                doneDetail: "Python 3.11 · FastAPI · uvicorn",         duration: 1400 },
  { detail: "Injecting py-spy into container…",        doneDetail: "py-spy v0.3.14 installed",                duration: 1700 },
  { detail: "Driving load · 50 RPS for 60s…",          doneDetail: "3,047 samples captured",                  duration: 2400 },
  { detail: "Building flame graph & ranking issues…",  doneDetail: "7 issues detected",                       duration: 1400 },
];

type Listener<T> = (p: T) => void;
const mockListeners: Record<string, Set<Listener<unknown>>> = {};

function mockEmit<T>(event: string, payload: T) {
  mockListeners[event]?.forEach((cb) => cb(payload as unknown));
}

function mockListen<T>(event: string, cb: (payload: T) => void): () => void {
  const set = (mockListeners[event] ??= new Set());
  const wrapped: Listener<unknown> = (p) => cb(p as T);
  set.add(wrapped);
  return () => set.delete(wrapped);
}

async function mockStartRun(_path: string): Promise<string> {
  const runId = crypto.randomUUID();
  // Fire steps with the same cadence as the example.
  let cumulative = 350;
  MOCK_STEPS.forEach((s, index) => {
    setTimeout(
      () => mockEmit<StepUpdate>("run://step", { runId, index, status: "active", detail: s.detail }),
      cumulative,
    );
    cumulative += s.duration;
    setTimeout(
      () => mockEmit<StepUpdate>("run://step", { runId, index, status: "done", detail: s.doneDetail, durationMs: s.duration }),
      cumulative,
    );
  });
  setTimeout(
    () => mockEmit<RunComplete>("run://complete", { runId, issuesFound: 7, criticalCount: 3 }),
    cumulative + 600,
  );
  return runId;
}

async function mockSelectPath(): Promise<string | null> {
  // No native dialog in browser; just echo a fake path.
  return "/Users/jdoe/projects/checkout-service";
}

// ---------- Public surface ----------
export async function selectProjectPath(): Promise<string | null> {
  if (!isTauri()) return mockSelectPath();
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ directory: true, multiple: false, title: "Choose project" });
  if (result === null) return null;
  return Array.isArray(result) ? (result[0] ?? null) : result;
}

export async function startRun(projectPath: string): Promise<string> {
  if (!isTauri()) return mockStartRun(projectPath);
  return realInvoke<string>("start_run", { projectPath });
}

export async function onStepUpdate(cb: (u: StepUpdate) => void): Promise<() => void> {
  if (!isTauri()) return mockListen("run://step", cb);
  return realListen<StepUpdate>("run://step", cb);
}

export async function onRunComplete(cb: (c: RunComplete) => void): Promise<() => void> {
  if (!isTauri()) return mockListen("run://complete", cb);
  return realListen<RunComplete>("run://complete", cb);
}

export async function onRunError(cb: (e: RunError) => void): Promise<() => void> {
  if (!isTauri()) return mockListen("run://error", cb);
  return realListen<RunError>("run://error", cb);
}
