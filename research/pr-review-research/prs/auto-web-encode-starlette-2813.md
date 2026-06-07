# encode/starlette #2813 — Fix unclosed 'MemoryObjectReceiveStream' upon exception in 'BaseHTTPMiddleware' children

**[View PR on GitHub](https://github.com/encode/starlette/pull/2813)**

| | |
|---|---|
| **Author** | @Kludex |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @graingert
> ah I think it's a race condition here... the other thread could be busy doing stuff moments before trying to put a message on the queue, so the queue appears empty when there's a message pending being put

### @graingert
> yes probably best to split into two PRs and add a changelog entry for the lost shutdown exception issue

### @graingert
> I think this is a pre-existing issue, just VERY rare

### @Kludex
> Well... I'm very confused as to why the current test is failing. 😆

*Note: GitHub's review-thread prose was only partially web-retrievable; quoted lines above are verbatim where shown.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
