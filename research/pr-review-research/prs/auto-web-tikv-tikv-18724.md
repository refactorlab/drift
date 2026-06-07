# tikv/tikv #18724 — GC: Move gc compaction to gc worker module

**[View PR on GitHub](https://github.com/tikv/tikv/pull/18724)**

| | |
|---|---|
| **Author** | @v01dstar |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @overvenus
> Dead code should be removed.

### @overvenus
> Consider implementing `RunnableWithTimer` and utilizing `tikv_util::worker::Worker`.

### @v01dstar
> Auto compaction is running in single thread, using cmd-action model is an overkill, the code would be more complicated.

### @overvenus
> Are they online configurable?

### @overvenus
> Can `total_range` be zero?

### @Connor1996
> please polish these names, `tikv_xxx` is verbose

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
