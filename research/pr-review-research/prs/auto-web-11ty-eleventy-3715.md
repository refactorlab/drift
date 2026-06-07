# 11ty/eleventy #3715 — Dependency optimization

**[View PR on GitHub](https://github.com/11ty/eleventy/pull/3715)**

| | |
|---|---|
| **Author** | @outslept |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @zachleat
> Happy to merge this but can you move the minimist->parseArgs change to a separate PR? I don't think parseArgs supports multi-type CLI args yet (boolean or string values) — and this is the riskiest change of the 4 I think

### @outslept
> The test expects `DirContains("..", "../..")` to return `false` (indicating that a directory two levels up is not contained within the parent directory), but the current implementation returns `true`... Would using `path.relative()` be a better approach here to properly determine containment relationships between directories?

### @Ryuno-Ki
> `path.relative()` sounds like a sensible choice to me. Maybe we can back out this piece into a separate PR to get the majority in here, though.

### @zachleat
> LGTM this will be in v3.0.1-alpha.6 (which we will likely end up as stable in v3.1.0 given it's growing size)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
