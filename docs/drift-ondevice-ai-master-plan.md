# Drift On-Device AI — Master Plan

The single end-to-end plan for Drift's on-device AI: a **grounded PR-summarizer LLM** and a **voice agent that talks and stops**, both running **in the browser** (and the GitHub Action), fine-tuned in-house, faithfulness-first.

This document is the **spine**. It states the vision, the shared foundations, the unified roadmap, and the cross-cutting decisions — and links out to three detailed plans for the depth:

- **[llm-finetune-pipeline.md](./llm-finetune-pipeline.md)** — the text PR-summarizer: data → SFT/KTO → quantize → MLC/GGUF → browser + Action deploy → security, observability, release.
- **[live-voice-agent-plan.md](../drift-chrome-extension/docs/live-voice-agent-plan.md)** — the ship-now voice **cascade** (Silero → Moonshine → Qwen → Kokoro, streaming, barge-in).
- **[duplex-voice-model-plan.md](./duplex-voice-model-plan.md)** — the R&D **duplex** model ("PersonaPlex, but smaller/faster/in-browser").

> **North Star: faithfulness.** Every model states only what the diff/scan supports. The whole stack — structured input, grounded prompts, claim-level eval, preference tuning — is engineered against invention.

---

## 1. The vision in one picture

```text
   ┌──────────────────── DRIFT ON-DEVICE AI ────────────────────┐
   │                                                            │
   │   TEXT BRAIN ───────────────┐        VOICE LAYER           │
   │   Qwen2.5-Coder-1.5B         │        (grounded on scan)    │
   │   (fine-tuned, faithful)     │                             │
   │      │ handover / Q&A        │   v1  Cascade: Qwen→Kokoro   │
   │      ▼                       │       streaming + barge-in   │
   │   PR handover (5-section)    │   v2  Duplex: CSM-style RQ   │
   │      │                       │       (talks AND listens)    │
   │      ├── Browser: WebLLM (WASM+WebGPU), OPFS-cached         │
   │      ├── Action:  GGUF Q4_K_M via llama.cpp (CPU)           │
   │      └── Desktop: Docker Model Runner                       │
   │                                                            │
   │   Shared: scan report = grounding · Mimi/Kokoro = audio    │
   └────────────────────────────────────────────────────────────┘
```

Two product surfaces (Chrome extension + GitHub Action), one fine-tuned brain, an optional voice skin that escalates from cascade → full-duplex.

---

## 2. Shared foundations (true across all three plans)

- **Text model:** `Qwen2.5-Coder-1.5B-Instruct` (Apache-2.0). `0.5B` for mobile/low-VRAM; **never the 3B** (non-commercial Qwen-Research license).
- **Browser runtime:** WebLLM (MLC, WASM+WebGPU) for the LLM; ONNX Runtime Web for audio (Kokoro/Mimi). Both **proven in the extension today** (Kokoro path).
- **Audio:** Kokoro (TTS + data-generation voice donor); Mimi codec for the duplex path (browser-proven).
- **Grounding:** the `drift-static-profiler` scan report is the source of truth; the LLM presents scanner-verified facts, never invents.
- **Hosting:** weights on **HuggingFace Hub** (CORS on `resolve/` works — proven by Kokoro in-repo); the WASM/model_lib **bundled** in the MV3 zip (code, not data).
- **Training:** MLX on Apple Silicon (SFT + KTO/DPO/ORPO native). Not Rust — Rust is for the runtime/scanner, not training.

---

## 3. Cross-cutting verified facts (the de-risk ledger)

| Claim | Status | Where verified |
|-------|--------|----------------|
| Qwen2.5-Coder-1.5B runs in WebLLM, WebGPU | ✅ prebuilt MLC model exists | [pipeline §risk](./llm-finetune-pipeline.md) |
| 5-section schema enforceable in-browser | ✅ XGrammar is MLC's default, free | pipeline |
| Extension can host it | ✅ Kokoro proves ML inference + HF download + cache + CSP | Explore of `drift-chrome-extension` |
| HF CORS for ~1 GB weights | ✅ Kokoro fetched from HF in-repo | extension code |
| Runs in GitHub Actions | ✅ GGUF Q4 + llama.cpp on 2-vCPU/7 GB runner, ~1–3 min/PR | pipeline §GH-Actions |
| Shrink the 3 GB fp16 | ✅ ship Q4 (~1 GB) / keep adapter (tens of MB) | pipeline §shrink |
| Mimi codec in-browser | ✅ ORT-Web, streaming 24 kHz | [duplex §2](./duplex-voice-model-plan.md) |
| Small talking base exists | ✅ Sesame CSM-1B (RQ-split, Mimi), Orpheus | duplex §4b |
| Mimi codec browser-ready | ✅ `onnx-community/kyutai-mimi-ONNX` (CC-BY) | duplex §4c |
| Moshi base is commercial | ✅ Moshi + Mimi are **CC-BY-4.0**; MLX-q4 runs on Mac/iPhone | duplex §4c |
| Fine-tune engine | ✅ `moshi-finetune` (Apache-2.0), 1×H100 ~$10/few hrs | duplex §4d |
| Kyutai model → ONNX → browser | ✅ proven (`pocket-tts-onnx-export`, ORT-Web) | duplex §6b |
| CSM architecture in PyTorch | ✅ native in HF Transformers (`sesame/csm-1b`) | duplex §6b |
| Dual-loop RQ ONNX orchestration | ❌ **you build it — the crux/IP** | duplex §6b |
| Full-duplex at ~1B | ⚠️ frontier (Moshi=7B; SALM-Duplex is research) | duplex §2 |

---

## 4. The latency law (decides the duplex architecture)

A 1.5B q4f16 decodes **~30–60 tok/s** in-browser. Therefore:

- **Flattened-SNAC head (Orpheus-style)** needs ~150 audio tok/s **from the big model** → **infeasible** in-browser real-time.
- **RQ-split (CSM/Moshi/PersonaPlex)** keeps the big model at **~12.5 Hz frame rate** (zeroth codebook + inner-monologue text) and offloads codebook expansion to a near-free **100 M** decoder → **fits**.

**The duplex architecture is forced: RQ-Transformer split, never the flattened head.** And **Sesame CSM-1B already is that architecture**, so Path B = *fine-tune CSM-1B on Kokoro+Qwen scan-grounded dialog with PersonaPlex's hybrid-prompt recipe* — not a from-scratch build.

---

## 5. Unified roadmap

Three workstreams that share the brain and the runtime. Ship the text model and the cascade first; treat duplex as a parallel R&D bet.

### Workstream A — Text PR-summarizer (the foundation)

1. Build the **eval harness** (HHEM fast filter + anchored claim-judge) + regression set + **injection red-team slice**. *First, always.*
2. **Data:** mine PRs (curl REST) → structured **+/− JSON** → clean → teacher-normalized gold; bootstrap from CommitBench. Time-split.
3. **Stage A prompt baseline** → ship if it clears the gate.
4. **SFT** (QLoRA/DoRA, MLX) → **KTO** preference (your judge emits its binary labels).
5. **Fuse → export both:** GGUF Q4_K_M (Action) + MLC q4f16 (browser, reuse prebuilt qwen2 wasm).
6. **Wire** into `action/src/ai-*` (Action) and a new `llmRuntime.ts` (extension); temp 0, XGrammar schema.
7. **Ship behind canary**, emit telemetry to `drift-observability`, fold failures into the next KTO round.

### Workstream B — Voice cascade (ship-now "talks and stops")

8. Spike `conversational-webgpu` in the side panel; **measure 3-models-on-one-GPU**.
9. Streaming **Kokoro TTS** → **Qwen LLM** (KV-prewarm the scan context) → **Moonshine STT + Silero VAD** → push-to-talk, half-duplex echo gate, `permission.html` mic grant.
10. Barge-in = interrupt generation + flush audio in one handler. **This already "talks and stops."**

### Workstream C — Duplex model (the R&D bet, "our own model")

11. **Learn the stack:** run Moshi/PersonaPlex (MLX/cloud A100) to prove the Drift-grounded role+voice loop at 7B.
12. **Build the small base (Path B):** fine-tune **Sesame CSM-1B** (RQ-split, Mimi) on Kokoro+Qwen scan-grounded dialog + PersonaPlex hybrid prompt → "Drift talks" in-browser.
13. **Add the user-listening stream** → pseudo/full duplex (negative-silence barge-in recipe).
14. **Efficiency + factuality pass:** codebook reduction, T-Mimi decoder, MoshiRAG-style retrieval, Inner Monologue.

---

## 6. Decision log (the calls a principal signed off)

- **Train in MLX, not Rust.** Rust ML training is research-grade; MLX ships SFT/KTO/DPO. Runtime stays Rust/WASM.
- **KTO over DPO** for preference tuning — the faithfulness judge already emits binary supported/unsupported labels.
- **WebLLM (browser) + llama.cpp (Action); Ollama is eval/dev only** — it's server-only and (post-PR #16031) just wraps llama.cpp.
- **Compile the browser `.wasm` once per architecture** (or reuse MLC's prebuilt qwen2); retrains only re-host weights.
- **OPFS + `navigator.storage.persist()`** so the ~1 GB never re-downloads; cache is per-origin (extension origin is stable).
- **Engine in a Web Worker from the side panel** (mirrors `ttsWorker.ts`), not the evictable service worker; offscreen doc only if warm-keeping matters.
- **Duplex = RQ-split, fine-tune CSM-1B** — forced by the latency law; don't build a flattened head or pretrain from scratch.
- **Reuse kernels, own the orchestration** — the streaming dataflow graph (VAD→STT→brain→talker→codec→audio, barge-in, KV-prewarm, scan-grounding) is the IP; matmul kernels are not.

---

## 7. Risk register (the honest unknowns)

- **3-model GPU contention in-tab** (LLM + Kokoro + STT) — measure in the Workstream-B spike; serialize/unload if it OOMs.
- **WebGPU buffer caps** on mobile/old GPUs — gated by `navigator.gpu` detection + 0.5B/runner fallback.
- **Prompt injection via diff/commit text** — summarization is the highest-risk task (96%/38%); mitigated by the scanner-as-privileged / LLM-as-quarantined split + faithfulness-as-detector.
- **Quant degrading reasoning at 1.5B/4-bit** — hard quant-gate on both surfaces.
- **No small *full-duplex* base** — "talks" (CSM-1B) is cheap; "talks-and-listens" is the genuine frontier (one stream away from CSM, but unproven at 1B in-browser).
- **COEP/COOP ripple** — enabling cross-origin isolation for WASM threads can break other extension fetches; spike-verify before committing.

---

## 8. Document index

| Plan | Scope |
|------|-------|
| **[llm-finetune-pipeline.md](./llm-finetune-pipeline.md)** | Text model: data, training (SFT/KTO), quant, MLC/GGUF, hosting, GitHub Actions, model-shrinking, security, observability, release engineering |
| **[live-voice-agent-plan.md](../drift-chrome-extension/docs/live-voice-agent-plan.md)** | Voice cascade: STT/VAD/LLM/TTS, latency-hiding, barge-in, MV3 packaging, phased build |
| **[duplex-voice-model-plan.md](./duplex-voice-model-plan.md)** | Duplex model: PersonaPlex decomposed, Path A/B, RQ-split mechanics, latency law, training recipe, browser runtime |

---

*Status: planning complete and verified end-to-end against the real `drift-chrome-extension` codebase and 2026 literature. Next implementation steps: (1) `llmRuntime.ts` against the stock prebuilt Qwen-1.5B MLC model to prove load+stream+schema in the side panel; (2) the Workstream-A eval harness; (3) the Workstream-B `conversational-webgpu` spike.*
