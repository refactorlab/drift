# cockroachdb/cockroach #138872 — ccl/changefeedccl: add compression options for webhook sink

**[View PR on GitHub](https://github.com/cockroachdb/cockroach/pull/138872)**

| | |
|---|---|
| **Author** | @massimo-ua |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @asg0451
> The zstd reader does implement Close(), which we should call. It may also be worth caching the readers instead of making a new one every time

### @andyyang890
> Could you also make the mock webhook sink/this function work with `zstd`?

### @asg0451
> nit: remove the else case and have `finalBytes := body` before the if

### @andyyang890
> Should we be using the encoder to write the body if compression is set like in the non-2XX code case?

### @asg0451
> Looks good to me, thanks for the contribution! I'll ask bors to merge it after CI runs.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
