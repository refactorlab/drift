# go-gorm/gorm #7450 — fix decimal migrate error.

**[View PR on GitHub](https://github.com/go-gorm/gorm/pull/7450)**

| | |
|---|---|
| **Author** | @Chise1 |
| **Status** | Merged (by jinzhu on Jun 6, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @a631807682
> Please add some tests in https://github.com/go-gorm/gorm/blob/master/tests/migrate_test.go

### @a631807682
> I think this can be a temporary solution, and the comments need to be handled later... I think the specific types (decimal/numeric) should be abstracted out and handled by the driver, which may require extending the ColumnType interface

### @Copilot
> [Nitpick] The Go convention is to use uppercase acronyms; rename `modifySql` to `modifySQL`

### @demoManito
> Approved changes after rounds of iteration (acceptance following the author's revisions addressing earlier feedback on test implementation).

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
