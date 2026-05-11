# Plan: How Goose Routes a Chat Through a Local Model

This directory captures **the full code path** when a goose user has a
downloaded GGUF and clicks the radio button next to it like:

```
Downloaded Models
  ◉ unsloth/gemma-4-26B-A4B-it-GGUF:Q4_K_M       [⚙] [🗑]
```

…then types a chat message and gets tokens streamed back. Every file you'd
need to replicate just this flow is here.

If you're looking for the *download* flow, see
[`../download_manager/`](../download_manager/). For the *iterative agent
loop*, see [`../plan-iterative-agent.md`](../plan-iterative-agent.md). For
the *desktop packaging*, see
[`../plan-flow-download-and-runtime.md`](../plan-flow-download-and-runtime.md).
This document is narrowly about **selection → load → generation**.

---

## Directory layout

```
goose_examples/local_llm/
├── plan-use-local-model.md                     # this file
│
├── frontend/                                   # React UI for selecting a model
│   ├── LocalInferenceSettings.tsx                       (567 LOC) the radio-button list + handlers
│   ├── ModelSettingsPanel.tsx                           (601 LOC) the gear icon → per-model settings
│   └── ModelAndProviderContext.tsx                      (262 LOC) global model/provider state
│
├── backend/
│   ├── routes_config_management.rs              (~1200 LOC) — POST /config/set_provider
│   ├── routes_agent.rs                          (~1400 LOC) — POST /agent/update_provider
│   ├── provider_base.rs                          (~900 LOC) — the Provider trait
│   ├── agent.rs                                 (~2500 LOC) — Agent::reply + the loop
│   ├── reply_parts.rs                            (~900 LOC) — stream_response_from_provider
│   │
│   └── inference/                                # The actual llama.cpp path
│       ├── local_inference.rs                    (LocalInferenceProvider, InferenceRuntime)
│       ├── inference_engine.rs                   (sampler chain, prefill, generation_loop)
│       ├── inference_native_tools.rs             (Jinja path — used by Gemma)
│       ├── inference_emulated_tools.rs           (text-parser path — used by Llama/Mistral)
│       ├── multimodal.rs                         (vision encoder integration)
│       ├── tool_parsing.rs                       (compact tools JSON)
│       └── local_model_registry.rs               (registry.json + ModelSettings)
│
└── snippets/                                     # Step-by-step code excerpts
    ├── 01_frontend_select_model.tsx.snippet
    ├── 02_frontend_change_model_in_session.tsx.snippet
    ├── 03_backend_set_config_provider.rs.snippet
    ├── 04_backend_update_agent_provider.rs.snippet
    ├── 05_backend_provider_create.rs.snippet
    ├── 06_backend_lazy_model_load.rs.snippet
    └── 07_backend_token_generation.rs.snippet
```

---

## The full picture in one diagram

```
┌──────────── FRONTEND (React in Electron renderer) ────────────────────┐
│                                                                       │
│ User clicks ◉ next to "unsloth/gemma-4-26B-A4B-it-GGUF:Q4_K_M"        │
│                                                                       │
│ LocalInferenceSettings.tsx::selectModel(modelId)                      │
│       │                                                               │
│       └──> setConfigProvider({                                        │
│               body: { provider: 'local', model: <id> }                │
│           })                                                          │
│       │                                                               │
│       └──> refreshCurrentModelAndProvider()                           │
│                  │                                                    │
│                  └──> read GOOSE_PROVIDER, GOOSE_MODEL from /config   │
│                                                                       │
│ User types: "What's 2+2? Read /tmp/foo.txt first."                    │
│                                                                       │
│ Chat component → POST /reply { message: "...", session_id: ... }      │
└───────────────────────────────────────────────────────────────────────┘
                                 │
                                 │  HTTPS over loopback,
                                 │  X-Secret-Key header,
                                 │  pinned cert fingerprint
                                 ▼
┌─────────── BACKEND (goosed Rust subprocess) ──────────────────────────┐
│                                                                       │
│ /config/set_provider handler (config_management.rs:720)               │
│       │                                                               │
│       └──> create_with_default_model("local", [])    ← validation     │
│            └──> LocalInferenceProvider::from_env()                    │
│                 ├──> InferenceRuntime::get_or_init()                  │
│                 │    └──> LlamaBackend::init() (singleton, ~30ms)     │
│                 └──> runtime.get_or_create_model_slot(model_name)     │
│                      [returns Arc<Mutex<Option<LoadedModel>>> = None] │
│                                                                       │
│       └──> Config::global()                                           │
│              .set_goose_provider("local")                             │
│              .set_goose_model("unsloth/...:Q4_K_M")                   │
│              [persisted to ~/Library/.../config.yaml]                 │
│                                                                       │
│                                                                       │
│ /reply handler (or /sessions/.../reply)                               │
│       │                                                               │
│       └──> Agent::reply(user_message, session_config, cancel)         │
│            (agent.rs:1049)                                            │
│            │                                                          │
│            ├─[outer turn loop]──> stream_response_from_provider(...)  │
│            │                      (reply_parts.rs:257)                │
│            │                      └──> provider.stream(...)           │
│            │                                                          │
│            │  ┌───────  LocalInferenceProvider::stream()  ─────────┐  │
│            │  │  (local_inference.rs:569)                          │  │
│            │  │                                                    │  │
│            │  │  if model_slot is None:                            │  │
│            │  │     • Evict any other resident model               │  │
│            │  │     • spawn_blocking { load_model_sync }           │  │
│            │  │       ├── resolve_model_path(model_id)             │  │
│            │  │       │    → ~/Library/.../models/gemma-...gguf    │  │
│            │  │       ├── LlamaModel::load_from_file (~1.5s)       │  │
│            │  │       ├── model.chat_template(None) → Jinja        │  │
│            │  │       └── init mtmd_ctx if mmproj exists           │  │
│            │  │     • slot = Some(LoadedModel{...})                │  │
│            │  │                                                    │  │
│            │  │  Choose tool-call strategy:                        │  │
│            │  │    settings.native_tool_calling == true            │  │
│            │  │      → generate_with_native_tools (Jinja path)     │  │
│            │  │    else                                            │  │
│            │  │      → generate_with_emulated_tools (text parser)  │  │
│            │  │                                                    │  │
│            │  │  Apply chat template → prompt string               │  │
│            │  │  spawn_blocking {                                  │  │
│            │  │    create_and_prefill_context(prompt)              │  │
│            │  │      └── llama_ctx.decode(prompt_batch)            │  │
│            │  │           ↑ FIRST METAL CALL — JIT shaders ~200ms  │  │
│            │  │    generation_loop:                                │  │
│            │  │      loop {                                        │  │
│            │  │        token = sampler.sample(ctx)                 │  │
│            │  │        if model.is_eog(token) break;               │  │
│            │  │        piece = model.token_to_piece(token)         │  │
│            │  │        on_piece(piece)  // emulator parses tools   │  │
│            │  │        ctx.decode(next_batch)                      │  │
│            │  │      }                                             │  │
│            │  │  }                                                 │  │
│            │  │  Channel sender pushes (Some(msg), Some(usage))    │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │            │                                             │
│            │            ▼                                             │
│            │     mpsc::Receiver as MessageStream                      │
│            │                                                          │
│            ├─[inner stream-drain loop]──> while stream.next() {       │
│            │     match chunk:                                         │
│            │       Some(text) → yield AgentEvent::Message(text)       │
│            │       Some(tool_request) →                               │
│            │         categorize → permission → dispatch_tool_call     │
│            │         (developer__shell, filesystem__read, etc.)       │
│            │   }                                                      │
│            │                                                          │
│            └─[next turn]──> if tools called, loop again with          │
│                              tool_response in conversation            │
└───────────────────────────────────────────────────────────────────────┘
                                 │
                                 │  Streaming events back to UI
                                 ▼
┌──────────── FRONTEND ─────────────────────────────────────────────────┐
│ Chat component receives stream of AgentEvent::Message chunks          │
│ Renders text incrementally, shows tool-call cards, etc.               │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-step trace (with line cites and snippets)

### STEP 1 — User clicks the radio button

**File:** [`frontend/LocalInferenceSettings.tsx`](frontend/LocalInferenceSettings.tsx#L200)

The "Downloaded Models" section renders one `<input type="radio">` per
model whose `status.state === 'Downloaded'`. The handler is `selectModel`
([line 200-210](frontend/LocalInferenceSettings.tsx#L200)):

```tsx
const selectModel = async (modelId: string) => {
  try {
    await setConfigProvider({
      body: { provider: 'local', model: modelId },
      throwOnError: true,
    });
    await refreshCurrentModelAndProvider();
  } catch (error) {
    console.error('Failed to select model:', error);
  }
};
```

The radio's `checked` state is purely derived from React state — no local
"selected" boolean. The truth source is the global config:

```tsx
const { currentModel, currentProvider } = useModelAndProvider();
const selectedModelId = currentProvider === 'local' ? currentModel : null;
// ...
<input type="radio" checked={selectedModelId === model.id} ... />
```

This means the UI re-checks the radio whenever any other code path updates
`GOOSE_PROVIDER`/`GOOSE_MODEL` — for instance, when a download completes
and auto-selects the freshly-downloaded model
([LocalInferenceSettings.tsx:246-254](frontend/LocalInferenceSettings.tsx#L246)).

See also: [`snippets/01_frontend_select_model.tsx.snippet`](snippets/01_frontend_select_model.tsx.snippet)

### STEP 2 — Frontend SDK fires HTTPS request

`setConfigProvider` is auto-generated by `@hey-api/openapi-ts` from
goose's openapi.json. It expands to:

```typescript
client.post('/config/set_provider', {
  body: { provider: 'local', model: modelId },
  headers: {
    'X-Secret-Key': '<per-launch random key>',
    'Content-Type': 'application/json',
  },
  // TLS pinned to goosed's self-signed cert fingerprint
});
```

The pinning is set up in `main.ts` after goosed emits its
`GOOSED_CERT_FINGERPRINT=<sha256>` line on stdout — see
[`../desktop_ui/`](../desktop_ui/) for the ceremony.

### STEP 3 — Backend handler validates + persists

**File:** [`backend/routes_config_management.rs`](backend/routes_config_management.rs#L720) `set_config_provider`

```rust
pub async fn set_config_provider(
    Json(SetProviderRequest { provider, model }): Json<SetProviderRequest>,
) -> Result<(), ErrorResponse> {
    // [a] VALIDATION: actually instantiate the provider with no extensions.
    //     For "local", this calls LocalInferenceProvider::from_env which
    //     calls InferenceRuntime::get_or_init (initializing LlamaBackend
    //     if first time). The provider is then dropped — no model is loaded.
    create_with_default_model(&provider, Vec::new())
        .await
        .and_then(|_| {
            // [b] PERSISTENCE: write to config.yaml
            let config = Config::global();
            config
                .set_goose_provider(provider.clone())
                .and_then(|_| config.set_goose_model(model.clone()))
                .map_err(|e| anyhow::anyhow!(e))
        })
        .map_err(...)?;
    Ok(())
}
```

The crucial point: **this endpoint validates and persists, but does not
load the GGUF**. Loading happens lazily on the first chat message.

See also: [`snippets/03_backend_set_config_provider.rs.snippet`](snippets/03_backend_set_config_provider.rs.snippet)

### STEP 3b — Per-session switch (alternate path)

If the user is mid-chat and uses the bottom-bar dropdown to swap models,
the call goes to `POST /agent/update_provider` instead — which **also**
calls `providers::create("local", model_config, extensions)` but then
calls `agent.update_provider(new_provider, session_id)` to atomically
swap the agent's `provider: Mutex<Option<Arc<dyn Provider>>>` field.

**File:** [`backend/routes_agent.rs`](backend/routes_agent.rs#L581)
`update_agent_provider`

See also: [`snippets/04_backend_update_agent_provider.rs.snippet`](snippets/04_backend_update_agent_provider.rs.snippet)
and [`snippets/05_backend_provider_create.rs.snippet`](snippets/05_backend_provider_create.rs.snippet)

### STEP 4 — User sends a chat message

UI calls `POST /reply` (or `POST /sessions/{id}/reply`). This routes to
[`crates/goose-server/src/routes/reply.rs`](../crates/goose-server/src/routes/reply.rs)
which calls `Agent::reply(user_message, session_config, cancel_token)`.

**File:** [`backend/agent.rs`](backend/agent.rs#L1049)

The agent enters its turn loop. First iteration calls
`stream_response_from_provider`, which calls `provider.stream(...)`.
This is where the real work begins.

### STEP 5 — First-time model load

**File:** [`backend/inference/local_inference.rs`](backend/inference/local_inference.rs#L569)

```rust
async fn stream(&self, model_config: &ModelConfig, session_id: &str,
                system: &str, messages: &[Message], tools: &[Tool])
    -> Result<MessageStream, ProviderError>
{
    // [1] Look up the file path from registry.json
    let resolved = resolve_model_path(&model_config.model_name)?;

    // [2] Load if not already in slot
    {
        let mut model_lock = self.model.lock().await;
        if model_lock.is_none() {
            // Evict other models first (one resident at a time)
            for slot in self.runtime.other_model_slots(&model_config.model_name) {
                let mut other = slot.lock().await;
                if other.is_some() { *other = None; }
            }

            // The slow path
            let loaded = tokio::task::spawn_blocking(move || {
                Self::load_model_sync(&runtime_for_load, &model_id, &settings_for_load)
            }).await??;
            *model_lock = Some(loaded);
        }
    }
    // ... continue to generation ...
}
```

`load_model_sync` itself
([line 409-461](backend/inference/local_inference.rs#L409)):

```rust
fn load_model_sync(runtime: &InferenceRuntime, model_id: &str,
                   settings: &ModelSettings) -> Result<LoadedModel, ProviderError>
{
    let resolved = resolve_model_path(model_id)?;
    let model_path = resolved.model_path;

    if !model_path.exists() {
        return Err("Model not downloaded: ... Please download from Settings");
    }

    let backend = runtime.backend();

    let mut params = LlamaModelParams::default();
    if let Some(n_gpu_layers) = settings.n_gpu_layers {
        params = params.with_n_gpu_layers(n_gpu_layers);  // ← Metal layers
    }
    if settings.use_mlock {
        params = params.with_use_mlock(true);
    }

    // ── THE SLOW PART (~1-3 seconds for 4 GB Q4_K_M on M2) ──
    let model = LlamaModel::load_from_file(backend, &model_path, &params)?;

    // Read embedded chat template from GGUF metadata
    let template = model.chat_template(None)
        .or_else(|_| LlamaChatTemplate::new("chatml"))?;

    // Vision encoder if applicable
    let mtmd_ctx = Self::init_mtmd_context(&model, &resolved.mmproj_path, settings);

    Ok(LoadedModel { model, template, mtmd_ctx })
}
```

See also: [`snippets/06_backend_lazy_model_load.rs.snippet`](snippets/06_backend_lazy_model_load.rs.snippet)

### STEP 6 — Choose tool-calling strategy

**File:** [`backend/inference/local_inference.rs`](backend/inference/local_inference.rs#L617) (around line 617)

```rust
let native_tool_calling = model_settings.native_tool_calling;
let use_emulator = !native_tool_calling && !tools.is_empty();
```

For **`unsloth/gemma-4-26B-A4B-it-GGUF:Q4_K_M`** specifically: the
`FEATURED_MODELS` table at
[`backend/inference/local_model_registry.rs:174-181`](backend/inference/local_model_registry.rs#L174)
declares `native_tool_calling: true`, so the **NATIVE PATH** is taken.

For Llama-3.2-3B or Mistral, those have `native_tool_calling: false`, so
the **EMULATED PATH** runs — the model is taught to emit `\n$ command` for
shell calls and `` ```execute_typescript ` `` blocks for code-mode.

### STEP 7 — Apply chat template, prefill, generate

**Native path** (Gemma-4-26B):
[`backend/inference/inference_native_tools.rs:17`](backend/inference/inference_native_tools.rs#L17) `generate_with_native_tools`

```rust
// Tool definitions are PASSED to the chat template — Jinja sees them
// and renders them into a structured prompt the model was trained for.
let prompt = ctx.loaded.model.apply_chat_template_with_tools_oaicompat(
    &ctx.loaded.template,
    ctx.chat_messages,
    full_tools_json,           // ← TOOLS PROVIDED
    None,
    true,
)?.prompt;

// ... prefill prompt tokens via ctx.decode(prompt_batch) ...
// ... run generation_loop, accumulating text ...
// ... at EOS: parse the response for tool_call blocks; if present,
//     emit MessageContent::ToolRequest, else MessageContent::Text ...
```

**Emulated path** (Llama-3.2-3B):
[`backend/inference/inference_emulated_tools.rs:352`](backend/inference/inference_emulated_tools.rs#L352) `generate_with_emulated_tools`

```rust
// NO tools passed to template — instead a special system prompt teaches
// the $ syntax (loaded from prompt_template "tiny_model_system.md")
let prompt = ctx.loaded.model.apply_chat_template_with_tools_oaicompat(
    &ctx.loaded.template,
    ctx.chat_messages,
    None,                      // ← NO TOOLS
    None,
    true,
)?.prompt;

let mut emulator_parser = StreamingEmulatorParser::new(code_mode_enabled);
let mut tool_call_emitted = false;

generation_loop(&model, &mut llama_ctx, settings,
    prompt_token_count, effective_ctx,
    |piece| {
        let actions = emulator_parser.process_chunk(piece);
        for action in actions {
            match action {
                EmulatorAction::Text(t) => send_text_chunk(...),
                EmulatorAction::ShellCommand(cmd) => {
                    send_tool_request("developer__shell",
                                      json!({"command": cmd}), tx);
                    tool_call_emitted = true;
                }
                EmulatorAction::ExecuteCode(code) => {
                    send_tool_request("code_execution__execute_typescript",
                                      json!({"code": code}), tx);
                    tool_call_emitted = true;
                }
            }
        }
        // First tool wins — agent will dispatch, then re-enter the loop
        if tool_call_emitted { Ok(TokenAction::Stop) }
        else { Ok(TokenAction::Continue) }
    }
)?;
```

See also: [`snippets/07_backend_token_generation.rs.snippet`](snippets/07_backend_token_generation.rs.snippet)

### STEP 8 — Tokens stream back via mpsc

The `generation_loop`'s `on_piece` closure calls `tx.blocking_send(...)`
on a `tokio::sync::mpsc::Sender`. The receiver is wrapped as a
`MessageStream` returned by `provider.stream()`. The agent loop drains it:

**File:** [`backend/agent.rs`](backend/agent.rs#L1391) (the inner stream-drain loop)

```rust
while let Some(next) = stream.next().await {
    match next {
        Ok((Some(response), usage)) => {
            yield AgentEvent::Message(filtered_response.clone());
            // If response contains tool_requests:
            //   categorize → permission check → dispatch
            //   then loop again with tool_response in conversation
        }
        Err(ProviderError::ContextLengthExceeded(_)) => { /* compact, retry */ }
        Err(_) => { /* surface error, break */ }
    }
}
```

Each `AgentEvent::Message` is yielded out as an SSE chunk from
`/reply`, which the React UI renders incrementally. See
[`../plan-iterative-agent.md`](../plan-iterative-agent.md) for the full
agent-loop semantics.

---

## Concrete example: the user's Gemma 4 26B Q4_K_M scenario

Goose's `FEATURED_MODELS` table
([backend/inference/local_model_registry.rs:174-181](backend/inference/local_model_registry.rs#L174))
declares:

```rust
FeaturedModel {
    spec: "unsloth/gemma-4-26B-A4B-it-GGUF:Q4_K_M",
    native_tool_calling: true,                           // ← Jinja path
    mmproj: Some(MmprojSpec {
        repo: "unsloth/gemma-4-26B-A4B-it-GGUF",
        filename: "mmproj-BF16.gguf",                    // ← vision capable
    }),
},
```

So when the user clicks the radio button:

1. Frontend `selectModel("unsloth/gemma-4-26B-A4B-it-GGUF:Q4_K_M")` →
   `POST /config/set_provider {provider: "local", model: "..."}`.
2. Backend writes config, returns 200. **No GGUF loaded yet.** Total time:
   ~50ms.
3. User types "Read /tmp/foo.txt and summarize."
4. UI sends `POST /reply { message: "..." }`.
5. `Agent::reply` enters turn loop, calls `provider.stream(...)`.
6. `LocalInferenceProvider::stream`:
   - First call → `model_lock.is_none()` → load the 16 GB Q4_K_M GGUF
     via mmap. **Takes ~3-4 seconds on M2.**
   - Initialize `MtmdContext` for the vision encoder (mmproj-BF16, 800 MB).
   - `model.chat_template(None)` returns Gemma's embedded Jinja template.
7. `model_settings.native_tool_calling == true` → take **NATIVE PATH**.
8. `apply_chat_template_with_tools_oaicompat(messages, full_tools_json)`:
   - Renders `developer__shell`, `developer__text_editor`,
     `filesystem__*`, etc. into the prompt as Gemma's tool-call format
     (function definitions in a special section).
9. `create_and_prefill_context(prompt)` → `ctx.decode(prompt_batch)` →
   **first Metal call**, JIT-compiles GGML shaders (~200ms one-time).
10. `generation_loop` produces tokens. Gemma decides to call shell:
    - `model.token_to_piece` builds up the assistant's response text.
    - At EOS, the response is parsed for Gemma's tool-call markup.
    - A `MessageContent::ToolRequest { name: "filesystem__read",
      arguments: {"path": "/tmp/foo.txt"} }` is emitted.
11. `tx.blocking_send(Ok((Some(msg_with_tool_call), Some(usage))))`.
12. Agent's inner loop receives the message, runs `categorize_tools` →
    bucketed as backend tool, permission check → approved (read-only),
    `dispatch_tool_call` → MCP `tools/call` to filesystem extension.
13. Tool result attached to message, conversation extended.
14. Outer turn loop iterates: another `provider.stream(...)` with the new
    conversation. Model is **already loaded** (model_lock has it cached).
15. Gemma now generates the actual summary. No more tools called →
    `no_tools_called = true` → outer loop exits.
16. UI receives the streamed summary text.

Subsequent messages in this session: **no model load**, just inference
(~30 tok/s on M2 for a 26B Q4_K_M).

---

## Reasoning chain — why this design

### Why two endpoints (`/config/set_provider` vs `/agent/update_provider`)?

Live agents cache the `Provider` instance for performance — instantiating
a provider can involve TLS handshakes (OpenAI), HF API calls (Local), etc.
A live chat session shouldn't pay that cost on every message. Instead:

- **`/config/set_provider`** writes the GLOBAL DEFAULT. Future new
  sessions inherit it. Existing sessions are unaffected.
- **`/agent/update_provider`** atomically replaces the provider in ONE
  named session. The new provider's `from_env` runs immediately;
  subsequent `provider.stream(...)` calls hit the new one.

The `selectModel` handler in the settings tab uses the first; the chat
window's bottom-bar dropdown uses the second.

### Why no model load in `from_env`?

`LocalInferenceProvider::from_env` is called multiple times per session —
once per provider switch, once per server boot, etc. Loading a 16 GB GGUF
unconditionally would make those code paths feel broken. The lazy load on
first `stream()` call defers cost to the moment the user actually wants to
chat — when they're already mentally paying for a "thinking" wait.

### Why is the slot a `Arc<Mutex<Option<LoadedModel>>>` instead of just `Option`?

Because **the agent loop and provider switch can race**. The agent might
hold a reference to a `LocalInferenceProvider` and be mid-`stream()`,
while the user clicks a different model. The `Mutex<Option<>>` lets one
thread evict the model while another is reading it. The `Arc` lets
multiple `LocalInferenceProvider` instances (rare but possible) share
the same underlying model.

The eviction loop at
[`local_inference.rs:587-593`](backend/inference/local_inference.rs#L587)
explicitly drops other models before loading a new one, ensuring at most
one resident GGUF.

### Why does the emulator path call `apply_chat_template_with_tools_oaicompat` with `None` for tools?

Subtle but important. Even on the emulator path, we still need the chat
template to render system/user/assistant messages correctly (each model
has its own delimiters: `<|im_start|>`, `[INST]`, `<start_of_turn>`,
etc.). But we deliberately pass `None` for the tools argument because:

1. The model wasn't trained for native tool calling — passing tools
   would confuse it.
2. We've already injected the `$` / `` ```execute `` syntax via the
   custom system prompt loaded by `load_tiny_model_prompt()`.
3. The streaming text parser handles tool-call extraction
   post-generation, not via the template.

Forcing `None` here keeps the template rendering correct without breaking
the emulator's text-based protocol.

### Why is `selectedModelId` derived from global config, not from local React state?

```tsx
const selectedModelId = currentProvider === 'local' ? currentModel : null;
```

So that **multiple windows stay in sync**. If a user opens settings in
two windows, picks a model in one, the other's radio button updates on
its next `refreshCurrentModelAndProvider()`. This also handles the
auto-select-on-download-complete case — when a download finishes, the
polling code calls `selectModel(modelId)` for free, which updates the
global config, which the UI reads back on next refresh.

### Why does `model.recommended` exist alongside the user's selection?

`recommended` (computed by `recommend_local_model(runtime)` at
[local_inference.rs:225-253](backend/inference/local_inference.rs#L225))
is purely advisory: "given your machine's free RAM, the largest featured
model that should fit is X." It's a hint for users who don't know what to
pick. The user's actual selection (the radio button) is independent — they
can override the recommendation, and a recommended model that's not
downloaded shows a "Download" button instead of a radio.

---

## Implementation plan — replicating just this flow

If you want to add "user can pick a downloaded local model and chat with
it" to your own app, the minimum scope is:

### Step 1 — A working backend `Provider` trait + one local provider

You need the in-process llama.cpp inference path running. Build this
first per [`../plan-iterative-agent.md`](../plan-iterative-agent.md)'s
Step 1-7. Acceptance: `provider.stream(messages, tools)` returns tokens
for an already-loaded GGUF.

### Step 2 — A registry of downloaded models

You need `resolve_model_path(model_id) → PathBuf` working. The simplest
form is a JSON file mapping `model_id → file_path` in your data dir. See
[`../download_manager/local_model_registry.rs`](../download_manager/local_model_registry.rs)
for the full version with file locking.

### Step 3 — Two HTTP endpoints

```rust
POST /config/set_provider     { provider, model }       // global default
POST /agent/update_provider   { session_id, provider, model, ... }  // per-session
```

Copy the bodies from
[`snippets/03_backend_set_config_provider.rs.snippet`](snippets/03_backend_set_config_provider.rs.snippet)
and
[`snippets/04_backend_update_agent_provider.rs.snippet`](snippets/04_backend_update_agent_provider.rs.snippet).

### Step 4 — Frontend selection UI

Two pieces:

1. **A radio-button list** of downloaded models — copy
   [`frontend/LocalInferenceSettings.tsx`](frontend/LocalInferenceSettings.tsx)'s
   `selectModel` + the JSX block at lines 406-467.

2. **A global model/provider context** — copy
   [`frontend/ModelAndProviderContext.tsx`](frontend/ModelAndProviderContext.tsx)'s
   `changeModel`, `currentModel`, `currentProvider`,
   `refreshCurrentModelAndProvider`. Mount it high in your React tree.

Acceptance: clicking a radio button persists across app restarts (because
`set_config_provider` writes to disk).

### Step 5 — Agent loop calls `provider.stream(...)`

If you've followed the iterative-agent plan, this already works. The
agent doesn't care which provider it has — it just calls
`provider.stream(...)`. When the user clicks a different model in the
UI, the next `Agent::reply` invocation uses the new provider.

### Step 6 — Per-model settings UI (optional polish)

Copy [`frontend/ModelSettingsPanel.tsx`](frontend/ModelSettingsPanel.tsx).
Backend endpoints `GET/PUT /local-inference/models/{id}/settings` save
sampler/GPU-layer/context settings into `registry.json`. The next model
load reads them.

---

## Operational notes

### Switching to a model that hasn't been downloaded

`set_config_provider` succeeds even if the GGUF is missing — it only
validates that "local" is a valid provider name. The error surfaces on
the first chat message, when `load_model_sync` calls
`!model_path.exists()` and returns

> "Model not downloaded: <id>. Please download it from Settings > Local Inference."

The UI catches this and toast-prompts the user to download. **Don't
move the existence check earlier** — `from_env` is called too often, and
the user might have manually deleted the file in Finder, in which case
`set_config_provider` succeeded earlier but the file is gone now.

### Switching models mid-tool-call

The agent's outer loop holds an `Arc<dyn Provider>` taken at turn start.
If `update_agent_provider` swaps the provider mid-turn, the in-flight
`provider.stream(...)` call continues with the OLD provider until it
completes. The NEXT turn picks up the new one. This is intentional —
killing in-flight inference would orphan tool calls and corrupt session
history.

### Eviction is not LRU — it's "evict everything else"

[`local_inference.rs:587-593`](backend/inference/local_inference.rs#L587)
unloads ALL other models when a new one is requested. This is harsh on
"two models small enough to fit together" workflows but avoids OOM on
typical hardware. If you want LRU, replace `other_model_slots()` with
something that checks memory headroom and only evicts when needed.

### The `model_id` IS the spec

Goose uses `"author/repo-GGUF:QUANT"` as the model's primary key
everywhere — registry, API params, UI state, config.yaml. This is
slightly unusual (most LLM systems use a short alias). The benefit:
unambiguous; you can copy-paste the model_id into HF's URL bar. The cost:
slightly verbose in JSON payloads. Goose chose readability.

---

## Source map

| File in this directory | Upstream source |
|---|---|
| `frontend/LocalInferenceSettings.tsx`              | `ui/desktop/src/components/settings/localInference/LocalInferenceSettings.tsx` |
| `frontend/ModelSettingsPanel.tsx`                  | `ui/desktop/src/components/settings/localInference/ModelSettingsPanel.tsx` |
| `frontend/ModelAndProviderContext.tsx`             | `ui/desktop/src/components/ModelAndProviderContext.tsx` |
| `backend/routes_config_management.rs`              | `crates/goose-server/src/routes/config_management.rs` |
| `backend/routes_agent.rs`                          | `crates/goose-server/src/routes/agent.rs` |
| `backend/agent.rs`                                 | `crates/goose/src/agents/agent.rs` |
| `backend/reply_parts.rs`                           | `crates/goose/src/agents/reply_parts.rs` |
| `backend/provider_base.rs`                         | `crates/goose/src/providers/base.rs` |
| `backend/inference/local_inference.rs`             | `crates/goose/src/providers/local_inference.rs` |
| `backend/inference/inference_engine.rs`            | `crates/goose/src/providers/local_inference/inference_engine.rs` |
| `backend/inference/inference_native_tools.rs`      | `crates/goose/src/providers/local_inference/inference_native_tools.rs` |
| `backend/inference/inference_emulated_tools.rs`    | `crates/goose/src/providers/local_inference/inference_emulated_tools.rs` |
| `backend/inference/multimodal.rs`                  | `crates/goose/src/providers/local_inference/multimodal.rs` |
| `backend/inference/tool_parsing.rs`                | `crates/goose/src/providers/local_inference/tool_parsing.rs` |
| `backend/inference/local_model_registry.rs`        | `crates/goose/src/providers/local_inference/local_model_registry.rs` |

---

## The single sentence summary

**When a goose user picks a downloaded local model, the frontend writes
`{provider: "local", model: <id>}` to the global config (and optionally
to one specific session via `/agent/update_provider`), which constructs a
`LocalInferenceProvider` whose `from_env` is FAST because the GGUF isn't
loaded yet — the actual `LlamaModel::load_from_file` happens lazily on
the first `provider.stream(...)` call inside `Agent::reply`'s turn loop,
runs on a `spawn_blocking` worker, picks the native (Jinja) or emulated
(text-parser) tool-calling path based on the registry's
`native_tool_calling` flag, and streams tokens back through a
`tokio::sync::mpsc` channel that the agent drains as a `MessageStream` —
identical in shape to what an OpenAI provider would emit.**
