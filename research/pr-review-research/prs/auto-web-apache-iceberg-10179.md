# apache/iceberg #10179 — Introduces the new IcebergSink based on the new V2 Flink Sink Abstraction

**[View PR on GitHub](https://github.com/apache/iceberg/pull/10179)**

| | |
|---|---|
| **Author** | @rodmeneses |
| **Status** | Merged (August 26, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nastra
> please update these to Junit5 tests that use AssertJ assertions. You can use `TestRewriteDataFilesAction` as a reference

### @pvary
> Should we do that in a different PR? Either before, or after this? One of the important thing with this PR is, that the original behaviour is not changing.

### @pvary
> Please update the description of the PR. Also link the previous versions, docs, relevant stuff. So in the future it is easier to find them

### @rodmeneses
> I will have all _new_ unit tests using JUnit 5. All the others we can update in another PR, once this is merged.

### @stevenzwu
> yes, we should have a config to determine which sink implementation used for Table API/SQL. Default should be using the old `FlinkSink`.

### @tedyu
> the `writer` should be set to null after the `close` call.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
