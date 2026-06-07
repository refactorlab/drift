# Comfy-Org/ComfyUI #2666 — Execution Model Inversion

**[View PR on GitHub](https://github.com/Comfy-Org/ComfyUI/pull/2666)**

| | |
|---|---|
| **Author** | @guill |
| **Status** | ✅ merged |
| **Opened** | 2024-01-29 |
| **Repo importance** | ★115,766 · 13,547 forks · score 174,952 |
| **Diff** | +2812 / −279 across 23 files |
| **Engagement** | 80 conversation · 46 inline review comments |

## Top review comments (ranked by reactions)

### @mcmonkey4eva — 14 reactions  
`❤️ 14`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/2666#issuecomment-2201045724)

> @guill re `I probably won't be putting too much more effort into this PR unless I get a clear indication that it's likely to be merged.`
> 
> The [new Comfy Org team](https://www.comfy.org/) (Comfy/me/robin/yoland/data/hcl/pythongossss/...) are considering this PR a priority to get figured out and merged. It's a massive change that needs a lot of validation, but it's a very important foundational feature to enable a lot of future expansion of what ComfyUI can be capable of natively running.
> 
> Hopefully @comfyanonymous can give a direct reply with more of his view here soon, but he's been talking about it quite a lot recently.

### @comfyanonymous — 7 reactions  
`🎉 7`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/2666#issuecomment-2291511820)

> Just a note that I made some small changes to this PR here: https://github.com/comfyanonymous/ComfyUI/commit/5960f946a9353f4a8ff97e92f82e0541caa32bf7

### @asagi4 — 5 reactions  
`❤️ 5`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/2666#issuecomment-1986810460)

> Just reporting that I've been running with this branch (periodically rebased on top of master) since the latest fixes with no further issues that I can detect. I haven't exercised the new functionality much, but at least it doesn't seem to break existing things anymore.

### @comfyanonymous — 4 reactions  
`👍 4`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/2666#issuecomment-1914041266)

> If anyone can test and report if it works or not with their most complex workflows that would be very helpful.

### @guill — 4 reactions  
`👍 4`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/2666#issuecomment-1960721887)

> @comfyanonymous The remaining backward-incompatibilities -- the `JOVConstantNode` issue and the multi-type (`FLOAT,INT`) issues -- are both a result of the fact that optional inputs are now validated by the back-end when they weren't previously. Could you weigh in on how we want to solve this?
> 
> In the case of `JOVConstantNode`, the issue is that one of the input types is a vector (specifically `VEC2`), but the declared `min` and `max` types are single integers (`32` and `8192`). I could change the back-end to only validate `min` and `max` for `INT` and `FLOAT` types, but that feels like it's reducing robustness for the sake of a slightly weird declaration.
> 
> For the multi-type inputs, I could update the back-end validation to support the Litegraph concept of comma-delimited types pretty easily, but I'm not sure that's how we want to handle typing in the long-run. Node packs can resolve this issue themselves the same way they would currently resolve it for non-optional inputs (by having a type that overrides `__ne__`).
> 
> There are likely other node packs with invalid combinations that simply weren't caught previously due to the lack of validation of optional inputs. There are a couple directions we could go:
> 
> 1. Revert to having no validation on optional input paths. This seems like a long-term detriment to ComfyUI just to keep things fully backwards-compatible.
> 2. Make individual fixes to support all the existing cases that work only because they happen to be on optional inputs (i.e. special-casing min/max, adding explicit support for polymorphism in the validator, etc.).
> 3. … *[truncated]*

### @ricklove — 3 reactions  
`👍 3`  ·  [link](https://github.com/Comfy-Org/ComfyUI/pull/2666#issuecomment-1960729335)

> > @comfyanonymous The remaining backward-incompatibilities -- the `JOVConstantNode` issue and the multi-type (`FLOAT,INT`) issues -- are both a result of the fact that optional inputs are now validated by the back-end when they weren't previously. Could you weigh in on how we want to solve this?
> > 
> > In the case of `JOVConstantNode`, the issue is that one of the input types is a vector (specifically `VEC2`), but the declared `min` and `max` types are single integers (`32` and `8192`). I could change the back-end to only validate `min` and `max` for `INT` and `FLOAT` types, but that feels like it's reducing robustness for the sake of a slightly weird declaration.
> > 
> > For the multi-type inputs, I could update the back-end validation to support the Litegraph concept of comma-delimited types pretty easily, but I'm not sure that's how we want to handle typing in the long-run. Node packs can resolve this issue themselves the same way they would currently resolve it for non-optional inputs (by having a type that overrides `__ne__`).
> > 
> > There are likely other node packs with invalid combinations that simply weren't caught previously due to the lack of validation of optional inputs. There are a couple directions we could go:
> > 
> > 1. Revert to having no validation on optional input paths. This seems like a long-term detriment to ComfyUI just to keep things fully backwards-compatible.
> > 2. Make individual fixes to support all the existing cases that work only because they happen to be on optional inputs (i.e. special-casing min/max, adding explicit support for polymorphism in the v … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
