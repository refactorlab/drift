# scrapy/scrapy #6729 — Minimal asynchronous start requests

**[View PR on GitHub](https://github.com/scrapy/scrapy/pull/6729)**

| | |
|---|---|
| **Author** | @Gallaecio |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wRAR
> What is the actual problem that the test failure suggests? was the code expected to guarantee the order of those requests?

### @Gallaecio
> there is a chance for a race condition where there is no room for the callback request to be yielded before `needs_backout` becomes `False` again

### @Gallaecio
> I feel like `start_requests()` was never a good name for a method, because 'start' here means 'initial' rather than 'initiate', and method names should start with imperative verbs

### @wRAR
> Added `process_start` support to BaseSpiderMiddleware, addressing middleware compatibility with the new async seeding approach without requiring downgrade/upgrade logic.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
