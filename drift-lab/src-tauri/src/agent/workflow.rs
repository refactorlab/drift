//! Agent-driven scan workflow — bridges `AgentEvent`s into the 5-step
//! timeline the UI renders.
//!
//! The deterministic [`crate::workflow`] runs hardcoded sleeps. This module
//! does the same dance but lets the LLM pick the tools, and surfaces the
//! model's prose as the step `detail` so the UI shows *why* the agent did
//! what it did.
//!
//! Mapping (matches `desktop-ui/src/store/runStore.ts`):
//!
//!   index 0  →  find_image                       — "Locating Docker image"
//!   index 1  →  detect_runtime                   — "Detecting language & runtime"
//!   index 2  →  install_profiler                 — "Installing profiler"
//!   index 3  →  drive_load + run_profiling       — "Running profiling session"
//!   index 4  →  analyze_samples                  — "Analyzing bottlenecks"
//!
//! The mapping is *advisory* — the loop accepts the model calling tools out
//! of order, it just emits step events under whichever index the most-recent
//! tool maps to. This keeps the UI honest if the model recovers from an
//! error by re-running an earlier stage.

use std::sync::Arc;
use std::time::Instant;

use futures_util::StreamExt;
use tokio_util::sync::CancellationToken;

use super::agent_loop::{Agent, AgentEvent};
use super::provider::Provider;
use crate::events::{RunComplete, RunError, StepStatus, StepUpdate};

/// Goal prompt fed to the agent when a scan starts. Always anchors on the
/// literal `project_path` the user picked and lists the **expected tool order**
/// so even small / non-tool-tuned local models can follow the recipe. An
/// optional `focus` line carries the user's preset / free-text prompt — it
/// scopes *what* to look for without replacing the path or recipe.
///
/// The earlier shape let the caller pass an opaque `goal_prompt` that
/// completely replaced the default — which meant picking any preset dropped
/// the project path from the prompt and the model would emit no tool calls.
/// Always-include-the-path is the contract now; `focus` is the only knob.
pub fn build_goal_prompt(project_path: &str, focus: Option<&str>) -> String {
    let focus_line = match focus.map(str::trim).filter(|s| !s.is_empty()) {
        Some(f) => format!("Focus for this run: {f}\n\n"),
        None => String::new(),
    };
    format!(
        "You are Drift Lab's profiling agent. Goal: profile the service at \
         `{project_path}` and report performance issues.\n\n\
         {focus_line}\
         Recommended tool order (deviate only if a step fails):\n\
         1. `check_docker` to confirm Docker is installed and the daemon is \
         reachable. If status is `not_installed` or `daemon_unreachable`, STOP \
         and report the returned `hint` to the user verbatim as the final \
         answer — do not call further tools.\n\
         2. `discover_project` to read manifests and identify language/runtime/scripts \
         (path: \"{project_path}\"). You may also call `list_directory` or \
         `read_file_excerpt` to inspect specific files.\n\
         3. `find_image` to locate the Docker image (path: \"{project_path}\").\n\
         4. `ensure_image` to verify the image is on the daemon. Pass through \
         `image`, `build_context`, `manifest_path`, and `compose_service` \
         exactly as `find_image` returned them, plus `project_path` (use the \
         absolute `{project_path}`) for the build working directory. \
         `ensure_image` first checks if the requested ref exists, then scans \
         `docker images` for any locally-built image matching the project \
         (catches the common case where the user already ran `make \
         docker-build` and tagged the image differently), and only builds / \
         pulls when nothing's found. **Use the `resolved_image` field from \
         this tool's output as the input to `detect_runtime` — not the \
         original `image_ref`.** If `status` is `failed`, report `error` and \
         stop.\n\
         5. `detect_runtime` for runtime + recommended profiler. Pass \
         `resolved_image` from `ensure_image`.\n\
         6. `find_test_runner_for_profiling` to pick the test command that will exercise \
         the code (path: \"{project_path}\").\n\
         7. `install_profiler`, then `run_profiling` (use `drive_load` only if profiling \
         a running server instead of a test).\n\
         8. `analyze_samples` to rank hotspots and produce the final report.\n\n\
         Before each tool call, write ONE short sentence explaining what you \
         expect to find. If a tool fails (missing Dockerfile, no test runner, \
         etc.) explain the failure in prose and try the next best path — do \
         NOT silently give up with zero tool calls. After the last tool \
         returns, give the user a 2-3 sentence summary of the top findings — \
         no further tool calls."
    )
}

/// Back-compat shim. New code should call [`build_goal_prompt`] directly.
pub fn default_goal_prompt(project_path: &str) -> String {
    build_goal_prompt(project_path, None)
}

/// Prompts the user can pick from on the home screen. Keep these short — the
/// LLM gets the project path appended automatically by the workflow.
pub const PROMPT_PRESETS: &[(&str, &str)] = &[
    (
        "Profile a slow endpoint",
        "Profile this service end-to-end. Drive load against its main HTTP \
         endpoints and identify the slowest functions. Focus on database, \
         network, and serialisation hotspots.",
    ),
    (
        "Profile a specific test",
        "Investigate the project's test suite, pick the single most relevant \
         test for performance analysis, and run it under the profiler. Report \
         which functions dominate that test's runtime.",
    ),
    (
        "Find startup-time bottlenecks",
        "Profile the service from cold start. Identify which modules and \
         functions dominate the first 5 seconds of execution — module \
         loading, dependency injection, schema validation, etc.",
    ),
];

/// Translate a tool name into the timeline index it should appear under.
/// Returns `None` for tools that don't map to a step (the UI ignores them
/// but they still run — `list_directory` / `read_file_excerpt` are agent
/// reasoning aids, not user-facing milestones).
pub fn tool_to_step_index(name: &str) -> Option<usize> {
    match name {
        // Stage 0 covers both the Docker availability probe and the image
        // lookup — from the timeline's perspective they're "Locating Docker
        // image", and we want a `check_docker` failure to surface there
        // (before the user wonders why detect_runtime is stuck).
        "check_docker" | "find_image" => Some(0),
        // Discovery family rolls up under "Detecting language & runtime".
        // From the user's perspective it's all one stage; the agent may
        // call several of these tools while it figures things out.
        // `ensure_image` belongs here because the runtime can't be detected
        // until the image is present on the daemon.
        "discover_project"
        | "ensure_image"
        | "detect_runtime"
        | "find_test_runner_for_profiling" => Some(1),
        "install_profiler" => Some(2),
        "drive_load" | "run_profiling" => Some(3),
        "analyze_samples" => Some(4),
        // Pure reasoning aids — don't surface to the timeline.
        "list_directory" | "read_file_excerpt" => None,
        _ => None,
    }
}

/// Sink for events produced while the workflow runs. Production wiring sends
/// them over Tauri; tests collect them into a vector.
pub trait WorkflowSink: Send + Sync {
    fn emit_step(&self, update: StepUpdate);
    fn emit_complete(&self, complete: RunComplete);
    fn emit_error(&self, error: RunError);

    /// Mirror every raw `AgentEvent` the loop produced, so the UI can render
    /// a streaming "what the agent is thinking + doing right now" log
    /// alongside the coarse step timeline. Default is a no-op so existing
    /// sinks (and tests that don't care) keep compiling.
    fn emit_agent_event(&self, _event: &AgentEvent) {}
}

/// In-process sink that accumulates events into a `Vec`. Used by tests and
/// could be reused for replay/debugging.
#[derive(Default)]
pub struct CaptureSink {
    pub events: std::sync::Mutex<Vec<CapturedEvent>>,
}

#[derive(Debug, Clone)]
pub enum CapturedEvent {
    Step(StepUpdate),
    Complete(RunComplete),
    Error(RunError),
    /// Raw agent event — surfaced so tests can assert against the streaming
    /// reasoning, not just the coarse step events.
    Agent(AgentEvent),
}

impl WorkflowSink for CaptureSink {
    fn emit_step(&self, update: StepUpdate) {
        self.events.lock().unwrap().push(CapturedEvent::Step(update));
    }
    fn emit_complete(&self, complete: RunComplete) {
        self.events.lock().unwrap().push(CapturedEvent::Complete(complete));
    }
    fn emit_error(&self, error: RunError) {
        self.events.lock().unwrap().push(CapturedEvent::Error(error));
    }
    fn emit_agent_event(&self, event: &AgentEvent) {
        self.events.lock().unwrap().push(CapturedEvent::Agent(event.clone()));
    }
}

impl CaptureSink {
    pub fn snapshot(&self) -> Vec<CapturedEvent> {
        self.events.lock().unwrap().clone()
    }
}

/// Inputs for one workflow run.
pub struct RunRequest {
    pub run_id: String,
    pub project_path: String,
    pub provider: Arc<dyn Provider>,
    pub mode: super::tools::Mode,
    /// Override the goal prompt. Default produced by [`default_goal_prompt`].
    pub goal_prompt: Option<String>,
}

/// Drive the agent through a profiling scan, mapping `AgentEvent`s to
/// `StepUpdate`s on `sink`. Returns when the agent emits `Done`,
/// `TurnBudgetExceeded`, `Error`, or the cancel token fires.
pub async fn run<S: WorkflowSink>(
    req: RunRequest,
    sink: &S,
    cancel: CancellationToken,
) -> Result<(), String> {
    // Always build the full recipe with the project_path anchored in. The
    // user's preset/free-text — if any — folds in as a Focus: line. Replacing
    // the recipe outright (the old behaviour) made the model emit no tool
    // calls because it never saw which directory to investigate.
    let goal = build_goal_prompt(&req.project_path, req.goal_prompt.as_deref());

    tracing::info!(
        target: "drift::workflow",
        run_id = %req.run_id,
        project_path = %req.project_path,
        mode = ?req.mode,
        goal_len = goal.len(),
        "scan workflow starting"
    );

    // System message inside the agent. Goal goes into the user message — that
    // way the model sees it as the explicit instruction to act on. We also
    // repeat the project_path in the system message because some smaller
    // models drop user-message arguments when invoking tools; having the path
    // in the system prompt makes "default to scanning <path>" the safe choice.
    let system = format!(
        "You are an embedded profiling agent operating on the project at \
         `{}`. Use only the provided tools. Call at least `discover_project` \
         or `find_image` before answering — never reply with a final summary \
         without having investigated. Keep prose short. Always finish with \
         a final summary.",
        req.project_path
    );
    let agent = Agent::new(req.provider, system).with_mode(req.mode);

    let mut tracker = StepTracker::new(req.run_id.clone());
    let mut stream = Box::pin(agent.reply(goal, vec![], cancel.clone()));

    while let Some(item) = stream.next().await {
        if cancel.is_cancelled() {
            tracing::info!(target: "drift::workflow", run_id = %req.run_id, "cancelled by user");
            break;
        }
        let event = match item {
            Ok(e) => e,
            Err(e) => {
                tracing::error!(
                    target: "drift::workflow",
                    run_id = %req.run_id,
                    error = %e,
                    "provider/transport error — surfacing to UI and exiting"
                );
                let err = RunError {
                    run_id: req.run_id.clone(),
                    message: e.to_string(),
                };
                sink.emit_error(err);
                return Err(e.to_string());
            }
        };
        // Mirror raw event to the sink BEFORE absorbing into step state — the
        // UI's reasoning log wants to see deltas in real time, not after we
        // collapse them into step updates.
        sink.emit_agent_event(&event);
        log_agent_event(&req.run_id, &event);
        tracker.absorb(event, sink);
        if tracker.terminal {
            tracing::info!(target: "drift::workflow", run_id = %req.run_id, "scan workflow completed");
            break;
        }
    }

    Ok(())
}

/// Backend log line per agent event. Goes through `tracing` so it lands on
/// stderr when running `drift-lab` from a terminal.
///
/// We intentionally truncate `TextDelta` text and tool arg/result payloads —
/// the LLM can produce kilobytes of prose in a single chunk and the log
/// stream is meant to be skimmable, not exhaustive.
fn log_agent_event(run_id: &str, event: &AgentEvent) {
    match event {
        AgentEvent::TextDelta { text } => {
            tracing::debug!(
                target: "drift::agent",
                run_id,
                delta = %truncate(text, 80),
                "thinking"
            );
        }
        AgentEvent::AssistantMessage { message } => {
            tracing::debug!(
                target: "drift::agent",
                run_id,
                tool_count = message.tool_requests().len(),
                text_len = message.flat_text().len(),
                "assistant turn committed"
            );
        }
        AgentEvent::ToolDispatched { id, name, arguments } => {
            tracing::info!(
                target: "drift::agent",
                run_id,
                tool = %name,
                tool_id = %id,
                args = %truncate(&arguments.to_string(), 240),
                "→ dispatching tool"
            );
        }
        AgentEvent::ToolCompleted { id, content, is_error } => {
            if *is_error {
                tracing::warn!(
                    target: "drift::agent",
                    run_id,
                    tool_id = %id,
                    error_preview = %truncate(content, 240),
                    "← tool returned error"
                );
            } else {
                tracing::info!(
                    target: "drift::agent",
                    run_id,
                    tool_id = %id,
                    result_len = content.len(),
                    result_preview = %truncate(content, 240),
                    "← tool succeeded"
                );
            }
        }
        AgentEvent::ToolNeedsApproval { name, .. } => {
            tracing::warn!(
                target: "drift::agent",
                run_id,
                tool = %name,
                "tool needs approval — denied in current mode"
            );
        }
        AgentEvent::Usage(u) => {
            tracing::debug!(
                target: "drift::agent",
                run_id,
                input_tokens = ?u.input_tokens,
                output_tokens = ?u.output_tokens,
                total_tokens = ?u.total_tokens,
                "usage"
            );
        }
        AgentEvent::TurnBudgetExceeded { max_turns } => {
            tracing::warn!(
                target: "drift::agent",
                run_id,
                max_turns,
                "turn budget exceeded — stopping"
            );
        }
        AgentEvent::Error { message } => {
            tracing::error!(target: "drift::agent", run_id, %message, "agent error");
        }
        AgentEvent::Done => {
            tracing::info!(target: "drift::agent", run_id, "✓ scan complete");
        }
    }
}

fn truncate(s: &str, n: usize) -> String {
    if s.len() <= n {
        s.to_string()
    } else {
        let cut = s.char_indices().nth(n).map(|(i, _)| i).unwrap_or(n);
        format!("{}…(+{} chars)", &s[..cut], s.len() - cut)
    }
}

/// Internal state the workflow maintains as `AgentEvent`s flow in. Exposes a
/// single `absorb()` entry point so the loop above doesn't carry state.
struct StepTracker {
    run_id: String,
    /// Buffered text from the assistant since the last tool call. This is
    /// what we hand to the UI as the step's `detail` when a tool starts.
    thinking_buffer: String,
    /// Index → start time, so we can compute durationMs on completion.
    starts: std::collections::HashMap<usize, Instant>,
    /// Whether we've already finalised the run.
    terminal: bool,
    /// The last tool we dispatched — so when `ToolCompleted` arrives we know
    /// which step index to mark done. Tools may run sequentially or in
    /// parallel; we track the last *dispatched* call.
    pending_index: Option<usize>,
    /// Name of the last-dispatched tool. Some tools (notably `check_docker`)
    /// always return `Ok`, but the *payload* tells us whether the user can
    /// continue — we use the name to peek at the right field on completion.
    pending_tool: Option<String>,
    /// Last successful `analyze_samples` result, parsed for `issues` /
    /// `critical_count`. Read on `AgentEvent::Done` so the UI's DoneState
    /// shows real numbers instead of the previous hardcoded 0/0.
    last_analysis: Option<(usize, u64)>,
}

impl StepTracker {
    fn new(run_id: String) -> Self {
        Self {
            run_id,
            thinking_buffer: String::new(),
            starts: std::collections::HashMap::new(),
            terminal: false,
            pending_index: None,
            pending_tool: None,
            last_analysis: None,
        }
    }

    fn absorb<S: WorkflowSink>(&mut self, event: AgentEvent, sink: &S) {
        match event {
            AgentEvent::TextDelta { text } => {
                // Accumulate prose. We don't emit per-token step updates —
                // too noisy. The *next* ToolDispatched flushes this buffer
                // into the active step's detail.
                self.thinking_buffer.push_str(&text);
            }

            AgentEvent::AssistantMessage { .. } => {
                // No-op: text already flowed via TextDeltas; tool requests
                // arrive as ToolDispatched/Completed.
            }

            AgentEvent::ToolDispatched { name, arguments, .. } => {
                let Some(index) = tool_to_step_index(&name) else {
                    tracing::debug!(
                        target: "drift::workflow",
                        tool = %name,
                        "tool not mapped to a timeline step (reasoning aid)"
                    );
                    return;
                };
                self.starts.insert(index, Instant::now());
                self.pending_index = Some(index);
                self.pending_tool = Some(name.clone());

                let thinking = std::mem::take(&mut self.thinking_buffer);
                let detail = if thinking.trim().is_empty() {
                    format!("Calling {name}…")
                } else {
                    format!("{} — calling {}…", thinking.trim(), name)
                };
                tracing::info!(
                    target: "drift::workflow",
                    run_id = %self.run_id,
                    step_index = index,
                    tool = %name,
                    args = %truncate(&arguments.to_string(), 240),
                    thinking_chars = thinking.len(),
                    "step → ACTIVE"
                );
                sink.emit_step(StepUpdate {
                    run_id: self.run_id.clone(),
                    index,
                    status: StepStatus::Active,
                    detail: Some(detail),
                    duration_ms: None,
                });
            }

            AgentEvent::ToolCompleted { content, is_error, .. } => {
                let Some(index) = self.pending_index.take() else {
                    tracing::debug!(
                        target: "drift::workflow",
                        "tool completion with no pending index — likely a reasoning-aid tool"
                    );
                    return;
                };
                let tool_name = self.pending_tool.take().unwrap_or_default();
                let duration_ms = self
                    .starts
                    .remove(&index)
                    .map(|t| t.elapsed().as_millis() as u64);
                // `check_docker` always returns Ok with structured data, even
                // when Docker isn't usable. Promote a non-ready status to an
                // effective error so the UI's timeline shows it as a blocker
                // (with the install/start hint as detail) instead of a green
                // check that contradicts the actual state.
                let effective_error = is_error
                    || (tool_name == "check_docker" && !check_docker_is_ready(&content));
                // Capture analyze_samples counts so RunComplete reports the real
                // numbers instead of hardcoded 0/0. Only on success.
                if index == 4 && !is_error {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                        let issues = v
                            .get("issues")
                            .and_then(|a| a.as_array())
                            .map(|a| a.len())
                            .unwrap_or(0);
                        let crit = v
                            .get("critical_count")
                            .and_then(|n| n.as_u64())
                            .unwrap_or(0);
                        self.last_analysis = Some((issues, crit));
                    }
                }
                // For `check_docker`, prefer the structured hint as the
                // user-visible detail — it's already actionable prose.
                let summary = if tool_name == "check_docker" {
                    check_docker_summary(&content).unwrap_or_else(|| {
                        summarise_tool_output(index, &content, effective_error)
                    })
                } else {
                    summarise_tool_output(index, &content, effective_error)
                };
                let status = if effective_error { StepStatus::Error } else { StepStatus::Done };
                tracing::info!(
                    target: "drift::workflow",
                    run_id = %self.run_id,
                    step_index = index,
                    duration_ms = ?duration_ms,
                    is_error = effective_error,
                    summary = %summary,
                    "step → {}",
                    if effective_error { "ERROR" } else { "DONE" }
                );
                sink.emit_step(StepUpdate {
                    run_id: self.run_id.clone(),
                    index,
                    status,
                    detail: Some(summary),
                    duration_ms,
                });
            }

            AgentEvent::ToolNeedsApproval { name, .. } => {
                // In Default mode the destructive stages need approval. Surface
                // that to the timeline so the user can re-run with `auto`.
                let Some(index) = tool_to_step_index(&name) else { return };
                sink.emit_step(StepUpdate {
                    run_id: self.run_id.clone(),
                    index,
                    status: StepStatus::Error,
                    detail: Some(format!(
                        "Approval required for `{name}` — re-run with autonomous mode."
                    )),
                    duration_ms: None,
                });
                self.terminal = true;
                sink.emit_error(RunError {
                    run_id: self.run_id.clone(),
                    message: format!("approval required for {name}"),
                });
            }

            AgentEvent::Usage(_) => { /* token accounting — ignored here */ }

            AgentEvent::TurnBudgetExceeded { max_turns } => {
                self.terminal = true;
                sink.emit_error(RunError {
                    run_id: self.run_id.clone(),
                    message: format!("hit the {max_turns}-turn budget without completing"),
                });
            }

            AgentEvent::Error { message } => {
                self.terminal = true;
                sink.emit_error(RunError {
                    run_id: self.run_id.clone(),
                    message,
                });
            }

            AgentEvent::Done => {
                // The agent finished cleanly. If analyze_samples ran, surface
                // its counts; otherwise zeros are the honest answer.
                self.terminal = true;
                let (issues_found, critical_count) = self.last_analysis.unwrap_or((0, 0));
                sink.emit_complete(RunComplete {
                    run_id: self.run_id.clone(),
                    issues_found: issues_found as u32,
                    critical_count: critical_count as u32,
                });
            }
        }
    }
}

/// True when a `check_docker` payload reports `status: "ready"`. Anything else
/// (not_installed, daemon_unreachable, garbled JSON) is treated as a blocker.
fn check_docker_is_ready(content: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(content)
        .ok()
        .and_then(|v| v.get("status").and_then(|s| s.as_str()).map(str::to_string))
        .as_deref()
        == Some("ready")
}

/// Pull the user-facing line out of a `check_docker` payload. When the daemon
/// isn't ready the tool returns a `hint` field — that's the actionable line we
/// want on the timeline. When ready, fall through to the generic summariser.
fn check_docker_summary(content: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(content).ok()?;
    let status = v.get("status").and_then(|s| s.as_str())?;
    if status == "ready" {
        return None;
    }
    let hint = v.get("hint").and_then(|s| s.as_str()).unwrap_or("");
    if hint.is_empty() {
        Some(format!("Docker status: {status}"))
    } else {
        Some(hint.to_string())
    }
}

/// Compress one tool's JSON output into one human line for the timeline.
/// We do not parse the structure deeply — just look for a few hint fields
/// that the existing `tools::*::Output` types tend to expose.
fn summarise_tool_output(index: usize, content: &str, is_error: bool) -> String {
    if is_error {
        return content.lines().next().unwrap_or(content).to_string();
    }
    let v: serde_json::Value = match serde_json::from_str(content) {
        Ok(v) => v,
        Err(_) => return content.chars().take(120).collect(),
    };
    match index {
        // Stage 0 covers both `check_docker` and `find_image`. The two payloads
        // are disjoint — `check_docker` has `status`, `find_image` has
        // `image_ref` — so we can tell them apart and render the right line.
        0 => {
            if let Some(status) = v.get("status").and_then(|s| s.as_str()) {
                let server = v
                    .get("server_version")
                    .and_then(|s| s.as_str())
                    .unwrap_or("");
                return match status {
                    "ready" if !server.is_empty() => format!("Docker ready (daemon v{server})"),
                    "ready" => "Docker ready".into(),
                    "daemon_unreachable" => "Docker is installed but the daemon isn't running".into(),
                    "not_installed" => "Docker is not installed on this machine".into(),
                    other => format!("Docker status: {other}"),
                };
            }
            v.get("image_ref")
                .and_then(|s| s.as_str())
                .map(|s| format!("Found {s}"))
                .unwrap_or_else(|| "Image located".into())
        }
        1 => {
            // Stage 1 covers discover_project, ensure_image, detect_runtime,
            // and find_test_runner_for_profiling. Detect which payload we
            // have by sniffing for tool-specific fields.
            if let Some(status) = v.get("status").and_then(|s| s.as_str()) {
                // `ensure_image` shape: { status, resolved_image, strategy, ... }
                if let Some(resolved) = v.get("resolved_image").and_then(|s| s.as_str()) {
                    let strategy = v.get("strategy").and_then(|s| s.as_str()).unwrap_or("");
                    return match (status, strategy) {
                        ("already_present", _) => format!("Image already on daemon: {resolved}"),
                        ("discovered_existing", _) => format!("Reusing existing local image: {resolved}"),
                        ("built", "compose-build") => format!("Built via compose: {resolved}"),
                        ("built", _) => format!("Built image: {resolved}"),
                        ("pulled", _) => format!("Pulled image: {resolved}"),
                        ("failed", _) => v
                            .get("error")
                            .and_then(|e| e.as_str())
                            .unwrap_or("ensure_image failed")
                            .to_string(),
                        (other, _) => format!("ensure_image: {other}"),
                    };
                }
            }
            // Otherwise fall through to detect_runtime's shape.
            let lang = v
                .get("language")
                .and_then(|s| s.as_str())
                .unwrap_or("?");
            let prof = v
                .get("recommended_profiler")
                .and_then(|s| s.as_str())
                .unwrap_or("?");
            format!("Language: {lang} · Profiler: {prof}")
        }
        2 => v
            .get("version")
            .and_then(|s| s.as_str())
            .map(|s| format!("Profiler installed ({s})"))
            .unwrap_or_else(|| "Profiler installed".into()),
        3 => v
            .get("samples_captured")
            .and_then(|n| n.as_u64())
            .map(|n| format!("{n} samples captured"))
            .unwrap_or_else(|| "Profiling complete".into()),
        4 => {
            let issues = v.get("issues").and_then(|a| a.as_array()).map(|a| a.len()).unwrap_or(0);
            let crit = v.get("critical_count").and_then(|n| n.as_u64()).unwrap_or(0);
            format!("{issues} issues · {crit} critical")
        }
        _ => "Done".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::provider::MessageStream;
    use crate::agent::tools::Mode;
    use crate::agent::types::{Message, MessageContent, ProviderError, Role, ToolDef, Usage};
    use async_trait::async_trait;
    use futures_util::stream;
    use std::sync::Mutex;

    type ScriptedChunk = Result<(Option<Message>, Option<Usage>), ProviderError>;
    type ScriptedTurns = Vec<Vec<ScriptedChunk>>;

    /// Scripted provider — same shape as the one in `agent_loop` tests. Each
    /// outer-loop turn pops the next pre-baked stream off `turns`.
    struct ScriptedProvider {
        turns: Mutex<ScriptedTurns>,
    }

    impl ScriptedProvider {
        fn new(turns: ScriptedTurns) -> Self {
            Self { turns: Mutex::new(turns) }
        }
    }

    #[async_trait]
    impl Provider for ScriptedProvider {
        fn name(&self) -> &str { "scripted" }
        async fn stream(
            &self,
            _system: &str,
            _messages: &[Message],
            _tools: &[ToolDef],
        ) -> Result<MessageStream, ProviderError> {
            let turn = self.turns.lock().unwrap().remove(0);
            Ok(Box::pin(stream::iter(turn)))
        }
    }

    fn text_chunk(s: &str) -> Result<(Option<Message>, Option<Usage>), ProviderError> {
        Ok((Some(Message::assistant_text(s)), None))
    }

    fn tool_chunk(
        id: &str,
        name: &str,
        args: serde_json::Value,
    ) -> Result<(Option<Message>, Option<Usage>), ProviderError> {
        Ok((
            Some(Message {
                role: Role::Assistant,
                content: vec![MessageContent::ToolRequest {
                    id: id.into(),
                    name: name.into(),
                    arguments: args,
                }],
            }),
            None,
        ))
    }

    #[test]
    fn goal_prompt_always_includes_project_path_even_with_focus() {
        // Regression: presets used to *replace* the goal entirely, dropping
        // the project_path. The model then had nothing to investigate and
        // emitted zero tool calls.
        let with_focus = build_goal_prompt("/srv/checkout", Some("Profile a specific test"));
        assert!(with_focus.contains("/srv/checkout"));
        assert!(with_focus.contains("Focus for this run: Profile a specific test"));
        assert!(with_focus.contains("discover_project"));

        let without = build_goal_prompt("/srv/checkout", None);
        assert!(without.contains("/srv/checkout"));
        assert!(!without.contains("Focus for this run"));

        // Whitespace-only focus is treated as no focus.
        let blank = build_goal_prompt("/srv/checkout", Some("   "));
        assert!(!blank.contains("Focus for this run"));
    }

    #[test]
    fn step_index_mapping_covers_canonical_workflow() {
        // `check_docker` shares stage 0 with `find_image` — both fall under
        // "Locating Docker image" on the timeline.
        assert_eq!(tool_to_step_index("check_docker"), Some(0));
        assert_eq!(tool_to_step_index("find_image"), Some(0));
        assert_eq!(tool_to_step_index("detect_runtime"), Some(1));
        assert_eq!(tool_to_step_index("install_profiler"), Some(2));
        assert_eq!(tool_to_step_index("drive_load"), Some(3));
        assert_eq!(tool_to_step_index("run_profiling"), Some(3));
        assert_eq!(tool_to_step_index("analyze_samples"), Some(4));
        assert_eq!(tool_to_step_index("list_containers"), None);
    }

    #[test]
    fn goal_prompt_mentions_check_docker_as_first_step() {
        // Regression: stage 1 (detect_runtime) used to be where the agent
        // discovered Docker was unreachable, producing a cryptic 404. The
        // recipe now leads with check_docker so we can surface "install
        // Docker" before any daemon-touching tool runs.
        let p = build_goal_prompt("/srv/checkout", None);
        assert!(p.contains("check_docker"), "goal prompt should call out check_docker");
        let check_idx = p.find("check_docker").unwrap();
        let find_idx = p.find("find_image").unwrap();
        assert!(
            check_idx < find_idx,
            "check_docker should appear before find_image in the recipe"
        );
    }

    #[test]
    fn check_docker_ready_flag_handles_each_status() {
        let ready = r#"{"status":"ready","server_version":"24.0.7","hint":""}"#;
        let missing = r#"{"status":"not_installed","hint":"Install Docker Desktop…"}"#;
        let down = r#"{"status":"daemon_unreachable","hint":"Start Docker Desktop…"}"#;
        assert!(check_docker_is_ready(ready));
        assert!(!check_docker_is_ready(missing));
        assert!(!check_docker_is_ready(down));
        assert!(!check_docker_is_ready("not json"));
    }

    #[test]
    fn check_docker_summary_prefers_hint_when_not_ready() {
        let payload = r#"{"status":"not_installed","hint":"Install Docker Desktop from https://example"}"#;
        let got = check_docker_summary(payload).unwrap();
        assert!(got.contains("Install Docker"));
        // When ready, fall through to the generic summariser.
        let ready = r#"{"status":"ready","server_version":"24.0.7","hint":""}"#;
        assert!(check_docker_summary(ready).is_none());
    }

    #[tokio::test]
    async fn check_docker_not_installed_marks_step_zero_as_error() {
        // The tool returned Ok with the structured "not_installed" payload —
        // the tracker should promote it to an Error step so the timeline
        // shows a red blocker (not a green check) with the install hint.
        let mut tracker = StepTracker::new("r".into());
        let sink = CaptureSink::default();

        tracker.absorb(
            AgentEvent::ToolDispatched {
                id: "cd".into(),
                name: "check_docker".into(),
                arguments: serde_json::json!({}),
            },
            &sink,
        );
        tracker.absorb(
            AgentEvent::ToolCompleted {
                id: "cd".into(),
                content: r#"{"status":"not_installed","binary_path":null,"client_version":null,"server_version":null,"hint":"Docker isn't installed. Install Docker Desktop."}"#.into(),
                is_error: false,
            },
            &sink,
        );

        let steps: Vec<StepUpdate> = sink
            .snapshot()
            .into_iter()
            .filter_map(|e| match e {
                CapturedEvent::Step(s) => Some(s),
                _ => None,
            })
            .collect();
        let done = steps
            .iter()
            .find(|s| matches!(s.status, StepStatus::Error))
            .expect("expected an Error step from a not-installed check_docker");
        assert_eq!(done.index, 0);
        assert!(
            done.detail.as_deref().unwrap_or("").contains("Install Docker"),
            "step detail should carry the install hint, got: {:?}",
            done.detail
        );
    }

    #[test]
    fn summarise_uses_image_ref_for_step_zero() {
        let payload = r#"{"image_ref": "registry/svc:42"}"#;
        let got = summarise_tool_output(0, payload, false);
        assert!(got.contains("registry/svc:42"));
    }

    #[test]
    fn summarise_falls_back_when_payload_is_garbage() {
        let got = summarise_tool_output(0, "this is not json", false);
        assert!(got.contains("not json"));
    }

    #[test]
    fn step_tracker_threads_analyze_samples_into_run_complete() {
        // Regression: Done used to hardcode issues_found = critical_count = 0
        // even after analyze_samples produced real numbers.
        let mut tracker = StepTracker::new("r".into());
        let sink = CaptureSink::default();

        // Dispatch analyze_samples (index 4), then complete it with a payload.
        tracker.absorb(
            AgentEvent::ToolDispatched {
                id: "t1".into(),
                name: "analyze_samples".into(),
                arguments: serde_json::json!({}),
            },
            &sink,
        );
        tracker.absorb(
            AgentEvent::ToolCompleted {
                id: "t1".into(),
                content: r#"{"issues": [1,2,3,4,5], "critical_count": 2}"#.into(),
                is_error: false,
            },
            &sink,
        );
        tracker.absorb(AgentEvent::Done, &sink);

        let completes: Vec<_> = sink
            .snapshot()
            .into_iter()
            .filter_map(|e| match e {
                CapturedEvent::Complete(c) => Some(c),
                _ => None,
            })
            .collect();
        assert_eq!(completes.len(), 1);
        assert_eq!(completes[0].issues_found, 5);
        assert_eq!(completes[0].critical_count, 2);
    }

    #[tokio::test]
    async fn workflow_emits_active_then_done_for_find_image() {
        // The agent thinks ("scanning…"), calls find_image with a path
        // pointing at a tempdir that has a Dockerfile, then on the next turn
        // emits a final answer with no tool calls.
        let dir = std::env::temp_dir().join(format!("drift-wf-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("Dockerfile"), "FROM alpine\n").unwrap();

        let provider = Arc::new(ScriptedProvider::new(vec![
            vec![
                text_chunk("Scanning the project for a Dockerfile."),
                tool_chunk(
                    "1",
                    "find_image",
                    serde_json::json!({"path": dir.display().to_string()}),
                ),
            ],
            vec![text_chunk("All done — no further tools needed.")],
        ]));

        let sink = CaptureSink::default();
        run(
            RunRequest {
                run_id: "test-run".into(),
                project_path: dir.display().to_string(),
                provider,
                mode: Mode::Auto,
                goal_prompt: Some("Test".into()),
            },
            &sink,
            CancellationToken::new(),
        )
        .await
        .unwrap();

        let events = sink.snapshot();
        let steps: Vec<&StepUpdate> = events
            .iter()
            .filter_map(|e| match e {
                CapturedEvent::Step(s) => Some(s),
                _ => None,
            })
            .collect();
        assert_eq!(steps.len(), 2, "expected one Active + one Done event for step 0");
        assert!(matches!(steps[0].status, StepStatus::Active));
        assert_eq!(steps[0].index, 0);
        // The thinking prose flows into the active step's detail.
        assert!(
            steps[0]
                .detail
                .as_deref()
                .unwrap_or("")
                .contains("Scanning the project"),
            "active detail should carry the LLM's thinking, got: {:?}",
            steps[0].detail
        );
        assert!(matches!(steps[1].status, StepStatus::Done));
        assert!(steps[1].detail.as_deref().unwrap_or("").contains("drift-lab/"));

        assert!(matches!(events.last(), Some(CapturedEvent::Complete(_))));
    }

    #[tokio::test]
    async fn workflow_walks_full_five_step_timeline() {
        // Cover every step index to prove the orchestration is end-to-end.
        // We use Mode::Auto so destructive tools (install_profiler etc.) run.
        // For tools that need Docker (detect_runtime, install_profiler,
        // drive_load, run_profiling), the in-process call will fail — and
        // that's fine: we're verifying the *orchestration*, not the tool
        // implementations. The step's `is_error` will be true, but it will
        // still be marked under the right index.
        let dir = std::env::temp_dir().join(format!("drift-wf-full-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("Dockerfile"), "FROM alpine\n").unwrap();

        let provider = Arc::new(ScriptedProvider::new(vec![
            vec![text_chunk("Step 1."), tool_chunk("a", "find_image",
                serde_json::json!({"path": dir.display().to_string()}))],
            vec![text_chunk("Step 2."), tool_chunk("b", "detect_runtime",
                serde_json::json!({"image": "drift-lab/anything:latest"}))],
            vec![text_chunk("Step 3."), tool_chunk("c", "install_profiler",
                serde_json::json!({"container_id": "abc", "language": "python"}))],
            vec![text_chunk("Step 4."), tool_chunk("d", "run_profiling",
                serde_json::json!({"container_id": "abc", "duration_seconds": 5}))],
            vec![text_chunk("Step 5."), tool_chunk("e", "analyze_samples",
                serde_json::json!({"sample_path": "/nonexistent"}))],
            vec![text_chunk("All done.")],
        ]));

        let sink = CaptureSink::default();
        run(
            RunRequest {
                run_id: "full".into(),
                project_path: dir.display().to_string(),
                provider,
                mode: Mode::Auto,
                goal_prompt: Some("Test".into()),
            },
            &sink,
            CancellationToken::new(),
        )
        .await
        .unwrap();

        let steps: Vec<&StepUpdate> = sink
            .snapshot()
            .into_iter()
            .filter_map(|e| match e {
                CapturedEvent::Step(s) => Some(s),
                _ => None,
            })
            .collect::<Vec<_>>()
            .iter()
            .map(|s| Box::leak(Box::new(s.clone())) as &StepUpdate)
            .collect();

        // Each step appears at least once with status Active. We don't
        // require Done because steps 1-4 hit the real Docker tool stubs and
        // will fail in a CI sandbox — their step still emits under the right
        // index, just with status Error.
        for expected_index in 0..=4 {
            assert!(
                steps.iter().any(|s| s.index == expected_index
                    && matches!(s.status, StepStatus::Active)),
                "missing Active event for step {expected_index}; saw: {:?}",
                steps.iter().map(|s| (s.index, s.status)).collect::<Vec<_>>()
            );
        }
    }

    #[tokio::test]
    async fn workflow_mirrors_raw_agent_events_to_sink() {
        // Same setup as the find_image happy-path test, but here we assert
        // that the sink saw the streaming AgentEvents (text deltas + tool
        // dispatch + done), not just the coarse Step updates.
        let dir = std::env::temp_dir().join(format!("drift-wf-events-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("Dockerfile"), "FROM alpine\n").unwrap();

        let provider = Arc::new(ScriptedProvider::new(vec![
            vec![
                text_chunk("Scanning for a Dockerfile."),
                tool_chunk(
                    "1",
                    "find_image",
                    serde_json::json!({"path": dir.display().to_string()}),
                ),
            ],
            vec![text_chunk("Done.")],
        ]));

        let sink = CaptureSink::default();
        run(
            RunRequest {
                run_id: "events".into(),
                project_path: dir.display().to_string(),
                provider,
                mode: Mode::Auto,
                goal_prompt: Some("Test".into()),
            },
            &sink,
            CancellationToken::new(),
        )
        .await
        .unwrap();

        let events = sink.snapshot();
        // Should have seen at least: TextDelta, ToolDispatched, ToolCompleted, Done.
        let kinds: Vec<&'static str> = events
            .iter()
            .filter_map(|e| match e {
                CapturedEvent::Agent(a) => Some(match a {
                    AgentEvent::TextDelta { .. } => "text_delta",
                    AgentEvent::AssistantMessage { .. } => "assistant_message",
                    AgentEvent::ToolDispatched { .. } => "tool_dispatched",
                    AgentEvent::ToolCompleted { .. } => "tool_completed",
                    AgentEvent::ToolNeedsApproval { .. } => "tool_needs_approval",
                    AgentEvent::Usage(_) => "usage",
                    AgentEvent::TurnBudgetExceeded { .. } => "turn_budget_exceeded",
                    AgentEvent::Error { .. } => "error",
                    AgentEvent::Done => "done",
                }),
                _ => None,
            })
            .collect();
        assert!(kinds.contains(&"text_delta"), "expected text_delta in mirrored stream, got {kinds:?}");
        assert!(kinds.contains(&"tool_dispatched"));
        assert!(kinds.contains(&"tool_completed"));
        assert!(kinds.contains(&"done"));
    }

    #[tokio::test]
    async fn destructive_tool_in_default_mode_surfaces_approval_error() {
        let dir = std::env::temp_dir().join(format!("drift-wf-deny-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("Dockerfile"), "FROM alpine\n").unwrap();

        let provider = Arc::new(ScriptedProvider::new(vec![vec![
            text_chunk("I'll inject the profiler now."),
            tool_chunk(
                "x",
                "install_profiler",
                serde_json::json!({"container_id": "abc", "language": "python"}),
            ),
        ]]));

        let sink = CaptureSink::default();
        run(
            RunRequest {
                run_id: "deny".into(),
                project_path: dir.display().to_string(),
                provider,
                mode: Mode::Default,
                goal_prompt: Some("Test".into()),
            },
            &sink,
            CancellationToken::new(),
        )
        .await
        .unwrap();

        // A destructive tool in Default mode → step marked Error + RunError.
        let events = sink.snapshot();
        assert!(
            events.iter().any(|e| matches!(e, CapturedEvent::Step(s)
                if s.index == 2 && matches!(s.status, StepStatus::Error))),
            "expected step 2 to surface as Error in Default mode"
        );
        assert!(events.iter().any(|e| matches!(e, CapturedEvent::Error(_))));
    }
}
