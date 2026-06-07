# comfyanonymous/ComfyUI #13408 — feat: SAM (segment anything) 3.1 support (CORE-34)

**[View PR on GitHub](https://github.com/comfyanonymous/ComfyUI/pull/13408)**

| | |
|---|---|
| **Author** | @kijai |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kijai
> Right, yeah that's my bad on the instructions... `apron` would indeed only find one as default is one object. I'm unsure which way the logic should be...

### @drphero
> The SAM3 Detect node doesn't seem to be able to mask more than one object of the same type. The threshold, refine_iterations, and individual_masks settings do not seem to have an effect...

### @Kosinkadink
> Tested this PR, seems to work well. Code looks good.

### @kijai
> Yes the model can't work well with sage, but it's already been updated to ignore the startup flag...

### @jimsmt
> issue occurs when `detection_threshold` is set to less than 0.4...causes too many objects due to a very low detection threshold setting

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
