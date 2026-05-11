//! The agent loop — outer turn loop + inner stream-drain.
//!
//! Mirrors the architecture documented in
//! `goose_examples/plan-iterative-agent.md`:
//!
//! - **Outer loop**: keeps requesting turns from the provider until the
//!   model emits a turn with no tool calls, the turn budget is hit, or the
//!   user cancels.
//! - **Inner loop**: drains one provider stream, yielding incremental text
//!   chunks to the UI and dispatching tool calls when the assistant turn
//!   finalises.
//!
//! The loop never inspects which provider it has — every backend goes
//! through the `Provider::stream()` trait method.

use std::sync::Arc;

use async_stream::try_stream;
use futures_util::{Stream, StreamExt};
use serde::Serialize;
use tokio_util::sync::CancellationToken;

use super::provider::{MessageStream, Provider};
use super::tools::{self, Decision, Mode, RegisteredTool};
use super::types::{Message, MessageContent, ProviderError, Role, Usage};

/// Default turn budget. Goose uses 100; we copy that. The budget is a
/// circuit-breaker against ping-pong loops, not the natural termination
/// condition (which is "assistant emitted no tool calls").
pub const DEFAULT_MAX_TURNS: u32 = 100;

/// Streamed events surfaced to the UI / Tauri layer.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AgentEvent {
    /// Partial text token from the assistant. Concatenate to render typing.
    TextDelta { text: String },
    /// One assistant turn was committed to history. May contain text +
    /// tool requests. Useful for the UI to draw a complete bubble.
    AssistantMessage { message: Message },
    /// A tool was approved and is about to run.
    ToolDispatched {
        id: String,
        name: String,
        arguments: serde_json::Value,
    },
    /// A tool finished. `is_error` is true if the tool returned a Rust error.
    ToolCompleted {
        id: String,
        content: String,
        is_error: bool,
    },
    /// Approval was required and the loop denied/skipped the call. Surfaces
    /// to the UI so it can prompt the user; on a re-run with `Mode::Auto`
    /// the call would proceed.
    ToolNeedsApproval {
        id: String,
        name: String,
        arguments: serde_json::Value,
    },
    /// Per-turn token accounting, when the provider sent it.
    Usage(Usage),
    /// Soft termination: hit the configured turn budget. The loop yielded
    /// a final placeholder assistant message before exiting.
    TurnBudgetExceeded { max_turns: u32 },
    /// Hard termination: provider error or transport failure.
    Error { message: String },
    /// Loop finished cleanly — assistant produced a tool-free final answer.
    Done,
}

/// Render a provider error into a human-actionable message for the UI.
///
/// For `ContextLengthExceeded` we surface the prompt/context numbers and
/// (when the model id is known) the exact `docker model configure` command
/// to raise the window. Compaction has already been tried once by the outer
/// loop at this point, so the user needs to act on the runtime — there's
/// nothing more we can do in-process.
pub(crate) fn format_provider_error(err: &ProviderError) -> String {
    match err {
        ProviderError::ContextLengthExceeded {
            prompt_tokens,
            context_size,
            model,
        } => {
            let sizing = match (prompt_tokens, context_size) {
                (Some(p), Some(c)) => format!("prompt is {p} tokens but the model is configured for {c}"),
                (Some(p), None) => format!("prompt is {p} tokens"),
                (None, Some(c)) => format!("model is configured for only {c} tokens"),
                (None, None) => "the prompt exceeded the model's context window".to_string(),
            };
            // Pick a target context size that's the next sensible power-of-two
            // multiple up from what's configured (min 8192). Concrete number
            // beats a hand-wavy "raise it" — the user can adjust if needed.
            let suggested_ctx = context_size
                .map(|c| {
                    let mut n = c.max(8192) * 2;
                    if n > 131_072 {
                        n = 131_072;
                    }
                    n
                })
                .unwrap_or(16_384);
            match model {
                Some(m) => format!(
                    "Model context window exhausted: {sizing}. \
                     To fix on Docker Model Runner, run: \
                     `docker model configure --context-size {suggested_ctx} {m}` \
                     then restart the model and re-run the scan."
                ),
                None => format!(
                    "Model context window exhausted: {sizing}. \
                     Raise the context size on your runtime (e.g. \
                     `docker model configure --context-size {suggested_ctx} <model-id>`) and re-run."
                ),
            }
        }
        other => other.to_string(),
    }
}

pub struct Agent {
    provider: Arc<dyn Provider>,
    system: String,
    mode: Mode,
    max_turns: u32,
    tools: Vec<RegisteredTool>,
}

impl Agent {
    pub fn new(provider: Arc<dyn Provider>, system: impl Into<String>) -> Self {
        Self {
            provider,
            system: system.into(),
            mode: Mode::default(),
            max_turns: DEFAULT_MAX_TURNS,
            tools: tools::registry(),
        }
    }

    pub fn with_mode(mut self, mode: Mode) -> Self {
        self.mode = mode;
        self
    }

    pub fn with_max_turns(mut self, n: u32) -> Self {
        self.max_turns = n;
        self
    }

    /// Restrict the toolset for this agent. Default is the full registry.
    pub fn with_tools(mut self, tools: Vec<RegisteredTool>) -> Self {
        self.tools = tools;
        self
    }

    /// Drive one user→assistant exchange. Returns a stream of `AgentEvent`s.
    /// `history` is the prior turns; `user_message` is the new user turn.
    /// The loop pushes the user message and every produced assistant /
    /// tool message into `history` (via the events the caller folds back).
    pub fn reply(
        &self,
        user_message: String,
        history: Vec<Message>,
        cancel: CancellationToken,
    ) -> impl Stream<Item = Result<AgentEvent, ProviderError>> + Send + '_ {
        // Capture by value into the stream — the `'_` lifetime keeps `self`
        // alive across the stream's lifetime, which is fine because the
        // caller awaits the stream to completion before dropping.
        let provider = Arc::clone(&self.provider);
        let system = self.system.clone();
        let mode = self.mode;
        let max_turns = self.max_turns;
        let tool_defs: Vec<_> = self.tools.iter().map(|t| t.def.clone()).collect();
        let tools_for_lookup = self.tools.clone();

        try_stream! {
            // Conversation = history + user turn + everything the loop produces.
            let mut conversation: Vec<Message> = history;
            conversation.push(Message::user(user_message));

            let mut turns_taken: u32 = 0;
            let mut compaction_attempted = false;

            // -------------- Outer loop: turns ----------------------------
            loop {
                // [1] Cancellation early-exit — between turns.
                if cancel.is_cancelled() {
                    tracing::info!(target: "drift::loop", "cancelled between turns");
                    break;
                }

                // [2] Turn budget.
                turns_taken += 1;
                tracing::info!(
                    target: "drift::loop",
                    turn = turns_taken,
                    max_turns,
                    history_len = conversation.len(),
                    "▶ turn start"
                );
                if turns_taken > max_turns {
                    tracing::warn!(
                        target: "drift::loop",
                        turns_taken,
                        max_turns,
                        "turn budget exceeded — emitting placeholder + stopping"
                    );
                    let final_msg = Message::assistant_text(format!(
                        "Stopped: hit the {} turn budget.", max_turns
                    ));
                    yield AgentEvent::AssistantMessage { message: final_msg };
                    yield AgentEvent::TurnBudgetExceeded { max_turns };
                    break;
                }

                // [3] Open the provider stream for this turn.
                let mut stream: MessageStream = match provider
                    .stream(&system, &conversation, &tool_defs)
                    .await
                {
                    Ok(s) => s,
                    Err(ProviderError::ContextLengthExceeded { .. }) if !compaction_attempted => {
                        // Step 9 (basic): drop the oldest non-system turn and retry.
                        tracing::warn!(
                            target: "drift::loop",
                            history_len = conversation.len(),
                            "context length exceeded — compacting + retrying"
                        );
                        compaction_attempted = true;
                        if conversation.len() > 2 {
                            // Keep the first user turn and the most recent half.
                            let drop_n = conversation.len() / 2;
                            conversation.drain(0..drop_n);
                        }
                        continue;
                    }
                    Err(e) => {
                        tracing::error!(target: "drift::loop", err = %e, "provider error opening stream");
                        yield AgentEvent::Error { message: format_provider_error(&e) };
                        return;
                    }
                };

                // -------------- Inner loop: drain one stream -------------
                let mut text_buf = String::new();
                let mut tool_requests: Vec<(String, String, serde_json::Value)> = Vec::new();
                let mut last_usage: Option<Usage> = None;

                while let Some(next) = stream.next().await {
                    if cancel.is_cancelled() { break; }
                    let (msg_opt, usage) = match next {
                        Ok(p) => p,
                        Err(ProviderError::ContextLengthExceeded { .. }) if !compaction_attempted => {
                            compaction_attempted = true;
                            // We can't compact mid-stream — just bail and let
                            // the outer loop retry. Drop the streamed text.
                            text_buf.clear();
                            tool_requests.clear();
                            break;
                        }
                        Err(e) => {
                            yield AgentEvent::Error { message: format_provider_error(&e) };
                            return;
                        }
                    };
                    if let Some(u) = usage {
                        last_usage = Some(u.clone());
                        yield AgentEvent::Usage(u);
                    }
                    let Some(msg) = msg_opt else { continue };
                    for c in msg.content {
                        match c {
                            MessageContent::Text(t) => {
                                text_buf.push_str(&t);
                                yield AgentEvent::TextDelta { text: t };
                            }
                            MessageContent::ToolRequest { id, name, arguments } => {
                                tool_requests.push((id, name, arguments));
                            }
                            MessageContent::ToolResponse { .. } => {
                                // Not expected from the provider stream.
                            }
                        }
                    }
                }
                let _ = last_usage;

                // [4] Build & commit this turn's assistant message.
                let mut content: Vec<MessageContent> = Vec::new();
                if !text_buf.is_empty() {
                    content.push(MessageContent::Text(text_buf.clone()));
                }
                for (id, name, arguments) in &tool_requests {
                    content.push(MessageContent::ToolRequest {
                        id: id.clone(),
                        name: name.clone(),
                        arguments: arguments.clone(),
                    });
                }
                let assistant_msg = Message { role: Role::Assistant, content };
                tracing::info!(
                    target: "drift::loop",
                    turn = turns_taken,
                    text_chars = text_buf.len(),
                    tool_calls = tool_requests.len(),
                    "◀ turn end (assistant committed)"
                );
                yield AgentEvent::AssistantMessage { message: assistant_msg.clone() };
                conversation.push(assistant_msg);

                // [5] No tools called → final answer → exit outer loop.
                if tool_requests.is_empty() {
                    tracing::info!(
                        target: "drift::loop",
                        turn = turns_taken,
                        "no tool calls — agent done"
                    );
                    yield AgentEvent::Done;
                    break;
                }

                // [6] Permission gate + dispatch (sequential — see comment).
                //
                // Goose runs tool calls concurrently via `stream::select_all`.
                // We do them sequentially: the average drift workflow chains
                // tools (find_image → detect_runtime → install_profiler) so
                // there's nothing to overlap, and concurrency would collide on
                // the shared Docker daemon. If a future tool family benefits
                // from parallelism, switch to `futures::future::join_all`.
                for (id, name, arguments) in tool_requests {
                    if cancel.is_cancelled() { break; }

                    let permission = tools_for_lookup
                        .iter()
                        .find(|t| t.def.name == name)
                        .map(|t| t.permission)
                        .unwrap_or(super::tools::Permission::Destructive);

                    match tools::decide(permission, mode) {
                        Decision::Approved => {
                            tracing::info!(
                                target: "drift::loop",
                                tool = %name,
                                tool_id = %id,
                                ?permission,
                                "permission approved → dispatching"
                            );
                            yield AgentEvent::ToolDispatched {
                                id: id.clone(),
                                name: name.clone(),
                                arguments: arguments.clone(),
                            };
                            let (payload, is_error) = tools::dispatch(&name, arguments).await;
                            yield AgentEvent::ToolCompleted {
                                id: id.clone(),
                                content: payload.clone(),
                                is_error,
                            };
                            conversation.push(Message::tool_response(id, payload, is_error));
                        }
                        Decision::NeedsApproval => {
                            tracing::warn!(
                                target: "drift::loop",
                                tool = %name,
                                tool_id = %id,
                                ?mode,
                                "permission denied — synthesising tool denial response"
                            );
                            yield AgentEvent::ToolNeedsApproval {
                                id: id.clone(),
                                name: name.clone(),
                                arguments,
                            };
                            // Synthesise a denial so the next turn sees that
                            // the call did NOT run. The model can decide to
                            // give up or try a read-only path.
                            let denial = serde_json::json!({
                                "denied": true,
                                "reason": "User approval required; call was not executed."
                            }).to_string();
                            conversation.push(Message::tool_response(id, denial, true));
                        }
                    }
                }

                // Cooperative yield — let other tasks run between turns.
                tokio::task::yield_now().await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::provider::MessageStream;
    use crate::agent::types::{ToolDef, Usage};
    use async_trait::async_trait;
    use futures_util::stream;
    use std::sync::Mutex;

    type ScriptedItem = Result<(Option<Message>, Option<Usage>), ProviderError>;
    type ScriptedTurns = Vec<Vec<ScriptedItem>>;

    /// Scripted provider — yields a hard-coded sequence per turn. Lets us
    /// test the loop without standing up an HTTP server.
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

    #[test]
    fn format_provider_error_renders_docker_model_configure_hint() {
        let err = ProviderError::ContextLengthExceeded {
            prompt_tokens: Some(4125),
            context_size: Some(4096),
            model: Some("ai/gemma3:E4B".to_string()),
        };
        let msg = format_provider_error(&err);
        // The user-actionable bits:
        assert!(msg.contains("4125"));
        assert!(msg.contains("4096"));
        assert!(msg.contains("docker model configure --context-size"));
        assert!(msg.contains("ai/gemma3:E4B"));
    }

    #[test]
    fn format_provider_error_works_without_model_id() {
        let err = ProviderError::ContextLengthExceeded {
            prompt_tokens: None,
            context_size: None,
            model: None,
        };
        let msg = format_provider_error(&err);
        // Generic hint that still mentions the command for orientation.
        assert!(msg.contains("Raise the context size"));
        assert!(msg.contains("docker model configure --context-size"));
    }

    #[test]
    fn format_provider_error_passes_through_non_context_errors() {
        let err = ProviderError::Network("connection refused".to_string());
        let msg = format_provider_error(&err);
        assert!(msg.contains("connection refused"));
    }

    #[tokio::test]
    async fn loop_exits_when_assistant_emits_no_tool_calls() {
        let provider = Arc::new(ScriptedProvider::new(vec![vec![
            Ok((Some(Message::assistant_text("hi there")), None)),
        ]]));
        let agent = Agent::new(provider, "you are a bot");
        let mut stream = Box::pin(agent.reply("hello".into(), vec![], CancellationToken::new()));
        let mut events = Vec::new();
        while let Some(e) = stream.next().await {
            events.push(e.unwrap());
        }
        assert!(matches!(events.last(), Some(AgentEvent::Done)));
        // A TextDelta + AssistantMessage + Done = 3 events at minimum.
        assert!(events.len() >= 3);
    }

    #[tokio::test]
    async fn turn_budget_short_circuits_runaway_tool_loops() {
        // Build a provider that keeps calling find_image forever. Budget
        // should kick in.
        let one_turn = || {
            vec![Ok::<_, ProviderError>((
                Some(Message {
                    role: Role::Assistant,
                    content: vec![MessageContent::ToolRequest {
                        id: "x".into(),
                        name: "find_image".into(),
                        arguments: serde_json::json!({"path": "/tmp"}),
                    }],
                }),
                None,
            ))]
        };
        let provider = Arc::new(ScriptedProvider::new(vec![
            one_turn(), one_turn(), one_turn(), one_turn(),
        ]));
        // Budget of 2 turns — even though the script has 4, we should stop early.
        let agent = Agent::new(provider, "").with_max_turns(2).with_mode(Mode::Auto);
        let mut stream = Box::pin(agent.reply("go".into(), vec![], CancellationToken::new()));
        let mut events = Vec::new();
        while let Some(e) = stream.next().await {
            events.push(e.unwrap());
        }
        assert!(events
            .iter()
            .any(|e| matches!(e, AgentEvent::TurnBudgetExceeded { .. })));
    }

    #[tokio::test]
    async fn destructive_tool_in_default_mode_needs_approval() {
        let provider = Arc::new(ScriptedProvider::new(vec![
            // Turn 1: model asks to exec_in_container.
            vec![Ok((
                Some(Message {
                    role: Role::Assistant,
                    content: vec![MessageContent::ToolRequest {
                        id: "x".into(),
                        name: "exec_in_container".into(),
                        arguments: serde_json::json!({"container": "abc", "command": ["echo", "hi"]}),
                    }],
                }),
                None,
            ))],
            // Turn 2: model gives a final text answer (after seeing the denial).
            vec![Ok((Some(Message::assistant_text("ok, skipped.")), None))],
        ]));
        let agent = Agent::new(provider, "").with_mode(Mode::Default);
        let mut stream = Box::pin(agent.reply("run echo".into(), vec![], CancellationToken::new()));
        let mut events = Vec::new();
        while let Some(e) = stream.next().await {
            events.push(e.unwrap());
        }
        assert!(events
            .iter()
            .any(|e| matches!(e, AgentEvent::ToolNeedsApproval { name, .. } if name == "exec_in_container")));
        assert!(matches!(events.last(), Some(AgentEvent::Done)));
    }

    #[tokio::test]
    async fn cancellation_breaks_outer_loop() {
        let provider = Arc::new(ScriptedProvider::new(vec![
            vec![Ok((Some(Message::assistant_text("first")), None))],
        ]));
        let agent = Agent::new(provider, "");
        let token = CancellationToken::new();
        token.cancel(); // already cancelled
        let mut stream = Box::pin(agent.reply("hi".into(), vec![], token));
        let mut events = Vec::new();
        while let Some(e) = stream.next().await {
            events.push(e.unwrap());
        }
        // Cancelled before the very first turn — no events emitted at all.
        assert!(events.is_empty());
    }
}
