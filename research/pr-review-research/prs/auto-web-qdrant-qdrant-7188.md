# qdrant/qdrant #7188 — slow requests log

**[View PR on GitHub](https://github.com/qdrant/qdrant/pull/7188)**

| | |
|---|---|
| **Author** | @generall |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @timvisee
> Is sorting still required here? I believe we don't use this to hash anymore, do we?

### @generall
> It is needed for deduplicating requests. This simplified payload will be hashed.

### @timvisee
> Why do we only have this collector line in `query_batch`? And not in `facet`, `retrieve`, `count`... for example.

### @generall
> this is in todo for further PRs

### @timvisee
> We should only log here if we actually run `CollectionUpdater::update`. It may not happen if flushing WAL above failed.

### @generall
> fixed

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
