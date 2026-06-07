# chroma-core/chroma #5867 — [ENH]: Execute task with no backfill or incremental

**[View PR on GitHub](https://github.com/chroma-core/chroma/pull/5867)**

| | |
|---|---|
| **Author** | @tanujnay112 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @HammadB
> Do we handle soft deletes for 1. Attaching 2. Comapction flush?

### @HammadB
> Do we properly handle empty compactions and the like here?

### @HammadB
> Also please just import Arc

### @HammadB
> yes, it's the same as normal compactions. That case is tested by compact.rs::test_compaction_with_empty_logs_from_inserts_and_deletes

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
