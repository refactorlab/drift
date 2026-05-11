//! Resolve a [`ModelBackend`] config into a `ResolvedBackend`.
//!
//! Every runtime — cloud or local — speaks OpenAI-compatible HTTP and lives
//! behind a base URL. drift-lab no longer runs any inference itself: local
//! runtimes (Ollama, LM Studio, Docker Model Runner) are detected via
//! [`crate::model_discovery::probe_local_runtimes`] and treated identically
//! to cloud providers downstream.

use anyhow::{Context, Result};
use rig::providers::openai;
use tauri::{AppHandle, Runtime};

use crate::model_config::ModelBackend;

pub struct ResolvedBackend {
    pub client: openai::CompletionsClient,
    pub model: String,
}

pub async fn resolve<R: Runtime>(
    backend: ModelBackend,
    _app: &AppHandle<R>,
) -> Result<ResolvedBackend> {
    match backend {
        ModelBackend::Api {
            base_url,
            api_key,
            model,
        } => {
            // `.completions_api()` switches rig from the new Responses API
            // (`POST /responses`) to classic Chat Completions. Local OpenAI-
            // compatible servers (Ollama, LM Studio, Docker Model Runner,
            // llama-server) only expose `/chat/completions` — the default
            // builder silently 404s against them. See `tests/openai_live.rs`
            // for the load-bearing assertion.
            let client = openai::Client::builder()
                .api_key(api_key)
                .base_url(base_url)
                .build()
                .context("building OpenAI-compatible client")?
                .completions_api();
            Ok(ResolvedBackend { client, model })
        }
    }
}
