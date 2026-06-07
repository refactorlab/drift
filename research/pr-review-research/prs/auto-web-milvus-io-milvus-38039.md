# milvus-io/milvus #38039 — enhance: Add json key inverted index in stats for optimization

**[View PR on GitHub](https://github.com/milvus-io/milvus/pull/38039)**

| | |
|---|---|
| **Author** | @JsDove |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @czs007
> change storage_version to 25

(Requesting an adjustment to version numbering in the protocol buffer definitions for consistency.)

### @zhengbuqian
> Why are we making this method virtual?

(Questioning the design decision to virtualize `RawAt` on `ChunkedColumn.h` and noting potential method-hiding issues between `ChunkedArrayColumn` and the base class.)

### @zhengbuqian
> should this be double? or is int64 intentional?

(Clarifying whether integer or floating-point type is correct for test data values in `test_expr.cpp`.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
