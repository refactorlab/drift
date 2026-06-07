# apache/druid #15817 — Introduce Segment Schema Publishing and Polling for Efficient Datasource Schema Building

**[View PR on GitHub](https://github.com/apache/druid/pull/15817)**

| | |
|---|---|
| **Author** | @findingrish |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cryptoe
> MSQ does not support centralized data source schema yet. I think we should put this comment here.

### @cryptoe
> Can this cause threadSafety issues if we change the reference?

### @kfaraz
> Why is `SegmentSchemaMapping` not included inside the `SegmentsAndCommitMetadata` object itself?

### @kfaraz
> We should include `SegmentSchemaMapping` inside the `SegmentsAndCommitMetadata` itself.

### @cryptoe
> This check should be outside the transaction. Lets create a follow up patch for that.

### @kfaraz
> Since passing `null` is a very common usage right now, it would be better to keep two variants of the new methods.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
