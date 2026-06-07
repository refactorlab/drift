# comfyanonymous/ComfyUI #7223 — Add --use-flash-attention flag

**[View PR on GitHub](https://github.com/comfyanonymous/ComfyUI/pull/7223)**

| | |
|---|---|
| **Author** | @FeepingCreature |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mcmonkey4eva
> jsyk user with torch 2.3 reports this causes a total launch failure even when not active

### @FeepingCreature
> Huh. Okay, I'll make that conditional.

### @bigcat88
> just note for that people who will test it: you need to disable `iGPU` if you have AMD motherboard...or do `export HIP_VISIBLE_DEVICES=0`

### @githust66
> after testing in the torch2.6 + rocm6.4 environment, its speed is slower than that of --use-pytorch-cross-attention

### @FeepingCreature
> I reliably get 10% more on FA, but some people have reported differently.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
