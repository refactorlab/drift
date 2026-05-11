//! Configuration for the LLM agent backend.
//!
//! Every supported runtime — cloud or local — speaks OpenAI-compatible HTTP,
//! so a single `Api` variant covers all of them. Local runtimes (Ollama,
//! LM Studio, Docker Model Runner, vLLM, llama-server, …) are detected via
//! [`crate::model_discovery::probe_local_runtimes`] and saved as an `Api`
//! config pointing at the loopback URL the runtime is bound to.
//!
//! Frontend sends `{ "mode": "api", ... }` to the `configure_backend` Tauri
//! command; serde dispatches into the matching variant.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "lowercase")]
pub enum ModelBackend {
    Api {
        base_url: String,
        api_key: String,
        model: String,
    },
}
