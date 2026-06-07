# quickwit-oss/tantivy #2711 — feat: added filter aggregation

**[View PR on GitHub](https://github.com/quickwit-oss/tantivy/pull/2711)**

| | |
|---|---|
| **Author** | @mdashti |
| **Status** | Merged (Nov 18, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @PSeitz
> Why do we use `SerializableQuery` when the query cannot be serialized?

### @PSeitz
> I think a query constructor would be more suitable here, than de/serializing runtime objects, which may carry state.

### @PSeitz
> I don't think we should put cached objects here. I also don't understand why we would need that, we can just execute the query directly and put the result into `FilterAggReqData`

### @PSeitz
> All the tests should include a deser roundtrip

### @PSeitz
> benchmark in a test doesn't make sense

### @PSeitz
> this should be moved to FilterAggReqData

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
