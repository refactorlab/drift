# influxdata/influxdb #27370 — feat: make /health and /ready available early

**[View PR on GitHub](https://github.com/influxdata/influxdb/pull/27370)**

| | |
|---|---|
| **Author** | @davidby-influx |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @gwossum
> SetHandler only guards against an untyped nil interface (next == nil), but a typed-nil...will still be stored and will panic when ServeHTTP is called on it.

### @gwossum
> Would it be more future-safe to always create `tasksReady` and `schedulerReady`, and then mark them ready when we create the scheduler? The logic here seems diffuse and easy to get wrong.

### @gwossum
> Is it bad to report a failed health state when any shards fail to load? The TSM store is still functional, just in a degraded capacity. Do we need a degraded health state?

### @gwossum
> Round-trip checks are great, but for APIs I really like to test against constants...If you change something in the endpoint response, roundtrip tests will pass, but the API contract has been broken.

### @gwossum
> Is this going to do weird things at DST time changes and falsely report scheduler failures?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
