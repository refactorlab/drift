# crossplane/crossplane #6777 — Add circuit breaker to prevent XR reconciliation thrashing

**[View PR on GitHub](https://github.com/crossplane/crossplane/pull/6777)**

| | |
|---|---|
| **Author** | @negz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jbw976
> I found myself getting confused about the meaning of open/closed...I'm wondering if this terminology is going to be confusing for end users.

### @jbw976
> Validating the watch circuit closes back after 5m would also be helpful. Did you omit not to make the test running too long, or?

### @turkenh
> Reduce time-based flakiness; avoid hard-coding NextAllowedAt ≈ now+30s in assertions.

### @coderabbitai
> Set token-bucket thresholds to PR spec (25 burst, 1 per 10s). Defaults (capacity 50, 0.5/s) don't match the stated behavior.

### @coderabbitai
> Who starts the GC loop? There's a ticker-driven GC helper, but I don't see where it's started with a context.

### @coderabbitai
> Re-applying all pre-existing conditions will overwrite any conditions supplied via Functions response's desired XR status.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
