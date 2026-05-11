# Plan: Porting Goose's Download Manager + Local LLM Agent

This directory is a self-contained snapshot of every file you need to replicate
goose's local-inference system in another Rust project. It splits the system
into two layers so you can adopt them independently.

---

## What's in this directory

```
goose_examples/
├── plan_add_download_manager_add_main_llm_call_agent.md   # this file
│
├── download_manager/         # Tier 1: get a GGUF onto disk (no GPU/FFI)
│   ├── paths.rs                       # OS-aware data_dir via etcetera
│   ├── download_manager.rs            # Range-resume HTTP downloader, sharded, retries
│   ├── hf_models.rs                   # HuggingFace API client + spec parser + quant table
│   ├── local_model_registry.rs        # registry.json persistence, FEATURED_MODELS, ModelSettings
│   └── routes_local_inference.rs      # 10 axum endpoints exposing the above
│
├── main_agent/               # Tier 2: load a GGUF and stream tokens (depends on llama-cpp-2)
│   ├── local_inference.rs             # InferenceRuntime singleton + LocalInferenceProvider
│   ├── inference_engine.rs            # Sampler chain, prefill/decode loop, KV-cache memory estimator
│   ├── inference_native_tools.rs      # Jinja-template tool calling (Gemma path)
│   ├── inference_emulated_tools.rs    # Text-protocol tool emulator (Llama/Mistral path)
│   ├── multimodal.rs                  # Image extraction + mmproj integration
│   └── tool_parsing.rs                # Compact tool JSON for context budget
│
├── wiring_snippets/          # The non-file glue you need to copy
│   ├── cargo_features.toml            # Feature flags + dependency block
│   ├── state_appstate.rs.snippet      # Lazy InferenceRuntime in your AppState
│   ├── routes_mod.rs.snippet          # Router merge with #[cfg]
│   ├── openapi.rs.snippet             # utoipa schema registration
│   └── providers_mod.rs.snippet       # Provider registry registration
│
└── tests/                    # Reference tests
    ├── local_inference_integration.rs  # End-to-end: load GGUF + run inference
    └── local_inference_perf.rs         # Throughput benchmark
```

---

## Why two layers?

The split mirrors the responsibility split inside goose itself, and matters for
**how you'd port this incrementally**.

| Layer | Depends on | Native build complexity | Ports cleanly to |
|---|---|---|---|
| `download_manager/` | `reqwest`, `tokio`, `etcetera`, `fs2`, `serde` | None — pure Rust | Any platform, including WASM in theory |
| `main_agent/` | `llama-cpp-2` (FFI to C++ llama.cpp) | High — Metal/CUDA/Vulkan toolchains | Native targets only; needs CMake + a C++ compiler |

**You can ship `download_manager/` alone** and pair it with a `llama-server`
sidecar (or any external inference engine that takes a path to a GGUF). Many
apps do exactly this — it's the lowest-risk path. Adding `main_agent/` is a
separate decision with separate native-build pain.

---

## Step-by-step reasoning behind the plan

### Why this order

1. **Paths first.** Every other piece writes to or reads from a directory
   computed by `paths.rs`. If you fork it last, you'll have to chase
   hard-coded paths through every other file.
2. **Download manager second.** It has zero project-specific code — it takes a
   URL list and a destination list, that's it. You can verify it works against
   *any* large public file before introducing HuggingFace at all.
3. **HF models third.** Pure HTTP + parsing. Has its own unit tests already
   (`#[cfg(test)] mod tests` in `hf_models.rs:641-819`) that don't need network.
4. **Registry fourth.** Glues HF metadata to download_manager state. Storing
   to disk via `fs2` shared/exclusive locks + `tempfile` atomic rename means
   two `goosed` processes can read concurrently and writes are crash-safe.
5. **Routes fifth.** Pure HTTP wrappers around all of the above; only meaningful
   once the four lower layers compile.
6. **Then (optionally) inference.** This is the highest-risk piece because of
   the C++ toolchain dependency, but everything below it is already validated.

### Why a separate `InferenceRuntime` singleton

Goose's `InferenceRuntime` exists for one reason: **`llama_cpp_2::LlamaBackend`
must only be initialized once per process**, and it cannot be safely
re-initialized after dropping. The `Arc<Weak<InferenceRuntime>>` pattern in
[main_agent/local_inference.rs:52-115](main_agent/local_inference.rs) lets the
backend stay alive as long as anything is using it, then deallocate cleanly on
shutdown — without making it a permanent global that leaks Metal resources at
exit. The comment at line 48-55 about field declaration order is a real bug
they hit; **don't reorder those fields when porting**.

### Why one resident model at a time

[main_agent/local_inference.rs:587-593](main_agent/local_inference.rs) — when a
new model is requested, every other slot is unloaded first. A 27B Q4 GGUF is
~16GB; loading two at once OOMs on most consumer GPUs. The slot map exists so
that re-loading the *same* model is free, but switching evicts.

### Why goose uses raw `reqwest` instead of `hf-hub`

The `hf-hub` crate exists, and goose chose not to use it. Three reasons visible
in the code:

1. **Storage layout control.** `hf-hub` writes to `~/.cache/huggingface/hub/`
   with content-addressable blobs and symlinks. Goose wants flat
   `models/<filename>.gguf` so users can identify files and delete cleanly.
2. **Progress reporting.** Goose tracks per-byte progress + speed + ETA in a
   shared `HashMap` polled by the UI. `hf-hub` doesn't expose that.
3. **Cancel mid-download.** Goose checks a cancellation flag on every chunk
   write — see `download_one_file` line 384-386 / 492-495 in
   `download_manager.rs`.

If you don't need any of those three, `hf-hub` would save you ~600 lines.

### Why "OpenAI format" without an OpenAI server

`build_openai_messages_json` at
[main_agent/local_inference.rs:255-263](main_agent/local_inference.rs) emits
the OpenAI Chat Completions JSON shape and hands it to llama.cpp's Jinja
template renderer (via `OpenAIChatTemplateParams`). This is **not** an
OpenAI-compatible HTTP server — there is no port, no `/v1/chat/completions`.
The format is borrowed because most modern GGUFs ship Jinja templates that
expect that exact JSON shape. Inference happens entirely in-process via FFI.

If you want a true OpenAI-compatible local endpoint, that's a different
architecture: spawn `llama-server -m <path>` and use goose's regular `openai`
provider pointed at `http://localhost:8080/v1`. The local-inference provider
shipped here is the in-process alternative.

---

## Implementation plan — three scopes

### Scope A: download manager only (≈1 day)

**Use when:** you're pairing this with `llama-server -hf` or similar sidecar.
You want goose's UX (progress bar, cancel, controlled storage layout) but
don't want llama.cpp linked into your binary.

**Steps:**

1. **Copy `paths.rs`** → change `top_level_domain`, `author`, `app_name` in the
   `choose_app_strategy` call to your project's identifiers. **Pick once and
   never change** — the comment at the top of the function explains why
   (existing user data dirs would orphan).

2. **Copy `download_manager.rs`** verbatim. Zero edits needed. It exposes:
   - `get_download_manager() -> &'static DownloadManager` — global singleton
   - `download_model(id, url, dest)` — single file
   - `download_model_sharded(id, files, total_size, on_complete)` — multi-shard
   - `get_progress(id) -> Option<DownloadProgress>` — for UI polling
   - `cancel_download(id)` — sets a flag the chunk loop checks
   - `cleanup_partial_downloads(dir, registered_paths)` — call once at startup
     to garbage-collect orphaned `.part` files

3. **Copy `hf_models.rs`**, strip `utoipa::ToSchema` derives if you're not using
   utoipa. Run its built-in tests (`cargo test --package <yours> hf_models`) —
   they're all offline.

4. **Copy `local_model_registry.rs`** but trim:
   - You can drop `ModelSettings` if a sidecar handles sampling (it'll only
     consume CLI flags, not these structs).
   - You can drop `MmprojSpec` and the vision plumbing entirely if you're
     text-only at first.
   - Update `FEATURED_MODELS` to the curated list you want to surface in your UI.

5. **Copy `routes_local_inference.rs`**, keep only the endpoints you need.
   Minimum useful set:
   - `POST /local-inference/download` — start a download
   - `GET  /local-inference/models` — list with status
   - `GET  /local-inference/models/{id}/download` — progress poll
   - `DELETE /local-inference/models/{id}/download` — cancel
   - `DELETE /local-inference/models/{id}` — remove from disk

   If your app is **Tauri** rather than axum-on-HTTP, the route bodies
   translate trivially to `#[tauri::command]` — strip the `Json<>` /
   `axum::extract::*` wrappers, return `Result<T, String>`, register the
   commands in `tauri::Builder::default().invoke_handler(...)`.

6. **Apply wiring snippets** from `wiring_snippets/`:
   - `cargo_features.toml` → your `Cargo.toml`
   - `routes_mod.rs.snippet` → wherever you compose your axum router
   - (skip `state_appstate.rs.snippet` — that's only needed for inference)

7. **Smoke test:** `POST /local-inference/download {"spec": "bartowski/Llama-3.2-1B-Instruct-GGUF:Q4_K_M"}`.
   Expect ~770 MB download, `.part` file appears, fills, atomically renames.
   Kill the process mid-download and re-issue — should resume from the
   `.part` file via HTTP `Range` header.

**Deliverable for scope A:** ~1,800 LOC, no FFI, no native build complexity.
You can call out to `llama-server -m <models_dir>/<filename>.gguf` from the
registered path to actually run the model.

---

### Scope B: scope A + in-process inference, text-only (≈3–4 days)

**Use when:** you want a single-process app and don't need vision.

Everything in Scope A, plus:

1. **Add `llama-cpp-2`** to `Cargo.toml` with features `["sampler"]` (and
   `"metal"` on macOS, `"cuda"` for nvidia, `"vulkan"` for AMD/Intel). This is
   where native build pain lives — document XCode CLT / CMake / build-essential
   requirements in your README. First `cargo build` will be slow (~5 min).

2. **Copy `local_inference.rs`** but **rip out the multimodal branches**:
   - Delete `init_mtmd_context`, `mmproj_path` fields, image extraction, the
     `vision_messages` block in `stream`, and the lazy mtmd init at line 754.
   - Keep `InferenceRuntime` (single backend + slot map + memory eviction).
   - Keep `LocalInferenceProvider::stream` and `load_model_sync`.
   - **Do not reorder fields in `InferenceRuntime`** — drop order matters
     (line 48-55 comment).

3. **Copy `inference_engine.rs`** — this is the real heart:
   - `build_sampler` (penalties → top_k → top_p → min_p → temp → dist OR
     mirostat_v2)
   - `estimate_max_context_for_memory` (KV-cache sizing from GGUF metadata,
     including MLA-aware path for DeepSeek/GLM)
   - `context_cap` (apply user's cap, model train ctx, memory ceiling)
   - prefill loop (`ctx.decode(batch)`)
   - generation loop (`sampler.sample` → `token_to_piece` → write to mpsc)

4. **Skip the tool-calling files** (`inference_native_tools.rs`,
   `inference_emulated_tools.rs`, `tool_parsing.rs`) unless you also need
   agentic tool use. Your app's chat path can call a much simpler "messages
   in, token stream out" function.

5. **Provider trait surface:** define your own minimal `Provider` interface
   (`async fn stream(messages) -> Stream<Item=String>`). You don't have to
   import goose's `Provider`/`ProviderDef`/`ProviderMetadata` machinery — that
   exists to plug into goose's larger model-routing system.

6. **Apply the `state_appstate.rs.snippet`** wiring so your AppState lazily
   creates the `InferenceRuntime` on first use.

7. **Smoke test:** issue a chat completion to your local provider. Expect
   tokens to start streaming within ~1s after model load. First request after
   cold start will be slow (model load + first prefill); subsequent requests
   reuse the loaded model.

**Deliverable for scope B:** add ~2,500 LOC on top of A. Single-process app
with streaming token output. No vision, no tool calling.

---

### Scope C: full feature parity (≈1–2 weeks)

Everything from Scope B, plus:

1. **Multimodal** — copy `multimodal.rs` and re-add the mmproj plumbing:
   - `MmprojSpec` struct in registry
   - `init_mtmd_context` in `local_inference.rs`
   - Vision-marker insertion in messages (`extract_images_from_messages`)
   - Lazy mtmd init when first image arrives (`local_inference.rs:754-760`)
   - Auxiliary mmproj download + backfill in
     `ensure_featured_models_in_registry` (`routes_local_inference.rs:58-209`)
   - Per-repo subdirectory layout for mmproj to avoid collisions
     (`local_model_registry.rs:128-133`)

2. **Tool calling** — copy both:
   - `inference_native_tools.rs` for Jinja-aware models (Gemma)
   - `inference_emulated_tools.rs` for non-tool-trained models (Llama 3.2)
   - `tool_parsing.rs` for context-budget-aware tool JSON compaction

3. **Per-model settings UI** — copy `GET/PUT /local-inference/models/{id}/settings`
   endpoints. Build a settings panel mirroring
   `ui/desktop/src/components/settings/localInference/ModelSettingsPanel.tsx`.

4. **Featured models curation** — maintain your own `FEATURED_MODELS` table
   keyed to the use cases your app cares about. Goose ships:
   - Llama 3.2 1B / 3B (text, emulated tools)
   - Hermes-2 Pro Mistral 7B (text, native tools)
   - Mistral Small 24B (text, emulated tools)
   - Gemma 4 E4B / 26B-A4B (vision, native tools)

**Deliverable for scope C:** full feature parity with goose's local provider.

---

## Operational notes (read before shipping)

### The `top_level_domain="Block"` legacy

[paths.rs:17-19](download_manager/paths.rs) keeps `"Block"` as the top-level
domain even though goose is no longer a Block product, because changing it
would orphan every existing user's data dir. **Pick your identifiers once at
project start.** Migration scripts later are painful.

### The `is_model_file` filter is brittle

[hf_models.rs:242-245](download_manager/hf_models.rs) distinguishes the main
model GGUF from auxiliary files (mmproj, vision encoders) by checking whether
the filename starts with the lowercased repo stem (minus `-GGUF`). This works
for Bartowski and Unsloth's repos but **will break on unconventional naming**.
If your target repos do something weird, relax this filter or add an explicit
allowlist.

### Drop order in `InferenceRuntime`

The field order in
[local_inference.rs:52-55](main_agent/local_inference.rs) is load-bearing:
`models` is declared before `backend` so models drop first, otherwise
ggml-Metal asserts at shutdown. Don't reorder.

### Native build complexity

`llama-cpp-2` builds C++ from source. Expect:
- macOS: Xcode CLT + CMake. Metal works out of the box.
- Linux: build-essential + CMake. CUDA needs `nvcc` on PATH; Vulkan needs the
  Vulkan SDK.
- Windows: VS Build Tools + CMake. CUDA integration is fiddlier than Linux.

First `cargo build` is ~5 min. CI caching of `target/` is essential.

### Cancellation is cooperative

[download_manager.rs:492-495](download_manager/download_manager.rs) — the chunk
loop only checks the cancel flag between chunk writes. With a slow connection
on a multi-MB chunk, expect ~1s latency between user clicking Cancel and the
download actually stopping. The `cancellable_sleep` helper at line 233-248
exists to make retry backoff also cancellable.

### Registry is a single global file under a file lock

[local_model_registry.rs:398-430](download_manager/local_model_registry.rs) —
`registry.json` uses `fs2::FileExt::lock_shared`/`lock_exclusive` for IPC
safety. Multiple `goosed` processes can read concurrently; writes serialize.
This works on Linux/macOS but on Windows the lock is mandatory rather than
advisory — be aware if you support Windows.

### Two download IDs per model

A vision model produces *two* downloads with IDs `{model_id}-model` and
`{model_id}-mmproj`. The progress endpoint
[routes_local_inference.rs:505-518](download_manager/routes_local_inference.rs)
reports only the model file's progress; the UI polls them separately. If you
add a third aux file, follow the same naming convention.

---

## File-by-file source map

For verification, here's where every copied file came from in the upstream
goose repo (relative to `/Users/ilyas/Projects/goose/`):

| Copy | Upstream source |
|---|---|
| `download_manager/paths.rs`                       | `crates/goose/src/config/paths.rs` |
| `download_manager/download_manager.rs`            | `crates/goose/src/download_manager.rs` |
| `download_manager/hf_models.rs`                   | `crates/goose/src/providers/local_inference/hf_models.rs` |
| `download_manager/local_model_registry.rs`        | `crates/goose/src/providers/local_inference/local_model_registry.rs` |
| `download_manager/routes_local_inference.rs`      | `crates/goose-server/src/routes/local_inference.rs` |
| `main_agent/local_inference.rs`                   | `crates/goose/src/providers/local_inference.rs` |
| `main_agent/inference_engine.rs`                  | `crates/goose/src/providers/local_inference/inference_engine.rs` |
| `main_agent/inference_native_tools.rs`            | `crates/goose/src/providers/local_inference/inference_native_tools.rs` |
| `main_agent/inference_emulated_tools.rs`          | `crates/goose/src/providers/local_inference/inference_emulated_tools.rs` |
| `main_agent/multimodal.rs`                        | `crates/goose/src/providers/local_inference/multimodal.rs` |
| `main_agent/tool_parsing.rs`                      | `crates/goose/src/providers/local_inference/tool_parsing.rs` |
| `tests/local_inference_integration.rs`            | `crates/goose/tests/local_inference_integration.rs` |
| `tests/local_inference_perf.rs`                   | `crates/goose/tests/local_inference_perf.rs` |

---

## Recommended starting point

If you're not sure which scope to commit to, **start with Scope A** even if you
think you want B/C eventually. Scope A is one weekend of work, has zero native
build complexity, and gives you the entire UX (progress bar, cancel, registry).
You can always glue `llama-server` in front of it as a sidecar to ship a v0.1,
then graduate to in-process inference (scope B/C) when you're sure the product
is worth the build-system investment.
