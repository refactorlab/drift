# chroma-core/chroma #6842 — [ENH]: Integrate seal operator for sharded collections

**[View PR on GitHub](https://github.com/chroma-core/chroma/pull/6842)**

| | |
|---|---|
| **Author** | @tanujnay112 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sanketkedia
> nit: `for_all` suffix feels redundant to me. Can just name it `create_new_shard`?

### @sanketkedia
> can you add a TODO to later remove segment uuid since it is already a part of `Segment`?

### @tanujnay112
> this is intended for simplicity

### @tanujnay112
> we will fail to increment version and will be safe as long as we throw an error

### @tanujnay112
> i think this is wrong, i set it above

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
