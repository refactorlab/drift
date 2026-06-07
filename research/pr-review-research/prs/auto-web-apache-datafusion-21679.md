# apache/datafusion #21679 — Add lambda support and array_transform udf

**[View PR on GitHub](https://github.com/apache/datafusion/pull/21679)**

| | |
|---|---|
| **Author** | @gstvg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @adriangb
> I just wanted to bring to attention that DuckDB deprecated this very syntax because of conflicts with JSON operators

### @gstvg
> I think this decision can be left to the user via the configurable dialect, as today. This PR merely consumes the LambdaFunction from sqlparser-rs AST

### @alamb
> this is pretty amazing -- I put a note to include it in the 55 release's notes

### @timsaucer
> This is definitely one of the things I am most excited about in the next release. This is going to be huge!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
