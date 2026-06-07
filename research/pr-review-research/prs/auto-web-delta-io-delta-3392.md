# delta-io/delta #3392 — [Spark] Add Scala `clone`, `cloneAtVersion`, and `cloneAtTimestamp` API

**[View PR on GitHub](https://github.com/delta-io/delta/pull/3392)**

| | |
|---|---|
| **Author** | @Kimahriman |
| **Status** | Merged (by allisonport-db on Aug 19, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @longvu-db
> Could we make `version` `Int` for the `cloneAtVersion` APIs? looks like that's what the SQL code is doing as well.

### @Kimahriman
> `version` is tracked as a Long internally, so if SQL is parsing it as an int that sounds like a SQL parser bug

### @longvu-db
> Just a couple comments on the doc of the clone APIs, then I think the PR looks good to me.

### @longvu-db
> Could you give me the permission to push to your branch? I think add me as a collaborator to your Delta repro clone?

### @longvu-db
> Remove `clone*` from `ignoreMethods` and move them to `testedMethods`, you can keep `.filter(!_.isSynthetic)`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
