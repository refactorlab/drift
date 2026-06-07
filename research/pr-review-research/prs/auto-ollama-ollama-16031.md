# ollama/ollama #16031 — runner: Remove CGO engines, use llama-server exclusively for GGML models

**[View PR on GitHub](https://github.com/ollama/ollama/pull/16031)**

| | |
|---|---|
| **Author** | @dhiltgen |
| **Status** | ✅ merged |
| **Opened** | 2026-05-07 |
| **Repo** | curated review-culture seed |
| **Diff** | +28445 / −430004 across 1100 files |
| **Engagement** | 177 conversation · 23 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @dhiltgen — 6 reactions  
`🎉 6`  ·  [link](https://github.com/ollama/ollama/pull/16031#issuecomment-4442161816)

> To aid in testing, a new 0.30.0 pre-release is [available](https://github.com/ollama/ollama/releases).  I'll be updating this PR and the pre-release RCs periodically with fixes and llama.cpp updates as we get closer to merging to main.

### @EnlistedGhost — 6 reactions  
`👍 3 · 🎉 3`  ·  [link](https://github.com/ollama/ollama/pull/16031#issuecomment-4492138879)

> > @deezid I believe I understand the 1080Ti performance gap now. We build 2 copies of llama.cpp for CUDA; one against v12, and one against v13. The v12 version is applicable for your older GPU. The v12 version enables flash attention as it covers a broad range of GPUs and toggles it at runtime based on GPU support. Your Pascal-era GPU does not support FA. The wrinkle is we can't build Pascal native binaries with FA enabled due to some of the newer GGML kernels exceeding memory layout limits on that generation of GPU. To work around this, we build the "virtual" targets for them, and this seems to be the origin of this performance gap. Ollama v0.24 is using an older GGML commit where the kernels still fit within the Pascal limits so we have been able to continue building native CC 6.x. I've made some updates to the cmake setup on the branch to make it easier to build from source, so you should be able to disable FA and target your GPU directly if you want to try to squeeze the last bit of performance out of your GPU.
> 
> Just wanted to thank you for supporting Pascal and Maxwell era cards. Few do this and it's a huge draw to your project that despite the age of my hardware- I can still conduct very impressive inferencing with these dated units.

### @dhiltgen — 5 reactions  
`🎉 5`  ·  [link](https://github.com/ollama/ollama/pull/16031#issuecomment-4446215428)

> @dchurch315 @fcorneli @sloppymcslopface thanks for the feedback!  I've repro'd your issues and should have fixes in rc16 which I'm aiming to release tomorrow.

### @dhiltgen — 4 reactions  
`🚀 4`  ·  [link](https://github.com/ollama/ollama/pull/16031#issuecomment-4481458425)

> **v0.30.0-rc20** is now available and should address more of the issues reported above.
> 
> **Mac/Linux**
> 
> ```bash
> curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION=0.30.0-rc20 sh
> ```
> 
> **Windows**
> 
> ```powershell
> $env:OLLAMA_VERSION="0.30.0-rc20"; irm https://ollama.com/install.ps1 | iex
> ```
> 
> A few follow-ups:
> 
> @fcorneli `qwen3-coder-next:q8_0` should be fixed in rc20. Please retest when you get a chance.
> 
> @sloppymcslopface rc20 includes Linux ROCm iGPU/shared-memory classification fixes. Please retry the Radeon 780M cases. If `qwen3.6:35b` or `nemotron-cascade-2` still fail to load, please share fresh `OLLAMA_DEBUG=1` logs. If `qwen3:4b` / `granite4.1:8b` are still slower, a fixed-output comparison with the same prompt, seed, and `num_predict` would help. As a diagnostic only, trying explicit `num_batch: 512` would also be useful.
> 
> @engstk thanks for the ROCm logs. I did not see an obvious placement/context mismatch: both runs used ROCm, full GPU offload, 4k context, batch 512, and flash attention. Please retry rc20; if ROCm still trails Vulkan, please share the rc20 debug log for the same prompt.
> 
> @drone540 @LFd3v local GGUF/GGML-family models now go through `llama-server` whether they came from the Ollama library or an HF/imported GGUF. Fit target is exposed through `LLAMA_ARG_FIT_TARGET`. For `--context-shift`, rc20 should only pass it for small effective contexts below 8192; `--keep 4` is Ollama’s historical `num_keep` default and can be overridden with `num_keep`.
> 
> @EntropyYue If rc20 still reproduces it, please share the exact request payload, model tag, and opti … *[truncated]*

### @dhiltgen — 4 reactions  
`👍 4`  ·  [link](https://github.com/ollama/ollama/pull/16031#issuecomment-4510209936)

> **v0.30.0-rc22** is now available and includes fixes for `ollama ps` CPU/GPU accounting, community Gemma 4 GGUF/NVFP4 loading, Qwen3.5 MTP import/wiring, and template selection for multi-capability models.
> 
> **Mac/Linux**
> 
>     curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION=0.30.0-rc22 sh
> 
> **Windows**
> 
>     $env:OLLAMA_VERSION="0.30.0-rc22"; irm https://ollama.com/install.ps1 | iex

### @dhiltgen — 4 reactions  
`👍 2 · 🚀 2`  ·  [link](https://github.com/ollama/ollama/pull/16031#issuecomment-4521611602)

> **v0.30.0-rc23** is now available with fixes for: lower startup OOM risk under tight VRAM, larger tool-call payloads, Qwen MTP/legacy compat, audio/template fixes, quantization display cleanup, and Windows ROCm packaging fixes.
> 
> **Mac/Linux**
> 
> ```console
> curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION=0.30.0-rc23 sh
> ```
> 
> **Windows**
> 
> ```powershell
> $env:OLLAMA_VERSION="0.30.0-rc23"; irm https://ollama.com/install.ps1 | iex
> ```


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
