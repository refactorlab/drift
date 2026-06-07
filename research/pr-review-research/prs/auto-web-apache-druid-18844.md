# apache/druid #18844 — Implement a fingerprinting mechanism to track compaction states in a more efficient manner

**[View PR on GitHub](https://github.com/apache/druid/pull/18844)**

| | |
|---|---|
| **Author** | @capistrant |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kfaraz
> The templates should only perform lightweight (i.e. non-IO) read-only operations as `createCompactionJobs` may be called frequently. We should not do any persistence here.

### @kfaraz
> Let's always keep all the compaction states in memory. We are already keeping all the used segments in memory. The distinct `CompactionState` objects will be fairly small in number and size.

### @clintropolis
> is this cool? as in, like does it matter that this will this be missing all of the jackson modules that get registered with the normal jsonMapper?

### @clintropolis
> should this be done as part of the same transaction that does the other stuff? same question for other similar calls in this file.

### @clintropolis
> nit: might be about time to break this down and have separate messages per problem

### @kfaraz
> I don't think the number of distinct `CompactState` objects that we keep in memory will increase after this patch. Do we still need to worry about the cache size?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
