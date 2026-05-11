# Plan: Goose's Iterative Agent Loop — How It Actually Works

How does goose's agent run "messages → LLM → tool calls → tool results → LLM
again" until it produces a final answer? This document traces the loop end to
end with line-precise references, then gives you a porting plan.

The big surprise: **the loop is identical for OpenAI and for in-process local
inference.** That's not a coincidence — it's the most important architectural
decision in this part of the codebase, and the reason the same `agent.rs`
file works with both.

---

## 1. The architectural picture

```
                     ┌─────────────────────────────────────────┐
                     │  Agent::reply()  (agent.rs:1049-1899)   │
                     │                                         │
                     │   ┌─────────────────────────────────┐   │
                     │   │  OUTER LOOP (per turn)          │   │  ← `loop {}` at L1327
                     │   │                                 │   │
                     │   │  1. Check max_turns / cancel    │   │
                     │   │  2. Build provider stream       │   │
                     │   │  3. Consume INNER LOOP          │   │
                     │   │  4. If tools called → loop again│   │
                     │   │     If no tools called → exit   │   │
                     │   └─────────────────────────────────┘   │
                     │                                         │
                     │   ┌─────────────────────────────────┐   │
                     │   │  INNER LOOP (per response chunk)│   │  ← `while stream.next()` at L1391
                     │   │                                 │   │
                     │   │  - read (Option<Message>, Usage)│   │
                     │   │  - categorize: text / tool calls│   │
                     │   │  - permission check             │   │
                     │   │  - dispatch tools (concurrent)  │   │
                     │   │  - emit AgentEvent::Message     │   │
                     │   └─────────────────────────────────┘   │
                     └─────────────────────────────────────────┘
                                       │
                                       │  Provider trait (base.rs:545-561)
                                       ▼
            ┌──────────────┬──────────────────┬──────────────────┐
            │ OpenAi       │ AnthropicProvider│ LocalInference   │
            │ Provider     │                  │ Provider         │
            ├──────────────┴──────────────────┴──────────────────┤
            │  All three implement:                              │
            │   async fn stream(...) -> MessageStream            │
            │                                                    │
            │  MessageStream = Stream<                           │
            │      Item = (Option<Message>, Option<Usage>)       │
            │  >                                                 │
            │                                                    │
            │  Each yields the SAME shape regardless of:         │
            │   - HTTP vs FFI                                    │
            │   - JSON tool calls vs text-protocol tool calls    │
            │   - Which model emitted them                       │
            └────────────────────────────────────────────────────┘
```

The outer loop drives turns. The inner loop drains one provider response. The
provider trait abstracts away **everything else** — token streaming, tool
parsing, model-specific formats, even the difference between an HTTP request
and an in-process FFI call.

---

## 2. The Provider trait — the contract every LLM honors

[`crates/goose/src/providers/base.rs:543-561`](../crates/goose/src/providers/base.rs#L543)

```rust
#[async_trait]
pub trait Provider: Send + Sync {
    fn get_name(&self) -> &str;

    /// Primary streaming method that all providers must implement.
    async fn stream(
        &self,
        model_config: &ModelConfig,
        session_id: &str,
        system: &str,
        messages: &[Message],
        tools: &[Tool],
    ) -> Result<MessageStream, ProviderError>;

    fn get_model_config(&self) -> ModelConfig;
    // ... a few other helpers ...
}

pub type MessageStream = Pin<Box<dyn Stream<
    Item = Result<(Option<Message>, Option<ProviderUsage>), ProviderError>
> + Send>>;
```

**The single point of polymorphism.** If you implement this one trait, your
backend gets every feature in `agent.rs` — turn loop, tool dispatch,
context-length compaction, retry logic, telemetry — for free.

### What each provider does inside `stream()`

| Provider | What `stream()` actually does |
|---|---|
| `OpenAiProvider::stream` ([openai.rs:685](../crates/goose/src/providers/openai.rs#L685)) | POST `/v1/chat/completions`, parse SSE chunks, call `response_to_message(json)` to convert OpenAI's `tool_calls` array into `MessageContent::ToolRequest` items |
| `AnthropicProvider::stream` | Same but Anthropic's `/v1/messages` API, parse `content[].type=="tool_use"` blocks |
| `LocalInferenceProvider::stream` ([local_inference.rs:569-806](../crates/goose/src/providers/local_inference.rs#L569)) | In-process FFI to llama.cpp; tokens stream from `LlamaContext::decode`; emit `MessageContent::ToolRequest` either via Jinja-template tool calling (Gemma path) OR a streaming text parser that detects `\n$ cmd` / ` ```execute` blocks (Llama/Mistral path) |

**All three return the same `MessageStream` shape.** The agent loop never
inspects which provider it has — it just consumes events.

### Why the `Option<Message>` wrapping?

Streams emit a sequence of partial chunks. Some chunks contain a message
delta, some only contain usage stats, some contain nothing yet (e.g. the
provider is still building up state). The two-element tuple lets the provider
emit one or both:

- `(Some(msg), None)` — interim text/tool-call chunk
- `(None, Some(usage))` — terminal "here's the final token count" chunk
- `(Some(msg), Some(usage))` — combined final chunk

The agent loop accumulates these naturally — only the final aggregated
`Message` is added to the conversation history.

---

## 3. The outer loop — turns

[`crates/goose/src/agents/agent.rs:1317-1892`](../crates/goose/src/agents/agent.rs#L1317)

This is a Rust `loop {}` (not a `for` over a fixed turn count and not a
`while` over a condition). The loop is open-ended; it terminates via `break`
on any of these:

```rust
let inner = Box::pin(async_stream::try_stream! {
    let mut turns_taken = 0u32;
    let max_turns = session_config.max_turns
        .unwrap_or_else(|| /* config GOOSE_MAX_TURNS, default */);
    let mut compaction_attempts = 0;
    let mut last_assistant_text = String::new();

    loop {
        // [1] Hard exits
        if is_token_cancelled(&cancel_token) { break; }
        if final_output_tool.is_some() { yield ...; break; }

        // [2] Turn budget
        turns_taken += 1;
        if turns_taken > max_turns {
            yield AgentEvent::Message(Message::assistant().with_text(
                "I've reached the maximum number of actions..."
            ));
            break;
        }

        // [3] Build the provider stream for this turn
        let mut stream = Self::stream_response_from_provider(
            self.provider().await?,        // ← resolves to OpenAi/Anthropic/Local
            &session_config.id,
            &system_prompt,
            conversation_with_moim.messages(),
            &tools,
            &toolshim_tools,
        ).await?;

        let mut no_tools_called = true;
        let mut messages_to_add = Conversation::default();
        let mut exit_chat = false;

        // [4] INNER LOOP — drain provider output
        while let Some(next) = stream.next().await {
            // ... see section 4 ...
        }

        // [5] Decide: another turn or stop?
        if no_tools_called {
            // Provider emitted only text → final answer → leave outer loop
            // (modulo retry-on-empty and final_output_tool logic at L1797-1844)
            exit_chat = true;
        }

        // [6] Persist messages from this turn to session history
        for msg in &messages_to_add {
            session_manager.add_message(&session_config.id, msg).await?;
        }
        conversation.extend(messages_to_add);
        if exit_chat { break; }

        tokio::task::yield_now().await;  // be nice to the scheduler
    }
});
```

### Termination matrix

| Reason for exit | Where in code |
|---|---|
| User pressed Stop (`cancel_token` fired) | L1328 |
| `final_output_tool` produced its structured output | L1334-1338 |
| Hit `max_turns` (default 100, configurable via `GOOSE_MAX_TURNS`) | L1341-1348 |
| Provider emitted only text (no tool calls) → answer is complete | L1797 → L1830 → L1888 |
| Tool parsing failed (bad JSON in a tool call → can't continue) | L1665-1666 |
| Provider error: context exceeded after 2 compaction attempts | L1679-1688 |
| Provider error: credits exhausted | L1754 |
| Provider error: network/other | L1765, L1776 |

There's **no `for i in 0..N`** — turn count is tracked in a `mut u32` so an
extension or final-output tool can adjust the budget mid-flight. The
`max_turns` exists primarily as a runaway-protection circuit-breaker, not as
the natural termination condition.

---

## 4. The inner loop — draining one provider response

[`agent.rs:1391-1779`](../crates/goose/src/agents/agent.rs#L1391)

This is `while let Some(next) = stream.next().await` — a streaming consumer.
Each iteration handles one chunk from the provider:

```rust
while let Some(next) = stream.next().await {
    if is_token_cancelled(&cancel_token) || exit_chat { break; }

    match next {
        Ok((response, usage)) => {
            // 4a. Update token-usage metrics
            if let Some(ref usage) = usage { self.update_session_metrics(...); }

            if let Some(response) = response {
                // 4b. Categorize this message into:
                //     - frontend tool calls (run on user's machine via stdio)
                //     - other tool calls
                //     - filtered_response (text + thinking, with tool reqs stripped for streaming)
                let ToolCategorizeResult {
                    frontend_requests, remaining_requests, filtered_response
                } = self.categorize_tools(&response, &tools, surfaced_thinking_in_turn).await;

                // 4c. Stream the visible text/thinking out to the UI
                yield AgentEvent::Message(filtered_response.clone());

                // 4d. If no tool calls → just append the message and continue draining
                let num_tool_requests = frontend_requests.len() + remaining_requests.len();
                if num_tool_requests == 0 {
                    messages_to_add.push(response);
                    continue;
                }

                // 4e. Run frontend tools FIRST, sequentially
                for request in frontend_requests.iter() {
                    let mut frontend_tool_stream =
                        self.handle_frontend_tool_request(request, response_msg);
                    while let Some(msg) = frontend_tool_stream.try_next().await? {
                        yield AgentEvent::Message(msg);
                    }
                }

                // 4f. Permission check + run backend tools concurrently
                let inspection_results = self.tool_inspection_manager.inspect_tools(...).await?;
                let permission_check_result =
                    self.tool_inspection_manager
                        .process_inspection_results_with_permission_inspector(...);

                let mut tool_futures = self.handle_approved_and_denied_tools(
                    &permission_check_result, ..., session
                ).await?;  // ← pre-approved tools start running here

                // Approval-required tools — ask user, then add to the same future set
                let mut tool_approval_stream = self.handle_approval_tool_requests(
                    &permission_check_result.needs_approval,
                    &mut tool_futures, ...
                );
                while let Some(msg) = tool_approval_stream.try_next().await? {
                    yield AgentEvent::Message(msg);   // forward elicitation prompts
                }

                // 4g. Drain ALL tool futures concurrently using stream::select_all
                let mut combined = stream::select_all(with_id);
                loop {
                    tokio::select! {
                        biased;
                        tool_item = combined.next() => match tool_item {
                            Some((request_id, ToolStreamItem::Result(output))) => {
                                // attach the result to the matching tool request
                                response.add_tool_response_with_metadata(...)
                            }
                            Some((request_id, ToolStreamItem::Message(msg))) => {
                                yield AgentEvent::McpNotification((request_id, msg));
                            }
                            None => break,  // all tools complete
                        }
                        _ = tokio::time::sleep(Duration::from_millis(100)) => {
                            // periodically yield elicitation messages from MCP servers
                        }
                    }
                }

                no_tools_called = false;
            }
        }

        Err(ProviderError::ContextLengthExceeded(_)) => {
            // 4h. Auto-compact and re-enter outer loop
            compact_messages(...).await;
        }
        Err(ProviderError::NetworkError(_)) | Err(_) => {
            // 4i. Surface error to user, break
        }
    }
}
```

### What "categorize_tools" does

[`reply_parts.rs:338-499`](../crates/goose/src/agents/reply_parts.rs#L338) —
takes the assistant's response and splits each `MessageContent::ToolRequest`
into one of three buckets:

| Bucket | Where it runs | Examples |
|---|---|---|
| **Frontend tools** | On the user's machine via the Electron renderer process (or terminal frontend) | Browser navigation, clipboard access — anything that needs DOM/native UI |
| **Backend tools** (`remaining_requests`) | In the Rust process via MCP extension stdio | `developer__shell`, `filesystem__read`, custom MCP servers |
| **Filtered response** | UI surface only | Text + thinking blocks with tool-call ToolRequests stripped, so the UI can render the prose without showing JSON tool-call blobs |

### The two-phase permission check

[`agent.rs:1469-1510`](../crates/goose/src/agents/agent.rs#L1469)

```rust
let inspection_results = tool_inspection_manager.inspect_tools(...).await?;
//   ↑ Runs every registered inspector (read/write classifier, security
//     analyzer, adversary detector) — produces side-channel facts about
//     each tool call without blocking it.

let permission_check_result =
    tool_inspection_manager.process_inspection_results_with_permission_inspector(...);
//   ↑ Splits {approved, needs_approval, denied} based on goose_mode setting:
//     - chat mode: nothing runs
//     - normal mode: read-only tools auto-approved, writes require approval
//     - smart mode: AI classifier decides
//     - autonomous mode: everything auto-approved
```

Approved + denied tools are dispatched immediately; `needs_approval` ones
trigger user prompts (elicitations) via the second stream.

### Concurrent tool execution via `stream::select_all`

The genius bit. Each tool call is wrapped in a stream of
`ToolStreamItem::{Result, Message}`. All streams are merged into one with
`futures::stream::select_all` — meaning **the agent doesn't await tools
sequentially**. If the LLM emits 5 tool calls in one turn (e.g. parallel
file reads), all 5 fire concurrently. As each completes, its
`tool_response` is attached to the assistant's message and yielded to the
UI.

This works because `dispatch_tool_call` returns a future that resolves to a
`ToolStream` — the actual work happens inside whatever extension owns the
tool (a separate `tokio::spawn`'d task running an MCP server over stdio).

---

## 5. Tool dispatch — `dispatch_tool_call`

[`agent.rs:598-692`](../crates/goose/src/agents/agent.rs#L598)

The single funnel for "actually run this tool":

```rust
pub async fn dispatch_tool_call(
    &self,
    tool_call: CallToolRequestParams,
    request_id: String,
    cancellation_token: Option<CancellationToken>,
    session: &Session,
) -> (String, Result<ToolCallResult, ErrorData>) {

    // [1] Special-case: schedule management tool — handled directly
    if tool_call.name == PLATFORM_MANAGE_SCHEDULE_TOOL_NAME { ... }

    // [2] Special-case: final-output tool — handled directly
    if tool_call.name == FINAL_OUTPUT_TOOL_NAME { ... }

    // [3] Frontend tools — caller will route via different channel
    if self.is_frontend_tool(&tool_call.name).await {
        return Err("Frontend tool execution required");
    }

    // [4] Default path: hand to the extension manager
    self.extension_manager
        .dispatch_tool_call(&ctx, tool_call.clone(), cancellation_token)
        .await
        .map(process_tool_response)  // ← truncate huge outputs
}
```

`extension_manager::dispatch_tool_call`
[`extension_manager.rs:1568`](../crates/goose/src/agents/extension_manager.rs#L1568)
looks up which MCP extension owns the tool (by namespace prefix —
`developer__shell` lives in the developer extension), then sends an MCP
`tools/call` message over the extension's transport (stdio, SSE, or
HTTP-streamable).

### Why `dispatch_tool_call` doesn't care about local vs external LLM

It receives `CallToolRequestParams { name, arguments }` — a normalized
struct. By the time the loop reaches this call, the difference between "the
LLM JSON-emitted a tool_call" and "the LLM text-emitted `\n$ ls`" has
already been collapsed inside the provider's `stream()` implementation. This
function dispatches one structured call per invocation regardless of source.

---

## 6. The local-vs-external difference: WHERE tool calls are detected

| Path | Provider emits `MessageContent::ToolRequest` by… |
|---|---|
| OpenAI / Anthropic / Bedrock / Gemini / etc. | Parsing the provider's own JSON tool-call format (e.g. OpenAI's `delta.tool_calls[]` array on each SSE chunk, [openai.rs:793](../crates/goose/src/providers/openai.rs#L793) calls `response_to_message`) |
| Local — **Gemma** native path | llama.cpp's Jinja chat-template machinery wraps tool definitions; the model emits a structured form; `apply_chat_template_with_tools_oaicompat` translates it back ([inference_native_tools.rs](../crates/goose/src/providers/local_inference/inference_native_tools.rs)) |
| Local — **Llama 3.2 / Mistral / Hermes-2** emulated path | Streaming text parser watches every generated token for `\n$ ` (shell prefix) or ` ```execute_typescript ` (code-mode fence). When detected, parser emits a `ShellCommand`/`ExecuteCode` action that gets converted into `MessageContent::ToolRequest`. Detection happens **inside the generation_loop** at [inference_emulated_tools.rs:413-432](../crates/goose/src/providers/local_inference/inference_emulated_tools.rs#L413) |
| Any provider via **toolshim** | Provider returns plain text; `toolshim_postprocess` ([reply_parts.rs:325](../crates/goose/src/agents/reply_parts.rs#L325)) runs a separate small LLM (e.g. tiny gpt-oss-mxfp4) that re-reads the response and structures tool calls from prose |

All four paths land in the same place: a `Message` whose `content` array
contains zero or more `MessageContent::ToolRequest` items, where each
`ToolRequest` has the standard `(name, arguments)` shape. The agent loop
sees no difference.

This is the load-bearing abstraction: **tool-call extraction is the
provider's responsibility, not the agent's**.

---

## 7. Putting it all together — request lifecycle

End-to-end trace of one chat message → streamed response with one tool call:

```
USER:   "Count files in /tmp"
            │
            ▼
HTTP layer (or CLI / Tauri bridge)
            │
            ▼
Agent::reply(user_message, session_config, cancel_token)            agent.rs:1049
            │
            ├─► add user_message to conversation history
            │
            ├─► [outer turn loop iteration #1]                      agent.rs:1327
            │
            ├─► stream_response_from_provider(provider, ...)        reply_parts.rs:257
            │       └─► provider.stream(...)
            │             ├─ OpenAi: HTTP POST → SSE stream
            │             └─ Local : llama_cpp_2::LlamaContext::decode loop in spawn_blocking
            │                       → mpsc::channel
            │
            ├─► [inner stream consume loop]                         agent.rs:1391
            │
            ├─► chunk: (Some({text: "I'll check.."}), None)
            │       └─► yield AgentEvent::Message → UI shows partial text
            │
            ├─► chunk: (Some({tool_request: shell({command:"ls /tmp | wc -l"})}), None)
            │       │
            │       ├─► categorize_tools → bucketed as backend (developer__shell)
            │       │
            │       ├─► tool_inspection_manager.inspect_tools()      tool_inspection
            │       ├─► permission_inspector.process(...)
            │       │       └─ goose_mode=normal, shell is read-only → APPROVED
            │       │
            │       ├─► handle_approved_and_denied_tools:
            │       │       └─► self.dispatch_tool_call(shell_call)  agent.rs:598
            │       │             └─► extension_manager.dispatch_tool_call
            │       │                   └─► MCP "tools/call" msg over stdio to developer ext
            │       │
            │       ├─► combined = stream::select_all([shell_stream])
            │       └─► drain combined: ToolStreamItem::Result("42\n")
            │             └─► attach tool_response to messages_to_add
            │             └─► yield to UI
            │
            ├─► provider stream ends (terminal chunk with usage)
            │
            ├─► no_tools_called = false → continue outer loop
            │
            ├─► add messages to session history
            │
            ├─► [outer turn loop iteration #2]
            │
            ├─► stream_response_from_provider(...)
            │       └─ now sees shell tool_response in conversation, generates final text
            │
            ├─► chunk: (Some({text: "42 files in /tmp."}), None)
            ├─► no tool calls in this turn → no_tools_called stays true
            │
            ├─► outer loop: no_tools_called → exit_chat = true → break
            │
            └─► stream returns; HTTP handler closes SSE
```

For the **same user message with a local Llama 3.2 GGUF**, the only thing
that differs is what happens inside `provider.stream()`:

```
Local Llama 3.2 (emulated tools):
  generation_loop yields token "I"
  generation_loop yields token "'ll"
  generation_loop yields token " check"
  generation_loop yields token "\n"           ← parser holds back (HOLD_BACK_SHELL_ONLY = 2)
  generation_loop yields token "$"            ← parser detects shell prefix!
  generation_loop yields token " ls"          ← parser accumulating cmd
  generation_loop yields token " /tmp"
  generation_loop yields token " | wc -l\n"   ← parser detects newline = end of cmd
                                              → emit EmulatorAction::ShellCommand
                                              → wrapped as MessageContent::ToolRequest
                                              → sent through mpsc::Sender
                                              → llama_ctx returns Ok(TokenAction::Stop)
  provider.stream() ends.
```

The agent loop sees **the exact same `MessageContent::ToolRequest`** as it
would from OpenAI, and dispatches it the same way.

---

## 8. Where session/turn state lives

| State | Owner | Lifetime |
|---|---|---|
| `conversation: Conversation` | local to `reply()` | one user→assistant exchange |
| `messages_to_add: Conversation` | local to outer loop iteration | one turn |
| `request_to_response_map: HashMap<id, Message>` | local to inner loop iteration | one provider response |
| `tool_futures: Vec<(id, ToolStream)>` | local | one batch of parallel tool calls |
| Session history (durable) | `SessionManager` (sqlite-backed) | persistent |
| Loaded GGUF model (local only) | `InferenceRuntime` singleton | process lifetime |
| Provider instance | `Agent.provider: Mutex<Option<Arc<dyn Provider>>>` | session lifetime |
| Frontend tool registry | `Agent.frontend_tools: Mutex<HashMap>` | agent lifetime |

The conversation is recomputed per turn from scratch and re-fed to the
provider. There's no "chat session" object passed across turns — the
provider sees a fresh `messages: &[Message]` each time. This is why the same
loop works for stateless providers (OpenAI: each call is independent) and
stateful ones (LocalInferenceProvider could in principle reuse KV cache,
but currently doesn't — it re-prefills the prompt each turn).

---

## 9. Implementation plan — porting the iterative loop

If you're building your own agent and want this pattern, here's the order
to do it in. **The unifying abstraction is what makes the loop work.** Build
that first.

### Step 1 — Define the Provider trait

Start with the contract, not the implementation. **This is the single most
important step** — get the trait shape right and everything below falls out.

```rust
#[async_trait]
pub trait Provider: Send + Sync {
    async fn stream(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[Tool],
    ) -> Result<MessageStream, ProviderError>;
}

pub type MessageStream = Pin<Box<dyn Stream<
    Item = Result<(Option<Message>, Option<Usage>), ProviderError>
> + Send>>;
```

Define `Message`, `MessageContent`, `Tool` as plain Rust structs/enums.
**Critical**: `MessageContent` must be an enum that includes a `ToolRequest`
variant carrying `{ id, name, arguments }`. This is the polymorphism point.

### Step 2 — Implement one Provider end-to-end first

Pick the simpler one: **OpenAI is easiest because tool-call parsing is
trivial** (the JSON shape is given). Get a stub working that:
1. Posts to `/v1/chat/completions`
2. Reads SSE chunks
3. Each chunk: emits `(Some(message_delta), None)`
4. On `[DONE]`: emits `(None, Some(usage))`

Verify with a one-shot test that you can stream "hello world" back. **Don't
add the loop yet.**

### Step 3 — The naive loop (no tools, no streaming UI)

Write the dumbest possible version:

```rust
pub async fn reply(&self, user: Message) -> Result<Message> {
    self.history.push(user);
    loop {
        let stream = self.provider.stream(&system, &self.history, &self.tools).await?;
        let (msg, _usage) = collect_stream(stream).await?;
        self.history.push(msg.clone());

        let tool_calls = msg.tool_requests();
        if tool_calls.is_empty() {
            return Ok(msg);  // final answer
        }

        for call in tool_calls {
            let result = self.dispatch_tool_call(call).await?;
            self.history.push(Message::user_tool_response(call.id, result));
        }
    }
}
```

This is ~30 lines and gives you the entire loop concept: **alternating
assistant turns with text or tool calls, terminating when the assistant
emits no tool calls.** Test it with a real tool (write a `get_weather` mock).

### Step 4 — Add streaming + UI events

Replace the one-shot return with a `try_stream!` that yields:

```rust
enum AgentEvent {
    Message(Message),                                // text chunk or tool result
    ToolDispatched { id, name, args },              // tool starting
    ToolCompleted { id, result },                   // tool done
}
```

Now the UI gets per-chunk feedback. Move from `collect_stream` back to a
`while let Some(chunk) = stream.next().await` loop.

### Step 5 — Add a turn budget

Single line: `let mut turns = 0; loop { turns += 1; if turns > MAX { ...
break; } ... }`. Goose's default is 100. The reason this matters: a buggy
LLM can ping-pong the same tool forever; without a budget, your process
hangs.

### Step 6 — Add the second provider

OpenAI alone is meaningless — it's just an API client. The point of the
abstraction is the **second** provider. Choose one of:

**Option A (easier)**: `OllamaProvider` — basically a different HTTP
endpoint with a slightly different SSE shape. Done in an afternoon.

**Option B (medium)**: `AnthropicProvider` — different tool-call JSON shape
(`content[].type=="tool_use"` blocks). Forces you to keep tool-call
extraction inside the provider, which is what we want.

**Option C (hard, payoff biggest)**: `LocalInferenceProvider` — in-process
llama.cpp via `llama-cpp-2`. See `goose_examples/main_agent/` for the
template. The payoff: you've now proved your trait is provider-agnostic.

After implementing Option C, **the agent loop should not have changed.**
That's the test. If you had to special-case the local provider in
`Agent::reply()`, the abstraction is wrong.

### Step 7 — Add concurrent tool dispatch

If multiple tool calls come in one assistant message, run them in parallel:

```rust
let futures: Vec<_> = tool_calls.iter()
    .map(|call| self.dispatch_tool_call(call.clone()))
    .collect();
let results = futures::future::join_all(futures).await;
```

Or use `stream::select_all` like goose does, if your tools themselves stream
progress events (e.g. an MCP server emitting log lines while running).

### Step 8 — Permission gating

Wrap `dispatch_tool_call` with a `permission_check(call) -> Decision::{Allow,
Ask, Deny}` step. Goose's full version uses an inspector chain
(`tool_inspection_manager`); the minimal version is a single read-only
classifier (`tool.name.starts_with("read") || tool.name.contains("__list_")`).

### Step 9 — Context-length handling

`ProviderError::ContextLengthExceeded` should not be a hard fail. Add an
`auto_compact()` step that summarizes old turns when the error fires, then
re-enters the outer loop with the compacted conversation. This is goose's
[L1674-1731](../crates/goose/src/agents/agent.rs#L1674) error handler.

### Step 10 — Cancellation

A `tokio_util::sync::CancellationToken` wired into both:
- The outer loop's start of each iteration (early exit between turns)
- The tool-dispatch path (so a long shell command can be killed)

Pass the token into every `dispatch_tool_call` so MCP servers can honor it.

---

## 10. Recommended scope cuts

Goose's `agent.rs` is 2562 lines because it handles a lot of edge cases. For
your own port, you can defer most of these to later:

| Feature | Lines saved | What you lose |
|---|---|---|
| Frontend tools (split run-on-frontend vs run-in-rust) | ~50 | Browser/clipboard/native UI tools |
| Tool inspection chain (5 inspectors) | ~200 | Adversary detection, AI permission classifier |
| Final output tool (structured-output enforcement) | ~60 | Recipe-based structured outputs |
| MOIM (mixture-of-instructions context injection) | ~30 | Per-extension instruction blending |
| Tool-pair summarization (compress old tool req+resp pairs) | ~100 | Long-running session efficiency |
| Auto-rename session via fast-model | ~40 | Cosmetic |
| Schedule management tool | ~50 | Scheduled agent runs |
| Subagent spawning | ~350 | Recursive agent-launches-agent |
| Telemetry (posthog) | ~80 | Analytics |
| Retry-on-empty-response logic | ~80 | Some flaky-LLM resilience |

A **functionally complete** version is ~400 lines: outer loop + inner loop +
dispatch_tool_call + permission gate + cancellation + context-length retry.
Everything else is polish.

---

## 11. Source map

For verification, every line cited above can be opened directly:

| Reference | Upstream file:line |
|---|---|
| `Agent::reply` entry point                          | [agent.rs:1049](../crates/goose/src/agents/agent.rs#L1049) |
| Outer turn loop                                     | [agent.rs:1327](../crates/goose/src/agents/agent.rs#L1327) |
| `max_turns` budget check                            | [agent.rs:1341-1348](../crates/goose/src/agents/agent.rs#L1341) |
| `stream_response_from_provider` build               | [agent.rs:1357-1364](../crates/goose/src/agents/agent.rs#L1357) |
| Inner stream-drain loop                             | [agent.rs:1391](../crates/goose/src/agents/agent.rs#L1391) |
| `categorize_tools` call                             | [agent.rs:1404-1416](../crates/goose/src/agents/agent.rs#L1404) |
| Frontend-tools loop                                 | [agent.rs:1447-1458](../crates/goose/src/agents/agent.rs#L1447) |
| Permission inspection                               | [agent.rs:1471-1493](../crates/goose/src/agents/agent.rs#L1471) |
| `handle_approved_and_denied_tools`                  | [agent.rs:489-529](../crates/goose/src/agents/agent.rs#L489) |
| `select_all` parallel tool drain                    | [agent.rs:1534-1594](../crates/goose/src/agents/agent.rs#L1534) |
| Context-exceeded handler / auto-compact             | [agent.rs:1674-1731](../crates/goose/src/agents/agent.rs#L1674) |
| `no_tools_called` exit logic                        | [agent.rs:1797-1845](../crates/goose/src/agents/agent.rs#L1797) |
| `dispatch_tool_call`                                | [agent.rs:598-692](../crates/goose/src/agents/agent.rs#L598) |
| `Provider` trait                                    | [base.rs:543-561](../crates/goose/src/providers/base.rs#L543) |
| `MessageStream` type alias                          | [base.rs:870](../crates/goose/src/providers/base.rs#L870) |
| `stream_response_from_provider` impl                | [reply_parts.rs:257-331](../crates/goose/src/agents/reply_parts.rs#L257) |
| `categorize_tool_requests` impl                     | [reply_parts.rs:338-499](../crates/goose/src/agents/reply_parts.rs#L338) |
| `OpenAiProvider::stream`                            | [openai.rs:685](../crates/goose/src/providers/openai.rs#L685) |
| `OpenAi response_to_message` (tool-call extraction) | [openai.rs:793](../crates/goose/src/providers/openai.rs#L793) |
| `LocalInferenceProvider::stream`                    | [local_inference.rs:569-806](../crates/goose/src/providers/local_inference.rs#L569) |
| Local emulated-tool generation                      | [inference_emulated_tools.rs:352-453](../crates/goose/src/providers/local_inference/inference_emulated_tools.rs#L352) |
| Local emulator parser detect & emit                 | [inference_emulated_tools.rs:412-432](../crates/goose/src/providers/local_inference/inference_emulated_tools.rs#L412) |
| Local native-tool generation (Jinja path)           | [inference_native_tools.rs:17](../crates/goose/src/providers/local_inference/inference_native_tools.rs#L17) |
| Toolshim postprocess (text→tool fallback)           | [reply_parts.rs:325](../crates/goose/src/agents/reply_parts.rs#L325) |
| `extension_manager::dispatch_tool_call`             | [extension_manager.rs:1568](../crates/goose/src/agents/extension_manager.rs#L1568) |

---

## 12. The single sentence summary

Goose's agent runs an **open-ended outer `loop {}` over turns, each turn
draining one provider response with a `while stream.next()` inner loop, and
dispatches tool calls concurrently via `stream::select_all` — and because
all providers (OpenAI, Anthropic, LocalInference) implement the same
`async fn stream(...) -> MessageStream` trait that emits a normalized
`MessageContent::ToolRequest`, the same loop drives every backend with no
special-casing.**
