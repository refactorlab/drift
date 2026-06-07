# yewstack/yew #4046 — feat: add SSR e2e hydration tests for simple_ssr and ssr_router

**[View PR on GitHub](https://github.com/yewstack/yew/pull/4046)**

| | |
|---|---|
| **Author** | @Madoshakalaka |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @WorldSEnder
> Ignores the return value without being explicit about as below... Technically this races for the pid. The server could exit (crash?) and get replaced by a different process with the same process id which would get the axe.

### @WorldSEnder
(Multiple inline comments on `tools/ssr-e2e/src/main.rs` regarding process handling and safety patterns, marked as "Outdated" after revision)

### @Madoshakalaka
> good point. made the first return explicit.

*Note: The page contained limited substantive human critique beyond the process-termination safety discussion. Most other interactions were bot-generated benchmark/size reports and automated approvals.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
