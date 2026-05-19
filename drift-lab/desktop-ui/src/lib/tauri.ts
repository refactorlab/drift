/**
 * Thin wrapper around the Tauri 2 IPC. Every call goes straight to the Rust
 * backend via `invoke` / `listen` — there is no browser-mode fallback. The UI
 * is always shipped inside Tauri; running pure vite (`make ui`) will fail any
 * call that touches the backend, by design.
 *
 * Why no mocks: the scan flow is end-to-end agent-driven. Fake step timers
 * shadow the real `agent::workflow` event stream and let regressions hide.
 * If you need to iterate on layout without the backend, work in components
 * that don't touch this module.
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";

import { decompressReport } from "./decompress";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return tauriInvoke<T>(cmd, args);
}

async function listen<T>(event: string, cb: (payload: T) => void): Promise<() => void> {
  return tauriListen<T>(event, (e) => cb(e.payload));
}

// ---------- Run timeline events ----------

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

export async function selectProjectPath(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ directory: true, multiple: false, title: "Choose project" });
  if (result === null) return null;
  return Array.isArray(result) ? (result[0] ?? null) : result;
}

// ---------- Agent-driven scan ----------

/** Permission mode for the iterative agent. `auto` runs every tool without
 *  prompting (the user has explicitly opted in by starting a scan); `default`
 *  asks for approval before destructive steps; `read_only` refuses them. */
export type AgentMode = "auto" | "default" | "read_only";

export interface PromptPreset {
  label: string;
  prompt: string;
}

/** Server-side list of canned scan goals. UI augments with an Other slot
 *  that submits free text as `goalPrompt`. */
export async function listPromptPresets(): Promise<PromptPreset[]> {
  return invoke<PromptPreset[]>("list_prompt_presets");
}

/**
 * Start an agent-driven scan. Returns the `run_id` immediately; the agent
 * loop runs in a Tokio task and emits `run://step`, `run://complete`, and
 * `run://error` events tagged with that id. This split — POST-and-return,
 * events on a separate channel — mirrors goosed's session-event bus.
 *
 * `goalPrompt` is `undefined` to use the default recipe prompt (see
 * `agent::workflow::default_goal_prompt`); pass a string from
 * `listPromptPresets` or free text for an "Other" goal.
 */
export async function startAgentRun(
  projectPath: string,
  options: { mode?: AgentMode; goalPrompt?: string } = {},
): Promise<string> {
  return invoke<string>("start_agent_run", {
    projectPath,
    mode: options.mode ?? "auto",
    goalPrompt: options.goalPrompt ?? null,
  });
}

export async function onStepUpdate(cb: (u: StepUpdate) => void): Promise<() => void> {
  return listen<StepUpdate>("run://step", cb);
}

export async function onRunComplete(cb: (c: RunComplete) => void): Promise<() => void> {
  return listen<RunComplete>("run://complete", cb);
}

export async function onRunError(cb: (e: RunError) => void): Promise<() => void> {
  return listen<RunError>("run://error", cb);
}

// ---------- Telemetry + visibility map ----------

/** One container snapshot from the Rust-side `docker stats` poller. Counters
 *  are absolute (cumulative bytes); the UI derives bytes/sec by diffing
 *  successive samples in the same series. */
export interface TelemetrySample {
  runId: string;
  tsMs: number;
  containerId: string;
  cpuPct: number;
  memMb: number;
  memPct: number;
  netRxBytes: number;
  netTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
}

/** One ranked hotspot from `analyze_samples`. Mirrors the Rust `Issue` struct
 *  in `tools/analyze_samples.rs` — keep in sync. */
export type IssueCategory =
  | "database"
  | "network"
  | "cpu"
  | "lock"
  | "gc"
  | "serde"
  | "filesystem"
  | "unknown";

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface Issue {
  rank: number;
  function: string;
  category: IssueCategory;
  severity: IssueSeverity;
  self_pct: number;
  total_pct: number;
  samples: number;
  example_stack: string;
}

/** End-of-run summary the backend builds from `analyze_samples` + one LLM
 *  synthesis turn for `architecture_advice`. */
export interface VisibilityMap {
  critical: Issue[];
  warnings: Issue[];
  estimatedCpuReductionPct: number;
  architectureAdvice: string[];
}

export interface RunReport {
  runId: string;
  map: VisibilityMap;
}

export async function onTelemetrySample(
  cb: (sample: TelemetrySample) => void,
): Promise<() => void> {
  return listen<TelemetrySample>("agent:telemetry", cb);
}

export async function onRunReport(cb: (report: RunReport) => void): Promise<() => void> {
  return listen<RunReport>("run://report", cb);
}

/** One formatted line out of the Rust `tracing` pipeline. Mirrors what's
 *  printed to stderr — the in-app log pane renders this so you don't need a
 *  terminal to see what the backend is up to. */
export interface LogLine {
  tsMs: number;
  level: string;
  target: string;
  message: string;
}

export async function onLogLine(cb: (line: LogLine) => void): Promise<() => void> {
  return listen<LogLine>("agent:log", cb);
}

// ---------- System tray deep-links ----------

/**
 * The user clicked "Settings…" in the system tray menu. The Rust side has
 * already shown the main window; the UI's job is to navigate to
 * `/settings`. Mirrors the `EVENT_OPEN_SETTINGS` constant in `tray.rs` —
 * the wire name must match exactly.
 */
export async function onOpenSettings(cb: () => void): Promise<() => void> {
  return listen<unknown>("tray://open-settings", () => cb());
}

// ---------- Blocked-on-user question ----------

/** The agent called `ask_user` and is parked waiting for a human answer.
 *  The UI shows a BlockedModal with `question`; the user's reply flows back
 *  through {@link answerBlockedQuestion}. */
export interface BlockedQuestion {
  id: string;
  question: string;
}

export async function onBlockedQuestion(
  cb: (q: BlockedQuestion) => void,
): Promise<() => void> {
  return listen<BlockedQuestion>("agent:blocked", cb);
}

/** Deliver the operator's answer to the in-flight blocked question. The
 *  agent loop resumes with `answer` as the tool's content. Throws if no
 *  question is pending. */
export async function answerBlockedQuestion(answer: string): Promise<void> {
  return invoke<void>("answer_blocked_question", { answer });
}

/**
 * Streaming `AgentEvent` mirror — the Rust workflow forwards every event the
 * iterative loop produced (text deltas, tool dispatch / completion, usage,
 * errors) so the UI can render a "live reasoning + tool log" panel.
 *
 * Variants match `crate::agent::agent_loop::AgentEvent` (serde tag = "kind",
 * snake_case). Keep this union in sync with the Rust enum — it ships over
 * the wire as JSON, so a missing variant becomes an `unknown` at runtime.
 */
export type AgentEvent =
  | { kind: "text_delta"; text: string }
  | { kind: "assistant_message"; message: unknown }
  | {
      kind: "tool_dispatched";
      id: string;
      name: string;
      arguments: unknown;
    }
  | { kind: "tool_completed"; id: string; content: string; is_error: boolean }
  | {
      kind: "tool_needs_approval";
      id: string;
      name: string;
      arguments: unknown;
    }
  | { kind: "usage"; [extra: string]: unknown }
  | { kind: "turn_budget_exceeded"; max_turns: number }
  | { kind: "error"; message: string }
  | { kind: "done" };

export async function onAgentEvent(
  cb: (event: AgentEvent) => void,
): Promise<() => void> {
  return listen<AgentEvent>("agent:event", cb);
}

// ---------- LLM agent backend ----------

/** A saved backend config — one of two wire protocols. Mirrors
 *  `crate::model_config::ModelBackend` (serde tag = "mode", lowercase).
 *
 *  - `api`: OpenAI-compatible HTTP. Covers cloud OpenAI, Groq, OpenRouter,
 *    Azure, and every local runtime (Ollama, LM Studio, Docker Model
 *    Runner, vLLM, llama-server). Local providers are discovered via
 *    {@link probeLocalRuntimes} and saved with `api_key: "not-needed"`.
 *  - `anthropic`: Claude's native `/v1/messages` shape. Distinct because
 *    auth uses `x-api-key` instead of `Authorization: Bearer`, `max_tokens`
 *    is required, and the SSE wire format differs in load-bearing ways.
 *    Provider impl: `agent::anthropic::ClaudeProvider`. */
export type ModelBackendConfig =
  | {
      mode: "api";
      base_url: string;
      api_key: string;
      model: string;
    }
  | {
      mode: "anthropic";
      base_url: string;
      api_key: string;
      model: string;
    };

export async function configureBackend(config: ModelBackendConfig): Promise<void> {
  return invoke<void>("configure_backend", { config });
}

/** Persist the config without resolving (download / spawn happens on first chat). */
export async function saveBackendConfig(config: ModelBackendConfig): Promise<void> {
  return invoke<void>("save_backend_config", { config });
}

export async function loadBackendConfig(): Promise<ModelBackendConfig | null> {
  return invoke<ModelBackendConfig | null>("load_backend_config");
}

export async function clearBackend(): Promise<void> {
  return invoke<void>("clear_backend");
}

/**
 * Backend lifecycle status. Mirrors the `BackendStatus` enum in `events.rs`.
 * `kind` is the discriminator; remaining fields depend on the variant.
 */
export type BackendStatus =
  | { kind: "unconfigured" }
  | { kind: "idle"; mode: string; model: string }
  | { kind: "starting" }
  | { kind: "ready"; mode: string; model: string }
  | { kind: "error"; message: string };

export async function getBackendStatus(): Promise<BackendStatus> {
  return invoke<BackendStatus>("get_backend_status");
}

/**
 * URL the bundled localhost HTTP server is listening on (e.g.
 * `http://127.0.0.1:5151`), or `null` if the bind step hasn't finished
 * yet. The Home page's viewer + Swagger buttons read this so the actual
 * port — possibly overridden via `DRIFT_HTTP_PORT` — drives the link.
 */
export async function getHttpServerUrl(): Promise<string | null> {
  return invoke<string | null>("get_http_server_url");
}

export async function onBackendStatus(
  cb: (status: BackendStatus) => void,
): Promise<() => void> {
  return listen<BackendStatus>("backend:status", cb);
}

/**
 * Stream a chat message. Tokens arrive via `chat:token` events; completion via
 * `chat:done`; errors via `chat:error`. Returns once the request is queued.
 */
export async function chat(message: string, preamble?: string): Promise<void> {
  return invoke<void>("chat", { message, preamble });
}

/** Non-streaming variant — returns the full response as a string. */
export async function chatOneshot(message: string, preamble?: string): Promise<string> {
  return invoke<string>("chat_oneshot", { message, preamble });
}

export async function onChatToken(cb: (token: string) => void): Promise<() => void> {
  return listen<string>("chat:token", cb);
}

export async function onChatDone(cb: () => void): Promise<() => void> {
  return listen<unknown>("chat:done", () => cb());
}

export async function onChatError(cb: (msg: string) => void): Promise<() => void> {
  return listen<string>("chat:error", cb);
}

// ---------- Multi-provider config (Phase 1.5) ----------

/** Wire protocol a preset targets. Forwarded into the saved
 *  `ModelBackendConfig.mode`. `api` for everything OpenAI-compatible,
 *  `anthropic` for Claude (its `/v1/messages` shape is incompatible enough
 *  to need its own path). */
export type PresetMode = "api" | "anthropic";

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  /** May be empty for local OpenAI-compatible endpoints — call
   *  {@link listModelsFromEndpoint} to populate. */
  models: string[];
  apiKeyUrl: string;
  /** `false` for local providers (Ollama, Docker Model Runner, LM Studio).
   *  When false, the Add Provider form hides the key input and submits
   *  `not-needed` automatically. */
  requiresApiKey: boolean;
  /** One-line copy explaining how to install/start this provider. */
  description: string;
  /** Which wire protocol this preset speaks. The Onboarding /
   *  AddProviderForm flows read this to choose the `mode` they send to
   *  `save_provider` / `test_provider`. Defaults to `api`. */
  mode: PresetMode;
}

export interface SavedProvider {
  id: string;
  name: string;
  config: ModelBackendConfig;
  createdAt: number;
}

export interface AppConfig {
  onboardingComplete: boolean;
  activeProviderId: string | null;
  providers: SavedProvider[];
  /** User-toggleable scan-walker filters. The Rust side serde-defaults this
   *  when missing from older config files; the field always exists at
   *  runtime, but is marked optional for forward-compat across future Rust
   *  rollbacks. */
  scanFilters: ScanFilters;
}

export interface ScanFilters {
  /** Skip directories named `static` / `assets` during static analysis.
   *  Default true — these almost always hold vendored minified JS that
   *  dominates the entry-point picker with synthetic top callers. Users
   *  analyzing a project where these dirs hold real source can disable. */
  excludeStaticAssets: boolean;
  /** Drop test/spec/mock files at the walker stage. Default true — a
   *  heavy bundled test file (e.g. a vite-built `*.test.js`) can otherwise
   *  flip the linguist breakdown to the wrong language and starve the
   *  entry-point picker. Mirrors `make scan-prompt`'s default behavior. */
  excludeTests: boolean;
}

/** One local runtime detected on the user's machine via `probeLocalRuntimes`.
 *  Plug-and-play: whichever runtime (Ollama, LM Studio, Docker Model Runner)
 *  the user already has installed shows up here. */
export interface DiscoveredRuntime {
  presetId: string;
  name: string;
  baseUrl: string;
  models: string[];
  /** Set when models were detected via a sidechannel (e.g. `docker model list`)
   *  but the HTTP endpoint isn't reachable. UI should disable activation and
   *  show this string. */
  note?: string;
}

export async function listPresets(): Promise<ProviderPreset[]> {
  return invoke<ProviderPreset[]>("list_presets");
}

/** Probe every curated local OpenAI-compatible runtime in parallel with a
 *  hard 800ms per-runtime timeout. Returns only the ones that responded.
 *  Also writes the result to the SQLite cache. */
export async function probeLocalRuntimes(): Promise<DiscoveredRuntime[]> {
  return invoke<DiscoveredRuntime[]>("probe_local_runtimes");
}

/** Read last-known runtimes from the SQLite cache without doing a network
 *  probe. Call this on mount for an instant first paint; then call
 *  {@link probeLocalRuntimes} in the background to refresh. */
export async function cachedLocalRuntimes(): Promise<DiscoveredRuntime[]> {
  return invoke<DiscoveredRuntime[]>("cached_local_runtimes");
}

export async function getAppConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("get_app_config");
}

/** Persist a new ScanFilters block. Returns the saved value so the UI can
 *  reconcile against the canonical Rust-side state in case any field was
 *  normalized server-side. */
export async function updateScanFilters(
  filters: ScanFilters,
): Promise<ScanFilters> {
  return invoke<ScanFilters>("update_scan_filters", { filters });
}

export async function testProvider(config: ModelBackendConfig): Promise<void> {
  return invoke<void>("test_provider", { config });
}

export async function saveProvider(
  name: string,
  config: ModelBackendConfig,
  activate: boolean,
): Promise<SavedProvider> {
  return invoke<SavedProvider>("save_provider", { name, config, activate });
}

export async function activateProvider(id: string): Promise<void> {
  return invoke<void>("activate_provider", { id });
}

export async function deleteProvider(id: string): Promise<void> {
  return invoke<void>("delete_provider", { id });
}

export async function resetAllConfig(): Promise<void> {
  return invoke<void>("reset_all_config");
}

// ---------- Generic helpers ----------

/**
 * Race a promise against a deadline. On timeout, throws `Error("timed out
 * after Xms")` — match against `/timed out|timeout/i` to route in the UI.
 *
 * Used to guard `checkForUpdate()` so the UI never sits on "Checking…" if
 * Tauri's reqwest is hung against an unreachable / placeholder endpoint.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// ---------- Live model discovery ----------

/** Probe an OpenAI-compatible endpoint (cloud or local) for its model list.
 *  Throws if unreachable or non-OpenAI-shaped response. */
export async function listModelsFromEndpoint(
  baseUrl: string,
  apiKey?: string,
): Promise<string[]> {
  return invoke<string[]>("list_models_from_endpoint", {
    baseUrl,
    apiKey: apiKey || null,
  });
}

// ---------- Auto-update ----------

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes?: string;
  date?: string;
}

export type UpdateProgress =
  | { kind: "started"; contentLength?: number }
  | { kind: "progress"; downloaded: number; contentLength?: number }
  | { kind: "finished" };

/**
 * Check the configured updater endpoint. Returns the available update or null.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update || !update.available) return null;
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body ?? undefined,
    date: update.date ?? undefined,
  };
}

/**
 * Download and install the latest update, streaming progress events, then
 * relaunch the app. Throws if no update is available — call `checkForUpdate`
 * first.
 */
export async function downloadAndInstallUpdate(
  onProgress?: (p: UpdateProgress) => void,
): Promise<void> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update || !update.available) throw new Error("no update available");

  let total: number | undefined;
  let received = 0;

  await update.downloadAndInstall((event) => {
    if (!onProgress) return;
    if (event.event === "Started") {
      total = event.data.contentLength ?? undefined;
      received = 0;
      onProgress({ kind: "started", contentLength: total });
    } else if (event.event === "Progress") {
      received += event.data.chunkLength;
      onProgress({ kind: "progress", downloaded: received, contentLength: total });
    } else if (event.event === "Finished") {
      onProgress({ kind: "finished" });
    }
  });

  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

/** App version pulled from the Tauri config — no network round-trip. */
export async function getAppVersion(): Promise<string> {
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

// ---------- Conversations + cancel (Phase 3 + 4) ----------

/**
 * `rig::message::Message` is a complex tagged union (text, tool calls,
 * reasoning blocks, etc.). The UI rarely cares — just read `role` and the
 * extracted text via `messageText()`.
 */
export type ChatMessage = unknown;

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  return invoke<ConversationSummary[]>("list_conversations");
}

export async function loadConversation(id: string): Promise<Conversation> {
  return invoke<Conversation>("load_conversation", { id });
}

export async function newConversation(): Promise<void> {
  return invoke<void>("new_conversation");
}

export async function deleteConversation(id: string): Promise<void> {
  return invoke<void>("delete_conversation", { id });
}

export async function getCurrentConversation(): Promise<Conversation | null> {
  return invoke<Conversation | null>("get_current_conversation");
}

export async function cancelChat(): Promise<void> {
  return invoke<void>("cancel_chat");
}

// ---------- Static scan (drift-static-profiler) ----------
//
// Two-step flow: `startStaticScan` runs root discovery, emits a stream of
// `scan://progress` events, then fires `scan://entries-ready` with the
// top-10 entry roots. The user picks one; the UI calls
// `selectEntryAndScan(scanId, rootIndex)` and the same task wakes up to
// build the focused report. On success a `scan://complete` event arrives
// with the path of the saved JSON.

export type ScanProgress =
  | { kind: "walk_start"; scanId: string }
  | { kind: "walk_progress"; scanId: string; filesSeen: number }
  | { kind: "walk_end"; scanId: string; totalFiles: number; bytes: number }
  | { kind: "parse_start"; scanId: string; totalSourceFiles: number }
  | { kind: "parse_progress"; scanId: string; done: number; total: number; current: string | null }
  | { kind: "phase"; scanId: string; name: string }
  | { kind: "step_start"; scanId: string; label: string; total: number }
  | { kind: "step_progress"; scanId: string; label: string; done: number; total: number; current: string | null }
  // Pipeline-level heartbeat — one per phase boundary. The UI uses it to
  // render a tqdm-style overall bar (phase X/Y · elapsed · ETA) above the
  // per-phase timeline. `elapsedMs` is measured from the moment the
  // analysis task started in the backend, so it includes any time spent
  // parked on the picker.
  | { kind: "overall"; scanId: string; phaseIndex: number; phaseTotalHint: number; elapsedMs: number };

export interface ScanPickerCaller {
  name: string;
  file: string;
  line: number;
}

export interface ScanPickerRoot {
  index: number;
  name: string;
  file: string;
  line: number;
  reach: number;
  callers: ScanPickerCaller[];
}

export interface ScanEntriesReady {
  scanId: string;
  roots: ScanPickerRoot[];
}

export interface ScanComplete {
  scanId: string;
  savedPath: string;
  pickedRoot: string | null;
}

export interface ScanErrorPayload {
  scanId: string;
  message: string;
}

/** Row metadata, fired *before* the LLM stream opens. The UI uses this to
 *  render an empty suggestion row with a streaming spinner, so the user sees
 *  the badges + file:line immediately — same UX as a ChatGPT bubble that
 *  appears before any text. */
export interface ScanSuggestionStartPayload {
  scanId: string;
  index: number;
  source: "immediate_fix" | "refactor_candidate" | "finding_top";
  kind: string;
  severity: string;
  file: string;
  line: number;
  name: string;
}

/** One text fragment from the provider stream. Append to the row's body —
 *  the backend guarantees fragments are sequential and non-overlapping. */
export interface ScanSuggestionDeltaPayload {
  scanId: string;
  index: number;
  delta: string;
}

/** Final settled body for one finding. The frontend uses this both to mark
 *  the row no-longer-streaming and to reconcile its delta accumulator (Tauri
 *  events are best-effort — reconciliation guarantees the row ends with the
 *  exact text the backend captured). */
export interface ScanSuggestionPayload {
  scanId: string;
  index: number;
  source: "immediate_fix" | "refactor_candidate" | "finding_top";
  kind: string;
  severity: string;
  file: string;
  line: number;
  name: string;
  suggestion: string;
}

export interface ScanSuggestionDone {
  scanId: string;
  total: number;
  failed: number;
}

/** Saved-scan envelope returned by `loadStaticScan`. The `report` mirrors
 *  the JSON the static-profiler CLI writes — same shape, so the same
 *  summary components render it identically. */
export interface StoredScan {
  scanId: string;
  savedAt: string;
  /// Typed loosely here; the summary components in
  /// `components/scan-summary` declare the concrete shape they need. */
  report: unknown;
  /// Full picker-root list the discovery phase produced for this scan.
  /// Empty for scans saved before the cache was introduced — the UI hides
  /// the "Pick another entry" affordance when this is empty.
  pickerRoots: ScanPickerRoot[];
}

export interface ScanMeta {
  scanId: string;
  savedAt: string;
  sourceRoot: string | null;
  profiledLanguage: string | null;
  files: number;
  symbols: number;
  findingsTotal: number;
}

export async function startStaticScan(projectPath: string): Promise<string> {
  return invoke<string>("start_static_scan", { projectPath });
}

export async function selectEntryAndScan(
  scanId: string,
  rootIndex: number | null,
): Promise<void> {
  return invoke<void>("select_entry_and_scan", { scanId, rootIndex });
}

/**
 * Re-run the focused profile against a different entry from a prior scan's
 * cached picker roots — skips the discovery phase and the picker pause.
 *
 * Returns the *new* `scan_id`. Progress streams over the same
 * `scan://progress` channel; no `scan://entries-ready` event will fire (the
 * picker is bypassed), so the UI should render the running view in
 * "profiling chosen entry" mode rather than waiting on a picker.
 *
 * Throws if the source scan's cached roots are empty (e.g. it predates the
 * cache feature) — the UI surfaces this with a hint to run a full Rescan.
 */
export async function restartScanFromCache(
  sourceScanId: string,
  rootIndex: number,
): Promise<string> {
  return invoke<string>("restart_scan_from_cache", { sourceScanId, rootIndex });
}

/** Stop an in-flight static scan. Idempotent — returns `false` if no scan
 *  is running with the given id. The backend flips a cancel flag the
 *  progress sink polls on every callback; the analyzer unwinds within
 *  milliseconds and the UI receives a `scan://error` with message
 *  `"scan stopped"`. */
export async function stopStaticScan(scanId: string): Promise<boolean> {
  return invoke<boolean>("stop_static_scan", { scanId });
}

export async function listStaticScans(): Promise<ScanMeta[]> {
  return invoke<ScanMeta[]>("list_static_scans");
}

export async function loadStaticScan(scanId: string): Promise<StoredScan> {
  // The backend now returns a compact-encoded envelope ({string_table,
  // frames, entries:[{f, …}]}). Decompress so callers continue to see
  // the denormalized in-memory shape.
  const env = await invoke<StoredScan>("load_static_scan", { scanId });
  return rehydrateEnvelope(env);
}

/** Sliced fetch — returns the same `StoredScan` shape as `loadStaticScan`
 *  but with each entry's `children` array empty. KB–tens of KB on the
 *  wire vs MBs–hundreds-of-MBs for a real-project full envelope, so it's
 *  the right primitive for the viewer's landing dashboard. Drill in to a
 *  specific entry via {@link loadScanEntry}. */
export async function loadStaticScanSummary(
  scanId: string,
): Promise<StoredScan> {
  const env = await invoke<StoredScan>("load_static_scan_summary", { scanId });
  return rehydrateEnvelope(env);
}

/** Fetch one entry's full call-tree subtree (with `children` populated
 *  recursively). `entryIndex` is the 0-based position in the envelope's
 *  `entries` array — same index the summary payload carries.
 *
 *  Returns a denormalized `CallTreeNode`-shaped value: the IPC wire form
 *  is a `CompactEntryDoc` ({string_table, frames, entry}); callers stay
 *  on the legacy inline shape via `decompressEntry`. */
export async function loadScanEntry(
  scanId: string,
  entryIndex: number,
): Promise<unknown> {
  const raw = await invoke<unknown>("load_scan_entry", { scanId, entryIndex });
  return decompressEntryDoc(raw);
}

/** Re-hydrate the `report` field of a [`StoredScan`] envelope returned by
 *  the backend. Decompress happens here, at the IPC boundary, so callers
 *  never see the wire shape. */
function rehydrateEnvelope(env: StoredScan): StoredScan {
  return { ...env, report: decompressReport(env.report) };
}

/** Wire shape of a Frame inside the compact 1.1 form. Matches the
 *  readable field names emitted by `drift_static_profiler::compact::Frame`. */
interface WireFrame {
  name: number;
  file: number;
  line: number;
  parent_class?: number;
  kind: number;
  /** non-canonical id; omitted when the id is `{file}::{parent_class}::{name}`. */
  id?: number;
}

/** Detect compact `CompactEntryDoc` (top-level `string_table` + `frames` +
 *  `entry`) and rebuild the inline `CallTreeNode`. Per-entry sidecars
 *  carry no `source_root` so the canonical-id reconstruction falls back
 *  to the prefix-less `{file}::{parent_class}::{name}` shape — matching
 *  what the Rust `expand_entry` produces for sidecar-only encodings. */
function decompressEntryDoc(raw: unknown): unknown {
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray((raw as Record<string, unknown>).string_table) ||
    !Array.isArray((raw as Record<string, unknown>).frames) ||
    !(raw as Record<string, unknown>).entry
  ) {
    return raw;
  }
  const doc = raw as {
    string_table: string[];
    frames: WireFrame[];
    entry: unknown;
  };
  return expandNodeWith(doc.entry, doc.string_table, doc.frames);
}

/** Recursive expansion mirroring `viewer/src/decompress.ts` — kept inline
 *  here so the desktop UI bundle doesn't pull in the viewer's decompress
 *  module (different `Report` typing). */
function expandNodeWith(
  raw: unknown,
  strings: string[],
  frames: WireFrame[],
): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const n = raw as Record<string, unknown> & {
    frame?: number;
    children?: unknown[];
  };
  const frameIx = typeof n.frame === "number" ? n.frame : 0;
  const fr = frames[frameIx] ?? { name: 0, file: 0, line: 0, parent_class: 0, kind: 0, id: 0 };
  const KINDS = ["Function", "Method", "Class"] as const;
  const kind = KINDS[fr.kind] ?? "Function";
  const sx = (ix: number | undefined): string =>
    ix === undefined || ix === null ? "" : strings[ix] ?? "";
  const sxOpt = (ix: number | undefined): string | null => {
    const v = sx(ix);
    return v.length > 0 ? v : null;
  };
  // Canonical id reconstruction — mirrors `StringRead::frame_id` and
  // `frameId` on the viewer side. Synthetic nodes (custom id_ix) keep
  // their stored value verbatim.
  const id =
    fr.id && fr.id !== 0
      ? sx(fr.id)
      : `${sx(fr.file)}::${sx(fr.parent_class)}::${sx(fr.name)}`;
  return {
    ...n,
    id,
    name: sx(fr.name),
    kind,
    file: sx(fr.file),
    line: fr.line,
    parent_class: sxOpt(fr.parent_class),
    children: ((n.children as unknown[]) ?? []).map((c) =>
      expandNodeWith(c, strings, frames),
    ),
  };
}

/** Delete a saved scan from `~/.drift/scans/`. Idempotent — calling for a
 *  scan id that's already been deleted resolves without throwing. Any
 *  in-flight "Study this" suggestion driver writing to this scan is
 *  cancelled by the backend before the file is removed. */
export async function deleteStaticScan(scanId: string): Promise<void> {
  return invoke<void>("delete_static_scan", { scanId });
}

/** One row in the canonical (dedupe + ranked + truncated) finding list the
 *  suggester would iterate over. The array position is the stable index —
 *  pass it straight into {@link startScanFindingSuggestion} to ask the LLM
 *  to study that exact row. */
export interface ListedFinding {
  source: "immediate_fix" | "refactor_candidate" | "finding_top";
  kind: string;
  severity: string;
  name: string;
  file: string;
  line: number;
  message: string;
}

export async function listScanFindings(scanId: string): Promise<ListedFinding[]> {
  return invoke<ListedFinding[]>("list_scan_findings", { scanId });
}

/** Kick off a single-finding LLM stream. The same `scan://suggestion-{start,
 *  delta,done}` events fire — keyed on `index` so existing handlers reconcile
 *  the right row. Idempotent for `(scanId, index)`: a second call while the
 *  first is still streaming is a silent no-op. */
export async function startScanFindingSuggestion(
  scanId: string,
  index: number,
): Promise<void> {
  return invoke<void>("start_scan_finding_suggestion", { scanId, index });
}

export async function stopScanFindingSuggestion(
  scanId: string,
  index: number,
): Promise<boolean> {
  return invoke<boolean>("stop_scan_finding_suggestion", { scanId, index });
}

/** One previously-persisted LLM suggestion, loaded from
 *  `~/.drift/scans/<scanId>/code-suggestions/<index>.json`. Matches the
 *  shape the `scan://suggestion` event delivers, plus a `savedAt`
 *  timestamp for diagnostics. The ScanReport page seeds its `rowsRef`
 *  from these on mount so prior "Study this" output survives reloads. */
export interface SavedSuggestion {
  index: number;
  /** 1-based sequence number within this finding's version history. v3
   *  means "the third Study This run on this finding". `listSavedSuggestions`
   *  returns the LATEST version of each finding (highest `version`);
   *  `listSuggestionVersions` returns every version for one finding,
   *  newest first. */
  version: number;
  source: "immediate_fix" | "refactor_candidate" | "finding_top";
  kind: string;
  severity: string;
  file: string;
  line: number;
  name: string;
  suggestion: string;
  savedAt: string;
}

/** Load the LATEST version of every previously-persisted suggestion for a
 *  saved scan, sorted by finding index. One entry per finding (the most
 *  recent take). Returns an empty array for scans where nothing was
 *  studied (the on-disk suggestions directory simply doesn't exist).
 *
 *  Use {@link listSuggestionVersions} for the full history of one finding. */
export async function listSavedSuggestions(scanId: string): Promise<SavedSuggestion[]> {
  return invoke<SavedSuggestion[]>("list_saved_suggestions", { scanId });
}

/** Load EVERY persisted version for one finding, newest first. Powers the
 *  per-row "← v3/5 →" version-history navigation: the user can flip
 *  through prior bodies without re-running the model. Returns an empty
 *  array if the finding has never been studied. */
export async function listSuggestionVersions(
  scanId: string,
  index: number,
): Promise<SavedSuggestion[]> {
  return invoke<SavedSuggestion[]>("list_suggestion_versions", { scanId, index });
}

export async function onScanProgress(
  cb: (p: ScanProgress) => void,
): Promise<() => void> {
  return listen<ScanProgress>("scan://progress", cb);
}

export async function onScanEntriesReady(
  cb: (p: ScanEntriesReady) => void,
): Promise<() => void> {
  return listen<ScanEntriesReady>("scan://entries-ready", cb);
}

export async function onScanComplete(
  cb: (p: ScanComplete) => void,
): Promise<() => void> {
  return listen<ScanComplete>("scan://complete", cb);
}

export async function onScanError(
  cb: (p: ScanErrorPayload) => void,
): Promise<() => void> {
  return listen<ScanErrorPayload>("scan://error", cb);
}

export async function onScanSuggestionStart(
  cb: (p: ScanSuggestionStartPayload) => void,
): Promise<() => void> {
  return listen<ScanSuggestionStartPayload>("scan://suggestion-start", cb);
}

export async function onScanSuggestionDelta(
  cb: (p: ScanSuggestionDeltaPayload) => void,
): Promise<() => void> {
  return listen<ScanSuggestionDeltaPayload>("scan://suggestion-delta", cb);
}

export async function onScanSuggestion(
  cb: (p: ScanSuggestionPayload) => void,
): Promise<() => void> {
  return listen<ScanSuggestionPayload>("scan://suggestion", cb);
}

export async function onScanSuggestionDone(
  cb: (p: ScanSuggestionDone) => void,
): Promise<() => void> {
  return listen<ScanSuggestionDone>("scan://suggestion-done", cb);
}

export async function onChatCancelled(cb: () => void): Promise<() => void> {
  return listen<unknown>("chat:cancelled", () => cb());
}

/**
 * Best-effort text extraction from a `rig::message::Message`. The shape
 * differs across rig versions, so we navigate defensively. Returns the
 * concatenated `text` fields of any `Text` content blocks.
 */
export function messageText(m: ChatMessage): string {
  const obj = m as { role?: string; content?: unknown };
  const content = obj.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        const block = c as { text?: string; type?: string };
        return block.text ?? "";
      })
      .join("");
  }
  return "";
}

export function messageRole(m: ChatMessage): string {
  return (m as { role?: string }).role ?? "unknown";
}

// =====================================================================
// events.log aggregation (drift-observability JSONL → snakeviz tree)
// =====================================================================

/** One file row in the LiveScan landing list. */
export interface EventLogMeta {
  path: string;
  displayName: string;
  sizeBytes: number;
  modifiedIso: string | null;
}

/** Per-call record after start/end pairing + parent assignment. */
export interface EventLogCall {
  callId: string;
  qualname: string;
  startUs: number;
  endUs: number;
  durationUs: number;
  status: string;
  file: string | null;
  line: number | null;
  cpu: number | null;
  parentCallId: string | null;
  depth: number;
  params?: unknown;
}

/** Per-qualname rollup. `totalUs` is exclusive (self) time, `cumulativeUs`
 *  is inclusive (self + descendants). Sorted by `cumulativeUs` desc. */
export interface EventLogFunctionStat {
  qualname: string;
  ncalls: number;
  totalUs: number;
  cumulativeUs: number;
  percallUs: number;
  errors: number;
  cpuAvg: number | null;
  file: string | null;
  line: number | null;
}

/** One node in the aggregated tree. `value` is inclusive μs on this path
 *  through the tree; `selfValue` is the exclusive portion at this node.
 *  Children are sorted by `value` desc. */
export interface EventLogTreeNode {
  name: string;
  value: number;
  selfValue: number;
  ncalls: number;
  depth: number;
  file: string | null;
  line: number | null;
  children: EventLogTreeNode[];
}

/** Full snakeviz-style report. */
export interface EventLogReport {
  sourceFile: string;
  startedAt: string | null;
  endedAt: string | null;
  durationUs: number;
  totalEvents: number;
  totalCalls: number;
  unmatchedStarts: number;
  unmatchedEnds: number;
  services: string[];
  pods: string[];
  functions: EventLogFunctionStat[];
  tree: EventLogTreeNode;
  calls: EventLogCall[];
  callsTruncated: boolean;
}

/** Live-tail event payloads (mirrors `event_log_commands::topic`). */
export interface LiveAggPayload {
  liveScanId: string;
  report: EventLogReport;
}
export interface LiveErrorPayload {
  liveScanId: string;
  message: string;
}

/** Pick an `events.log` (or .jsonl) via the system file dialog. */
export async function selectEventLogFile(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    multiple: false,
    title: "Choose events.log",
    filters: [
      { name: "Event log", extensions: ["log", "jsonl"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (result === null) return null;
  return Array.isArray(result) ? (result[0] ?? null) : result;
}

/** List `.log`/`.jsonl` files in `~/.drift/event_logs/` (or `dir` if set),
 *  newest-first. Returns `[]` when the default dir doesn't exist yet. */
export async function listEventLogs(dir?: string): Promise<EventLogMeta[]> {
  return invoke<EventLogMeta[]>("list_event_logs", { dir: dir ?? null });
}

/** One-shot aggregation of an event log at `path`. Reads the file fully;
 *  the `calls[]` array is truncated for very large traces (the aggregates
 *  and tree stay exact). */
export async function aggregateEventLog(path: string): Promise<EventLogReport> {
  return invoke<EventLogReport>("aggregate_event_log", { path });
}

/** Start a live-tail aggregator. Returns `live_scan_id`; the backend emits
 *  a fresh `EventLogReport` over `event_log://aggregate` at ~1Hz, and
 *  any read error over `event_log://error`. */
export async function startLiveEventScan(path: string): Promise<string> {
  return invoke<string>("start_live_event_scan", { path });
}

/** Stop a live-tail aggregator. Idempotent — returns `false` when no
 *  scan with `liveScanId` is registered. */
export async function stopLiveEventScan(liveScanId: string): Promise<boolean> {
  return invoke<boolean>("stop_live_event_scan", { liveScanId });
}

export interface DownloadedEventLog {
  /** Absolute path on disk where the file was saved. */
  path: string;
  sizeBytes: number;
}

/** Fetch the JSONL events file from an observability-server's `/events/log`
 *  endpoint and save it to `~/.drift/event_logs/downloaded-<stamp>.jsonl`.
 *  Returns the saved path so callers can feed it back into
 *  `aggregateEventLog` or `startLiveEventScan`. */
export async function downloadEventLog(
  url: string,
): Promise<DownloadedEventLog> {
  return invoke<DownloadedEventLog>("download_event_log", { url });
}

export async function onLiveEventAgg(
  cb: (p: LiveAggPayload) => void,
): Promise<() => void> {
  return listen<LiveAggPayload>("event_log://aggregate", cb);
}

export async function onLiveEventErr(
  cb: (p: LiveErrorPayload) => void,
): Promise<() => void> {
  return listen<LiveErrorPayload>("event_log://error", cb);
}
