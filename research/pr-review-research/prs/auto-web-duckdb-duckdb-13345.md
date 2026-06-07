# duckdb/duckdb #13345 — add some RealNest benchmarks

**[View PR on GitHub](https://github.com/duckdb/duckdb/pull/13345)**

| | |
|---|---|
| **Author** | @ZuleykhaPavlichenkova-TomTom |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @taniabogatsch
> Currently, this PR focuses heavily on the `UNNEST`. In future PRs, it would be nice to see more operations directly on the nested types without unnesting them.

### @Tmonster
> Also, could you rename all of the single digit benchmarks so that they are prefixed with a `0`? I.e, instead of `1_list_sort_text.benchmark` it's `01_list_sort_text.benchmark`, then they show up as sorted in the file system

### @Tmonster
> Also can you add this as a regression test to the `Regression.yml` You can add it after the `regression test csv` step...

### @taniabogatsch
> Hi @hmeriann, I had a look at the changes and added a few more comments. Great work!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
