# pmndrs/jotai #2363 — Improve performance of recomputeDependents

**[View PR on GitHub](https://github.com/pmndrs/jotai/pull/2363)**

| | |
|---|---|
| **Author** | @samkline |
| **Status** | Merged (January 31, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dai-shi
> Yes, I was pretty sure that there should be better algorithm then loop1&loop2. So great to see this.

### @dai-shi
> Nice. Can you please add comment in source code so that we know it's the workaround for transpilation?

### @samkline
> For those out of the loop, the issue applies when the code is transpiled to support older JS versions.

### @dai-shi
> It looks simplified!

### @yf-yang
> jotai-scope is good with [commit hash]

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
