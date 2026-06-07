# redwoodjs/redwood #10031 — feat(rsc-streaming): Integrating RSC builds with Streaming and Client side hydration

**[View PR on GitHub](https://github.com/redwoodjs/redwood/pull/10031)**

| | |
|---|---|
| **Author** | @dac09 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Tobbe
> Thanks for highlighting this for me. I agree, this is ok. Just change to `innerText` instead of `innerHTML` and it should pass again 👍

### @dac09
> I've essentially disabled SSR for pages (in `renderFromRscServer`) - this is until we figure out how to render RSCs on first render.

### @dac09
> Note: OG Tags, etc. won't be rendered either, unless you use a routehook too

### @dac09
> Once you enable RSC you get: ✅ Client side rendering ❌ Server side rendering (only partially) ✅ Server component rendering after client has been hydrated

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
