# Plan: Porting Goose's Local-Inference Desktop UI

This directory mirrors the React/Electron UI that drives the
`download_manager` and `main_agent` backend layers. It is split so you can
adopt only the pieces you need.

If you haven't read the backend plan yet:
- [`../plan_add_download_manager_add_main_llm_call_agent.md`](../plan_add_download_manager_add_main_llm_call_agent.md)
  — the Rust side (HTTP routes, registry, downloader, llama.cpp provider).

The UI here calls the routes that backend exposes. **No UI changes are
useful without the matching backend in place.**

---

## What's in this directory

```
goose_examples/desktop_ui/
├── plan_add_local_inference_ui.md          # this file
│
├── components/
│   ├── settings/
│   │   ├── localInference/                 # The whole local-inference settings tab
│   │   │   ├── LocalInferenceSection.tsx           (9 LOC — section wrapper)
│   │   │   ├── LocalInferenceSettings.tsx          (567 LOC — list, download, delete, progress)
│   │   │   ├── HuggingFaceModelSearch.tsx          (412 LOC — HF search + repo picker + quant chooser)
│   │   │   └── ModelSettingsPanel.tsx              (601 LOC — per-model sampler/GPU/context settings)
│   │   │
│   │   └── dictation/                      # Whisper UI — same DownloadManager backend
│   │       ├── DictationSettings.tsx               (288 LOC — provider chooser, Whisper section)
│   │       ├── LocalModelManager.tsx               (333 LOC — Whisper download UI; mirror of localInference)
│   │       └── MicrophoneSelector.tsx              (250 LOC — peripheral, optional)
│   │
│   ├── onboarding/
│   │   └── LocalModelPicker.tsx            (463 LOC — first-run "use a local model" flow)
│   │
│   ├── bottom_bar_reference/
│   │   └── ModelsBottomBar.tsx             (REFERENCE — how to surface "Local Model Settings"
│   │                                                    in the chat-window bottom bar)
│   │
│   └── ui/                                 # Shared primitives the components import
│       ├── button.tsx                              (103 LOC)
│       ├── switch.tsx                              (32 LOC)
│       ├── dialog.tsx                              (130 LOC)
│       ├── input.tsx                               (22 LOC)
│       ├── scroll-area.tsx                         (240 LOC)
│       └── Select.tsx                              (60 LOC)
│
├── contexts/                                # React contexts referenced by the components
│   ├── FeaturesContext.tsx                         (50 LOC — feature-flag gate from `/features`)
│   ├── ModelAndProviderContext.tsx                 (262 LOC — current model selection)
│   └── ConfigContext.tsx                           (308 LOC — config read/write hooks)
│
├── i18n/
│   └── index.ts                                    (89 LOC — defineMessages + useIntl re-exports)
│
├── api_codegen/                            # API SDK (auto-generated — see plan)
│   ├── openapi-ts.config.ts                        (the codegen config that built the two below)
│   └── generated/
│       ├── sdk.gen.ts                              (~1500 LOC; downloadHfModel, listLocalModels, etc.)
│       └── types.gen.ts                            (~3000 LOC; LocalModelResponse, HfQuantVariant, etc.)
│
└── wiring_snippets/
    ├── SettingsView.touchpoints.tsx.snippet        (where to mount the tab)
    ├── FreeOptionCards.touchpoints.tsx.snippet     (where to mount the onboarding card)
    └── package.json.relevant.md                    (only the deps you actually need)
```

---

## How the layers map to the backend

```
                   USER ACTION                     BACKEND ENDPOINT
LocalInferenceSettings.tsx     "Download model"  → POST   /local-inference/download
                               poll progress     → GET    /local-inference/models/{id}/download
                               "Cancel"          → DELETE /local-inference/models/{id}/download
                               "Delete"          → DELETE /local-inference/models/{id}
                               list refresh      → GET    /local-inference/models

HuggingFaceModelSearch.tsx     search HF         → GET    /local-inference/search?q=…
                               pick a repo       → GET    /local-inference/repo/{a}/{r}/files

ModelSettingsPanel.tsx         load settings     → GET    /local-inference/models/{id}/settings
                               save settings     → PUT    /local-inference/models/{id}/settings

LocalModelPicker.tsx           first-run setup   → all of the above

dictation/LocalModelManager.tsx Whisper download → POST   /dictation/download   (uses same DownloadManager)
                                progress         → GET    /dictation/download/{id}
                                cancel/delete    → DELETE /dictation/...
```

Every UI component is a **thin client over an axum handler**. There is no
business logic in the UI — just polling, optimistic updates, progress bars,
and form binding for `ModelSettings`.

---

## The full integration points (the touchpoints I extracted)

There are exactly two places in the goose codebase outside this directory
that reference local-inference UI (besides the routes themselves):

1. **`SettingsView.tsx`** — adds a tab to the settings shell.
   See [`wiring_snippets/SettingsView.touchpoints.tsx.snippet`](wiring_snippets/SettingsView.touchpoints.tsx.snippet).

2. **`FreeOptionCards.tsx`** — adds "Use a Local Model" to the
   first-run free-tier onboarding flow.
   See [`wiring_snippets/FreeOptionCards.touchpoints.tsx.snippet`](wiring_snippets/FreeOptionCards.touchpoints.tsx.snippet).

Plus one optional integration:

3. **`ModelsBottomBar.tsx`** — adds "Local Model Settings" to the
   chat-window's bottom-bar dropdown so the user can adjust sampler params
   without leaving the chat. See `components/bottom_bar_reference/`.

---

## Implementation plan — three scopes (mirror the backend scopes)

### Scope A — UI for download manager only (≈1 day on top of backend Scope A)

**Use when:** your backend exposes the download/list/delete routes only (no
in-process inference yet — you're pairing with `llama-server` sidecar).

What to copy:

1. **All four files in `components/settings/localInference/`** verbatim, BUT
   open `ModelSettingsPanel.tsx` and **gut the GPU/sampler settings**: keep
   only the `context_size` field (the rest are llama-cpp specific and
   meaningless if you're using a sidecar that takes its own CLI flags). Or
   skip `ModelSettingsPanel.tsx` entirely and remove the "settings gear" icon
   from `LocalInferenceSettings.tsx`.

3. **`components/onboarding/LocalModelPicker.tsx`** if you have first-run
   onboarding. Otherwise skip — the settings tab is enough.

4. **All six files in `components/ui/`** — these are shadcn/ui-style wrappers
   around Radix primitives. If your project already uses shadcn/ui or has
   equivalents, replace imports with yours and skip the copies.

5. **`contexts/FeaturesContext.tsx`** verbatim — it just polls
   `GET /features` once at boot and exposes `localInference: boolean`.

6. **`i18n/index.ts`** verbatim. (If you don't internationalize, replace every
   `intl.formatMessage(i18n.foo)` with the literal English string and skip.)

7. **Apply both wiring snippets** from `wiring_snippets/`.

8. **Regenerate the API SDK**:
   ```bash
   # In your UI project
   pnpm add -D @hey-api/openapi-ts @hey-api/client-fetch
   # Copy api_codegen/openapi-ts.config.ts to your project root
   pnpm run generate-api    # outputs src/api/{sdk.gen.ts, types.gen.ts}
   ```
   Do NOT hand-edit the generated files. Re-run codegen whenever you change a
   backend route.

**Deliverable:** Settings tab where users can browse/download/delete GGUF
models. Roughly 1,200 LOC of UI on top of ~2,000 LOC of shared deps.

---

### Scope B — UI for Scope A + per-model settings (≈1.5 days on top of backend Scope B)

Everything in Scope A, plus:

1. **Keep `ModelSettingsPanel.tsx` intact.** Now that you have in-process
   `llama-cpp-2`, every field maps to a real backend setting:
   - `context_size`, `max_output_tokens`
   - sampler: `temperature`, `top_k`, `top_p`, `min_p` (or mirostat)
   - `repeat_penalty`, `repeat_last_n`, `frequency_penalty`, `presence_penalty`
   - performance: `n_batch`, `n_gpu_layers`, `use_mlock`, `flash_attention`,
     `n_threads`
   - `native_tool_calling`, `use_jinja`, `enable_thinking`

2. **Optional: copy `bottom_bar_reference/ModelsBottomBar.tsx`** as a
   reference for surfacing "Local Model Settings" inside the chat window.
   This is a UX polish, not core functionality.

**Deliverable:** Full per-model settings panel where users tune sampling and
GPU layers without restarting the app.

---

### Scope C — UI for Scope B + multimodal + dictation (≈2 days on top of backend Scope C)

Everything in Scope B, plus:

1. **Multimodal indicators** — `LocalInferenceSettings.tsx` already shows the
   `<Eye>` icon next to vision-capable models and a separate
   "vision encoder downloading…" status. This works automatically once your
   backend exposes `vision_capable` and `mmproj_status` on
   `LocalModelResponse`. No code changes needed here.

2. **Dictation UI** — copy `components/settings/dictation/`:
   - `DictationSettings.tsx` — top-level chooser (OpenAI / Local Whisper /
     ElevenLabs)
   - `LocalModelManager.tsx` — Whisper model download UI; **mirrors the same
     pattern** as `LocalInferenceSettings.tsx` but talks to the
     `/dictation/...` routes. Useful because it shows that the same
     `DownloadManager` Rust singleton serves multiple model types from one UI
     pattern.
   - `MicrophoneSelector.tsx` — only if you actually need dictation.

   This is fully optional — Whisper is unrelated to LLM inference. But the
   dictation routes use the same `DownloadManager` backend, so if you've
   already ported the download manager you get it almost for free.

**Deliverable:** Full feature parity with goose's UI: vision models,
dictation, the works.

---

## Step-by-step execution order

This is the order I'd actually do the port, with each step being a
checkpoint that compiles cleanly:

### Day 1 — bootstrap

1. **Set up codegen first.** Drop `api_codegen/openapi-ts.config.ts` into your
   UI project, install `@hey-api/openapi-ts` and `@hey-api/client-fetch`, run
   `pnpm run generate-api` against your already-ported backend's
   `openapi.json`. **Verify the generated `sdk.gen.ts` contains** the eight
   `*LocalModel*` / `*Hf*` exports listed in
   `api_codegen/generated/sdk.gen.ts:316-347`. If anything is missing, your
   backend isn't exposing it — fix the Rust side first.

2. **Copy `i18n/index.ts`** and the messages helper. If you skip i18n, leave
   yourself a comment listing the strings to come back to — there are ~30 in
   `LocalInferenceSettings.tsx` alone.

3. **Copy the six `components/ui/*` files.** Verify they compile against
   your Tailwind/Radix versions. If you're not using Tailwind, you'll need to
   either pull it in or rewrite each primitive — the local-inference
   components import these heavily.

4. **Copy `contexts/FeaturesContext.tsx`** and mount the `<FeaturesProvider>`
   high in your app tree. Smoke test: `useFeatures().localInference` should
   return `true` once your backend's `/features` endpoint includes
   `local-inference: true`.

### Day 2 — core localInference UI

5. **Copy `components/settings/localInference/`** (all four files).
   Replace the import path `'../../../api'` to wherever you wrote the
   generated SDK. Replace `'../../../i18n'` to wherever you put your i18n
   helper.

6. **Apply `SettingsView.touchpoints.tsx.snippet`** to your settings shell.

7. **Smoke test:** Open settings → Local Inference. The list should populate
   from `GET /local-inference/models`. Click "Featured Models" → pick a small
   one (Llama 3.2 1B, ~770MB) → "Download". Watch progress bar fill. Watch
   `models/registry.json` get written under your data dir.

### Day 3 — onboarding + settings panel

8. **Copy `components/onboarding/LocalModelPicker.tsx`** + apply
   `FreeOptionCards.touchpoints.tsx.snippet` if you have a first-run flow.

9. **Verify `ModelSettingsPanel.tsx`** by clicking the gear next to a
   downloaded model. All sliders/toggles should round-trip through
   `GET/PUT /local-inference/models/{id}/settings`. **Test:** lower
   `n_gpu_layers` to 0, save, reload the model — inference should drop to
   CPU-only speed.

10. **(Optional)** Copy `bottom_bar_reference/ModelsBottomBar.tsx` parts into
    your chat UI's bottom bar.

### Day 4+ — multimodal / dictation / polish

11. Multimodal works automatically once the backend supplies the fields.

12. Dictation is its own self-contained feature — port if you want voice
    input, otherwise skip.

---

## Reasoning behind the file choices

### Why `FeaturesContext.tsx`?

Goose treats `local-inference` as a **build-time Cargo feature** that's
exposed to the UI at runtime via `GET /features`. This means a single binary
can ship with or without the local-inference backend, and the UI degrades
gracefully (no tab, no onboarding card) when it's absent. **Copy this
pattern even if you ship one binary** — it makes A/B'ing the feature trivial.

### Why three Settings tab files instead of one?

`LocalInferenceSettings.tsx` (the list view), `HuggingFaceModelSearch.tsx`
(search panel), and `ModelSettingsPanel.tsx` (gear modal) are split because
each manages its own polling lifecycle and they mount/unmount independently.
The list keeps polling even while the search modal is open; the search
modal's network calls don't block the list. Combining them would force a
larger React state tree and tangle the SWR-or-equivalent invalidation logic.

### Why include `ModelAndProviderContext.tsx` and `ConfigContext.tsx`?

`LocalInferenceSettings.tsx` imports `useModelAndProvider()` to mark the
currently-selected model with a "currently active" indicator and to switch
to a model after download completes. Without this context the UI works but
loses that connection — users have to manually re-select the model.

`ConfigContext.tsx` is imported by the dictation UI for storing the
"preferred dictation provider" key. Local-inference itself doesn't need it,
but we copy it because it's tiny and `LocalModelPicker.tsx` references it
indirectly via the analytics util.

### Why include the dictation UI?

It's a working example of the **same `DownloadManager` Rust singleton being
driven by a different UI surface** — Whisper transcription models go through
the exact same code path (`get_download_manager()`, range-resume, progress
polling). If you ever add a third type of downloadable resource (e.g.
embedding models, voice models, custom checkpoints), the pattern shown in
`dictation/LocalModelManager.tsx` is what to copy.

### Why `bottom_bar_reference/` instead of just copying it?

`ModelsBottomBar.tsx` only uses ~10 lines of local-inference code (lines
16, 77, 155, 174-189). The other 180 lines manage your *general* model/provider
selection. Copying it whole would force you to also port your general model
selection state. Keep it as **reference** — extract the modal-trigger and
`ModelSettingsPanel` mount into your existing bottom bar however you've
structured it.

### Why include `api_codegen/generated/*`?

Two reasons:
1. **Reading reference** — when porting, it's faster to look up the exact
   shape of `LocalModelResponse` here than to deduce it from your own
   generated output.
2. **Diff checking** — after you regenerate against your own openapi.json,
   `diff` against these files. Any unexpected difference points at a backend
   route signature mismatch.

**Do not check the generated files into your own repo without regenerating
them first** — they reference goose-internal types (`DictationProvider`,
`DictationProviderStatus`, etc.) that won't exist in your project.

---

## Operational notes

### The sdk.gen.ts file is huge but each call is tiny

The generated SDK is ~1500 lines but each function is one line.
`downloadHfModel({body: {spec: 'user/repo:Q4_K_M'}})` is the entire
download-trigger surface. The bulk of the file is the type union for every
endpoint in the whole goose API; you can ignore everything except the
`*LocalModel*`, `*Hf*`, `*ModelSettings*`, and `*Download*` exports.

### Polling cadence

`LocalInferenceSettings.tsx` polls `GET /local-inference/models` every 2
seconds while a download is active, then stops once `status === 'Downloaded'`.
**Don't poll faster** — the registry's `fs2::FileExt::lock_shared` call has
non-trivial cost on Windows, and 2s is plenty of UI smoothness.

### Toast errors, not modal errors

Download failures show as a toast (`react-toastify` in the upstream UI), not
a blocking modal — because retries are automatic on the backend side and
most "errors" resolve themselves within a few seconds. If you see persistent
toast spam, that's a real backend problem.

### Watch out for the `mmproj_status` shape

`LocalModelResponse.mmproj_status` is `Optional<ModelDownloadStatus>` (None
for text-only models, Some for vision models). The UI uses
`if (mmproj_status === undefined) { /* hide vision UI */ }` — make sure your
generated types reflect this nullability or the vision section will render
for non-vision models.

---

## Source map

| Copy | Upstream source |
|---|---|
| `components/settings/localInference/*.tsx`             | `ui/desktop/src/components/settings/localInference/` |
| `components/settings/dictation/*.tsx`                  | `ui/desktop/src/components/settings/dictation/` |
| `components/onboarding/LocalModelPicker.tsx`           | `ui/desktop/src/components/onboarding/LocalModelPicker.tsx` |
| `components/bottom_bar_reference/ModelsBottomBar.tsx`  | `ui/desktop/src/components/settings/models/bottom_bar/ModelsBottomBar.tsx` |
| `components/ui/*.tsx`                                  | `ui/desktop/src/components/ui/` |
| `contexts/FeaturesContext.tsx`                         | `ui/desktop/src/contexts/FeaturesContext.tsx` |
| `contexts/ModelAndProviderContext.tsx`                 | `ui/desktop/src/components/ModelAndProviderContext.tsx` |
| `contexts/ConfigContext.tsx`                           | `ui/desktop/src/components/ConfigContext.tsx` |
| `i18n/index.ts`                                        | `ui/desktop/src/i18n/index.ts` |
| `api_codegen/openapi-ts.config.ts`                     | `ui/desktop/openapi-ts.config.ts` |
| `api_codegen/generated/sdk.gen.ts`                     | `ui/desktop/src/api/sdk.gen.ts` |
| `api_codegen/generated/types.gen.ts`                   | `ui/desktop/src/api/types.gen.ts` |

---

## Recommended starting point

Same advice as the backend plan: **start with Scope A**. The settings tab
alone takes one full day to wire correctly (codegen + i18n + Tailwind + UI
primitives + Radix). Until that's working end-to-end against your already-
ported backend, don't bother with onboarding/dictation/multimodal polish —
they all assume the core download list works.
