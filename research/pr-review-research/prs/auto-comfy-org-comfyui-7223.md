# Comfy-Org/ComfyUI #7223 — Add --use-flash-attention flag.

**[View PR on GitHub](https://github.com/Comfy-Org/ComfyUI/pull/7223)**

| | |
|---|---|
| **Author** | @FeepingCreature |
| **Status** | ✅ merged |
| **Opened** | 2025-03-13 |
| **Repo importance** | ★115,766 · 13,547 forks · score 174,952 |
| **Diff** | +64 / −0 across 3 files |
| **Engagement** | 68 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @mcmonkey4eva — 1 reactions  
`👍 1`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7223#issuecomment-2724151424)

> jsyk user with torch 2.3 reports this causes a total launch failure even when not active
> ![image](https://github.com/user-attachments/assets/dfd9dd83-ba5c-40bd-9ac4-5dc713134689)

### @bigcat88 — 1 reactions  
`👍 1`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7223#issuecomment-2726262989)

> > (For testing, I recommend the @gel-crabs branch `pip install -U git+https://github.com/gel-crabs/flash-attention-gfx11@headdim512` - make sure to `pip uninstall flash-attn` first! )
> 
> just note for that people who will test it: you need to disable `iGPU` if you have AMD motherboard(and enable it after building flash-attention) or do
> 
> ```
> export HIP_VISIBLE_DEVICES=0
> export ROCR_VISIBLE_DEVICES=0
> ```
> 
> before installing `flash-attention-gfx11@headdim512`
> 
> reference: https://github.com/vladmandic/sdnext/issues/3515

### @FeepingCreature — 1 reactions  
`👀 1`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7223#issuecomment-2799894094)

> Uh oh. Does anyone have `flash_attn_rocm` checked out? Howiejay's upstream branch for rocm/composable_kernel seems to be gone.
> 
> Ping @dejay-vu? The upstream CK commit in https://github.com/ROCm/flash-attention/tree/howiejay/navi_support can no longer be found.

### @Hakim3i — 1 reactions  
`🚀 1`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7223#issuecomment-2817300459)

> > What sort of speeds are you seeing? On Pytorch nightly, I get 3.7it/s with Pytorch cross attention and 4it/s with Flash Attention on my 7900 XTX.
> 
> am getting 4.57 it/s with --use-pytorch-cross-attention
> 
> ![image](https://github.com/user-attachments/assets/98b72d30-3e9a-4370-b3b7-642396eb756e)

### @FeepingCreature — 0 reactions  
`—`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7223#issuecomment-2722140777)

> (For testing, I recommend the @gel-crabs branch `pip install -U git+https://github.com/gel-crabs/flash-attention-gfx11@headdim512` - make sure to `pip uninstall flash-attn` first! )

### @comfyanonymous — 0 reactions  
`—`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/7223#issuecomment-2722697875)

> one of the ruff fails is my fault but can you fix the other one?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
