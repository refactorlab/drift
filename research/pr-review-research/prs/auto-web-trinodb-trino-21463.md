# trinodb/trino #21463 — Add support for storing metadata to metastore in Delta Lake

**[View PR on GitHub](https://github.com/trinodb/trino/pull/21463)**

| | |
|---|---|
| **Author** | @ebyhr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @findinpath
> We need compatibility tests with Delta Lake OSS where Spark writes to the table and Trino is constrained to update the metadata caching properties on any read/write operation.

### @findepi
> we should maintain a sort of a queue of pending updates and scheduling new update logically remove previous entry...the update manager should deduplicate (updates coming from different transactions) and perform actual updates

### @findepi
> This looks like efficient operation, but it's not good API at least for Glue. Getting table names is as expensive as getting all table information

### @findepi
> Regardless of whether we compress or not, we should have a check on length.

### @findinpath
> In case of referencing multiple times the same table in a query, is this check supposed to avoid calling metastore table replace repeatedly for the same table? I don't follow where we ensure that the call is made only once.

### @findepi
> the update should be propagated to the metastore after transaction is committed

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
