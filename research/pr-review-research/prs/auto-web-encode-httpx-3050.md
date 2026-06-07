# encode/httpx #3050 — Deprecate `app=...` in favor of explicit `WSGITransport`/`ASGITransport`

**[View PR on GitHub](https://github.com/encode/httpx/pull/3050)**

| | |
|---|---|
| **Author** | @lovelydinosaur |
| **Status** | Merged (February 2, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Kludex
> This is not deprecation of `app=...`, it's a removal directly. Is it ok? We usually raise warnings when deprecating paramters, don't we?

### @T-256
> Since this PR is version 1.0 proposal, why don't you track its changelog in #3069?

### @lovelydinosaur
> Thanks @Kludex, based on this I've updated the PR to be just a deprecation at this point.

### @lovelydinosaur
> Referenced issue discussion noting the change aims for a "stricter simpler more consistent API" in version 1.0.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
