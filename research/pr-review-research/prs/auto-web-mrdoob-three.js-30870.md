# mrdoob/three.js #30870 — Added new DevTools

**[View PR on GitHub](https://github.com/mrdoob/three.js/pull/30870)**

| | |
|---|---|
| **Author** | @mrdoob |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mrdoob
> Is this intentional? `info.render.calls` never resets on `WebGPURenderer`.

### @sunag
> The `render.call` corresponds to an ID of the `WebGPURenderer.render()` call; `frameCall` is reset per frame.

### @Mugen87
> We wanted to achieve a clearer separation between global, render and compute metrics...

### @mrdoob
> Alright, sounds good! 👍👍👍

*(Note: several inline review threads from @Mugen87 on the bridge.js implementation were marked "Outdated / resolved" and their full text did not render verbatim on the HTML page.)*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
