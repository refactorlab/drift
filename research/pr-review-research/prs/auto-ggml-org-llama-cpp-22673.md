# ggml-org/llama.cpp #22673 — llama + spec: MTP Support 

**[View PR on GitHub](https://github.com/ggml-org/llama.cpp/pull/22673)**

| | |
|---|---|
| **Author** | @am17an |
| **Status** | ✅ merged |
| **Opened** | 2026-05-04 |
| **Repo importance** | ★114,713 · 19,193 forks · score 196,483 |
| **Diff** | +2226 / −412 across 54 files |
| **Engagement** | 420 conversation · 43 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @cmp-nct — 61 reactions  
`👍 16 · ❤️ 40 · 👀 5`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/22673#issuecomment-4371354015)

> in my opinion Qwen 3.6 is the most important thing that happened in open source models in a long time, this is going to be so valuable. 
> I wonder if this, once merged, could be combined with ngram drafting ?
> So MTP is used until ngram is triggered - switching to ngram until rejection and back to MTP
> 
> ngram could be set to match only very strong and long candidates - for large repetitive paraphrasing
> and MTP fills the gap

### @Dampfinchen — 43 reactions  
`👍 1 · 🎉 42`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/22673#issuecomment-4381126079)

> Google has just released the MTP layers for Gemma 4:
> 
> https://huggingface.co/google/gemma-4-26B-A4B-it-assistant
> https://huggingface.co/google/gemma-4-31B-it-assistant
> https://huggingface.co/google/gemma-4-E4B-it-assistant
> https://huggingface.co/google/gemma-4-E2B-it-assistant

### @wsbagnsv1 — 40 reactions  
`👍 40`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/22673#issuecomment-4382557171)

> With all the current mainstream ggufs being without mtp would it maybe make sense to allow a secondary gguf with the mtp tensors to be loaded instead of just 1 file with both the main and mtp model?

### @cturan — 38 reactions  
`👍 23 · 🚀 12 · 👀 3`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/22673#issuecomment-4372285675)

> Thank you, we are eagerly awaiting this to become stable, here automated test results for my machine;
> 
> __
> Qwen3.6-27B Q6_K benchmark on llama.cpp b9025-10829dbcc / PR #22673 branch
> Hardware: RTX 3090 24GB + RTX 3060 12GB
> Runtime flags: `-fa on -c 10000 -np 1 -ngl 99 --no-mmap --no-cache-prompt`
> Endpoint: `/completion`, raw text prompt
> Prompt: 6978 tokens
> Generation: 256 tokens
> Runs: 3 measured runs after warmup
> 
> | mode | model | prefill tok/s avg | generation tok/s avg | MTP acceptance | loaded VRAM |
> |---|---|---:|---:|---:|---:|
> | MTP enabled | Qwen3.6-27B-MTP-Q6_K.gguf + `--spec-type mtp --spec-draft-n-max 3` | 665.14 | 42.45 | 76.0% | 24.96 GiB |
> | MTP disabled, same GGUF | Qwen3.6-27B-MTP-Q6_K.gguf, no spec | 1315.46 | 22.97 | n/a | 22.47 GiB |
> | Existing non-MTP Q6 | Qwen3.6-27B-Q6_K.gguf, no spec | 1260.12 | 22.39 | n/a | 22.59 GiB |
> 
> Result:
> - MTP improves decode from 22.97 tok/s to 42.45 tok/s on the same GGUF: ~1.85x speedup.
> - Against the existing non-MTP Q6 file, decode improves from 22.39 tok/s to 42.45 tok/s: ~1.90x speedup.
> - Prefill is slower with MTP enabled in this PR path: 665 tok/s vs 1315 tok/s on the same GGUF (~0.51x).
> - MTP adds about 2.49 GiB loaded VRAM in this setup.

### @pwilkin — 30 reactions  
`👍 2 · 🚀 28`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/22673#issuecomment-4370369885)

> Great work, this should massively bridge the TG gap with vLLM, or maybe even surpass it together with tensor-parallel.

### @am17an — 16 reactions  
`👍 12 · ❤️ 4`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/22673#issuecomment-4371483712)

> @cmp-nct I'm not sure, but could be possible
> 
> @Dampfinchen as of right now it is opt-in via `--spec-type mtp`, but in terms of memory it should be < 10% of overall memory used (it's just a single layer transformer + kv cache, much lighter than draft models) 
>  
> @mbednarek360 ~I've only tested this on a small number of CUDA devices as of now, once it's ready to review I would have tested more devices/backends. In particular this PR relies on #22400 which is not implemented for vulkan for now, if you ask an LLM to add support for that you might get a little further~ Vulkan and Metal also tested


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
