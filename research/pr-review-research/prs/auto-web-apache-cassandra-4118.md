# apache/cassandra #4118 — CASSANDRA-20336 (Add mutation tracking summary to SSTables)

**[View PR on GitHub](https://github.com/apache/cassandra/pull/4118)**

| | |
|---|---|
| **Author** | @aratno |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aweisberg
> You can make `MutationIdRanges` and interface, and then have the implementation extend `Long2ObjectHashMap` directly so there is no pointer chasing to access the map.

### @bdeggleston
> This really needs 3 classes, an immutable one, a mutable concurrent one, and a builder and/or static merge method.

### @bdeggleston
> A more accurate name would also be good since these aren't ranges of mutation ids, but the highest mutation id that exists in a memtable/sstable.

### @aweisberg
> This is a major change? What is the reasoning behind this? Does this create scenarios where people can't access data due to missing or corrupted stats files?

### @aweisberg
> This particular class isn't built that often so a wrapper builder isn't a big deal, but it is a wasted allocation.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
