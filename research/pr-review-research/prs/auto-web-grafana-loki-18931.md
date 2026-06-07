# grafana/loki #18931 — feat: add logfmt parse support to the v2 query engine

**[View PR on GitHub](https://github.com/grafana/loki/pull/18931)**

| | |
|---|---|
| **Author** | @trevorwhitney |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @rfratto
> The logical plan is the wrong place for handling key collection, and moving it into the physical plan will be a better separation of concerns and won't require the introduction of some of the constructs.

### @rfratto
> This is introducing a very significant amount of code, and in my reviews, some of it feels out of scope for introducing logfmt parsing (casting), and other parts feel like we're adding new ways to do something we can already do (the column registry).

### @rfratto
> I'm also concerned about the logfmt tokenizer. It seems written by AI, and may have subtle bugs everywhere. Can we use an existing logfmt decoder instead of having AI write one, please?

### @rfratto
> Prefer to test behaviour via the public API of packages, rather than testing internal details. This will give us more freedom to refactor without breaking tests.

### @chaudum
> Flagged unused business logic and requested removal of cast-related code and integration tests outside the core feature scope.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
