//! Curated provider + local-model presets surfaced to the UI's onboarding
//! flow. Hardcoded today; can graduate to a JSON resource later.

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderPreset {
    pub id: &'static str,
    pub name: &'static str,
    pub base_url: &'static str,
    /// Statically known model ids. Empty for local endpoints — the UI fetches
    /// `/v1/models` to populate the dropdown live.
    pub models: &'static [&'static str],
    /// Where the user goes to fetch an API key. Empty for local providers.
    pub api_key_url: &'static str,
    /// `false` for local OpenAI-compatible endpoints (Ollama, Docker Model
    /// Runner, LM Studio) — the UI hides the key input and auto-fills
    /// `not-needed`.
    pub requires_api_key: bool,
    /// One-line copy explaining how to install/start this provider. Shown
    /// under the preset name in the picker. Every entry — cloud or local —
    /// uses the same OpenAI-compatible HTTP shape downstream, this field
    /// just helps the user tell *where* the endpoint comes from.
    pub description: &'static str,
}

/// All providers — cloud or local — talk the same OpenAI HTTP shape:
/// `<base_url>/chat/completions`, `<base_url>/models`, bearer auth (or
/// `not-needed` for local). The `requires_api_key` flag is the only thing
/// the UI branches on.
pub const PRESETS: &[ProviderPreset] = &[
    // ----- Cloud APIs -----
    ProviderPreset {
        id: "openai",
        name: "OpenAI",
        base_url: "https://api.openai.com/v1",
        models: &["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
        api_key_url: "https://platform.openai.com/api-keys",
        requires_api_key: true,
        description: "OpenAI's hosted API. Bring your own key.",
    },
    ProviderPreset {
        id: "groq",
        name: "Groq",
        base_url: "https://api.groq.com/openai/v1",
        models: &["llama-3.3-70b-versatile", "qwen/qwen3-32b"],
        api_key_url: "https://console.groq.com/keys",
        requires_api_key: true,
        description: "Hosted Llama / Qwen on Groq's LPU. OpenAI-compatible.",
    },
    ProviderPreset {
        id: "openrouter",
        name: "OpenRouter",
        base_url: "https://openrouter.ai/api/v1",
        models: &["openai/gpt-4o", "anthropic/claude-opus-4-7"],
        api_key_url: "https://openrouter.ai/keys",
        requires_api_key: true,
        description: "Aggregator — one key, hundreds of models.",
    },
    // ----- Local OpenAI-compatible servers -----
    ProviderPreset {
        id: "ollama",
        name: "Ollama (local)",
        base_url: "http://localhost:11434/v1",
        models: &[],
        api_key_url: "https://ollama.com",
        requires_api_key: false,
        description: "Runs models on this machine. Install Ollama, then `ollama pull <model>`.",
    },
    ProviderPreset {
        id: "docker-model-runner",
        name: "Docker Model Runner (local)",
        // Canonical OpenAI-compat path; engine-agnostic. (NOT the
        // engine-specific `/engines/llama.cpp/v1` — that path bypasses
        // Docker's engine routing and isn't what most clients should use.)
        base_url: "http://localhost:12434/engines/v1",
        models: &[],
        api_key_url: "https://docs.docker.com/ai/model-runner/",
        requires_api_key: false,
        description: "Docker Desktop's built-in model runner. Enable in Settings → AI.",
    },
    ProviderPreset {
        id: "lm-studio",
        name: "LM Studio (local)",
        base_url: "http://localhost:1234/v1",
        models: &[],
        api_key_url: "https://lmstudio.ai",
        requires_api_key: false,
        description: "Desktop app for local models. Start the local server in LM Studio.",
    },
    ProviderPreset {
        id: "custom",
        name: "Custom (OpenAI-compatible)",
        base_url: "http://localhost:8080/v1",
        models: &[],
        api_key_url: "",
        requires_api_key: false,
        description: "Any OpenAI-compatible HTTP endpoint — vLLM, llama-server, TGI, etc.",
    },
];

#[tauri::command]
pub fn list_presets() -> Vec<ProviderPreset> {
    PRESETS.to_vec()
}
