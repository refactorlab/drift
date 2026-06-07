# ggml-org/llama.cpp #16095 — Model: Qwen3 Next

**[View PR on GitHub](https://github.com/ggml-org/llama.cpp/pull/16095)**

| | |
|---|---|
| **Author** | @pwilkin |
| **Status** | ✅ merged |
| **Opened** | 2025-09-18 |
| **Repo importance** | ★114,713 · 19,193 forks · score 196,483 |
| **Diff** | +1345 / −19 across 16 files |
| **Engagement** | 320 conversation · 69 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @pwilkin — 63 reactions  
`👍 37 · ❤️ 8 · 🚀 9 · 👀 6 · 😕 3`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/16095#issuecomment-3363803147)

> Sigh... after adding `tri` (triu/tril from PyTorch) and `cumsum` ops I'm down to only having the chunked operations to implement in the actual delta_net op. All the reshapes, transpositions, permutations and slices are a total nightmare though.

### @pwilkin — 61 reactions  
`👍 24 · 🚀 37`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/16095#issuecomment-3336146263)

> Status update: QKV split is now correct, on to the convolution tomorrow.

### @pwilkin — 52 reactions  
`👍 4 · 🎉 35 · 🚀 9 · 👀 4`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/16095#issuecomment-3334488591)

> Getting there...
> 
> ```console
> Top 10 PyTorch logits: [5.835827  5.6605897 5.3096943 5.216682  5.1912103 5.1011677 5.0356965
>  4.918073  4.8696313 4.850964 ]
> Top 10 llama.cpp logits: [5.860941  5.408732  5.129989  4.9978523 4.994956  4.885063  4.875494
>  4.838045  4.775799  4.7310333]
> ```

### @pwilkin — 50 reactions  
`❤️ 47 · 🚀 3`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/16095#issuecomment-3362715768)

> > has this project got abandoned?
> 
> Nope. Sitting on it right now in fact.

### @pwilkin — 45 reactions  
`👍 22 · ❤️ 13 · 🚀 7 · 👀 3`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/16095#issuecomment-3369068208)

> Slowly trudging forward. Notes from the last few days:
> - thought that maybe I'm far enough that can get an LLM to write a piece of the function by comparing with the reference implementation and reference tensor dumps. Nope, even GLM 4.6 is too dumb to do that properly.
> - the GGML and Transformers implementations for l2norm differ on clamping strategies for near-epsilon values, which produced a divergence with my randomly generated tensors; oh well...
> - feeling like `ggml_tri` will be a pretty useful op to add
> 
> Obtained full parity with pre-chunked attention calc in the main delta-net (i.e. up to and including `attn = -((k_beta @ key.transpose(-1, -2)) * decay_mask).masked_fill(mask, 0)`). Once I'm done with delta-net the rest should be a breeze.
> 
> Tips from the last days for anyone who wants to do conversions: if you make a really small model, do actually convert with `--outtype f32`, then you can try to go for near-perfect parity without wondering if the small diferences are due to rounding errors or you're doing something wrong.

### @pwilkin — 44 reactions  
`👍 44`  ·  [link](https://github.com/ggml-org/llama.cpp/pull/16095#issuecomment-3342082469)

> For people who want some deterministic reference frame regarding progress: some hard parts are already done, still need to align the delta gate with the reference implementation. I'm getting more comfortable navigating the GGML operations, so that's a plus ;) will probably be able to give a few more details once I monkey-patch the reference implementation processing functions and see what actually diverges.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
