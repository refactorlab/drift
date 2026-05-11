//! Live-endpoint streaming test against an OpenAI-compatible server.
//!
//! Defaults to **Docker Model Runner** at `http://localhost:12434/engines/v1`,
//! which is the same wire shape OpenAI's hosted API speaks — so pointing this
//! at `https://api.openai.com/v1` (with `DRIFT_LAB_OPENAI_TEST_KEY=sk-…` and
//! `DRIFT_LAB_OPENAI_TEST_MODEL=gpt-4o-mini`) exercises the production path
//! identically. Same goes for Ollama, LM Studio, Groq, OpenRouter.
//!
//! The test is **gated on reachability**: if the endpoint isn't up, the test
//! prints a skip line and returns OK so CI on machines without Docker Model
//! Runner doesn't fail. Force-skip with `DRIFT_LAB_SKIP_NET=1`.
//!
//! Why this matters: rig 0.35's default `openai::Client::builder().build()`
//! routes through the new **Responses API** (`POST /responses`). Local
//! servers (llama-server, Ollama, Docker Model Runner) only expose the
//! classic Chat Completions surface — so this test threads `.completions_api()`
//! end-to-end and asserts that real tokens come back. That's the same switch
//! `backend.rs` should make for `mode: "local"` providers; this test makes
//! the requirement load-bearing.
//!
//! Run with: `cargo test --test openai_live -- --nocapture`
//!
//! Tweak via env:
//!   DRIFT_LAB_OPENAI_TEST_URL    base URL (default: http://localhost:12434/engines/v1)
//!   DRIFT_LAB_OPENAI_TEST_KEY    API key (default: "not-needed", fine for local servers)
//!   DRIFT_LAB_OPENAI_TEST_MODEL  model id; if unset, the first id from /models is used

use std::time::Duration;

use futures_util::StreamExt;
use rig::agent::MultiTurnStreamItem;
use rig::client::CompletionClient;
use rig::providers::openai;
use rig::streaming::{StreamedAssistantContent, StreamingChat};

const DEFAULT_BASE_URL: &str = "http://localhost:12434/engines/v1";
const DEFAULT_KEY: &str = "not-needed";

fn env(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|v| !v.is_empty())
}

async fn endpoint_reachable(base_url: &str, api_key: &str) -> bool {
    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let mut req = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap()
        .get(&url);
    if api_key != DEFAULT_KEY && !api_key.is_empty() {
        req = req.bearer_auth(api_key);
    }
    matches!(req.send().await, Ok(resp) if resp.status().is_success())
}

async fn discover_model(base_url: &str, api_key: &str) -> Option<String> {
    if let Some(m) = env("DRIFT_LAB_OPENAI_TEST_MODEL") {
        return Some(m);
    }
    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let mut req = reqwest::Client::new().get(&url);
    if api_key != DEFAULT_KEY && !api_key.is_empty() {
        req = req.bearer_auth(api_key);
    }
    let resp = req.send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let json: serde_json::Value = resp.json().await.ok()?;
    json.get("data")?
        .as_array()?
        .first()?
        .get("id")?
        .as_str()
        .map(|s| s.to_string())
}

#[tokio::test(flavor = "multi_thread")]
async fn streams_real_tokens_from_an_openai_compatible_endpoint() {
    if std::env::var("DRIFT_LAB_SKIP_NET").is_ok() {
        eprintln!("openai_live: DRIFT_LAB_SKIP_NET set — skipping");
        return;
    }
    let base_url = env("DRIFT_LAB_OPENAI_TEST_URL").unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
    let api_key = env("DRIFT_LAB_OPENAI_TEST_KEY").unwrap_or_else(|| DEFAULT_KEY.to_string());

    if !endpoint_reachable(&base_url, &api_key).await {
        eprintln!(
            "openai_live: {base_url} not reachable — skipping. \
             Start Docker Model Runner (Docker Desktop → Settings → AI), or \
             override with DRIFT_LAB_OPENAI_TEST_URL=…"
        );
        return;
    }

    let model = match discover_model(&base_url, &api_key).await {
        Some(m) => m,
        None => {
            eprintln!(
                "openai_live: could not discover a model at {base_url}/models — skipping. \
                 Set DRIFT_LAB_OPENAI_TEST_MODEL=<id> to force one."
            );
            return;
        }
    };
    eprintln!("openai_live: using base_url={base_url} model={model}");

    // Same construction drift-lab's `backend::resolve` should be using for
    // local providers (it currently uses the default — the Responses API —
    // which silently 404s against llama-server / Docker Model Runner).
    let client = openai::Client::builder()
        .api_key(api_key)
        .base_url(&base_url)
        .build()
        .expect("build openai client")
        .completions_api();

    let agent = client
        .agent(&model)
        .preamble("Answer directly. One short sentence. No reasoning trace.")
        .build();

    let history: Vec<rig::message::Message> = vec![];
    let stream_fut =
        agent.stream_chat("What is the capital of France?".to_string(), history);

    let mut stream = tokio::time::timeout(Duration::from_secs(30), stream_fut)
        .await
        .expect("stream_chat future should resolve within 30s — endpoint stuck?");

    let mut accumulated = String::new();
    let mut chunk_count = 0usize;
    let mut errored = None;

    let collect = async {
        while let Some(item) = stream.next().await {
            match item {
                Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::Text(
                    t,
                ))) => {
                    chunk_count += 1;
                    accumulated.push_str(&t.text);
                }
                Ok(_) => {} // tool calls, final response — none expected
                Err(e) => {
                    errored = Some(format!("{e:?}"));
                    break;
                }
            }
        }
    };
    tokio::time::timeout(Duration::from_secs(60), collect)
        .await
        .expect("stream did not finish within 60s");

    if let Some(e) = errored {
        panic!("provider returned error: {e}");
    }

    eprintln!(
        "openai_live: received {chunk_count} chunk(s); total {} chars",
        accumulated.len()
    );
    eprintln!("openai_live: response = {accumulated:?}");

    assert!(
        chunk_count > 0,
        "expected at least one streamed text chunk, got zero"
    );
    assert!(
        !accumulated.trim().is_empty(),
        "expected non-empty assistant text, got `{accumulated}`"
    );
}
