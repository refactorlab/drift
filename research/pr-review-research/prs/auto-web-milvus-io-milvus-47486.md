# milvus-io/milvus #47486 — enhance: improve the preformance of create partitions

**[View PR on GitHub](https://github.com/milvus-io/milvus/pull/47486)**

| | |
|---|---|
| **Author** | @sunby |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @liliu-z
> SyncNewCreatedPartition is dispatched via a raw goroutine instead of `jobScheduler`, violating the same-collection sequential execution contract.

### @liliu-z
> Insert() never checks for EntryStateStale, so once an entry becomes stale it can never be overwritten back to Active — the cache is permanently stuck for that key.

### @liliu-z
> `time.NewTicker` and `ticker.Reset` panic when given a non-positive duration. The `proxy.metaCacheGCTimeInterval` parameter...has no minimum value validation.

### @liliu-z
> `targetOp.String()` switch...does not have a case for the new `UpdatePartition` operation. When this op is logged, it will fall through to the default and print 'Unknown'.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
