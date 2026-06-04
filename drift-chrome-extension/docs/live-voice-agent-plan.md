# Live Voice Agent — In-Browser, On-Device, Grounded on the Scan

**Goal:** a hands-free, near-zero-perceived-latency voice conversation in the Drift side panel. You speak; Andy answers out loud — grounded on the live scan report — with everything (STT → LLM → TTS) running on-device via WebGPU, falling back to WASM. No server inference.

This plan is the synthesis of two research passes (a 5-phase fact-checked deep-research workflow + an OSS reference hunt) mapped onto the existing `drift-chrome-extension` codebase.

---

## 0. The key insight: you already have 70% of it

| Capability | Status in repo today | Source |
|---|---|---|
| **TTS (Kokoro)** | ✅ Done — `kokoro-js@1.2.1`, `core/kokoroRuntime.ts`, `core/ttsEngine.ts`, `core/ttsWorker.ts` | existing |
| **transformers.js runtime** | ✅ Already bundled transitively via `kokoro-js` (it depends on `@huggingface/transformers`) | existing |
| **WASM model hosting** | ✅ `core/wasi.ts`, `core/scanWorker.ts`, `core/wasmScan` — you already load + run WASM in workers | existing |
| **Scan report data** | ✅ `core/scanOutput.ts`, `core/scanReport.ts`, `core/liveSummary.ts` — structured findings/files/metrics | existing |
| **Chat surface** | ⚠️ Exists (`app/Chat.tsx`) but streams **canned** `buildReasoning()` steps on a 450ms timer — **no real LLM** | existing |
| **Side panel host** | ✅ `side_panel` page = full DOM document → **WebGPU works here directly** | existing |
| **CSP + storage** | ✅ `'wasm-unsafe-eval'` in CSP, `unlimitedStorage` permission | existing |
| **STT (mic → text)** | ❌ Missing | NEW |
| **On-device LLM** | ❌ Missing (Chat is simulated) | NEW |
| **Turn-taking loop** (VAD, barge-in, streaming LLM→TTS) | ❌ Missing | NEW |

**So the build is exactly three new modules + rewiring `Chat.tsx`.**

---

## 1. Where everything runs (MV3 architecture)

**Verified constraint:** WebGPU is **not** usable from the MV3 background **service worker** in a portable way, and ONNX Runtime Web / transformers.js use `import()` which is banned in `ServiceWorkerGlobalScope`. Inference must run in a **document context**. (Deep-research: ORT issue #20876, Chrome 124 notes; OSS hunt: chromeclaw, gemma-gem all use offscreen docs.)

**Your advantage:** the **side panel IS a document context.** You don't strictly need an offscreen document — run inference in the side-panel page (or workers it spawns). Use an offscreen document only if you want models to stay warm after the panel closes.

```
┌─ Side Panel (DOM document — WebGPU OK) ─────────────────────────┐
│  app/VoiceChat.tsx  ── UI, call button, transcript, waveform    │
│        │                                                         │
│   AudioContext(16kHz in) → vad-processor (AudioWorklet)          │
│        │ 512-sample frames                                       │
│        ▼                                                         │
│  ┌ voice worker (Web Worker) ─────────────────────────────────┐ │
│  │  Silero VAD ─→ Moonshine STT ─→ Qwen2.5 LLM ─→ Kokoro TTS  │ │
│  │  (turn detect)   (speech→text)   (stream tok)  (stream wav) │ │
│  └────────────────────────────────────────────────────────────┘ │
│        │ 24kHz pcm chunks                                        │
│        ▼                                                         │
│   play-worklet (AudioWorklet) → AudioContext(24kHz out)         │
└──────────────────────────────────────────────────────────────────┘
        ▲ scan report injected as grounding (system prompt)
   core/scanReport.ts  →  buildGroundingContext()
```

Background service worker stays a **control plane only** (open panel, route messages). No inference there.

> **Side panel vs offscreen (VERIFIED tradeoff):** the side panel **unloads its JS context — and the models — when closed**, so they reload (and re-warm shaders, a few seconds) on reopen. An **offscreen document** (`"offscreen"` permission) persists in the background and keeps models warm across panel toggles. **Topology decision:**
> - **v1 / spike — everything in the side panel.** Simplest: mic capture + WebGPU inference + audio playback in one document, minimal messaging. Accept model reload on reopen. Mic works here *after* a one-time permission grant (see §3b).
> - **v2 / production — offscreen doc = warm model host, side panel = UI + mic + playback, SW = router.** Keeps models warm but adds plumbing (audio frames messaged side-panel→offscreen for STT). Promote to this once warm-keeping matters.
> - **NOT the service worker:** WebGPU was added to SWs in Chrome 124 but ONNX Runtime Web still fails there (`import()` banned in `ServiceWorkerGlobalScope`, ORT #20876). Inference must be in a document/offscreen context either way.

### 1b. Model delivery & MV3 packaging (VERIFIED)

- **Fetch-at-runtime + cache — do NOT bundle the 1.5GB of weights.** MV3's remote-code ban covers **executable code only (JS/WASM)** — Chrome's own migration doc says it "does not include data or things like JSON." **Model weights are data**, so fetching ONNX tensors from the HF CDN at runtime is compliant. This does *not* conflict with your existing "scanner WASM must be bundled" rule — that rule is about *code*; weights are *data*. **Bundle the ORT `.wasm`/`.mjs` runtime + tokenizers/configs; fetch the four weight sets and cache them.** (CWS zip limit is 2GB, so 1.5GB *would* fit — but bundling bloats every store update and forces a full re-download per version bump. Out-of-band weights are strictly better.)
- **Cache in the Cache Storage API** (what transformers.js `env.useBrowserCache` + WebLLM use by default; no per-object size cap, shared across all tabs under the `chrome-extension://` origin). Call **`navigator.storage.persist()` on a user gesture** so the ~1.5GB isn't silently evicted (eviction is all-or-nothing per origin); `unlimitedStorage` raises the cap but doesn't guarantee persistence. Cache API has no native resume → implement chunked/range fetch for resumable downloads + a `DOWNLOAD_PROGRESS` message for UX.
- **SharedArrayBuffer / multithreaded WASM fallback needs cross-origin isolation.** `crossOriginIsolated` is **false by default**; opt in via manifest `cross_origin_embedder_policy: {value:"require-corp"}` + `cross_origin_opener_policy: {value:"same-origin"}`. ORT-Web only enables WASM threads when isolated — **without it, single-thread WASM is ~3–4× slower.** ⚠️ **Spike-verify:** enabling COEP `require-corp` requires your model CDN (and *any* other fetch the extension makes — GitHub API, scan data) to send proper CORP/CORS headers, or those fetches break. This is the one packaging change that could ripple into the existing extension — test end-to-end before committing. (On the WebGPU path threading matters less; COI mainly helps the WASM-fallback tier.)

---

## 2. Stack decision (with reasoning)

### LLM runtime — **transformers.js (ONNX Runtime Web) primary; WebLLM optional "speed mode"**

| Option | Verdict | Reasoning |
|---|---|---|
| **transformers.js / ORT-Web** | ✅ **Primary** | Already in your bundle (via kokoro-js). **One runtime with a true WebGPU→WASM fallback** — exactly the "WebGPU-first, WASM fallback" you asked for. Generation is **interruptible** (`InterruptableStoppingCriteria`) → real barge-in. This is what reference #1 (`conversational-webgpu`) uses. |
| **WebLLM (MLC)** | ⭐ Optional | **Fastest Qwen** (~70–90 tok/s for 3B 4-bit on Apple Silicon; ~70–80% of native) and **best for long RAG prompts** — relevant since you inject a scan report. BUT: **WebGPU-only (no WASM fallback)** and **no native generation abort** (barge-in must gate input instead). Reference #2 (`activated-intelligence/voice-chat`) runs `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` this way. |
| **wllama / LlamaWeb** | 🔸 Fallback only | WASM-centric llama.cpp; the deep escape hatch if ORT's WASM path underperforms. Better for very short turns, worse prefill for long RAG. |

**Model:** **Qwen2.5-Coder-1.5B-Instruct**, quantized **q4f16**. 1.5B is the sweet spot for live latency on consumer GPUs; offer 0.5B (low-end / WASM) and 3B (high-end discrete GPU) as quality tiers. Reuse KV-cache across turns; warm up with a 1-token generate on load.

### STT — **Moonshine on-device primary; Web Speech API as opt-in "fast mode"**

| Option | Verdict | Reasoning |
|---|---|---|
| **Moonshine** (`onnx-community/moonshine-base-ONNX`) | ✅ **Primary** | Purpose-built for **streaming low-latency** short segments; beats Whisper in-class on WER **and** dramatically on latency in cited benchmarks (~107ms vs multi-second for Whisper on short clips). On-device, **offline, private**, runs in transformers.js (WebGPU/WASM). Reference #1 even ships it as a commented drop-in. |
| **Whisper-base** | 🔸 Alt | What reference #1 uses by default; solid accuracy, heavier/slower for live. Good fallback if Moonshine quality disappoints on your accent/vocabulary. |
| **Web Speech API** (`webkitSpeechRecognition`) | ⚠️ Opt-in only | Lowest effort + no model download, **but Chrome's implementation is cloud-based (sends audio to Google) and not reliably offline** — a privacy leak for a code-review tool, and shaky in extension/offline contexts. Offer it behind a "fast cloud STT" toggle, **off by default.** |

**VAD / turn-taking:** **Silero VAD** (`onnx-community/silero-vad`, ~2MB) — lifted directly from reference #1. Thresholds proven in the wild: speech 0.3 / exit 0.1 hysteresis, 400ms min-silence to end turn, 250ms min-speech to reject blips, 80ms pad, plus a small pre-buffer FIFO so the leading consonant isn't clipped.

### TTS — **Kokoro (you already have it), now made streaming**

`kokoro-js` exposes `TextSplitterStream` + `tts.stream()` — push LLM tokens in, get **per-sentence** audio out. Kokoro WebGPU runs **faster than real-time** (RTF ~2.4×–6.5× on Apple Silicon / discrete GPUs; TTFA ~300–750ms). On integrated GPUs it can dip below real-time — fall back to a smaller voice or WASM and warn. Your `ttsEngine.ts` likely does one-shot synthesis today; the work is switching it to the streaming generator.

---

## 3. The latency-hiding pipeline (the whole game)

Perceived latency = **time-to-first-audio**, not total response time. Four techniques, all from the references:

1. **Stream LLM tokens straight into sentence-chunked TTS.** The LLM's `TextStreamer` callback does `splitter.push(token)`; a parallel `for await (const {audio} of tts.stream(splitter))` emits audio as soon as sentence 1 is complete. TTS speaks sentence 1 while the LLM is still generating sentence 2. TTFA ≈ "first sentence generated," not "full reply."
2. **Warm-load / pre-compile.** On panel open, run `transcriber(new Float32Array(16000))` and `llm.generate({max_new_tokens:1})` once to pay the **1–5s WebGPU shader-compile cost** up front, not on the user's first question.
3. **Pipeline STT→LLM→TTS + KV-cache reuse.** Thread `past_key_values` across turns so each turn only prefills the *new* user message, not the whole history.
4. **Barge-in.** While Andy speaks, either (a) **interrupt** generation via `InterruptableStoppingCriteria.interrupt()` (transformers.js path — true barge-in), or (b) **gate input** (`if isPlaying drop frames`) if you use WebLLM (no native abort). Reference #1 uses the gate; you can do true interrupt on the transformers.js path.

`play-worklet.js` from reference #1 is a near-copy-paste **buffered AudioWorklet playback queue** that drains Kokoro chunks sample-accurately and emits `playback_ended` — lift it directly.

### 3b. The audio-loop hazards (VERIFIED — the stuff that actually breaks hands-free)

**🚩 #1 hazard — self-hearing / echo feedback.** When Andy speaks through speakers, the mic hears him → VAD/STT re-triggers → feedback loop. Browser `echoCancellation:true` *does* target your own TTS (WebRTC AEC3), **but it's a boolean — you can't feed it your TTS buffer as a reference, and it leaks exactly at speech onset and during double-talk** ("the bot interrupts itself"). So AEC is a **backstop, not the defense.**

- **Primary defense = half-duplex gate.** While TTS plays, **pause VAD and drop STT input** (reference #1's `isSpeaking`/`playing` flag flipped back by the worklet's `playback_ended`). This deterministically kills the loop.
- **getUserMedia constraints:** `{ channelCount:1, echoCancellation:true, noiseSuppression:true, autoGainControl:true }` (AEC/NS/AGC on as backstop).
- **VAD hardening:** minimum start-segment length + volume smoothing to ignore the AEC onset leak.
- **Recommend headphones in-UI** for true talk-over (no acoustic path = no feedback).

**🚩 #2 gotcha — mic permission in a side panel.** `getUserMedia()` **fails in the side panel / popup / offscreen doc** until permission is granted, because those surfaces can't show Chrome's prompt. **Pattern:** on first run, open a full extension tab (`permission.html`) via `chrome.tabs.create` and call `getUserMedia` there to trigger the prompt; once granted for the extension origin, the **side panel can call `getUserMedia` directly** thereafter. You do **not** need an offscreen doc for mic (only for capture with no visible UI).

**Interaction model:** **push-to-talk as the v1 default** — deterministic, zero false triggers, privacy-friendly (mic hot only on press), and it sidesteps the echo loop entirely since the mic isn't live during TTS. Offer **always-listening VAD behind the half-duplex gate** as an opt-in hands-free mode. Surface explicit **idle → listening → thinking → speaking** states; showing "thinking" the instant speech ends is the cheapest perceived-latency win.

**Barge-in:** on detected speech, in one handler fire **both** "stop the AudioWorklet/audio playback" **and** "abort generation" (`InterruptableStoppingCriteria.interrupt()` / `AbortController`) — sub-second, or it feels broken.

---

## 4. Grounding on the scan report (RAG) + context pre-warming

**VERIFIED (the design's keystone):** because the scan finishes *before* the conversation, you can prefill the scan context into a KV-cache during idle reading time and reuse it every turn — and this is a **real, code-level capability in transformers.js** (and effectively **not supported in WebLLM**). This is the single strongest reason transformers.js is the primary runtime.

- **transformers.js — YES.** `generate()` returns a `past_key_values` object; capture it, pass it back as `past_key_values:` on the next call, reset with `= null`. The `conversational-webgpu` worker does exactly this (`past_key_values_cache`). You can prefill `[system + scan report]` once with a `max_new_tokens:1` pass during idle time, park the cache, and every turn then only prefills the short *question* → tiny per-turn TTFT. (Source: conversational-webgpu/src/worker.js; HF KV-cache docs document the "prefill a prefix, reuse it" pattern explicitly.)
- **WebLLM — NO.** No prefix-cache / prefill-reuse API; re-sending a long fixed system prompt re-prefills it every call (web-llm issue #735). Decisive against WebLLM for this feature.
- **Prefill cost to hide:** ~350 tok/s prefill @ 1.5B q4f16 on a fast Chrome/Windows GPU (slower on M2/Safari, ~9 tok/s on Firefox). So ~3k tokens of scan context ≈ **~8–9s of idle warm-up** on a fast GPU — fine to hide behind report-reading, but a hard argument to **keep the grounding tight** (fewer tokens = faster warm-up + less DynamicCache memory). Benchmark per-device; treat 350 tok/s as order-of-magnitude.
- **Context window:** Qwen2.5-1.5B is **32k native** (`max_position_embeddings: 32768`); **no YaRN/128k** for the 1.5B build, and no evidence transformers.js/ONNX honors YaRN anyway. A scan summary fits in 32k many times over — memory, not the window, is the real limit.

### RAG strategy

Start **simple**: the scan summary (top findings, changed files, key metrics, mermaid intent) is small enough to **stuff into the system prompt** — no vector DB. You already produce this in `core/scanReport.ts` / `core/liveSummary.ts`.

```
System: You are Andy, a PR-review voice assistant. Answer ONLY from the scan
below; if it's not covered, say so. Keep answers short and spoken-friendly.
<scan>
  Findings: {top N from scanOutput}
  Changed files: {paths + churn from prDiff}
  Metrics: {from scanReport}
</scan>
```

**Escalate only if it overflows context:** chunk by file/finding, rank by BM25/keyword overlap with the question (or a tiny embedder), inject top-K. Keep spoken answers short (1–3 sentences) regardless — long monologues kill the "live" feel.

### Prompting a 1.5B model for spoken grounded QA (VERIFIED guidance)

A 1.5B model **can** be a good terse grounded Q&A bot **if constrained hard** — but has real limits. Decisions:

- **Ship v1 as pure conversational — NOT agentic.** WebLLM tool-calling is WIP and doesn't even list Qwen2.5; at 1.5B, multi-step function-calling is unreliable. If you want light actions (open file / jump to finding), use **constrained JSON-mode intents** (`{"action":"open_file","file":"…"}`) executed in JS — not free-form tool-calls. Defer agentic behavior.
- **🚩 PRODUCT GUARDRAIL — do not surface model-stated line numbers as authoritative.** A 1.5B model *will* occasionally fabricate line numbers. Treat its spoken numbers as conversational only; in the UI, **map each answer back to the real finding record (by the IDs you supplied)** and link to the actual line. Never render a model-generated `file:line` as a clickable truth.
- **Grounding levers that work:** "answer ONLY from the scan; if absent say *exactly* 'That's not in the scan.'" (a literal quoted refusal string beats abstract instructions on small models); **1–2 few-shot examples** including one successful grounded answer + one refusal (so it learns the boundary, not just to refuse); ≤5–7 hard rules, most-important first AND last.
- **Spoken-output rules (prompt for them AND post-strip in JS):** 1–3 sentences, no markdown/lists, expand numbers/symbols to words, **humanize identifiers** ("line one forty-two of the login file," not "login dot r-s colon 142"), pronunciation hints ("SQL"→"sequel"), refer to findings by description not ID. A 1.5B model leaks markdown despite the prompt — **always strip residual markdown/symbols before TTS.**
- **Context serialization:** compact severity-ordered labeled lists (NOT JSON for *input*), cap at 6–8 findings, include changed-file churn, **drop full diff bodies** (biggest token sink). Target ~1.5–2.5k tokens pinned — which also keeps the KV warm-up fast (§4).
- **Memory:** pin `system + scan` every turn; **sliding window** of last ~3 exchanges for history; summarize only if you near the budget. Don't over-engineer v1.

The full system-prompt template + serialization block live in the research notes; lift them into `core/voicePrompt.ts`.

---

## 5. Phased implementation

Design every stage behind an injectable interface from day one (§5c) — it's how the logic stays testable AND how you swap WebGPU↔WASM and transformers.js↔WebLLM.

**Phase 0 — Spike (de-risk, ~1–2 days). The whole point is to measure the unmeasurable.** Clone `conversational-webgpu`, run it, swap SmolLM2 → Qwen2.5-Coder-1.5B-q4f16, confirm WebGPU works inside *your* side-panel page. **Explicitly measure on real hardware:** (a) all **three models resident on one GPU** — does it OOM? VRAM headroom? (b) Qwen **prefill + decode tok/s**; (c) whether enabling **COEP `require-corp`** breaks the extension's other fetches. **Gate:** voice loop runs in the panel + the three risk numbers are known.

**Phase 1 — TTS streaming.** Upgrade `core/ttsEngine.ts` to a streaming path (`TextSplitterStream` + `tts.stream()`); add `play-worklet.js` (lift from ref #1). Static text first. **Gate:** sentence-by-sentence audio, TTFA < 1s.

**Phase 2 — LLM module + context pre-warm.** New `core/voiceLlm.ts`: load Qwen2.5-Coder-1.5B-q4f16 via transformers.js, streaming `generate` with `TextStreamer` + `InterruptableStoppingCriteria`, and **`past_key_values` threading**. Build `core/voicePrompt.ts` (Appendix A). **Pre-warm the scan-context KV when the report renders** (idle-time prefill). Wire token stream → TTS splitter; post-strip markdown. **Gate:** type a question → spoken grounded answer with tiny TTFT (context already warm), barge-in interrupts both gen + playback.

**Phase 3 — STT + VAD + push-to-talk.** New `core/voiceStt.ts` (Moonshine ≥ tfjs 3.2) + Silero VAD (raw ORT or `@ricky0123/vad-web`) + `voiceWorker.ts`. Ship the one-time **`permission.html` mic-grant tab**. **Default interaction = push-to-talk** (sidesteps echo); VAD hands-free behind a **half-duplex gate** as opt-in. **Gate:** full hands-free loop — speak, get a spoken grounded answer; no self-hearing feedback.

**Phase 4 — Grounding.** `buildGroundingContext()` from `scanReport.ts` (severity-ordered, ≤8 findings, no diff bodies); bind conversation to the PR url like `Chat.tsx` already does. **🚩 UI maps spoken answers back to real finding records by ID — never trust model-stated line numbers.** **Gate:** answers cite real findings; refuses out-of-scope with the fixed string.

**Phase 5 — Rewire `Chat.tsx`.** Replace canned `buildReasoning()` with the real agent; keep timer-reasoning as the "thinking" affordance. Add PTT/call button, waveform, **idle/listening/thinking/speaking** states, live transcript (also serves accessibility). Persist transcripts via `state/chatHistory`.

**Phase 6 — MV3 hardening + tiers.** Hardware-detected tiers (0.5B/1.5B/3B); WebGPU/WASM gate; **fetch-at-runtime weight download UX** (progress + resume, Cache Storage, `navigator.storage.persist()`); manifest **COEP/COOP** for WASM-tier threading; optional **offscreen-doc** promotion for warm models; optional Web Speech "fast cloud STT" toggle; latency HUD (§5c).

**Rough effort:** Phase 0 ~1–2 days; Phases 1–5 the bulk (~2–4 weeks for a polished v1, since most infra is reused); Phase 6 ongoing hardening. Biggest schedule risk is Phase 0's GPU-contention result — if three models don't co-reside, you sequence/unload (adds latency) or drop a tier.

---

## 5b. Verified download manifest (all repos confirmed live, HF API, June 2026)

Every artifact below was verified to exist with the listed dtype + size. **Coder-specific ONNX exists at 0.5B/1.5B/3B — no plain-Instruct fallback needed.**

### Recommended **1.5B tier** (transformers.js / WebGPU primary) — **≈ 1.5 GB total**
| Model | Repo | dtype | ~size | Notes |
|---|---|---|---|---|
| LLM | `onnx-community/Qwen2.5-Coder-1.5B-Instruct` | **q4f16** | **1,344 MB** | single file (no external `.onnx_data`) — clean WebGPU load |
| STT | `onnx-community/moonshine-base-ONNX` | q4f16 (enc+dec_merged) | ~102 MB | needs transformers.js **≥ 3.2.0**; encoder/decoder split, use `decoder_model_merged` |
| VAD | `onnx-community/silero-vad` | fp32 | 2 MB | **no transformers.js pipeline** — drive via raw `onnxruntime-web` or `@ricky0123/vad-web` |
| TTS | `onnx-community/Kokoro-82M-v1.0-ONNX` | q8 (+1 voice 0.5 MB) | ~93 MB | you already ship this via kokoro-js; voices are separate 0.52 MB `.bin` each |

### Low-end **0.5B / tiny tier** — **≈ 0.68 GB total**
| Model | Repo | dtype | ~size |
|---|---|---|---|
| LLM | `onnx-community/Qwen2.5-Coder-0.5B-Instruct` | q4f16 | 555 MB |
| STT | `onnx-community/moonshine-tiny-ONNX` | q4f16 | ~56 MB |
| VAD | `onnx-community/silero-vad` | int8 | 0.64 MB |
| TTS | `onnx-community/Kokoro-82M-v1.0-ONNX` | q8f16 | ~87 MB |

### Optional WebLLM (MLC) speed-mode — Coder prebuilt at 0.5B/1.5B/3B/7B
`Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` (and 0.5B/3B/7B) are all prebuilt in WebLLM's `prebuiltAppConfig`, auto-fetched from `mlc-ai/…`. WebLLM is LLM-only → still pair with the Moonshine/Silero/Kokoro ONNX above. WebGPU-only, no WASM fallback.

**Manifest gotchas:** (1) **3B Coder** ONNX uses external `.onnx_data` for every dtype (q4f16 = 2 files, ~2.37 GB) — avoid on the primary path, prefer the single-file 1.5B. (2) **whisper-base has no q4f16 decoder** — if you use Whisper instead of Moonshine, pick int8 (~77 MB). (3) Count only the **Kokoro voices you ship**, not all 54.

---

## 5c. Testing & observability (grounded in your existing DI pattern)

Your `core/ttsProvider.ts` + `fakeRuntime()` recording-fake in `ttsProvider.test.ts` is **already the right pattern** — generalize it. The hard constraint: WebGPU / AudioWorklet / getUserMedia / 1GB models **don't exist in jsdom and can't be faithfully mocked**, so architect the testable logic to never touch them.

**Testing pyramid:**
- **Unit (CI, the bulk):** put every stage behind a small interface (`SttRuntime`/`LlmRuntime`/`TtsRuntime`/`VadRuntime`), inject **deterministic fakes** that record calls + return scripted streams. Pure-test the highest-value logic headlessly: conversation **state machine** (as a reducer `(state,event)=>state`), **sentence-splitter** (mid-sentence tokens NOT flushed, abbreviations don't false-trigger, final flush on end), **KV-cache threading** (turn N's cache passed to N+1, reset on clear), streaming order/backpressure, `AbortSignal` propagation STT→LLM→TTS.
- **Integration (CI, faked runtimes):** scripted token/audio streams asserting wiring/ordering/abort.
- **Manual on-device (NOT CI):** anything touching WebGPU/AudioWorklet/mic/real models + voice naturalness + perceived latency = **QA checklist**. Optionally ONE Playwright smoke on a real-GPU runner (load extension, feed a fake-audio WAV via `--use-file-for-fake-audio-capture`, assert "adapter present → audio emitted, no crash"). Broader E2E is a maintenance sink (MV3 SW suspends ~30s, GPU-backend variance, model nondeterminism).

**Latency instrumentation:** a **metrics decorator** over the same runtime interfaces (so it's injected + unit-testable with `vi.useFakeTimers()` + stubbed `performance.now`). Capture per turn via `performance.mark/measure`: EOU/turn-detect delay, STT latency, **LLM TTFT**, tokens/sec, **TTS TTFA**, first-audio latency (`speech-end`→first sample = the number users feel), e2e turn latency. Report P50/P90/P99 to a dev HUD. Targets from production agents: TTFT <800ms (ideally ≤500), TTFA <300ms with sentence-chunking.

**Quality eval (`npm run eval`, on-device, not CI):** STT WER on ~10–20 reference clips; LLM grounding/refusal accuracy on a fixture set (pin greedy/temp=0); TTS via **STT-round-trip** (synthesize→transcribe→WER). Keep models out of CI entirely (fakes mean they're never fetched). Respect the repo gotcha: never co-schedule a GPU/eval job with the vitest or cargo/WASM jobs (esbuild OOM).

## 6. Two repos to lift code from

1. **`huggingface/transformers.js-examples/conversational-webgpu`** (Apache/MIT) — the loop. Take `worker.js` (VAD heuristics, streaming LLM→TTS, warm-up, KV-cache, interrupt), `vad-processor.js`, `play-worklet.js`, `constants.js`. **3 of its 4 components are already your stack** (Kokoro, Silero, Whisper/Moonshine).
2. **`activated-intelligence/voice-chat`** (MIT, Dec 2025) — the Qwen brain. `src/hooks/use-webllm.ts` (~10 lines) if you pick the WebLLM speed-mode path; its README documents the WebGPU→WASM fallback and the **"WebLLM has no native abort"** gotcha.
   - MV3 packaging reference: **`algopian/chromeclaw`** (offscreen + Whisper + Kokoro) and **`kessler/gemma-gem`**.

---

## 7. Risk register (after research)

**✅ Resolved by research:**
- **Web Speech API offline in MV3** → confirmed cloud-only/Google; opt-in "fast mode" off by default, not the offline path.
- **KV-cache prefix pre-warm** → confirmed supported in transformers.js, not WebLLM. Design works; transformers.js is primary.
- **Model artifacts exist** → all verified live with sizes; Coder-specific ONNX at 0.5/1.5/3B.
- **Bundle vs CDN for 1.5GB** → fetch-at-runtime + Cache Storage is MV3-compliant (weights = data) and better than bundling.
- **SharedArrayBuffer / COOP-COEP** → needed for multithreaded WASM (~3–4× penalty without); enabled via manifest COEP/COOP keys. Matters mainly for the WASM-fallback tier.
- **Self-hearing / echo** → half-duplex gate is the primary fix (AEC is backstop); push-to-talk v1 sidesteps it.
- **Mic in side panel** → works after a one-time `permission.html` tab grant.

**⚠️ Must measure in the Phase 0 spike (no amount of research substitutes):**
- **Three models on one WebGPU device** (Qwen 1.34GB + Kokoro + Moonshine) — VRAM pressure / device contention. The #1 thing to measure on real hardware.
- **Qwen2.5 q4f16 prefill+decode latency on YOUR target devices** — planning numbers are ~350 tok/s prefill / ~45 tok/s decode @ 1.5B on a fast GPU, but device-dependent (much worse on Firefox/integrated GPU).
- **COEP `require-corp` ripple** — does enabling cross-origin isolation break the extension's *other* fetches (GitHub API, scan data, HF CDN)? Test end-to-end before committing; it touches the whole extension, not just this feature.
- **Integrated-GPU / WASM-only floor** — Qwen decode ~2–6 tok/s on WASM makes "live" impossible there; the 0.5B tier + honest UX messaging is the mitigation.

---

### Bottom line
You're not building from scratch — you're grafting a **proven open-source voice loop** (reference #1) onto infrastructure you already own (Kokoro, transformers.js, WASM workers, scan report, side panel). Because the **scan finishes before the conversation**, you pre-warm the grounding KV-cache during reading time, so per-turn latency is dominated by the *question*, not the context. The honest target: **~1.5–2.5s to first word on WebGPU, then fluid sentence-streamed speech**, degrading gracefully on WASM. "Literal zero latency" isn't physical, but this *feels* conversational. The single biggest unknown — three models sharing one GPU — is answered by building the spike, not by more research.

---

## Appendix A — Ready-to-use system-prompt template

Lift into `core/voicePrompt.ts`. Pin `system + scan` every turn; append last ~3 exchanges; then the new user message. **Always post-strip residual markdown/symbols before TTS.**

```
You are Drift, a hands-free voice assistant. You answer questions about ONE code-scan
report, read aloud by a speech engine. The scan below is your ONLY source of truth.

RULES (follow exactly):
1. Use ONLY facts in the SCAN REPORT. If the answer is not in it, say exactly:
   "That's not in the scan." Do not guess, and do not use outside knowledge.
2. Never state a line number, file, or metric that is not written verbatim in the scan.
3. Answer in 1 to 3 short spoken sentences. No lists, no markdown, no code, no symbols.
4. Speak naturally. Say "line one forty-two of the login file," not "login dot r-s colon 142."
   Say "sequel" for SQL. Refer to issues by description, never by an ID like F1.
5. Ask at most one short follow-up question, and only when needed.

EXAMPLES:
User: What's the worst issue?
You: The most serious one is in the login file, where passwords are compared in a way
that's vulnerable to timing attacks.

User: How many tests are failing?
You: That's not in the scan.

=== SCAN REPORT (the only source of truth) ===
METRICS: 3 high, 5 medium, 12 low | 8 files changed | +412 −97 lines
FINDINGS (most severe first):
[F1] HIGH · auth/login.rs:142 · Password compared with == (timing-unsafe)
[F2] HIGH · api/users.rs:88  · SQL built via string format (injection risk)
[F3] MED  · cache/store.rs:30 · Unbounded map, possible memory growth
CHANGED FILES:
auth/login.rs (+60 −12) · api/users.rs (+90 −4) · cache/store.rs (+22 −0)
=== END SCAN ===
```

Serialization: compact severity-ordered labeled lists (NOT JSON for input), cap 6–8 findings, include changed-file churn, drop full diff bodies, target ~1.5–2.5k tokens.
