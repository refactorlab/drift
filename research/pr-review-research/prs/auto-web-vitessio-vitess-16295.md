# vitessio/vitess #16295 — adding new mysql shell backup engine

**[View PR on GitHub](https://github.com/vitessio/vitess/pull/16295)**

| | |
|---|---|
| **Author** | @rvrangel |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @shlomi-noach
> the mysqlshell method is the first and only (thus far) logical backup solution, so it's unfortunate that this solution will not support logical point in time recoveries.

### @shlomi-noach
> when these are all added, a new CI job will run to test `mysqlshell`-based backup, restores, and point-in-time recoveries.

### @shlomi-noach
> This feels risky. Please indicate caveats in this flag's description. Otherwise this looks 'too good', why wouldn't anyone want to speed up the restore?

### @deepthi
> Does the mysqlshell backup specifically backup only the actual keyspace/database?

### @frouioui
> the new workflow should eventually be marked as required and that vitess-operator changes would be needed separately for full support.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
