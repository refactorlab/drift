# scylladb/scylladb #22906 — Co-locate tablets of different tables

**[View PR on GitHub](https://github.com/scylladb/scylladb/pull/22906)**

| | |
|---|---|
| **Author** | @mlitvk |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tgrabiec
> It seems that it doesn't make sense to have different tablet count then, tablets from the larger group would be pinned by a matching tablet from the smaller group so they may as well be a single tablet. If we have the same tablet count, we could share the tablet map, and the whole thing becomes much simpler.

### @avikivity
> Moreover, it breaks when we break the power-of-two rule. I think we should require 1:1 (and change split/resize/migrate to work on table groups rather than tables).

### @tgrabiec
> Depends on what we want to use co-location for. If it's supposed to hold at all times, then reusing a tablet map is a better way, because discrepancy is impossible by design.

### @avikivity
> The load balancer should merge per-table tablet hints to per-tablet-group tablet hints.

### @mlitvk
> I'm not sure if we need perfect atomic co-location

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
