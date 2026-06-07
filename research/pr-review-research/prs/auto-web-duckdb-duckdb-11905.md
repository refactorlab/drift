# duckdb/duckdb #11905 — [Appender] Add `AppendDefault`

**[View PR on GitHub](https://github.com/duckdb/duckdb/pull/11905)**

| | |
|---|---|
| **Author** | @Tishj |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Mytherin
> Thanks for the PR! Great idea. Some comments:

### @taniabogatsch
> Any performance-focused appender implementation most likely uses `duckdb_append_data_chunk`

### @Giorgi
> Not only performance-focused, `duckdb_append_data_chunk` is needed to append more 'complex' data types (uuid, decimal, enum, list, etc).

### @Mytherin
> I think this PR has too much stuff going on in it at this point...I propose the following changes to make this PR simpler and get it merged, then we can do follow-up work in subsequent PRs.

### @taniabogatsch
> Yes, but in a separate PR, we found some aspects to address and discuss first

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
