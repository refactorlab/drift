# VictoriaMetrics/VictoriaMetrics #9487 — cluster: add support of ingesting metadata

**[View PR on GitHub](https://github.com/VictoriaMetrics/VictoriaMetrics/pull/9487)**

| | |
|---|---|
| **Author** | @zekker6 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @hagen1778
> Looks good overall. The formatting needs some love and rebase.

### @makasim
> Server attempts to parse RPC only if client send new Hello message, while client fallbacks to the old Hello message if server closes connection.

### @makasim
> @f41gh7, please add a changelog line

### @makasim
> PR introduced flaky test, fixed in bf3b1cf.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
