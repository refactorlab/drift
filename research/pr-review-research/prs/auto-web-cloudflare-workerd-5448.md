# cloudflare/workerd #5448 — improve text encoder encode performance

**[View PR on GitHub](https://github.com/cloudflare/workerd/pull/5448)**

| | |
|---|---|
| **Author** | @anonrig |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jasnell
> my preference would be to settle on #5449 first before landing any changes here. Also, since we do utf8 conversions everywhere, not just in TextEncoder::encode, my preference would be to address this more generally.

### @jasnell
> The optimized encoding path should go into `jsg::JsString` so that it can be used everywhere rather than just in `TextEncoder::encode`.

### @erikcorry
> I don't think we need to speed optimize for the broken UTF-16 case unless and until someone shows it matters. The only reason to space-optimize would be to avoid throwing OOM.

### @erikcorry
> (Shared a detailed paste with suggested implementation simplifications that improved both performance and code maintainability.)

### @anonrig
> This helps a lot. I'll push with your changes. Thanks @erikcorry

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
