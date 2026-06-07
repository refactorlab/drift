# ggml-org/llama.cpp #14939 — model: Add support for GLM 4.5 family of models (#14921)

**[View PR on GitHub](https://github.com/ggml-org/llama.cpp/pull/14939)**

| | |
|---|---|
| **Author** | @sammcj |
| **Status** | ✅ merged |
| **Opened** | 2025-07-29 |
| **Repo importance** | ★114,713 · 19,193 forks · score 196,483 |
| **Diff** | +594 / −8 across 15 files |
| **Engagement** | 213 conversation · 124 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @ddh0 — 22 reactions  
`👍 20 · ❤️ 2`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/14939#issuecomment-3136866999)

> Gentle ping for @zRzRzRzRzRzRzR, who wrote the original implementation for GLM 4.5 (https://github.com/vllm-project/vllm/pull/20736) as well as #12867 . Maybe they would be so kind as to take a look? :)

### @sammcj — 19 reactions  
`❤️ 12 · 🎉 7`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/14939#issuecomment-3134430303)

> Bingo! I have conversion, quantisation and llama-server working! 🎉 
> 
> ```
> ./bin/llama-server -m /Users/samm/LLM\ Models/zai-org_GLM-4.5-Air/glm-4.5-air-q3_K_M.gguf -n 10 --temp 0.1
> build: 4624 (2e54c5125) with Apple clang version 17.0.0 (clang-1700.0.13.5) for arm64-apple-darwin24.5.0
> system info: n_threads = 8, n_threads_batch = 8, total_threads = 12
> 
> system_info: n_threads = 8 (n_threads_batch = 8) / 12 | Metal : EMBED_LIBRARY = 1 | BF16 = 1 | CPU : NEON = 1 | ARM_FMA = 1 | FP16_VA = 1 | MATMUL_INT8 = 1 | DOTPROD = 1 | ACCELERATE = 1 | REPACK = 1 |
> 
> main: binding port with default address family
> main: HTTP server is listening, hostname: 127.0.0.1, port: 8080, http threads: 11
> main: loading model
> srv    load_model: loading model '/Users/samm/LLM Models/zai-org_GLM-4.5-Air/glm-4.5-air-q3_K_M.gguf'
> llama_model_load_from_file_impl: using device Metal (Apple M2 Max) - 83999 MiB free
> llama_model_loader: loaded meta data with 39 key-value pairs and 803 tensors from /Users/samm/LLM Models/zai-org_GLM-4.5-Air/glm-4.5-air-q3_K_M.gguf (version GGUF V3 (latest))
> llama_model_loader: Dumping metadata keys/values. Note: KV overrides do not apply in this output.
> llama_model_loader: - kv   0:                       general.architecture str              = glm4moe
> llama_model_loader: - kv   1:                               general.type str              = model
> llama_model_loader: - kv   2:                               general.name str              = Zai org_GLM 4.5 Air
> llama_model_loader: - kv   3:                         general.size_label str              = 128x9.4B
> llama_model_loader: - … *[truncated]*

### @sammcj — 16 reactions  
`👍 16`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/14939#issuecomment-3139207705)

> Between competing priories I'm focusing on the conversion script where I think I found an issue with  the MoE mapping and the final (nextn) layer.
> 
> I'm very much "having a go" at this and I don't know how long it will take, so please if anyone wants to contribute fixes or pull in what I've got so far to their own - feel free to do so.

### @ddh0 — 16 reactions  
`👍 1 · 🚀 15`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/14939#issuecomment-3146613997)

> FYI to @sammcj and code reviewers, I've started a new, cleaner PR for GLM-4.5 and have already figured out some kinks that make it easier to implement and review than this PR. It's still a draft and not ready for review yet, but I'm quickly making progress: #15026

### @sammcj — 15 reactions  
`❤️ 15`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/14939#issuecomment-3135403214)

> No luck, it usually starts out responding alright, then it devolves into nonsense, even with the repeat penalty cranked up:
> 
> ```
> ./bin/llama-cli -ngl 37 --flash-attn --temp 0.6 --top-k 20 --top-p 0.6 --min-p 0.0 \
>   --repeat-penalty 2 --presence-penalty 1.5 --model glm-4.5-air-q3_K_M.gguf \
>   --ctx-size 8192 --chat-template-file chat_template_gh_fixed.jinja 
> 
> > tell me 5 jokes
> <think>Okay, user asked for exactly "jokes" - probably meant typos but intent clear.
> 
> Hmm... they want humor quick fix no deep analysis needed just punchlines ready to go straight delivery mode activated: short sharp clean ones universal laughs guaranteed five joke grenades one-liners zero niche references safe-for-all-ages material here's request straightforward list format perfect timing crucial jokes land universally puns? Wait check all-crowd. Animal dad-joke style then classic setup-punchline structure needed no cultural barriers wordplay only English yes! User just wants 5 quick laughs universal clean ones ready-to-go for any age groups avoid niche humor keep it simple: animals food objects relatable scenarios + twist punchlines visual puns safe work universally groanalogical. Animal jokes? Check all-ones with animal+food=universal appeal no deep cuts to land anywhere anytime request clear enough five quick laughs zero offense-free clean ones everyone gets why not offensive materialize universal themes pets silly wordplay onelbowls 5jokes time-sensitive humor user probably just need puns universally accessible.
> 
> Hmm, got it's "tell me tell jokes? No dark or niche maybe they said no deep cuts bot … *[truncated]*

### @ddh0 — 13 reactions  
`❤️ 12 · 🚀 1`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/14939#issuecomment-3146038446)

> I am also happy to help, I have been looking at this PR locally and comparing to the PR on ik_llama.cpp (https://github.com/ikawrakow/ik_llama.cpp/pull/668). I'm trying to see if I can get it working locally and then hopefully narrow down the issue from there. So far no luck but I'll report back here if I find anything.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
