# cockroachdb/cockroach #131850 — raft: add tracing to raft

**[View PR on GitHub](https://github.com/cockroachdb/cockroach/pull/131850)**

| | |
|---|---|
| **Author** | @andrewbaptist |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sumeerbhola
> It's not clear to me why this needs to be highly concurrent given there is a `RaftTracer` per replica and many of the state change events already happen with `raftMu` or `Replica.mu` held.

### @pav-kv
> A queue/LogTracker like data structure here would make the code simpler / faster...we wouldn't need to scan the map on every message and could take advantage of the ordering

### @sumeerbhola
> I don't understand this choice to register at most one entry per batch...it seems we would arbitrarily pick one, and that would be the only one with Raft tracing.

### @sumeerbhola
> I suspect we will get most of the benefit solely with leaseholder introspection...we can log it periodically based on the (delta) latency at some percentile being higher than some threshold

### @pav-kv
> The existence of this limit is a precaution - with the code as is the entry lifetime tracking is not super precise, and there are cases when the index can stay 'registered' for a long time.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
