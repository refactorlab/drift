# weaviate/weaviate #11155 — feat: async replication scheduler

**[View PR on GitHub](https://github.com/weaviate/weaviate/pull/11155)**

| | |
|---|---|
| **Author** | @jeroiraz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tsmith023
> Do you think this is a concern at all if there are shards with very large disparities using up the available workers while other smaller shards...remaining inconsistent for long times?

### @jeroiraz
> Each `runHashbeatCycle` is hard-bounded by `propagationLimit` (default 1k UUIDs/cycle)...so a single shard cannot hold a worker indefinitely

### @jeroiraz
> If we hit this in practice we can add weighted fairness (e.g. priority boost for shards above a divergence threshold) as a follow-up.

### @tsmith023
> Yes please! It doesn't need to be an urgent action item just a note that some kind of fairness algorithm is a future optimisation

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
