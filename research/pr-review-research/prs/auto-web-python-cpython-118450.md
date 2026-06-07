# python/cpython #118450 — gh-117139: Convert the evaluation stack to stack refs

**[View PR on GitHub](https://github.com/python/cpython/pull/118450)**

| | |
|---|---|
| **Author** | @Fidget-Spinner |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @gvanrossum
> Could we hold off on this until 3.14? It's only a week until feature freeze for 3.13...this looks like a lot of churn in a time where we all would like stability.

### @colesbury
> That makes sense. I'll start providing feedback and reviewing this now, but it won't be merged in 3.13.

### @markshannon
> It isn't implicit it depends on the flags pass [PEP 590]. Take care to set the flags to suit your buffer size.

### @Fidget-Spinner
> Yeah I recall the flag, but I just blanket put +1 extra space for everything for simplicity's sake.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
