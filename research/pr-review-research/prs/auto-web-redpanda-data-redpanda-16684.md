# redpanda-data/redpanda #16684 — archival: Add archiver_service

**[View PR on GitHub](https://github.com/redpanda-data/redpanda/pull/16684)**

| | |
|---|---|
| **Author** | @Lazin |
| **Status** | Merged |
| **Source** | GitHub conversation + files-changed pages (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @andrwng
> Just curious why this was needed?

(On moving `archival_metadata_stm` from the cluster module to the archival module.)

### @Lazin (author response)
> move STM to the corresponding module

…noting that the stm manager now supports this, and "eventually we should be able to build the `archival` separately from cluster" — framing the refactor as a step toward modular independence.

---
*Note: This is a large, long-running PR (184 comments). Most of the review discussion threads are collapsed / lazy-loaded and did not render in the public HTML page, so only the comments above could be extracted verbatim without an API token.*

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
