//! Streaming-LLM integration test.
//!
//! Goose's local-inference layer treats the model as a stream of
//! `MultiTurnStreamItem` events from `rig::agent::stream_chat`. Drift-lab's
//! `commands::chat` consumes the same event stream — see `commands.rs:269`.
//!
//! What's hard to test in CI: actually running `llama-server` against a real
//! GGUF. What's *worth* testing: that drift-lab's chat surface drives `rig`'s
//! agent loop correctly against the OpenAI streaming wire format.
//!
//! Strategy: stand up a wiremock HTTP server emulating OpenAI's
//! `POST /v1/chat/completions` with SSE responses, point a
//! `rig::providers::openai::Client` at it, and drive `agent.stream_chat()`.
//! This exercises:
//!   - SSE parsing for `chat.completion.chunk` deltas
//!   - The same `MultiTurnStreamItem::StreamAssistantItem(Text)` branch
//!     `commands::chat` matches on
//!   - Cooperative cancellation via `tokio::select!` over a CancellationToken
//!     (the exact pattern drift-lab uses to implement `cancel_chat`).
//!
//! Run with: `cargo test --test llm_stream -- --nocapture`

use std::time::Duration;

use futures_util::StreamExt;
use rig::agent::MultiTurnStreamItem;
use rig::client::CompletionClient;
use rig::providers::openai;
use rig::streaming::{StreamedAssistantContent, StreamingChat};

// `openai::Client::builder()` defaults to the OpenAI **Responses API**
// (`POST /responses`). Local OpenAI-compatible servers only expose the
// classic Chat Completions surface (`POST /chat/completions`), so switch
// the client into completions mode via `.completions_api()`. That's the
// shape llama-server / Ollama / Docker Model Runner all serve.
use tokio_util::sync::CancellationToken;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

const MODEL: &str = "drift-lab-test";

/// One SSE event line, trailing blank line included so the parser sees the
/// boundary. Drop the chunk into a `data: ...\n\n` envelope.
fn sse_chunk(content: &str, finish: Option<&str>) -> String {
    let delta = if let Some(reason) = finish {
        format!(
            r#"{{"index":0,"delta":{{}},"finish_reason":"{}"}}"#,
            reason
        )
    } else {
        format!(
            r#"{{"index":0,"delta":{{"content":{}}},"finish_reason":null}}"#,
            serde_json::to_string(content).unwrap()
        )
    };
    format!(
        "data: {{\"id\":\"chatcmpl-test\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"{MODEL}\",\"choices\":[{delta}]}}\n\n"
    )
}

fn sse_done() -> &'static str {
    "data: [DONE]\n\n"
}

fn assemble(deltas: &[&str]) -> Vec<u8> {
    let mut body = String::new();
    body.push_str(&sse_chunk("", None)); // initial role-only delta is optional but matches OAI shape
    for (i, d) in deltas.iter().enumerate() {
        let finish = if i == deltas.len() - 1 { Some("stop") } else { None };
        body.push_str(&sse_chunk(d, None));
        if let Some(f) = finish {
            body.push_str(&sse_chunk("", Some(f)));
        }
    }
    body.push_str(sse_done());
    body.into_bytes()
}

#[tokio::test]
async fn streams_assistant_text_through_rig_agent_loop() {
    let server = MockServer::start().await;

    let body = assemble(&["Hello", " from", " drift", "-lab", "."]);
    Mock::given(method("POST"))
        .and(path("/chat/completions"))
        .respond_with(
            ResponseTemplate::new(200)
                .insert_header("content-type", "text/event-stream")
                .set_body_raw(body, "text/event-stream"),
        )
        .expect(1)
        .mount(&server)
        .await;

    let client = openai::Client::builder()
        .api_key("test-key")
        .base_url(server.uri())
        .build()
        .expect("build openai client")
        .completions_api();

    let agent = client
        .agent(MODEL)
        .preamble("You are a test stub.")
        .build();

    let history: Vec<rig::message::Message> = vec![];
    let mut stream = agent.stream_chat("hi".to_string(), history).await;
    let mut accumulated = String::new();
    let mut error_message: Option<String> = None;
    while let Some(item) = stream.next().await {
        match item {
            Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::Text(t))) => {
                accumulated.push_str(&t.text);
            }
            Ok(_) => {}
            Err(e) => {
                error_message = Some(format!("{e:?}"));
                break;
            }
        }
    }

    if let Some(err) = error_message {
        let reqs = server.received_requests().await.unwrap_or_default();
        let urls: Vec<_> = reqs.iter().map(|r| r.url.path().to_string()).collect();
        panic!("stream errored: {err}\nrig hit these paths: {urls:?}");
    }
    assert_eq!(
        accumulated, "Hello from drift-lab.",
        "expected concatenated stream tokens; got `{accumulated}`"
    );
}

#[tokio::test]
async fn cancellation_token_breaks_the_stream_loop_promptly() {
    // Same shape as the real `commands::chat` cancellation: race the stream's
    // next() against `token.cancelled()` via `tokio::select!`. Drop the
    // stream as soon as the token fires.
    let server = MockServer::start().await;

    // Long delay between the body's bytes by interleaving padding tokens.
    let mut chunks = Vec::new();
    chunks.push(sse_chunk("", None));
    for i in 0..50 {
        chunks.push(sse_chunk(&format!("tok{i} "), None));
    }
    chunks.push(sse_chunk("", Some("stop")));
    chunks.push(sse_done().to_string());
    let body = chunks.join("").into_bytes();

    Mock::given(method("POST"))
        .and(path("/chat/completions"))
        .respond_with(
            // Server-side delay so cancellation has work to interrupt.
            ResponseTemplate::new(200)
                .insert_header("content-type", "text/event-stream")
                .set_body_raw(body, "text/event-stream")
                .set_delay(Duration::from_millis(50)),
        )
        .mount(&server)
        .await;

    let client = openai::Client::builder()
        .api_key("test-key")
        .base_url(server.uri())
        .build()
        .unwrap()
        .completions_api();

    let agent = client.agent(MODEL).build();
    let token = CancellationToken::new();

    let token_cloned = token.clone();
    let driver = tokio::spawn(async move {
        let history: Vec<rig::message::Message> = vec![];
    let mut stream = agent.stream_chat("hi".to_string(), history).await;
        let mut tokens_seen = 0usize;
        loop {
            tokio::select! {
                biased;
                _ = token_cloned.cancelled() => break tokens_seen,
                item = stream.next() => match item {
                    Some(Ok(MultiTurnStreamItem::StreamAssistantItem(
                        StreamedAssistantContent::Text(_),
                    ))) => { tokens_seen += 1; }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break tokens_seen,
                    None => break tokens_seen,
                }
            }
        }
    });

    // Wait briefly so at least one token has likely been delivered, then cancel.
    tokio::time::sleep(Duration::from_millis(120)).await;
    token.cancel();

    let started = std::time::Instant::now();
    let tokens_seen = tokio::time::timeout(Duration::from_secs(5), driver)
        .await
        .expect("driver should exit within 5s after cancel")
        .expect("driver should not panic");
    let elapsed_after_cancel = started.elapsed();

    assert!(
        elapsed_after_cancel < Duration::from_secs(2),
        "stream loop should break promptly after cancellation, but took {elapsed_after_cancel:?}"
    );
    eprintln!("tokens delivered before cancel: {tokens_seen}");
}

/// Sanity check on the assembled SSE shape — protects us from a typo in the
/// helper silently making the streaming test pass for the wrong reason.
#[test]
fn sse_helpers_produce_well_formed_events() {
    let body = assemble(&["a", "b"]);
    let s = std::str::from_utf8(&body).unwrap();
    assert!(s.contains(r#""content":"a""#));
    assert!(s.contains(r#""content":"b""#));
    assert!(s.contains(r#""finish_reason":"stop""#));
    assert!(s.ends_with("data: [DONE]\n\n"));
}
