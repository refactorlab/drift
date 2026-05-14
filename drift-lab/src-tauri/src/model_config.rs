//! Configuration for the LLM agent backend.
//!
//! Two wire protocols are supported:
//!
//! - `Api` — OpenAI-compatible HTTP. Covers cloud OpenAI, Azure OpenAI, and
//!   every local runtime we care about (Ollama, LM Studio, Docker Model
//!   Runner, vLLM, llama-server), all of which speak `/chat/completions`.
//! - `Anthropic` — Anthropic's `/v1/messages`. Distinct because the wire
//!   format differs in load-bearing ways: `x-api-key` auth, `max_tokens`
//!   required, `system` top-level, tool use as content blocks, multi-event
//!   SSE.
//!
//! Frontend sends `{ "mode": "api" | "anthropic", ... }` to the
//! `configure_backend` Tauri command; serde dispatches into the matching
//! variant. To pick a concrete `Provider` from a config, call
//! [`crate::agent::make_provider`].

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "lowercase")]
pub enum ModelBackend {
    Api {
        base_url: String,
        api_key: String,
        model: String,
    },
    Anthropic {
        #[serde(default = "default_anthropic_base_url")]
        base_url: String,
        api_key: String,
        model: String,
    },
}

fn default_anthropic_base_url() -> String {
    "https://api.anthropic.com".to_string()
}
