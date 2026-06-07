# aio-libs/aiohttp #8063 — Add server capability to check for Brotli compressed static files

**[View PR on GitHub](https://github.com/aio-libs/aiohttp/pull/8063)**

| | |
|---|---|
| **Author** | @steverep |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bdraco
> I think this one should be safe for backport.

### @Dreamsorcerer
> We try to stick to bug fixes in the patch releases.

### @webknjaz
> Blockers so far: new binary blob in Git, formatting changes in tests. Please, deal with this to making this mergeable.

### @bdraco
> LGTM, #8136 should merge first so it can be backported

### @steverep
> I considered making a check for which is smaller if both exist, but figured it wouldn't be worth the extra file system call in the vast majority of cases.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
