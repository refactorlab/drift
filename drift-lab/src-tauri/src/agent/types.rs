//! Wire types shared across the loop and every provider impl.
//!
//! Every provider lowers its own protocol (OpenAI's `tool_calls[]`,
//! Anthropic's `content[].type=="tool_use"`, llama.cpp's text parser) into
//! these structs. The agent loop only sees `MessageContent::ToolRequest` —
//! it never inspects which provider produced it.

use serde::{Deserialize, Serialize};

/// Roles map 1:1 to the OpenAI chat-completion roles. `Tool` is reserved for
/// the synthetic message we build to deliver a tool result back to the model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

/// One semantic chunk inside a `Message`. A single assistant turn can mix
/// `Text` + multiple `ToolRequest`s. A tool turn carries one `ToolResponse`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum MessageContent {
    Text(String),
    ToolRequest {
        id: String,
        name: String,
        arguments: serde_json::Value,
    },
    ToolResponse {
        id: String,
        /// Stringified tool output. Whatever the tool produced, JSON-encoded.
        content: String,
        is_error: bool,
    },
}

impl MessageContent {
    pub fn text(s: impl Into<String>) -> Self {
        MessageContent::Text(s.into())
    }
}

/// A complete role-tagged turn. Equivalent to one row of `messages` in an
/// OpenAI chat-completion request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: Vec<MessageContent>,
}

impl Message {
    pub fn user(text: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: vec![MessageContent::Text(text.into())],
        }
    }

    pub fn system(text: impl Into<String>) -> Self {
        Self {
            role: Role::System,
            content: vec![MessageContent::Text(text.into())],
        }
    }

    pub fn assistant_text(text: impl Into<String>) -> Self {
        Self {
            role: Role::Assistant,
            content: vec![MessageContent::Text(text.into())],
        }
    }

    pub fn tool_response(id: impl Into<String>, content: impl Into<String>, is_error: bool) -> Self {
        Self {
            role: Role::Tool,
            content: vec![MessageContent::ToolResponse {
                id: id.into(),
                content: content.into(),
                is_error,
            }],
        }
    }

    /// Pull every tool request out of this message, in order. Empty for
    /// pure-text turns.
    pub fn tool_requests(&self) -> Vec<(&str, &str, &serde_json::Value)> {
        self.content
            .iter()
            .filter_map(|c| match c {
                MessageContent::ToolRequest {
                    id,
                    name,
                    arguments,
                } => Some((id.as_str(), name.as_str(), arguments)),
                _ => None,
            })
            .collect()
    }

    /// Concatenate every `Text` block — useful when persisting a final answer.
    pub fn flat_text(&self) -> String {
        let mut out = String::new();
        for c in &self.content {
            if let MessageContent::Text(t) = c {
                out.push_str(t);
            }
        }
        out
    }
}

/// Tool advertisement sent to the model on each turn — name, description, and
/// the JSON-schema for `Args`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// Per-turn token accounting. Providers fill in whichever fields they have;
/// missing fields are `None`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Usage {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
}

/// Errors the provider can surface to the agent loop. The loop treats
/// `ContextLengthExceeded` specially (compaction step in goose); everything
/// else is fatal for the current turn.
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    /// The model's context window was exhausted. The loop tries one round of
    /// compaction (dropping the oldest half of the history) before bailing;
    /// the optional fields are surfaced verbatim to the user when we bail so
    /// they can act on the error (e.g. raise the context size on Docker
    /// Model Runner).
    #[error("context length exceeded")]
    ContextLengthExceeded {
        /// Tokens the failing request would have sent.
        prompt_tokens: Option<u64>,
        /// Context window the model is configured for.
        context_size: Option<u64>,
        /// Model identifier (e.g. `ai/gemma3:E4B`) so the UI can suggest
        /// a model-specific remediation command.
        model: Option<String>,
    },
    #[error("network error: {0}")]
    Network(String),
    #[error("malformed response: {0}")]
    Malformed(String),
    #[error("provider error: {0}")]
    Other(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn message_roundtrips_text() {
        let m = Message::user("hi");
        assert_eq!(m.flat_text(), "hi");
        assert!(m.tool_requests().is_empty());
    }

    #[test]
    fn tool_requests_are_extracted_in_order() {
        let m = Message {
            role: Role::Assistant,
            content: vec![
                MessageContent::text("ok"),
                MessageContent::ToolRequest {
                    id: "1".into(),
                    name: "a".into(),
                    arguments: serde_json::json!({"x": 1}),
                },
                MessageContent::ToolRequest {
                    id: "2".into(),
                    name: "b".into(),
                    arguments: serde_json::json!({}),
                },
            ],
        };
        let names: Vec<_> = m.tool_requests().iter().map(|(_, n, _)| *n).collect();
        assert_eq!(names, vec!["a", "b"]);
        assert_eq!(m.flat_text(), "ok");
    }
}
