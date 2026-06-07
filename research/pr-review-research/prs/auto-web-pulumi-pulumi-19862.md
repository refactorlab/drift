# pulumi/pulumi #19862 — journaling interface inside the engine

**[View PR on GitHub](https://github.com/pulumi/pulumi/pull/19862)**

| | |
|---|---|
| **Author** | @tgummerer |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @julienp
> Since this does not actually do anything other than potentially report an internal error for us, I think it would be good to get this merged sooner rather than later.

### @pgavlin
> Yeah I think that's just a subset of the patch operation.

### @Frassle
> (Design clarification requesting confirmation that the implementation properly handles snapshot mutations at each step / journal-entry processing approach. Specific verbatim text not fully rendered on the public conversation page.)

Note: This PR introduced no functional changes initially; full benefits depend on a future service-side implementation that reconstructs snapshots from journal entries asynchronously.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
