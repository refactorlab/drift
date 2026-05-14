//! Anthropic Messages API provider.
//!
//! Implements the same [`Provider`] trait the OpenAI module does, but speaks
//! Anthropic's `/v1/messages` protocol. The conversion is non-trivial:
//!
//! | Concern               | OpenAI                                                        | Anthropic |
//! |-----------------------|---------------------------------------------------------------|-----------|
//! | Auth                  | `Authorization: Bearer <key>`                                 | `x-api-key: <key>` + `anthropic-version: 2023-06-01` |
//! | `max_tokens`          | Optional                                                      | **Required** |
//! | System prompt         | A `role: "system"` message                                    | Top-level `system` field |
//! | Tool definition       | `{type:"function",function:{name,description,parameters}}`    | `{name,description,input_schema}` |
//! | Tool call (response)  | `tool_calls[].function.arguments` is a **JSON string**         | `content[].type=="tool_use"` with `input` as a **parsed JSON object** |
//! | Tool result (request) | `role: "tool"`, `tool_call_id`, string `content`              | `role: "user"`, `content: [{type:"tool_result", tool_use_id, content, is_error?}]` |
//! | Role alternation      | Loose                                                         | **Strict** — consecutive same-role messages are rejected |
//! | SSE                   | One event type, each `data:` is a delta chunk                 | Multiple event types: `message_start` / `content_block_{start,delta,stop}` / `message_delta` / `message_stop` / `ping` / `error` |
//!
//! Two consequences worth flagging:
//!
//! - Tool responses (our `Role::Tool` messages) become **`user`-role** turns
//!   on the wire. Several consecutive tool responses are merged into a single
//!   user message with multiple `tool_result` blocks so the alternation
//!   invariant holds.
//! - The SSE accumulator tracks **per-index content blocks** because a single
//!   assistant turn may contain a text block (`index=0`) and one or more
//!   `tool_use` blocks (`index=1..N`) that stream in parallel.
//!
//! Reference: https://docs.anthropic.com/en/api/messages-streaming

use std::collections::BTreeMap;

use async_stream::try_stream;
use async_trait::async_trait;
use futures_util::StreamExt;
use serde::Deserialize;

use super::provider::{MessageStream, Provider};
use super::types::{Message, MessageContent, ProviderError, Role, ToolDef, Usage};

/// API version header value. Pinned to the GA version the docs document for
/// `/v1/messages`. Newer beta features ride on `anthropic-beta` instead.
pub const ANTHROPIC_VERSION: &str = "2023-06-01";

/// Sensible default for streaming agent turns — large enough not to truncate
/// most replies, well under every current model's hard cap. Override with
/// [`ClaudeProvider::with_max_tokens`].
pub const DEFAULT_MAX_TOKENS: u32 = 16000;

/// Default base URL for the Anthropic API. Override only for proxies / tests.
pub const DEFAULT_BASE_URL: &str = "https://api.anthropic.com";

pub struct ClaudeProvider {
    base_url: String,
    api_key: String,
    model: String,
    max_tokens: u32,
    http: reqwest::Client,
}

impl ClaudeProvider {
    /// Construct with the default Anthropic base URL.
    pub fn new(api_key: impl Into<String>, model: impl Into<String>) -> Self {
        Self::with_base_url(DEFAULT_BASE_URL, api_key, model)
    }

    pub fn with_base_url(
        base_url: impl Into<String>,
        api_key: impl Into<String>,
        model: impl Into<String>,
    ) -> Self {
        Self {
            base_url: base_url.into(),
            api_key: api_key.into(),
            model: model.into(),
            max_tokens: DEFAULT_MAX_TOKENS,
            http: reqwest::Client::new(),
        }
    }

    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = max_tokens;
        self
    }

    fn build_request_body(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[ToolDef],
    ) -> serde_json::Value {
        let (combined_system, wire_messages) = lower_messages(system, messages);

        let wire_tools: Vec<serde_json::Value> = tools
            .iter()
            .map(|t| {
                serde_json::json!({
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.parameters,
                })
            })
            .collect();

        let mut body = serde_json::json!({
            "model": self.model,
            "max_tokens": self.max_tokens,
            "stream": true,
            "messages": wire_messages,
        });
        if !combined_system.is_empty() {
            body["system"] = serde_json::Value::String(combined_system);
        }
        if !wire_tools.is_empty() {
            body["tools"] = serde_json::Value::Array(wire_tools);
        }
        body
    }
}

/// Lower drift-lab's role-tagged history into Anthropic's wire shape.
///
/// Returns `(top_level_system, wire_messages)`:
///   - `Role::System` turns are stripped from the array and **concatenated**
///     onto the `system` preamble.
///   - `Role::Tool` turns become `role: "user"` with `tool_result` blocks.
///   - Consecutive same-role turns are merged so the strict alternation rule
///     isn't violated (multiple parallel tool calls produce consecutive
///     `Role::Tool` turns from the agent loop).
fn lower_messages(system_preamble: &str, messages: &[Message]) -> (String, Vec<serde_json::Value>) {
    let mut system_parts: Vec<String> = Vec::new();
    if !system_preamble.is_empty() {
        system_parts.push(system_preamble.to_string());
    }

    // First pass: split out system messages, lower each non-system message to
    // (wire_role, wire_blocks).
    let mut lowered: Vec<(&'static str, Vec<serde_json::Value>)> = Vec::new();
    for m in messages {
        match m.role {
            Role::System => {
                let text = m.flat_text();
                if !text.is_empty() {
                    system_parts.push(text);
                }
            }
            Role::User => lowered.push(("user", user_blocks(m))),
            Role::Assistant => lowered.push(("assistant", assistant_blocks(m))),
            Role::Tool => lowered.push(("user", tool_response_blocks(m))),
        }
    }

    // Second pass: merge consecutive same-role turns so alternation holds.
    let mut wire: Vec<serde_json::Value> = Vec::with_capacity(lowered.len());
    for (role, mut blocks) in lowered {
        if let Some(last) = wire.last_mut() {
            if last["role"].as_str() == Some(role) {
                if let Some(arr) = last["content"].as_array_mut() {
                    arr.append(&mut blocks);
                    continue;
                }
            }
        }
        wire.push(serde_json::json!({"role": role, "content": blocks}));
    }

    (system_parts.join("\n\n"), wire)
}

fn user_blocks(m: &Message) -> Vec<serde_json::Value> {
    let mut out = Vec::new();
    for c in &m.content {
        if let MessageContent::Text(t) = c {
            out.push(serde_json::json!({"type": "text", "text": t}));
        }
    }
    out
}

fn assistant_blocks(m: &Message) -> Vec<serde_json::Value> {
    let mut out = Vec::new();
    for c in &m.content {
        match c {
            MessageContent::Text(t) if !t.is_empty() => {
                out.push(serde_json::json!({"type": "text", "text": t}));
            }
            MessageContent::Text(_) => {}
            MessageContent::ToolRequest { id, name, arguments } => {
                // Anthropic expects `input` as a **parsed object**, not a
                // JSON-encoded string. Pass our `arguments` through verbatim.
                out.push(serde_json::json!({
                    "type": "tool_use",
                    "id": id,
                    "name": name,
                    "input": arguments,
                }));
            }
            MessageContent::ToolResponse { .. } => {
                // An assistant turn never carries a tool response.
            }
        }
    }
    out
}

fn tool_response_blocks(m: &Message) -> Vec<serde_json::Value> {
    let mut out = Vec::new();
    for c in &m.content {
        if let MessageContent::ToolResponse {
            id,
            content,
            is_error,
        } = c
        {
            let mut block = serde_json::json!({
                "type": "tool_result",
                "tool_use_id": id,
                "content": content,
            });
            if *is_error {
                block["is_error"] = serde_json::Value::Bool(true);
            }
            out.push(block);
        }
    }
    out
}

/// Best-effort detection of the "prompt too long" failure mode across
/// Anthropic and OpenAI-shaped error bodies, so the agent loop can trigger
/// its compaction path uniformly.
fn is_context_error(body: &str) -> bool {
    body.contains("context_length_exceeded")
        || body.contains("prompt is too long")
        || body.contains("input length")
        || body.contains("maximum context")
}

#[async_trait]
impl Provider for ClaudeProvider {
    fn name(&self) -> &str {
        "anthropic"
    }

    async fn stream(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[ToolDef],
    ) -> Result<MessageStream, ProviderError> {
        let url = format!("{}/v1/messages", self.base_url.trim_end_matches('/'));
        let body = self.build_request_body(system, messages, tools);
        let model = self.model.clone();

        let resp = self
            .http
            .post(&url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            if is_context_error(&body) {
                return Err(ProviderError::ContextLengthExceeded {
                    prompt_tokens: None,
                    context_size: None,
                    model: Some(model),
                });
            }
            return Err(ProviderError::Other(format!("HTTP {status}: {body}")));
        }

        let byte_stream = resp.bytes_stream();
        let stream = try_stream! {
            let mut buf = String::new();
            let mut acc = StreamAccumulator::default();
            let mut s = byte_stream;

            while let Some(chunk) = s.next().await {
                let chunk = chunk.map_err(|e| ProviderError::Network(e.to_string()))?;
                let text = std::str::from_utf8(&chunk)
                    .map_err(|e| ProviderError::Malformed(e.to_string()))?;
                buf.push_str(text);

                // Drain whole SSE events (delimited by blank line) from buf.
                while let Some(idx) = buf.find("\n\n") {
                    let raw_event: String = buf.drain(..idx + 2).collect();
                    let payload = match extract_data_payload(&raw_event) {
                        Some(p) => p,
                        None => continue,
                    };
                    let parsed: WireEvent = match serde_json::from_str(&payload) {
                        Ok(p) => p,
                        Err(_) => continue, // ignore ping / unknown event types
                    };
                    for out in acc.absorb(parsed) {
                        match out {
                            AccOutput::Yield(msg, usage) => yield (Some(msg), usage),
                            AccOutput::Error(e) => Err(e)?,
                        }
                    }
                }
            }

            // Stream ended without an explicit message_stop — flush.
            if let Some((msg, usage)) = acc.finalize() {
                yield (Some(msg), usage);
            }
        };

        Ok(Box::pin(stream))
    }
}

/// Pull the `data: ...` payload out of one SSE event (the `event: <type>` line
/// is ignored — every payload self-identifies via its `type` field).
fn extract_data_payload(raw_event: &str) -> Option<String> {
    let mut payload = String::new();
    for line in raw_event.lines() {
        let line = line.trim_start();
        if let Some(p) = line.strip_prefix("data:") {
            if !payload.is_empty() {
                payload.push('\n');
            }
            payload.push_str(p.trim_start());
        }
    }
    if payload.is_empty() {
        None
    } else {
        Some(payload)
    }
}

// ---- SSE event types -------------------------------------------------------
//
// Anthropic's stream is a sequence of typed events. We deserialise into one
// untagged sum and let the accumulator drive on `.type`.

#[derive(Deserialize, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
enum WireEvent {
    MessageStart {
        message: WireMessageStart,
    },
    ContentBlockStart {
        index: u32,
        content_block: WireContentBlockStart,
    },
    ContentBlockDelta {
        index: u32,
        delta: WireDelta,
    },
    ContentBlockStop {
        #[allow(dead_code)]
        index: u32,
    },
    MessageDelta {
        #[serde(default)]
        delta: WireMessageDeltaInner,
        #[serde(default)]
        usage: Option<WireUsage>,
    },
    MessageStop,
    Error {
        error: WireErrorPayload,
    },
    #[serde(other)]
    Other,
}

#[derive(Deserialize, Debug)]
struct WireMessageStart {
    #[serde(default)]
    usage: Option<WireUsage>,
}

#[derive(Deserialize, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
enum WireContentBlockStart {
    Text {
        #[serde(default)]
        text: String,
    },
    ToolUse {
        id: String,
        name: String,
    },
    #[serde(other)]
    Other,
}

#[derive(Deserialize, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
enum WireDelta {
    TextDelta {
        text: String,
    },
    InputJsonDelta {
        partial_json: String,
    },
    #[serde(other)]
    Other,
}

#[derive(Deserialize, Default, Debug)]
struct WireMessageDeltaInner {
    #[serde(default)]
    #[allow(dead_code)]
    stop_reason: Option<String>,
}

#[derive(Deserialize, Debug)]
struct WireUsage {
    #[serde(default)]
    input_tokens: Option<u64>,
    #[serde(default)]
    output_tokens: Option<u64>,
}

#[derive(Deserialize, Debug)]
struct WireErrorPayload {
    #[serde(rename = "type", default)]
    kind: String,
    #[serde(default)]
    message: String,
}

// ---- Accumulator -----------------------------------------------------------

enum BlockState {
    Text(String),
    ToolUse {
        id: String,
        name: String,
        partial_json: String,
    },
}

/// What the accumulator hands back per absorbed SSE event. Most events
/// produce nothing; text deltas produce a stream chunk; `message_stop`
/// produces the aggregated terminal message; errors short-circuit the loop.
enum AccOutput {
    Yield(Message, Option<Usage>),
    Error(ProviderError),
}

#[derive(Default)]
struct StreamAccumulator {
    /// In-flight content blocks keyed by their SSE `index`. `BTreeMap` so the
    /// final aggregated message preserves block order.
    blocks: BTreeMap<u32, BlockState>,
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    /// True once `message_stop` (or stream end) has fired.
    finalised: bool,
}

impl StreamAccumulator {
    fn absorb(&mut self, event: WireEvent) -> Vec<AccOutput> {
        let mut out: Vec<AccOutput> = Vec::new();
        match event {
            WireEvent::MessageStart { message } => {
                if let Some(u) = message.usage {
                    self.input_tokens = u.input_tokens.or(self.input_tokens);
                }
            }
            WireEvent::ContentBlockStart {
                index,
                content_block,
            } => match content_block {
                WireContentBlockStart::Text { text } => {
                    self.blocks.insert(index, BlockState::Text(text));
                }
                WireContentBlockStart::ToolUse { id, name } => {
                    self.blocks.insert(
                        index,
                        BlockState::ToolUse {
                            id,
                            name,
                            partial_json: String::new(),
                        },
                    );
                }
                WireContentBlockStart::Other => {}
            },
            WireEvent::ContentBlockDelta { index, delta } => match delta {
                WireDelta::TextDelta { text } => {
                    if let Some(BlockState::Text(buf)) = self.blocks.get_mut(&index) {
                        buf.push_str(&text);
                    }
                    // Emit the delta immediately so the UI can stream tokens.
                    out.push(AccOutput::Yield(
                        Message {
                            role: Role::Assistant,
                            content: vec![MessageContent::Text(text)],
                        },
                        None,
                    ));
                }
                WireDelta::InputJsonDelta { partial_json } => {
                    if let Some(BlockState::ToolUse {
                        partial_json: buf, ..
                    }) = self.blocks.get_mut(&index)
                    {
                        buf.push_str(&partial_json);
                    }
                }
                WireDelta::Other => {}
            },
            WireEvent::ContentBlockStop { .. } => {}
            WireEvent::MessageDelta { usage, .. } => {
                if let Some(u) = usage {
                    self.output_tokens = u.output_tokens.or(self.output_tokens);
                }
            }
            WireEvent::MessageStop => {
                if let Some((msg, usage)) = self.finalize() {
                    out.push(AccOutput::Yield(msg, usage));
                }
            }
            WireEvent::Error { error } => {
                let kind = error.kind;
                let msg = error.message;
                if kind == "overloaded_error" || kind == "api_error" {
                    out.push(AccOutput::Error(ProviderError::Other(format!(
                        "{kind}: {msg}"
                    ))));
                } else if msg.to_lowercase().contains("prompt is too long")
                    || msg.to_lowercase().contains("maximum context")
                {
                    out.push(AccOutput::Error(ProviderError::ContextLengthExceeded {
                        prompt_tokens: None,
                        context_size: None,
                        model: None,
                    }));
                } else {
                    out.push(AccOutput::Error(ProviderError::Other(format!(
                        "{kind}: {msg}"
                    ))));
                }
            }
            WireEvent::Other => {}
        }
        out
    }

    /// Build the terminal aggregated message: tool calls in SSE-index order,
    /// final usage if we observed either side of the token accounting.
    fn finalize(&mut self) -> Option<(Message, Option<Usage>)> {
        if self.finalised {
            return None;
        }
        self.finalised = true;
        let mut content: Vec<MessageContent> = Vec::new();
        for (_, block) in std::mem::take(&mut self.blocks) {
            match block {
                BlockState::Text(_) => {
                    // Text was already streamed as deltas — don't double-emit.
                }
                BlockState::ToolUse {
                    id,
                    name,
                    partial_json,
                } => {
                    let arguments: serde_json::Value = match serde_json::from_str(&partial_json) {
                        Ok(v) => v,
                        Err(_) => serde_json::Value::String(partial_json),
                    };
                    content.push(MessageContent::ToolRequest {
                        id,
                        name,
                        arguments,
                    });
                }
            }
        }
        let usage = if self.input_tokens.is_some() || self.output_tokens.is_some() {
            let total = match (self.input_tokens, self.output_tokens) {
                (Some(i), Some(o)) => Some(i + o),
                _ => None,
            };
            Some(Usage {
                input_tokens: self.input_tokens,
                output_tokens: self.output_tokens,
                total_tokens: total,
            })
        } else {
            None
        };
        Some((
            Message {
                role: Role::Assistant,
                content,
            },
            usage,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn provider() -> ClaudeProvider {
        ClaudeProvider::new("sk-test", "claude-opus-4-7")
    }

    #[test]
    fn request_body_has_required_max_tokens_and_streams() {
        let body = provider().build_request_body("You are helpful.", &[], &[]);
        assert_eq!(body["model"], "claude-opus-4-7");
        assert_eq!(body["stream"], true);
        assert!(
            body["max_tokens"].as_u64().unwrap() > 0,
            "max_tokens must be set — Anthropic 400s without it"
        );
        assert_eq!(body["system"], "You are helpful.");
    }

    #[test]
    fn system_role_messages_merge_into_top_level_system() {
        let messages = [
            Message::system("Be concise."),
            Message::user("Hello"),
        ];
        let body = provider().build_request_body("Base preamble.", &messages, &[]);
        assert_eq!(body["system"], "Base preamble.\n\nBe concise.");
        // The system turn must NOT appear in the messages array.
        let arr = body["messages"].as_array().unwrap();
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0]["role"], "user");
    }

    #[test]
    fn tool_def_uses_input_schema_not_parameters() {
        let tools = [ToolDef {
            name: "get_weather".into(),
            description: "Get weather".into(),
            parameters: serde_json::json!({"type": "object", "properties": {"city": {"type": "string"}}}),
        }];
        let body = provider().build_request_body("", &[Message::user("hi")], &tools);
        let tool = &body["tools"][0];
        assert_eq!(tool["name"], "get_weather");
        assert_eq!(tool["description"], "Get weather");
        assert_eq!(tool["input_schema"]["type"], "object");
        assert!(tool.get("parameters").is_none(), "Anthropic uses input_schema, not parameters");
        assert!(tool.get("type").is_none(), "Anthropic tools are not wrapped in {{type:function,...}}");
    }

    #[test]
    fn assistant_tool_call_is_lowered_to_tool_use_block_with_object_input() {
        let messages = [Message {
            role: Role::Assistant,
            content: vec![
                MessageContent::Text("Let me check.".into()),
                MessageContent::ToolRequest {
                    id: "toolu_abc".into(),
                    name: "get_weather".into(),
                    arguments: serde_json::json!({"city": "Paris"}),
                },
            ],
        }];
        let body = provider().build_request_body("", &messages, &[]);
        let blocks = body["messages"][0]["content"].as_array().unwrap();
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0]["type"], "text");
        assert_eq!(blocks[1]["type"], "tool_use");
        assert_eq!(blocks[1]["id"], "toolu_abc");
        assert_eq!(blocks[1]["name"], "get_weather");
        // Critical: Anthropic expects `input` as a JSON object, NOT a string.
        assert!(blocks[1]["input"].is_object(), "input must be a parsed object, not a JSON string");
        assert_eq!(blocks[1]["input"]["city"], "Paris");
    }

    #[test]
    fn tool_response_becomes_user_role_with_tool_result_block() {
        let messages = [
            Message::user("weather?"),
            Message {
                role: Role::Assistant,
                content: vec![MessageContent::ToolRequest {
                    id: "toolu_1".into(),
                    name: "get_weather".into(),
                    arguments: serde_json::json!({"city": "Paris"}),
                }],
            },
            Message::tool_response("toolu_1", "72F sunny", false),
        ];
        let body = provider().build_request_body("", &messages, &[]);
        let arr = body["messages"].as_array().unwrap();
        assert_eq!(arr.len(), 3);
        assert_eq!(arr[2]["role"], "user", "tool turns become user turns on the wire");
        let result_block = &arr[2]["content"][0];
        assert_eq!(result_block["type"], "tool_result");
        assert_eq!(result_block["tool_use_id"], "toolu_1");
        assert_eq!(result_block["content"], "72F sunny");
        assert!(result_block.get("is_error").is_none(), "is_error omitted when false");
    }

    #[test]
    fn tool_response_with_error_sets_is_error_true() {
        let messages = [
            Message::user("x"),
            Message {
                role: Role::Assistant,
                content: vec![MessageContent::ToolRequest {
                    id: "t1".into(),
                    name: "x".into(),
                    arguments: serde_json::json!({}),
                }],
            },
            Message::tool_response("t1", "boom", true),
        ];
        let body = provider().build_request_body("", &messages, &[]);
        assert_eq!(body["messages"][2]["content"][0]["is_error"], true);
    }

    #[test]
    fn consecutive_tool_responses_are_merged_into_one_user_turn() {
        // Two parallel tool calls produce two consecutive Role::Tool messages
        // — Anthropic rejects consecutive same-role turns, so they must merge.
        let messages = [
            Message::user("x"),
            Message {
                role: Role::Assistant,
                content: vec![
                    MessageContent::ToolRequest {
                        id: "t1".into(),
                        name: "a".into(),
                        arguments: serde_json::json!({}),
                    },
                    MessageContent::ToolRequest {
                        id: "t2".into(),
                        name: "b".into(),
                        arguments: serde_json::json!({}),
                    },
                ],
            },
            Message::tool_response("t1", "r1", false),
            Message::tool_response("t2", "r2", false),
        ];
        let body = provider().build_request_body("", &messages, &[]);
        let arr = body["messages"].as_array().unwrap();
        assert_eq!(arr.len(), 3, "two tool turns merge into one user turn");
        let merged = arr[2]["content"].as_array().unwrap();
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0]["tool_use_id"], "t1");
        assert_eq!(merged[1]["tool_use_id"], "t2");
    }

    #[test]
    fn accumulator_streams_text_deltas_and_aggregates_tool_call() {
        let mut acc = StreamAccumulator::default();

        // message_start with input usage
        for o in acc.absorb(WireEvent::MessageStart {
            message: WireMessageStart {
                usage: Some(WireUsage {
                    input_tokens: Some(25),
                    output_tokens: None,
                }),
            },
        }) {
            // message_start emits nothing
            match o {
                AccOutput::Yield(_, _) => panic!("message_start should not yield"),
                AccOutput::Error(_) => panic!("no error expected"),
            }
        }

        // Text block: start + two deltas + stop
        let _ = acc.absorb(WireEvent::ContentBlockStart {
            index: 0,
            content_block: WireContentBlockStart::Text { text: String::new() },
        });
        let out1 = acc.absorb(WireEvent::ContentBlockDelta {
            index: 0,
            delta: WireDelta::TextDelta { text: "Hel".into() },
        });
        let out2 = acc.absorb(WireEvent::ContentBlockDelta {
            index: 0,
            delta: WireDelta::TextDelta { text: "lo".into() },
        });
        assert_eq!(out1.len(), 1);
        assert_eq!(out2.len(), 1);
        if let AccOutput::Yield(m, _) = &out1[0] {
            assert_eq!(m.flat_text(), "Hel");
        } else {
            panic!("expected yield");
        }
        let _ = acc.absorb(WireEvent::ContentBlockStop { index: 0 });

        // Tool-use block: start + two arg deltas + stop
        let _ = acc.absorb(WireEvent::ContentBlockStart {
            index: 1,
            content_block: WireContentBlockStart::ToolUse {
                id: "toolu_x".into(),
                name: "find_image".into(),
            },
        });
        let _ = acc.absorb(WireEvent::ContentBlockDelta {
            index: 1,
            delta: WireDelta::InputJsonDelta {
                partial_json: r#"{"path""#.into(),
            },
        });
        let _ = acc.absorb(WireEvent::ContentBlockDelta {
            index: 1,
            delta: WireDelta::InputJsonDelta {
                partial_json: r#":"/tmp"}"#.into(),
            },
        });
        let _ = acc.absorb(WireEvent::ContentBlockStop { index: 1 });

        // message_delta with final output_tokens
        let _ = acc.absorb(WireEvent::MessageDelta {
            delta: WireMessageDeltaInner::default(),
            usage: Some(WireUsage {
                input_tokens: None,
                output_tokens: Some(7),
            }),
        });

        // message_stop — the terminal yield
        let final_out = acc.absorb(WireEvent::MessageStop);
        assert_eq!(final_out.len(), 1);
        let (final_msg, usage) = match final_out.into_iter().next().unwrap() {
            AccOutput::Yield(m, u) => (m, u),
            _ => panic!("expected yield"),
        };

        // Final aggregated message: text already streamed (not re-emitted),
        // tool call parsed into a ToolRequest with object arguments.
        assert_eq!(final_msg.flat_text(), "", "text was streamed, not re-emitted");
        let reqs = final_msg.tool_requests();
        assert_eq!(reqs.len(), 1);
        let (id, name, args) = reqs[0];
        assert_eq!(id, "toolu_x");
        assert_eq!(name, "find_image");
        assert_eq!(args["path"], serde_json::json!("/tmp"));

        let u = usage.unwrap();
        assert_eq!(u.input_tokens, Some(25));
        assert_eq!(u.output_tokens, Some(7));
        assert_eq!(u.total_tokens, Some(32));
    }

    #[test]
    fn accumulator_surfaces_context_length_error_from_error_event() {
        let mut acc = StreamAccumulator::default();
        let out = acc.absorb(WireEvent::Error {
            error: WireErrorPayload {
                kind: "invalid_request_error".into(),
                message: "prompt is too long: 250000 tokens > 200000 maximum".into(),
            },
        });
        assert_eq!(out.len(), 1);
        match out.into_iter().next().unwrap() {
            AccOutput::Error(ProviderError::ContextLengthExceeded { .. }) => {}
            other => panic!("expected ContextLengthExceeded, got {other:?}", other = match other {
                AccOutput::Yield(_, _) => "Yield",
                AccOutput::Error(e) => Box::leak(format!("Error({e})").into_boxed_str()),
            }),
        }
    }

    #[test]
    fn extract_data_payload_handles_simple_event() {
        let raw = "event: content_block_delta\ndata: {\"type\":\"content_block_delta\"}\n\n";
        let p = extract_data_payload(raw).unwrap();
        assert_eq!(p, "{\"type\":\"content_block_delta\"}");
    }

    #[test]
    fn extract_data_payload_handles_multiline_data() {
        // Per the SSE spec, multiple data: lines in one event are joined with \n.
        let raw = "data: line1\ndata: line2\n\n";
        let p = extract_data_payload(raw).unwrap();
        assert_eq!(p, "line1\nline2");
    }

    #[test]
    fn extract_data_payload_returns_none_for_event_with_no_data() {
        let raw = "event: ping\n\n";
        assert!(extract_data_payload(raw).is_none());
    }

    #[test]
    fn provider_name_is_anthropic() {
        assert_eq!(provider().name(), "anthropic");
    }
}
