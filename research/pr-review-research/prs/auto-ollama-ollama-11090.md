# ollama/ollama #11090 — New Memory Management

**[View PR on GitHub](https://github.com/ollama/ollama/pull/11090)**

| | |
|---|---|
| **Author** | @jessegross |
| **Status** | ✅ merged |
| **Opened** | 2025-06-16 |
| **Repo** | curated review-culture seed |
| **Diff** | +1855 / −895 across 26 files |
| **Engagement** | 62 conversation · 26 inline review comments |

## Top review comments (ranked by reactions)

### @jessegross — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/ollama/ollama/pull/11090#issuecomment-2981470713)

> > Wait, isn't ollama using llama.cpp as your runner? I mean, #10740 is kind of an egregious estimation fail, but the real work is in llama.cpp...
> 
> No, for the current generation of models it's generally not. As noted in the description above, this PR only works for models that use Ollama's engine.
> 
> > I've recently become enamored with Paged Attention and may have tried to vibe code it sideways into llama.cpp. (Without success, but I learned some things)
> > 
> > Llama.cpp allocates a fixed amount of memory based on n_ctx, model quantization, KV quantization, and the model tensors. It should be an easy fix to not get the estimate wrong for #10740 .
> 
> The other major component of memory usage is the compute graph. For newer models that have image processing capabilities and/or require longer context length, this has been an increasingly significant factor. It's also the most difficult to estimate correctly and the reason why Ollama's estimates have become increasingly suboptimal over time.
> 
> > A WAY more interesting idea is to dynamically allocate tokens and KV cache elements when they're needed, and allow fine grained control of the KV cache. Unused KV cache entries can also be offloaded to system RAM.
> > 
> > I've got a demo of the latter and it's actually quite fast, but it's working on top of the fixed n_ctx you gave the model, and could be way better, but requires rearchitecting the ggml backends. Which we should do. Because all modern GPUs have MMUs and effectively neither llama.cpp nor ollama are using them at all.
> 
> Paged Attention is no doubt a very useful building block but i … *[truncated]*

### @johnnysn — 1 reactions  
`🎉 1`  ·  [link](https://github.com/ollama/ollama/pull/11090#issuecomment-2993849933)

> @jessegross sorry about the confusion. When running the software without setting OLLAMA_NEW_ENGINE=1, `ollama ps` was indicating that some layers were offloaded to the GPU, when in fact they were not. So I assumed CUDA was working properly, but there was actually an issue with some environment variables.
> 
> Now I fixed the problem and run qwen3:32b with a context window of 32K tokens to compare with [this test using the main branch](https://github.com/ollama/ollama/issues/10911#issuecomment-2925513480). Now memory estimation seems to be accurate and the model runs entirely on the GPUs. Very nice! 👏
> 
> ```
> time=2025-06-21T21:43:59.168-03:00 level=DEBUG source=sched.go:293 msg="runner with non-zero duration has gone idle, adding timer" runner.name=registry.ollama.ai/library/qwen3:32b_32k runner.inference=cuda runner.devices=2 runner.size="35.7 GiB" runner.vram="35.7 GiB" runner.parallel=2 runner.pid=5990 runner.model=/home/septerium/.ollama/models/blobs/sha256-3291abe70f16ee9682de7bfae08db5373ea9d6497e614aaad63340ad421d6312 runner.num_ctx=65536 duration=5m0s
> time=2025-06-21T21:43:59.168-03:00 level=DEBUG source=sched.go:311 msg="after processing request finished event" runner.name=registry.ollama.ai/library/qwen3:32b_32k runner.inference=cuda runner.devices=2 runner.size="35.7 GiB" runner.vram="35.7 GiB" runner.parallel=2 runner.pid=5990 runner.model=/home/septerium/.ollama/models/blobs/sha256-3291abe70f16ee9682de7bfae08db5373ea9d6497e614aaad63340ad421d6312 runner.num_ctx=65536 refCount=0
> ```
> 
> ```bash
> $ ollama ps
> NAME             ID              SIZE     PROCESSOR    UNTIL … *[truncated]*

### @Master-Pr0grammer — 1 reactions  
`👍 1`  ·  [link](https://github.com/ollama/ollama/pull/11090#issuecomment-2994311672)

> does anyone happen to have a compiled build of this pr? I would love to test it out but I tried building it myself but ran into issues.

### @coolestmage — 1 reactions  
`👍 1`  ·  [link](https://github.com/ollama/ollama/pull/11090#issuecomment-2998145339)

> I haven't had a ton of time to test this yet, but it seems to be working great. I'm using a few Radeon MI50s with mixed vram sizes and this new version loads them all correctly and evenly. A massive improvement.

### @jessegross — 1 reactions  
`👍 1`  ·  [link](https://github.com/ollama/ollama/pull/11090#issuecomment-3161392354)

> @coolestmage Rebased this branch on main, so it now supports gpt-oss

### @jessegross — 1 reactions  
`👍 1`  ·  [link](https://github.com/ollama/ollama/pull/11090#issuecomment-3176720730)

> @dhiltgen All good comments - addressed in the most recent push.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
