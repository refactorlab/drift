# apache/cassandra #4402 — Add cursor-based low allocation optimized compaction implementation

**[View PR on GitHub](https://github.com/apache/cassandra/pull/4402)**

| | |
|---|---|
| **Author** | @nitsanw |
| **Status** | Merged (December 19, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @blambov
> This approach that bundles all the steps of the processing in one single file will be quite difficult to maintain and keep in sync with the combination of iterators and transformations that we use in other parts of the code such as the query path.

### @blambov
> Personally, I am very unhappy about switching to mutable, pooled and reused objects, which are significantly more unwieldy and error prone, especially in contexts where concurrent access can occur.

### @blambov
> Suddenly making a `DeletionTime` mutable is not an acceptable change.

### @netudima
> Should we add some tests for schema change use cases? When we flush initially data using one version of schema and then do some schema changes and then do a compaction of SSTables written using the old schema and the new schema together.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
