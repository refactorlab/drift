# prometheus/prometheus #17671 — tsdb(wal): st-per-sample initial code and benchmarks

**[View PR on GitHub](https://github.com/prometheus/prometheus/pull/17671)**

| | |
|---|---|
| **Author** | @ywwg |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bwplotka
> I am curious about `using a more efficient per-sample delta encoding` statements. Is V1 really less efficient than V2?

### @bwplotka
> Should we actually assert V2 for enabled storage? I guess that means we change appender code to actually use flag. Let's either do this or not change tests

### @bwplotka
> We can skip appendV1 tests changes. Appender V1 will never use new WAL formats

### @bwplotka
> Maybe you tried merging main changes? It's very hard to review this form.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
