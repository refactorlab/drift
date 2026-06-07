# Drift Duplex Voice Model — "PersonaPlex, but smaller, faster, in-browser"

> R&D plan to build Drift's own **full-duplex, voice+role-controlled speech model**
> that runs in the browser — inspired by [PersonaPlex](https://arxiv.org/abs/2602.06053)
> (NVIDIA, ICASSP 2026) but re-engineered for the on-device WebGPU constraint.
> Cross-links: [`live-voice-agent-plan.md`](../drift-chrome-extension/docs/live-voice-agent-plan.md)
> (the cascade, ship-now) · [`llm-finetune-pipeline.md`](./llm-finetune-pipeline.md) (the text model).

---

## 1. What PersonaPlex actually is (decomposed)

Reading the paper closely, PersonaPlex = **three things, only one of which is novel:**

| Layer | What it is | Novel? |
|---|---|---|
| **Architecture** | **Unchanged Moshi** — RQ-Transformer (7B Helium **Temporal Transformer** + small **Depth Transformer** over K codebooks), **Mimi** codec (24 kHz→12.5 Hz, 8 codebooks), **Inner Monologue** (predict text token before audio, per frame), 3 streams: user-audio / agent-text / agent-audio | ❌ "conditioning… **without altering the underlying architecture**" (their words) |
| **Hybrid System Prompt** | a **text segment** (role conditioning: force role text on the agent-text channel, agent-audio silent) **+ a voice segment** (a short speech sample on the agent-audio channel → zero-shot voice clone); user-audio replaced by a 440 Hz sine during the prompt | ✅ **the contribution** |
| **Training** | **init from Moshi weights**, then **fine-tune** on synthetic data. Depth LR 4e-6 / Temporal 2e-6, 24,576 steps, batch 32, seq 2048 (163.84 s), **6 h on 8×A100**. Loss masked on the system prompt; non-semantic audio tokens down-weighted ×0.02, padded text ×0.3. Negative-duration silence in data = barge-in/interruption. | ✅ recipe + data |

**The decisive realization:** the **method is architecture-agnostic** and the *expensive part was already done by Moshi*. PersonaPlex got "6 GPU-hours" because it **inherited a pre-trained 7B duplex base**. The hybrid-prompt + synthetic-data recipe ports to **any Moshi-class base — including a small one.** So "build our own, browser-able" = **apply PersonaPlex's recipe to a small duplex base** — and the real work is *getting that small base*, not the fine-tune.

---

## 2. Browser feasibility — what's proven vs. the wall

**Proven (good news):**
- ✅ **Mimi runs in-browser today** — transformers.js + ONNX, 24 kHz streaming, encode+decode ([Frisson Labs](https://www.frisson-labs.com/mimi-codec)). Mimi is ~96 M params and **causal/streaming (80 ms)**. The hard audio half is solved.
- ✅ **Smaller-than-Moshi duplex models already beat it** — **SALM-Duplex** (NVIDIA, TinyLlama backbone, "Efficient and Direct Duplex Modeling", [arXiv 2505.15670](https://arxiv.org/html/2505.15670v1)) outscores Moshi with a smaller backbone and less data — *and PersonaPlex itself cites it as ref [12]*. **Sesame CSM** is a 1B Llama-backbone conversational speech model. **T-Mimi** is a mobile-optimized Mimi decoder ([arXiv 2601.20094](https://arxiv.org/html/2601.20094v1)).
- ✅ Drift already runs ONNX ML in-browser (Kokoro), with HF model download + cache + `wasm-unsafe-eval` + `unlimitedStorage`.

**The wall (honest):**
- ❌ **PersonaPlex-7B will not run in a browser.** It's 7B BF16, needs **A100 80 GB**. The browser ceiling is ~1.5–3B @ 4-bit / ~4 GB VRAM.
- ❌ **There is no "Moshi-1.5B" to initialize from.** PersonaPlex skipped pretraining by standing on Moshi-7B. A *small* duplex base must be **distilled** or **trained on Mimi tokens** — the part that costs real compute (Moshi pretrained on ~7 M hours).
- ⚠️ A full-duplex loop in-browser = **4 streaming models at once** (Mimi-enc, Temporal, Depth, Mimi-dec) + mic loop, real-time. Heavier than the cascade; at the edge of WebGPU.

**Conclusion:** browser-native duplex is *feasible but is an R&D bet*, and its cost is **obtaining a small duplex base**, not the PersonaPlex-style fine-tune.

---

## 3. The target spec (Drift's own model)

A **~1.5–2B, 4-bit, full-duplex, voice+role-controlled speech model, grounded on the code-scan report**, running in the Drift side panel on WebGPU. Role = "Drift code reviewer"; voice = Drift's Kokoro voice (zero-shot cloned via the hybrid prompt). Novel vs. PersonaPlex: **PersonaPlex did customer-service; Drift does grounded code review** — which makes **factuality** (Inner Monologue + retrieval) central, not optional.

---

## 4. Two build paths to the small base (pick by budget)

| Path | How | Pros | Cons |
|---|---|---|---|
| **A — Distill Moshi-7B → ~1.5B** | knowledge-distill the Temporal Transformer onto a 1.5B backbone on Mimi tokens, keep Depth + Mimi, then apply PersonaPlex's hybrid-prompt FT | most direct "smaller Moshi"; preserves duplex behavior | distillation is weeks of GPU; nontrivial |
| **B — Thinker-Talker from a text LLM** (recommended start) | Qwen2.5-Coder-1.5B = Temporal/Thinker; add a small **Depth/Talker** predicting **Mimi (or SNAC)** tokens with **Inner Monologue**; train on synthetic data; start **half-duplex**, then add the user-audio stream for **pseudo→full duplex** | reuses your *already-chosen* text model + its faithfulness training; incremental; cheaper | not full-duplex on day one; you build the audio head |

**Recommendation:** **Path B**, staged. It reuses the [§ text pipeline](./llm-finetune-pipeline.md) (same Qwen-1.5B, same grounding), adds an audio head, and reaches "talks" first, "talks-and-listens" (duplex) second — instead of betting everything on a 7B distillation up front. Keep Path A on the table if a **Moshi-mini / Sesame / SALM-Duplex** checkpoint ships that's small enough to fine-tune directly (watch those repos).

---

## 4b. Path B mechanics — de-risked, with the latency law that picks the architecture

**Attaching an audio head to a text LLM is a solved, open pattern** — three references, in increasing fitness for *our* constraint:

| Pattern | Mechanism | Reference | Fit for browser duplex |
|---|---|---|---|
| **Vocab-expand, flattened** | add codec tokens to the LLM vocab; the **one** model emits interleaved text + **7 SNAC tokens/frame** (~150 audio tok/s); CNN detokenizer → PCM | **Orpheus** (Llama-3B + SNAC) ([Orpheus](https://github.com/canopyai/Orpheus-TTS), [HN](https://news.ycombinator.com/item?id=43420493)) | ❌ see latency law |
| **RQ-split (backbone + tiny depth decoder)** | big backbone predicts only the **zeroth (semantic) codebook at frame rate (12.5 Hz)**; a small **100 M** decoder predicts acoustic codebooks 1..N−1 conditioned on it; **Mimi** split-RVQ | **Sesame CSM-1B** ([HF](https://huggingface.co/sesame/csm-1b)) = Llama-1B + 100M decoder; same split as Moshi/PersonaPlex | ✅ **the one** |
| **LoRA + vocab-expand** | resize embeddings for audio tokens, **LoRA all layers**, freeze text embeddings, **10× loss on new audio tokens**, z-loss; **only 30–100 M trainable** to give a 7B a voice while keeping text ability | Microsoft *Make Some Noise* ([arXiv 2503.22275](https://arxiv.org/html/2503.22275v1)) | ✅ the cheap fine-tune |

### ⚠️ The latency law (the decision-critical finding)

**The browser backbone is decode-rate-limited (~30–60 tok/s for a 1.5B q4f16 in WebLLM).** So:

- **Orpheus-style flattened SNAC needs ~150 audio tokens/sec *from the big model*** → **impossible in-browser real-time** (2.5–5× over budget).
- **CSM/Moshi RQ-split keeps the big model at frame rate (~12.5 tok/s for the zeroth codebook + the inner-monologue text)**, and offloads codebook expansion to a **100 M** decoder that's nearly free. **12.5 tok/s ≪ 30–60 tok/s budget → real-time fits.**

**Therefore the architecture is forced: use the RQ-Transformer split (CSM/Moshi), never the flattened-SNAC head.** This is *why* Moshi/CSM/PersonaPlex all use it — it's not aesthetic, it's the only thing that hits real-time at small scale.

### The de-risk this delivers

The "no small base to init from" wall (§2) is **softer than it looked**: for the **"talks" (half-duplex)** half, **two open ~1B Llama+codec talking models already exist** — **Sesame CSM-1B** (Mimi, RQ-split — *exactly our target architecture*) and **Orpheus** (incl. small variants). And **fine-tuning them on your voice/domain is cheap** — Speechmatics fine-tuned CSM on new voices with modest data ([Speechmatics](https://blog.speechmatics.com/sesame-finetune)); you do **not** pay Orpheus's 100k-hour pretrain. CSM even trains the depth decoder on only **1/16 of frames** to save memory — a recipe you inherit.

**So Path B sharpens to:** *fine-tune Sesame CSM-1B (RQ-split, Mimi, browser-codec-proven) on Kokoro+Qwen-generated, scan-grounded Drift dialog, with the PersonaPlex hybrid-prompt recipe.* The only true frontier piece that remains is **adding the user-listening stream for full duplex** (§4 Path, Phase 3) — CSM already ingests conversation audio context, so it's one stream away, not a rebuild.

### Codec choice: **Mimi**, not SNAC, for this target

Both are streaming/hierarchical and browser-viable (SNAC "runs real-time on a smartphone CPU"; **Mimi is already proven in-browser** via ORT-Web). But **Mimi at 12.5 Hz with the split-RVQ semantic/acoustic structure is what the RQ-split duplex lineage (Moshi/CSM/PersonaPlex) uses**, and it's the codec the listening-stream/full-duplex work is built around. Pick Mimi for architectural lineage + duplex path; keep SNAC as a fallback if a Mimi ONNX export underperforms.

## 4c. The Moshi/Mimi base — concrete specs, variants & licensing (the foundation)

Researched [`kyutai/moshiko-pytorch-bf16`](https://huggingface.co/kyutai/moshiko-pytorch-bf16) and the Moshi/Mimi ecosystem. The facts that matter for Drift:

**Repo contents (the base PersonaPlex fine-tuned):**

| File | Size | What |
|------|------|------|
| `model.safetensors` | **15.4 GB** | the full Moshi (~7B) in bf16 — Temporal+Depth transformer |
| `tokenizer-…checkpoint125.safetensors` | 385 MB | the **Mimi codec** weights (loaded via `get_mimi()`) |
| `tokenizer_spm_32k_3.model` | 553 kB | SentencePiece **text** tokenizer (32k vocab) |

**Licensing — the unlock:** Moshi **and** Mimi are **CC-BY-4.0** → **commercial use is allowed with attribution.** You can build Drift's duplex model on this base commercially. (PersonaPlex *weights* are NVIDIA Open Model License, but its *method* is what we reuse; the *base* we'd actually build on — Moshi or CSM — is CC-BY / open.)

**Variants — and they align with Drift's stack perfectly:**

| Backend | Variants | Relevance to Drift |
|---------|----------|--------------------|
| PyTorch | `moshiko/moshika` × `bf16`, `q8` | training / server |
| **MLX (Apple Silicon)** | `q4`, `q8`, `bf16` | **runs on Mac *and iPhone*** — `drift-lab` desktop path |
| **Candle (Rust)** | `q8`, `bf16` | aligns with Drift's Rust/WASM orientation |

(`moshiko` = one voice, `moshika` = another; pick either as the voice-cloning base.)

**The size reality (decides where each tier runs):**

- bf16 = 15.4 GB; **MLX-q4 ≈ ~4–5 GB** → **too big for a browser tab, but it runs on Apple Silicon (Mac/iPhone) via MLX**, and in Rust via Candle-q8.
- **Training scale proves "don't pretrain":** Moshi used **7M hours audio + 1,016 H100 GPUs** (+2k h Fisher, +170 h supervised, +20k h synthetic). You **never** reproduce that — you fine-tune the CC-BY base or CSM-1B. This is the numeric proof behind §2's "no cheap small base from scratch."

**Mimi is browser-ready *today*:** a maintained ONNX export exists — [`onnx-community/kyutai-mimi-ONNX`](https://huggingface.co/onnx-community/kyutai-mimi-ONNX) — CC-BY, 12.5 Hz, 1.1 kbps, streaming, **8 codebooks for Moshi** (Mimi supports up to 32). So the codec half of the browser duplex loop is a download, not a port.

### What this changes in the plan — a **two-tier duplex deployment** (mirrors the text model)

| Surface | Duplex model | Runtime | Status |
|---------|--------------|---------|--------|
| **Desktop (`drift-lab`)** | **Moshi/PersonaPlex-style 7B**, fine-tuned on Drift dialog | **MLX-q4** (Apple Silicon) or Candle-q8 (Rust) | near-term — the base + backends already exist |
| **Browser (extension)** | **CSM-1B** RQ-split (§4b) | WebLLM/ORT-Web + Mimi-ONNX | R&D — the small-base bet |

The **desktop tier is a near-term win**: fine-tune `moshiko` with the PersonaPlex hybrid-prompt recipe (CC-BY base, MLX-q4 runs on the Mac you train on), ship the full 7B duplex experience in `drift-lab` **now**, while the browser CSM-1B path matures. Mimi (CC-BY, ONNX) is the **shared codec** across both tiers. This is the same "desktop runs the big model, browser runs the small one" split the text pipeline already uses.

## 4d. The fine-tuning engine — `moshi-finetune` (Apache-2.0), costed & runnable

[`kyutai-labs/moshi-finetune`](https://github.com/kyutai-labs/moshi-finetune) is the official trainer — and it makes the **desktop duplex tier a concrete, cheap, near-term build.** It's literally the tool PersonaPlex's recipe maps onto.

**What it is:** LoRA **or** full fine-tuning of Moshi, **Apache-2.0** (built on mistral-finetune), single-GPU capable.

**Cost reality (the unlock):**

| Setup | Peak mem | Throughput |
|-------|----------|-----------|
| **1× H100** | **39.6 GB** | ~12k tok/s |
| 8× H100 | 23.7 GB/GPU | ~10.7k tok/s |

A LoRA fine-tune of Moshi-7B runs on **a single H100 or A100-80GB** (~$0.44–2.40/hr in 2026) for a few hours → **~$5–15 total.** This is a weekend spike, not a research program.

**Data format (and how PersonaPlex's conditioning maps onto it):**

- Input = **stereo WAV**: **left = agent/model audio, right = user audio** (one file = one dialogue) + a JSONL of `{"path", "duration"}` + per-file transcript JSON with timestamps (auto-generated by **`annotate.py`**, SLURM-shardable).
- **PersonaPlex's Hybrid System Prompt is a *data-construction* layer, not a code feature** (moshi-finetune has no built-in role/voice conditioning). You encode it by **prepending a prompt segment** to each training clip: agent-audio channel = a **Kokoro voice sample** (→ voice clone), user-audio channel = **440 Hz sine**, agent-text transcript = the **role description** ("You are Drift, reviewing THIS scan…"), with delimiters before the dialogue. Then `annotate.py` transcribes and you train.
- **Drift's data pipeline:** Qwen generates scan-grounded two-speaker transcripts → Kokoro (agent voice) + varied voices (user) synthesize the two channels → prepend the hybrid-prompt segment → `annotate.py` → train.

**Hyperparameters already match PersonaPlex:** LR **2e-6**, weight decay 0.1, LoRA rank ≤128 (scaling 2), `duration_sec` 100, batch 16, ~2000 steps, a **first-codebook weight multiplier** (semantic emphasis) + **text-padding weight** — i.e. moshi-finetune's defaults *are* PersonaPlex's loss-balancing knobs. PersonaPlex just used more steps (24,576), batch 32, and full (not LoRA) FT on synthetic hybrid-prompt data. **Replicating it = moshi-finetune + the data above.**

**Inference of the result:** `python -m moshi.server --lora-weight=…/lora.safetensors` (server), **MLX** on Mac/iPhone, or **Rust/Candle** for production.

### Why this lands perfectly in `drift-lab`

- **`drift-lab` is Tauri (Rust)**, and **Moshi has a first-class Rust/Candle inference stack** (`rust/`, `moshi-cli`) → **native embedding, no Python at runtime.** Candle-q8 weights exist on HF.
- **Real-time on consumer Apple Silicon is proven:** MoshiVis on an **M4 Pro Mac Mini hits 55 ms/step — under the 80 ms real-time bar** for the 12.5 Hz Mimi codec; MLX tested on M3 MacBook Pro.

**So the desktop tier is a costed spike:** rent 1× H100 (~$10), generate synthetic hybrid-prompt data (Qwen + Kokoro), LoRA-fine-tune `moshiko` a few hours, deploy **Candle-q8 inside the Tauri `drift-lab`** (or MLX-q4) → a full 7B Drift duplex voice agent on the Mac, **now** — while the browser CSM-1B path matures.

## 4e. VERIFIED architecture & training spec (from source) + the shrink math

Pulled from the actual `moshi/models/loaders.py` and `moshi-finetune/example/moshi_7B.yaml` — the ground truth to build on, not summaries.

### The architecture, by the numbers

| Component | Config (verified) | ~Params | Role |
|-----------|-------------------|---------|------|
| **Temporal Transformer** (Helium) | `dim=4096, num_layers=32, num_heads=32, context=3000, hidden_scale=4.125, RoPE, RMSNorm` | **~7B** | the brain; predicts text + zeroth codebook per frame |
| **Depth Transformer** (Depformer) | `depformer_dim=1024, num_layers=6, num_heads=16, depformer_context=8` | **~100M** | predicts the 8 acoustic codebooks within each frame |
| **Mimi codec** | SEANet `dim=512, ratios=[8,6,5,4]`, transformer `d_model=512, 8 layers`, `n_q=32` (8 used), `bins=2048` | **~96M** | 24 kHz ↔ tokens, 12.5 Hz, streaming |
| Codebooks/vocab | `n_q=16, dep_q=8, card=2048 (audio), text_card=32000`, `context=3000` frames = **240 s** | — | 8 audio + 1 text = **9 streams/frame** |

### The latency law, now *proven* from the structure

Per 12.5 Hz frame: the **Temporal (7B) runs ONCE** (produces text + zeroth codebook + a context embedding); the **Depth (100M) runs 8×** (one per acoustic codebook). So:

- **Big model rate = 12.5 forward-passes/sec.** Depth = 100/sec but 70× smaller (≈ free).
- **Browser check:** 7B q4f16 in WebLLM ≈ 10–20 tok/s → **12.5/sec is marginal** (no headroom). 1.5B q4f16 ≈ 30–60 tok/s → **12.5/sec has 4–5× headroom** → comfortable real-time.
- **∴ the Temporal must shrink for the browser; the Depth + Mimi stay fixed.**

### The shrink math (7B → browser ~1.5B)

Drop the Temporal from `dim=4096, 32 layers` → roughly `dim≈2048, ~16–24 layers` ≈ **1–1.5B**, keep Depth (~100M) + Mimi (~96M). Total ≈ **1.2–1.7B → q4f16 ≈ 0.7–1.0 GB** → fits Chrome's ~4 GB tab.

**This exact instantiation already exists: Sesame CSM-1B** = ~1B Llama backbone + ~100M depth decoder + Mimi, RQ-split. So "shrink Moshi" = "start from CSM-1B," verified at the dimension level.

### The stream structure (why the base is *already* full-duplex) — and the Path-B fork

Decoding `n_q=16, dep_q=8` + the "9" in the token formula: per frame the model **ingests the user's 8 audio codebooks** (Mimi-encoded mic input) and **predicts 8 agent audio codebooks + 1 text token** (= 9 predicted streams). So **Moshi is full-duplex by construction** — the user-listening slot is *in the architecture*, consumed every frame while it speaks. That's how it "listens while speaking."

This precisely characterizes the Path-B fork:

- **Shrink Moshi (Path A-small):** keeps the live duplex stream, but there's **no small Moshi** → distill 7B→1.5B (compute-heavy).
- **Start from CSM-1B (Path B):** small + cheap + same RQ shape, **but CSM is trained for *conversational generation* (context-conditioned), not *live* full-duplex** → you **add live-user-stream training** (feed the user's 8 codebooks as input, the negative-silence/barge-in data from PersonaPlex §3.2). This is the genuine remaining R&D, now pinned to one concrete task: *teach CSM-1B to consume the live user codebook stream.*

### `first_codebook_weight_multiplier=100` → the faithfulness lever, located precisely

The config weights the **zeroth (semantic) codebook 100×** and text padding 0.5×. The zeroth codebook + the text inner-monologue carry **the linguistic content** ("what is said"); the Depth fills acoustic timbre. **So Drift's faithfulness constraint maps exactly onto the zeroth codebook + text stream** — the streams the *backbone* predicts and training already prioritizes 100×. Grounding the handover = grounding those two streams; the acoustic codebooks are timbre, not truth.

### The dual-loop ONNX export, now precise

- **Outer (Temporal):** 1 pass/frame, frame-level KV-cache over `context=3000`. Export as `decoder_model_merged` (q4f16).
- **Inner (Depth):** 8 passes/frame, `depformer_context=8` (tiny per-frame cache). Export as a small separate graph.
- **JS orchestration (the crux/IP):** `temporal.step() → for k in 0..8: depth.step(k) → Mimi.decode`. Two ONNX models, two nested loops driven in JS — the piece nobody has shipped.

### Training, verified (the operational defaults = PersonaPlex's recipe)

```yaml
moshi_paths: { hf_repo_id: "kyutai/moshiko-pytorch-bf16" }
full_finetuning: false
lora: { enable: true, rank: 128, scaling: 2.0, ft_embed: false }
first_codebook_weight_multiplier: 100.0   # semantic emphasis (= faithfulness lever)
text_padding_weight: 0.5
duration_sec: 100
batch_size: 16
max_steps: 2000
gradient_checkpointing: true
optim: { lr: 2e-6, weight_decay: 0.1, pct_start: 0.05 }
```

Single GPU: `torchrun --nproc-per-node 1 -m train example/moshi_7B.yaml`. Data = stereo WAV (L=agent, R=user) + JSONL `{"path","duration"}` + `annotate.py` transcripts. **PersonaPlex = this + synthetic hybrid-prompt data + more steps.**

## 5. The training recipe (lifted from PersonaPlex, adapted)

PersonaPlex's recipe is the gift — reuse it almost verbatim:

1. **Synthetic data — you already own the generators.** Transcripts from **Qwen** (PersonaPlex used Qwen3-32B + GPT-OSS-120B); speech from a **multispeaker/zero-shot TTS** — PersonaPlex used Dia/Chatterbox/Tortoise; **Drift uses Kokoro** as the voice-donor + TTS (free, on-device, consistent house voice). Generate **paired (role-prompt, voice-sample, two-speaker conversation)** grounded on **real Drift scan reports** so the agent learns *code-review* dialog, not customer service.
2. **Hybrid System Prompt:** text segment = "You are Drift, a code-review voice assistant for THIS scan: <scan>"; voice segment = a Kokoro voice sample → clones Drift's voice. Put **voice prompt first** (enables prefill when not cloning → lower latency, exactly PersonaPlex §3.1).
3. **Barge-in in data:** insert **negative-duration silence** between turns to teach interruption/overlap (PersonaPlex §3.2, validated by SALM-Duplex).
4. **Loss:** mask the system prompt; down-weight non-semantic audio ×0.02, padded text ×0.3 (Moshi/PersonaPlex token-imbalance fix).
5. **Init + short FT:** init the audio head (and LoRA the backbone), fine-tune — for 1.5B this is **cheaper than PersonaPlex's 6×8 A100-hours**. Rent A100s briefly to start; the fine-tune is small.
6. **Factuality (Drift's must-have):** keep **Inner Monologue** (text-before-audio per frame — it "improves factuality and linguistic quality"), and consider **MoshiRAG** (kyutai's *compact full-duplex + async retrieval for factuality*, [repo](https://github.com/kyutai-labs/moshi-rag)) — directly aligned with grounding answers in the scan.

---

## 6. Browser runtime architecture

```
 Side panel (WebGPU) — extends live-voice-agent-plan.md
 ┌──────────────────────────────────────────────────────────────┐
 │ mic 24kHz ─▶ Mimi ENCODER (ONNX/ORT-Web)  ─┐                  │
 │                                            ▼                  │
 │   ┌ duplex worker ───────────────────────────────────────┐   │
 │   │  Temporal Transformer (Qwen-1.5B, q4f16, WebLLM/ORT)  │   │
 │   │     │ hidden states + Inner-Monologue text           │   │
 │   │     ▼                                                 │   │
 │   │  Depth/Talker Transformer → Mimi audio tokens (K cb)  │   │
 │   └───────────────────────────┬───────────────────────────┘   │
 │                               ▼                              │
 │              Mimi DECODER (ONNX/ORT-Web) ─▶ 24kHz out        │
 └──────────────────────────────────────────────────────────────┘
   ▲ scan report = the role/grounding in the Hybrid System Prompt
```

- **Reuse the kernels, own the graph** (per the build-vs-reuse rule): Mimi enc/dec = ORT-Web (proven); backbone = WebLLM/MLC (q4f16, prebuilt Qwen) or transformers.js; **the Depth/Talker + the streaming RQ loop + barge-in = your custom orchestration** (the IP).
- **Inherit the whole [voice-plan §14 runtime](../drift-chrome-extension/docs/live-voice-agent-plan.md):** worker topology, KV-prewarm of the scan context, half-duplex echo gate, `permission.html` mic grant, OPFS/Cache weights, warm-up pass.

---

## 6b. Implementation roadmap — PyTorch architecture → train → ONNX → browser

This is the build order for the **end goal: the small duplex model running in-browser via ONNX.** Framed as principal ML engineer (architecture/training) + data scientist (data/eval). **No off-the-shelf browser duplex model exists — you implement it.** What's proven de-risks each step.

### The template that proves the whole path: `pocket-tts`

Kyutai's [`pocket-tts`](https://github.com/kyutai-labs/pocket-tts) is a **100 M** speech model that **already runs in-browser** — community exports: **`pocket-tts-onnx-export` (ONNX Runtime Web)**, `pocket-tts-candle` (Rust/WASM), and a JAX-JS port. It proves *"Kyutai speech model → ONNX → ORT-Web browser"* end-to-end. **Study/fork it first** — it's the reference for the export + streaming-decode glue.

### Build order

1. **Implement the architecture in PyTorch (don't start from scratch).** Two reuse anchors:
   - **CSM is native in HF Transformers** (`sesame/csm-1b`, `model_doc/csm`) — the RQ-split (Llama backbone predicts zeroth codebook + 100 M depth decoder predicts 1..N−1, Mimi). Start here; it's the closest open implementation of the target.
   - Swap/initialize the backbone toward **Qwen-1.5B-Coder** if you want the text-faithfulness lineage from the [text pipeline](./llm-finetune-pipeline.md); otherwise keep CSM's Llama-1B.
2. **Build the training data (data-scientist core).** Synthetic, scan-grounded, in moshi-finetune's **stereo-WAV format** (§4d): Qwen generates two-speaker code-review transcripts grounded on real Drift scans → Kokoro (agent voice) + varied voices (user) synthesize L/R channels → prepend the **hybrid system prompt** (voice sample + role text + 440 Hz sine) → `annotate.py` transcribes. **Diversity is the lever:** many voices, scan types, interruption patterns (negative-silence). Hold out a **Code-Review-Duplex-Bench** (your analog of PersonaPlex's Service-Duplex-Bench) for eval.
3. **Train/fine-tune in PyTorch on a rented GPU** — `moshi-finetune` (if CSM-compatible) or the CSM training path; LoRA rank ≤128, LR 2e-6, ~single H100, **~$10, a few hours** (§4d). Training is **never** in-browser.
4. **Export to ONNX via [Optimum](https://huggingface.co/docs/optimum)** — the hard step, done in pieces:
   - **Mimi enc + dec** → already done (`onnx-community/kyutai-mimi-ONNX`). Reuse.
   - **Backbone (Temporal)** and **Depth decoder** → export **separately**, each as a **`decoder_model_merged`** with `past_key_values` as graph inputs/outputs (the streaming KV-cache pattern transformers.js uses for Whisper/Moonshine). Quantize q4f16.
   - ⚠️ **The crux:** the **dual loop** (temporal frame-step ⟶ depth codebook-step) does **not** export as one ONNX graph. **Export the two transformers as separate ONNX models and orchestrate both loops in JS** — this is the piece nobody has shipped and **your core implementation work + IP.**
5. **Run in ORT-Web / transformers.js (WebGPU, WASM fallback)** — drive the RQ loop in JS: Mimi-encode mic frames → Temporal predicts zeroth codebook + inner-monologue text → Depth predicts remaining codebooks → Mimi-decode → audio; thread KV-cache across frames; barge-in = interrupt + flush. Reuse the entire [voice-plan runtime](../drift-chrome-extension/docs/live-voice-agent-plan.md) (workers, OPFS cache, mic grant, echo gate).
6. **Eval (data-scientist gate):** Full-Duplex-Bench metrics (turn-taking/interruption latency, TOR) + your Code-Review-Duplex-Bench (role adherence, scan-grounding faithfulness) + speaker-similarity (WavLM). Gate on **faithfulness** (does it only say what the scan supports) as the Drift-specific axis.

### What's proven vs. what you build

| Component | Status |
|-----------|--------|
| Mimi codec in ONNX/browser | ✅ exists (`onnx-community/kyutai-mimi-ONNX`) |
| Kyutai-model → ONNX → ORT-Web pipeline | ✅ proven (`pocket-tts-onnx-export`) |
| CSM architecture (PyTorch) | ✅ in HF Transformers |
| KV-cache `decoder_model_merged` ONNX export | ✅ standard (Whisper/Moonshine in transformers.js) |
| Backbone + Depth ONNX export, quantized | ⚠️ you do it (Optimum) |
| **Dual-loop RQ streaming orchestration in JS** | ❌ **you build it — the crux + the IP** |
| Full-duplex listening stream at ~1B in-browser | ❌ frontier (start half-duplex, add the stream) |

### Reference shelf for implementation
- [`pocket-tts`](https://github.com/kyutai-labs/pocket-tts) + `pocket-tts-onnx-export` (the export+browser template) · [Mimi-ONNX](https://huggingface.co/onnx-community/kyutai-mimi-ONNX) · [CSM in Transformers](https://huggingface.co/docs/transformers/main/model_doc/csm) · [`moshi-finetune`](https://github.com/kyutai-labs/moshi-finetune) (trainer) · [Optimum ONNX export](https://huggingface.co/docs/optimum) · [transformers.js](https://github.com/huggingface/transformers.js) (ORT-Web + WebGPU + KV-cache pattern).

## 7. "Better / faster / more efficient" — the concrete levers

1. **4× smaller backbone** (1.5–2B vs 7B Helium) → browser-fits + faster.
2. **4-bit** (q4f16) vs PersonaPlex BF16 → ~4× smaller weights.
3. **Fewer Mimi codebooks** (8→4) if quality holds → fewer Depth-Transformer steps/frame → lower per-frame latency.
4. **T-Mimi-style** efficient transformer decoder for the codec on weak GPUs.
5. **Prompt prefill** (voice-first hybrid prompt) → cut first-response latency (PersonaPlex already exploits this).
6. **Inner Monologue + retrieval (MoshiRAG)** → factuality without a bigger model — the cheap way to beat PersonaPlex *on Drift's axis* (grounded correctness), even if we never beat its 7B naturalness.

The realistic claim is **not** "beat PersonaPlex on naturalness" (it's 7B) — it's **"match its duplex interactivity at ≤2B, add code-scan grounding, and run it where it can't: the browser."** That's a defensible, novel result.

---

## 8. Honest risks & the staged roadmap

**Risks (no hand-waving):**
- **Small duplex base is the cost center** — there's no Moshi-1.5B; Path B means *building* the audio head (real ML work), Path A means *distillation* (real compute). Neither is the "6 GPU-hours" PersonaPlex quotes.
- **4 streaming models in-tab** at interactive latency is unproven for full-duplex; Mimi alone is proven.
- **Quality at 1.5B** — duplex + 4-bit + small backbone may degrade naturalness; the SALM-Duplex result says small *can* win, but it's not guaranteed for our data.

**Roadmap:**
- **Phase 0 (now) — Ship the cascade** ([voice plan](../drift-chrome-extension/docs/live-voice-agent-plan.md)). It already "talks and stops." Don't block it on this R&D.
- **Phase 1 — Learn the stack on a server.** Run PersonaPlex/Moshi (it has **MLX/Apple-Silicon + Rust + web** stacks) on a desktop/cloud A100; prove the Drift-grounded role+voice use case end-to-end at 7B. This is "start developing" today, no browser constraint.
- **Phase 2 — Build the small base (Path B).** Qwen-1.5B + Mimi + Depth/Talker + Inner Monologue; train half-duplex "talks" on Kokoro-generated grounded dialog. Browser-deploy via ORT-Web (Mimi) + WebLLM (backbone).
- **Phase 3 — Add the user-audio stream → pseudo/full duplex** with the negative-silence barge-in recipe; integrate the voice-plan runtime.
- **Phase 4 — Efficiency pass** (codebook reduction, T-Mimi decoder, quant tuning) + factuality (MoshiRAG).

---

## 9. Reference shelf
- **PersonaPlex** — [paper](https://arxiv.org/abs/2602.06053) · [code (MIT)](https://github.com/NVIDIA/personaplex) · [model (NVIDIA Open Model License)](https://huggingface.co/nvidia/personaplex-7b-v1) — 7B, Moshi-based, A100-80GB.
- **Moshi/Mimi** — [paper](https://arxiv.org/abs/2410.00037) · [code](https://github.com/kyutai-labs/moshi) (MLX + Rust + web stacks) · [Mimi in-browser](https://www.frisson-labs.com/mimi-codec).
- **Efficient/small duplex** — [SALM-Duplex](https://arxiv.org/html/2505.15670v1) (NVIDIA, TinyLlama) · Sesame CSM (1B) · [T-Mimi mobile decoder](https://arxiv.org/html/2601.20094v1) · [MoshiRAG](https://github.com/kyutai-labs/moshi-rag) (compact duplex + retrieval).
- **Data generators (already in Drift):** Qwen (transcripts) + Kokoro (voice/TTS).
- **Bench:** Full-Duplex-Bench; PersonaPlex's Service-Duplex-Bench extension (build a **Code-Review-Duplex-Bench** analog for Drift).
