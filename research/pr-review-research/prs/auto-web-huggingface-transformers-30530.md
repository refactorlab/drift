# huggingface/transformers #30530 — Add ViTPose

**[View PR on GitHub](https://github.com/huggingface/transformers/pull/30530)**

| | |
|---|---|
| **Author** | @NielsRogge |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ArthurZucker
> Wondering if you are certain we need to split these. I think we can just add all in vitpose no? Why do we need to have the backbone separate?

### @NielsRogge
> It's mainly because ViTPose itself is a framework which could leverage various different backbones, so I made it compatible with the `AutoBackbone` API

### @ArthurZucker
> why don't we have a single for loop here?

### @NielsRogge
> I'm not a fan of this, I'd always put these in conversion scripts.... especially since we are still tweaking the architecture and things can break

### @ArthurZucker
> let's go with `SwitchTransformersSparseMLP` implementation, it should be more efficient see #31173

### @ArthurZucker
> config checks should be done in the config, not sure this has a lot of value / can be removed!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
