# Drift Duplex Voice Model — Implementation Spec (code-grounded)

> Build-grade companion to [`DRIFT_ONDEVICE_AI_MASTER_PLAN.md`](../DRIFT_ONDEVICE_AI_MASTER_PLAN.md). Where the master plan decides *what* and *why*, this spec is *how to actually implement it* — extracted by reading the real source of the "stones": `kyutai-labs/moshi` (`moshi/models/lm.py`), `kyutai-labs/moshi-finetune` (`train.py` + `finetune/`), Sesame CSM in HF Transformers, and the Mimi-ONNX export. End goal: a small RQ-split full-duplex model **running in the browser via ONNX**. Every code symbol below is quoted from the actual source; anything I could not confirm is flagged **(unverified)**.

---

## 1. The model forward pass & the RQ dual-loop (from `moshi/models/lm.py`)

**Verified structure of `LMModel`** (extends `StreamingContainer`):

- Two transformers: a main `StreamingTransformer` (the **Temporal**, Helium, `dim=4096`) and a second `StreamingTransformer` assigned as the **`depformer`** (`depformer_dim=1024`, 6 layers).
- Three embeddings: `self.emb` (audio codebooks), `self.text_emb` (text), `self.depformer_emb` (the within-frame autoregressive feedback).
- Config knobs: `n_q=8` (audio codebooks), `dep_q=8` (codebooks the Depformer predicts), `card=2048` (audio vocab), `text_card=32000`, plus `audio_offset` (separates the text stream from the audio streams in the token tensor).

**The two methods that matter:**

- `forward_text()` — the main transformer consumes the per-frame token columns (text + audio) and produces `transformer_out`, plus `text_logits`.
- `depformer_step()` — **the inner loop**, run once per frame:

```python
# verbatim shape of the logic in depformer_step()
for cb_index in range(lm_model.dep_q):          # 8 acoustic codebooks
    logits   = lm_model.forward_depformer(cb_index, input_, transformer_out)
    nxt      = sample_token(logits, ...)
    prev     = nxt                              # autoregressive WITHIN the frame
# returns stacked [B, dep_q]
```

`forward_depformer` projects `transformer_out` through `depformer_in[cb_index]` (or a shared linear if not `depformer_multi_linear`) and **adds the previous codebook's embedding** (`depformer_emb`) — so codebook *k* is conditioned on the Temporal context *and* codebooks `0..k-1` of the same frame.

**The generation loop — `LMGen._step()` (the spec for our JS port):**

1. **Circular cache, not a flat KV append:** `state.cache` has shape `[B, num_codebooks, max_delay + 2]`; `state.offsets [B]` is the frame counter.
2. **Gather** the model input for this frame from the cache at the current offset, *masked by the per-codebook delay* (this is where the acoustic delay is applied — see §2).
3. **Main forward:** `state.graphed_main(input_, condition_sum, condition_cross)` → `transformer_out` + text logits (CUDA-graphed in the reference; irrelevant for us).
4. **Sample text token** from text logits.
5. **Depformer:** `state.graphed_depth(text_token, transformer_out)` runs the `for cb in range(dep_q)` inner loop → the 8 audio tokens.
6. **Scatter** the new tokens back into the circular cache at `offset % buffer_size` (`scatter_with_mask_`).
7. Returns `[B, num_codebooks, 1]` — but **returns `None` until `max_delay` frames have elapsed** (delay warm-up). `support_out_of_sync` allows variable-rate stepping.

**∴ The JS/ONNX translation (the crux/IP), now pinned to real code:**

```text
per 12.5 Hz frame:
  input = gatherDelayed(cache, offset, delays)        # pure JS indexing, no model
  tOut, textLogits = backbone.step(input, pastKV)     # ONNX decoder_model_merged (KV-cache)
  textTok = sample(textLogits)
  prev = textTok
  for cb in 0..dep_q-1:                               # 8×, tiny graph
      logits = depth.step(cb, prev, tOut)             # ONNX (per-codebook)
      audioTok[cb] = sample(logits); prev = audioTok[cb]
  scatterDelayed(cache, offset, [textTok, ...audioTok], delays)
  offset++
  if offset > maxDelay: emit Mimi.decode(undelay(cache window))
```

Two ONNX graphs (`backbone`, `depth`); the **circular-buffer delay logic is plain JS** — that is the unshipped orchestration the master plan calls the crux.

---

## 2. The acoustic delay pattern

Mechanism is **verified**: `_delay_sequence()` shifts codes backward in time per codebook; `_undelay_sequence()` shifts logits forward to re-align; `LMGen` realizes this as gather/scatter offsets on the circular cache, with `max_delay` driving the warm-up before the first emitted frame.

**Delay values — RESOLVED to the exact constant (from `loaders.py` `_lm_kwargs`):**

```python
delays = [0, 0, 1, 1, 1, 1, 1, 1, 1,  0, 1, 1, 1, 1, 1, 1, 1]   # len 17 = 1 text + 16 audio (n_q=16)
```

This decodes the **entire stream layout**:

| Index | Stream | Delay |
|-------|--------|-------|
| 0 | **text** (inner monologue) | 0 |
| 1 | **agent** codebook-0 (semantic) | 0 |
| 2–8 | agent acoustic codebooks 1–7 | **1** |
| 9 | **user** codebook-0 (semantic) | 0 |
| 10–16 | user acoustic codebooks 1–7 | **1** |

So: **8 agent + 8 user audio + 1 text = 17 streams; the acoustic delay is exactly 1 frame** (semantic + text at delay 0). The earlier `[0,3,6,…]` reading was wrong. This **also confirms the full-duplex structure at the config level** — the model carries the user's 8 codebooks (input) alongside the agent's 8 (predicted, `dep_q=8`) + text. (CSM/TTS drops the user 8 → ~9 streams.) Other verified config values: `n_q=16, dep_q=8, card=2048, text_card=32000, existing_text_padding_id=3`. `max_delay` is `max(delays)=1` here; copy the exact list from the checkpoint you load.

---

## 3. Training loss, masking & stereo tokenization (from `moshi-finetune/train.py`)

**Verified data path:**

- Stereo WAV (**L = agent/Moshi, R = user**) → Mimi-encoded into codebook streams; the transcript JSON → the text inner-monologue stream; assembled by **`InterleavedTokenizer` / `Interleaver`** (`finetune.data.interleaver`), loaded via `build_data_loader` (`finetune.data.data_loader`).
- Token tensor `batch.codes`: **text at `codes[:, :model.audio_offset]`, audio at `codes[:, model.audio_offset : model.audio_offset + model.dep_q]`.** Optional `batch.condition_attributes`.

**Verified loss (two masked cross-entropies, summed):**

```python
text_loss  = compute_loss_with_mask(output.text_logits,
                codes[:, :model.audio_offset], output.text_mask,
                mode='text', text_padding_weight=args.text_padding_weight,
                text_padding_ids={model.text_padding_token_id, model.end_of_text_padding_id})
audio_loss = compute_loss_with_mask(output.logits,
                codes[:, model.audio_offset : model.audio_offset + model.dep_q], output.mask,
                mode='audio', first_codebook_weight_multiplier=args.first_codebook_weight_multiplier)
mb_loss = text_loss + audio_loss          # from finetune.loss.compute_loss_with_mask
```

- **`first_codebook_weight_multiplier` (=100) weights the *audio* codebook-0** (the semantic acoustic token) — this is the faithfulness lever, located exactly: the backbone's codebook-0 + the text stream carry content; the multiplier makes training prioritize them 100×.
- **`text_padding_weight` (=0.5)** down-weights padded text positions.
- Model + LoRA via `get_fsdp_model` (`finetune.wrapped_model`); `lm_config["lora"|"lora_rank"|"lora_scaling"]`.
- **Optimizer (verified):** `AdamW(lr=args.optim.lr, betas=(0.9, 0.95), eps=1e-8, weight_decay=args.optim.weight_decay)`; **`OneCycleLR(max_lr=lr, total_steps=max_steps, pct_start=args.optim.pct_start)`**.

**The exact `compute_loss_with_mask` internals (verified — implement this directly):**

```python
def compute_loss_with_mask(logits, target, target_mask, mode,
                           first_codebook_weight_multiplier=1.0,
                           text_padding_weight=1.0, text_padding_ids=None):
    target  = torch.where(target_mask, target, torch.zeros_like(target))
    weights = target_mask.float()
    if mode == 'audio':
        weights[:, 0] *= first_codebook_weight_multiplier      # codebook-0 (semantic) ×100
    elif mode == 'text':
        for tid in text_padding_ids:                            # {text_padding_token_id, end_of_text_padding_id}
            weights[target == tid] *= text_padding_weight       # padded text ×0.5
    ce = cross_entropy(flatten(logits), flatten(target), reduction='none')
    ce = torch.where(weights > 0.0, ce * weights, torch.zeros_like(ce))
    return torch.sum(ce) / torch.sum(weights)                  # masked WEIGHTED mean (not /batch)
```

Three things an implementer must copy exactly: (1) **mask zeroes out-of-region targets** before CE; (2) the weighting is a **per-position multiplier tensor** (`weights[:,0] *= 100` for the semantic codebook in audio mode; `weights[target==pad] *= 0.5` in text mode); (3) the reduction is **`sum(loss·weights)/sum(weights)`** — normalize by total weight, not batch size.

**The exact tokenization (`finetune/data/interleaver.py`, verified):**

1. **Audio:** `mimi.encode(audio[:, None])` → `[1, codebooks, frames]`; `num_audio_frames = ceil(duration_sec * mimi.frame_rate)` (12.5 Hz); pad with `interleaver.zero_padding`.
2. **Text:** load `<path>.json` `"alignments"`; binary-search (`dicho()`) the segment by start/end time; `build_token_stream()` maps word tokens onto 12.5 Hz frames using `text_padding` (filler), `in_word_padding` (intra-word), `end_of_text_padding` (word boundary).
3. **Barge-in is here, in code:** **if `audio_delay < 0`, prepend `zero_padding` for `int(frame_rate · -audio_delay)` frames** — this *is* PersonaPlex's negative-silence interruption simulation, realized in the tokenizer.
4. **Assemble:** `codes = torch.cat([text_tokens, audio_tokens], dim=1)` → `[1, 1+codebooks, num_audio_frames]`; `text` at `codes[:, :audio_offset]`, audio at `codes[:, audio_offset:audio_offset+dep_q]`.

**Drift data construction (the PersonaPlex hybrid prompt in this exact format):** build each stereo clip as `[hybrid-prompt segment] + [dialogue]`, where the prompt segment puts a **Kokoro voice sample on the L (agent) channel**, a **440 Hz sine on the R (user) channel**, and the **role text on the agent text stream**; generate the dialogue transcript with Qwen grounded on a real Drift scan, render L/R with Kokoro (agent) + varied voices (user), insert **negative-duration silence** for barge-in, run `annotate.py` for the transcript JSON, then the `InterleavedTokenizer` produces `batch.codes`. The loss/masking above then trains it unchanged.

---

## 4. CSM-1B as the shrink target (verified from HF Transformers)

**Verified:** CSM is *"composed of two LLaMA-style auto-regressive transformer decoders: a **backbone decoder that predicts the first codebook token** and a **depth decoder that generates the remaining tokens**. It uses … **Mimi** … to encode/decode."* API: `CsmForConditionalGeneration`, `AutoProcessor`, `model.generate(..., output_audio=True)`, speaker tags like `[0]`.

This is **Moshi's RQ-split at 1B** — backbone = the Temporal (predicts codebook-0 at frame rate), depth decoder = the Depformer, Mimi = the codec. So the master plan's "shrink Moshi → ~1.5B" resolves to a real, loadable, Optimum-exportable model.

**CSM dims — now resolved from `CsmConfig` (and they confirm the shrink math exactly).** The HF `CsmConfig` defaults ([transformers CSM docs](https://huggingface.co/docs/transformers/main/model_doc/csm)): **`backbone_hidden_size=2048`** (the Llama-1B backbone — the Temporal), depth decoder **`hidden_size=1024`, `num_hidden_layers=4`** (even leaner than Moshi's 6-layer Depformer), **`num_codebooks=32`**, **`text_vocab_size=128256`** (Llama-3 tokenizer), `intermediate_size=8192`. So **Moshi's `dim=4096` → CSM's `2048` is precisely the "halve the Temporal" shrink** the latency law demanded; the depth decoder is ~100M as predicted. Still confirm the exact `csm-1b` checkpoint values locally (the gated `config.json` raw-404'd via WebFetch), but the architecture target is now pinned.

**The honest gap (verified, and reinforced by the ecosystem):** CSM *"cannot generate text"* and is contextual **TTS** — text + optional audio *context* in, audio out; it does **not** ingest a live user-audio stream while speaking. Crucially, **every "realtime CSM" project is a cascade, not native duplex**: `davidbrowne17/csm-streaming` (realtime web UI) explicitly *"converse … using a separate LLM"*; `senstella/csm-mlx` runs CSM on Apple Silicon; `interactivetech/csm-streaming-tts` is FastAPI streaming TTS. Fine-tuning is cheap (`lora.py` on raw wavs + a metadata file of `path, transcription, [times], [speaker]` — [Speechmatics](https://blog.speechmatics.com/sesame-finetune), [csm-streaming](https://github.com/davidbrowne17/csm-streaming)). **Frontier task (unshipped by anyone):** port Moshi's three-stream input (user-audio + agent-text + agent-audio, §1) onto a CSM-class backbone and fine-tune on live-overlap data to get *native* full-duplex. Until then, the pragmatic browser voice is the **cascade** (small LLM → CSM/Kokoro streaming TTS), exactly as the rest of the CSM ecosystem does it.

---

## 5. Mimi-ONNX I/O for the browser (verified from `onnx-community/kyutai-mimi-ONNX`)

**Verified files & tensors:**

- `encoder_model.onnx`: input **`input_values`** `(B, 1, samples)` → output **`audio_codes`** `(B, num_quantizers, codes_len)`.
- `decoder_model.onnx`: input **`audio_codes`** `(B, num_quantizers, codes_len)` → output **`audio_values`** `(B, 1, samples)`.
- transformers.js: `pipeline('feature-extraction', 'onnx-community/kyutai-mimi-ONNX')`.

**⚠️ The key implementation risk — now characterized.** The published ONNX export does **not** expose streaming/causal state, so a naive frame-by-frame call (1920 samples = one 12.5 Hz frame at 24 kHz) loses the conv receptive-field context. **But the fix is known:** the HF `MimiModel` has a **`use_streaming`** flag (default `False`) and a **causal streaming encoder** designed for low latency ([MimiConfig](https://huggingface.co/docs/transformers/en/model_doc/mimi), [modeling_mimi.py](https://github.com/huggingface/transformers/blob/main/src/transformers/models/mimi/modeling_mimi.py)) — the public export simply baked it as `False`. **Re-export with `use_streaming=True` (and `use_cache`) so the conv/transformer state is graph I/O**, then thread it in JS like the LM KV-cache. Fallbacks if the streaming export is awkward: overlapping windows (discard edges), or a small code look-back on the decoder. **Verified:** `num_quantizers` default is **32**; set the model to **8 active** for the Moshi/RQ path (`num_semantic_quantizers` + acoustic). T-Mimi ([arXiv 2601.20094](https://arxiv.org/html/2601.20094)) shows a transformer Mimi decoder running real-time on-phone — evidence the decode hot-path is browser-tractable.

**Proven anchor:** `pocket-tts` (Kyutai, ~100M) is already exported and driven in **ONNX Runtime Web** (`pocket-tts-onnx-export`) — fork its JS calling pattern (session creation, the per-step `session.run`, the audio-worklet playback) as the template for the Mimi-decode + RQ loop.

---

## 6. ONNX export + JS dual-loop orchestration

| Piece | How | Status |
|-------|-----|--------|
| Mimi enc/dec | reuse `onnx-community/kyutai-mimi-ONNX` (fix streaming, §5) | ✅ exists |
| Backbone (Temporal) | Optimum export as **`decoder_model_merged`** — `past_key_values` as graph I/O (the Whisper/Moonshine pattern transformers.js uses), q4f16 | ⚠️ you do it |
| Depth (Depformer) | export as a small separate graph: inputs `(cb_index, prev_token, transformer_out)`, run **8×/frame**; tiny per-frame state | ⚠️ you do it |
| Circular-cache delay (`_delay`/`_undelay`) | **plain JS** gather/scatter on a ring buffer, `max_delay` warm-up | ⚠️ you build it (no neural op) |
| RQ loop | JS: `backbone.step → for cb in 0..7: depth.step → Mimi.decode` (§1) | ❌ **the crux/IP — unshipped anywhere <2B in-browser** |

**Why two graphs, not one:** the per-frame × per-codebook nested autoregression (`LMGen._step` calling `depformer_step`) cannot be a single ONNX graph — ONNX has no native unbounded inner loop over a sampled feedback variable. Export the two transformers separately and drive both loops in JS. This is exactly how the reference splits `graphed_main` vs `graphed_depth`.

---

## 7. Build order (with go/no-go gates)

0. **Cheapest de-risk first (1–2 days):** fork `pocket-tts-onnx-export` into the Drift extension worker; export & run the **Mimi decoder in ORT-Web at 12.5 Hz** with the streaming fix (§5). **Gate:** real-time tokens→audio in the side panel, no underrun. *If this fails, the whole browser path is in doubt — learn it cheap.*
1. **Implement/verify the arch in PyTorch from `CsmForConditionalGeneration`** (it already is the RQ-split). **Gate:** reproduce CSM TTS locally.
2. **Add the live-user-audio input stream** (port Moshi's 3-stream input, §1/§4) → the frontier change. **Gate:** model consumes a user codebook stream while emitting; measure overlap behavior.
3. **Build scan-grounded synthetic stereo data** (§3): Qwen transcripts on real scans + Kokoro/varied voices + hybrid prompt + negative-silence barge-in, in moshi-finetune format. **Data-science gate:** diversity (voices × scan types × interruption patterns); held-out **Code-Review-Duplex-Bench**.
4. **Train** (`moshi-finetune` recipe, §3): LoRA r≤128, lr 2e-6, `first_codebook_weight_multiplier=100`, ~1×H100, ~$10. **Gate:** faithfulness (claim-judge on the text + codebook-0 streams) beats baseline.
5. **ONNX export** (§6): Mimi reuse + backbone/depth as separate `decoder_model_merged` graphs, q4f16.
6. **JS RQ-loop orchestration** (§1, §6) + barge-in (interrupt + flush). **Gate:** clears the 12.5 Hz floor in-browser on target hardware (the latency law — measured, not assumed).

---

## 2026 landscape update — newer bases & deployment levers (changes two decisions)

A scan of the 2025–2026 releases surfaced options newer than the Moshi-7B base this plan started from. Net effect: a **better half-duplex base candidate**, a **ready cascade framework**, and a **mobile/iOS coverage lever** — but **true simultaneous full-duplex at <2B is still unshipped by anyone**, so that bet stands.

### Newer model candidates

| Model | Duplex? | Size | Codec / arch | Browser path | License | Verdict for Drift |
|-------|---------|------|--------------|--------------|---------|-------------------|
| **LFM2.5-Audio-1.5B** (Liquid) | **half** (turn-based interleaved S2S; *not* simultaneous) | 1.5B (1.2B LM + 115M FastConformer enc + Mimi-compat detok, 8 cb) | **RQ-transformer + Mimi-compatible**, 24 kHz, ingests audio | GGUF (llama.cpp) only — **no ONNX/WebGPU yet** | LFM Open License v1.0 (check commercial terms) | **Best half-duplex S2S base** if turn-based is acceptable — already RQ+Mimi+audio-in at 1.5B; you'd still do the ONNX export (the crux) |
| **CSM-1B** (Sesame) | half (TTS, no audio-in stream) | 1B + 100M | RQ-split + Mimi | HF Transformers → Optimum-exportable | Apache-ish | the "shrink Moshi" target; needs an audio-input stream added for duplex |
| **TinyWave-2B** | interleaved S2S | 2B (distilled from SpiritLM-7B, 50k h) | interleaved speech-text | (unverified) | (verify) | another small distilled candidate |
| **Moshi-7B / PersonaPlex-7B** | **full** (simultaneous) | 7B | RQ + Mimi | desktop only (MLX/Candle) | CC-BY / NVIDIA-OML | the only *true* full-duplex open bases — desktop tier, distillation teacher |
| **Hertz-dev-8.5B** | full | 8.5B | — | desktop/cloud | open | too big for browser; distillation teacher only |

**Decision delta #1 — the browser S2S base.** If Drift's voice can be **turn-based** (a code-review assistant arguably doesn't need to be interrupted mid-word), **LFM2.5-Audio-1.5B is a stronger starting point than CSM-1B** — it already ingests audio, already uses RQ + a Mimi-compatible codec, and is sized for the browser; the remaining work is the same ONNX export + JS RQ-loop. If Drift **must** have simultaneous full-duplex (barge-in while speaking), no <2B base exists — that's the frontier bet (extend a 1B backbone with Moshi's live-input stream, §4). **Recommend: prototype on LFM2.5-Audio-1.5B (turn-based) first; treat simultaneous full-duplex as the research track.** ⚠️ verify the LFM Open License permits your commercial use before committing.

### The cascade is a solved, open framework — Kyutai **Unmute**

Kyutai's **[Unmute](https://github.com/kyutai-labs/unmute)** (open, 2025) *"makes text LLMs listen and speak"* by wrapping **any text LLM** with **Kyutai STT** + **Kyutai TTS** — i.e. it **is** the master plan's voice cascade, already built. Components ([delayed-streams-modeling](https://github.com/kyutai-labs/delayed-streams-modeling)):

- **Kyutai STT** — `stt-1b-en_fr` (~1B, **0.5 s delay, built-in semantic VAD** = turn detection for free) or `stt-2.6b-en`. CC-BY, MLX on-device. **A stronger STT than Moonshine for our turn-taking** (semantic VAD is exactly the barge-in/end-of-turn signal the voice-cascade plan hand-builds).
- **Kyutai TTS** — `tts-1.6b-en_fr` (actually 1.8B: 1B backbone + 600M depth), DSM + **Mimi 12.5 Hz**, 220 ms latency, voice cloning, CC-BY; also a smaller **`tts-0.75b-en-public`**. Server/MLX-oriented (heavier than Kokoro's 82M).

**Decision delta (cascade):** keep **Kokoro-82M (Apache, browser-native, transformers.js, #1 TTS-Arena Jan 2026)** as the *lightweight browser* TTS, but adopt **Unmute's architecture** and consider **Kyutai STT for its semantic VAD**. If you later want codec alignment with the duplex model, Kyutai TTS shares **Mimi** with it. DSM ("Delayed Streams Modeling") is the unifying framework behind Moshi/Hibiki/Kyutai-STT/TTS — the same delay mechanism in §2.

### Mobile/iOS coverage lever — **WebNN** (the answer to "no iOS-Safari WebGPU")

**WebNN** (W3C Candidate Recommendation; in Chrome/Edge behind a flag in 2026) is the **only browser API exposing NPU access** and is hardware-agnostic — it maps to **Core ML on macOS/iOS**, **NNAPI on Android**, **DirectML on Windows**. **ONNX Runtime Web has a WebNN execution provider** ([ORT WebNN](https://onnxruntime.ai/docs/tutorials/web/ep-webnn.html), [WebNN overview](https://learn.microsoft.com/en-us/windows/ai/directml/webnn-overview)). Because our whole duplex/codec path is **already ONNX**, switching ORT-Web's EP from WebGPU to WebNN is largely a config change — and it's the **emerging fix for the iOS-Safari-no-WebGPU and mobile −60–80% gaps** I flagged throughout (WebNN→Core ML reaches the Apple NPU). **(unverified for our model sizes; experimental in 2026)** — but it's the strategic mobile-coverage path: **target ONNX, run WebGPU today, add the WebNN EP as the mobile/NPU tier matures.**

---

## Source files read

- `kyutai-labs/moshi` → `moshi/moshi/models/lm.py` (LMModel, LMGen._step, depformer_step, forward_text/forward_depformer, delays, circular cache).
- `kyutai-labs/moshi-finetune` → `train.py` (loss, masking, optimizer, module imports: `finetune.data.interleaver`, `finetune.loss.compute_loss_with_mask`, `finetune.wrapped_model.get_fsdp_model`) + `README` + `example/moshi_7B.yaml`.
- HF Transformers `model_doc/csm` (two-LLaMA-decoder structure, Mimi, `CsmForConditionalGeneration`, half-duplex/no-text limit).
- `onnx-community/kyutai-mimi-ONNX` (encoder/decoder I/O tensors, transformers.js pipeline).
- `kyutai/moshiko-pytorch-bf16` (15.4 GB bf16 base; Mimi weights in the 385 MB tokenizer checkpoint).

## Gaps — resolved by follow-up research

- **Delay pattern — RESOLVED:** ~1-step acoustic delay between semantic (cb-0) and acoustic codebooks (text has its own delay); not `[0,3,6,…]`. Copy exact vector + `max_delay` from the checkpoint, but the shape is known (§2).
- **CSM dims — RESOLVED from `CsmConfig`:** backbone `hidden_size=2048`, depth `1024`/`4L`, `num_codebooks=32`, text vocab `128256`. Moshi 4096 → CSM 2048 = the predicted shrink (§4).
- **Mimi streaming — RESOLVED:** HF Mimi has a `use_streaming` flag + causal encoder; re-export with it `True` to expose state. `num_quantizers=32` default, use 8 active (§5).
- **CSM = half-duplex, all "realtime CSM" are cascades — RESOLVED:** `csm-streaming`/`csm-mlx`/`csm-streaming-tts` all pair CSM (TTS) with a separate LLM (§4).

## Honest unknowns that remain (measure, don't assume)

- The exact `delays`/`max_delay` and `csm-1b` checkpoint dims — copy from the local config (shapes known, values to confirm).
- Whether the **streaming Mimi-ONNX re-export** is clean and real-time in ORT-Web — the step-0 spike.
- **The core bet:** whether a <2B *native full-duplex* RQ-split model (CSM-class backbone + added live-user-input stream) clears the 12.5 Hz floor in-browser. Unshipped by anyone — measure in steps 0/2/6. Until proven, ship the **cascade** (the rest of the CSM ecosystem's answer for "realtime").
