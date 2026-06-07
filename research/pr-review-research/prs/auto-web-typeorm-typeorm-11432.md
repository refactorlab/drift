# typeorm/typeorm #11432 — feat: add tagged template for executing raw SQL queries

**[View PR on GitHub](https://github.com/typeorm/typeorm/pull/11432)**

| | |
|---|---|
| **Author** | @Newbie012 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @alumni
> Do we have to serialize the parameters? Can't we use the same logic as `.query()` instead of implementing something specific only for this?

### @alumni
> I rarely have single-line SQL template strings...Could we also have indentation-stripping here?

### @alumni
> Should we provide some helper function (e.g. `safeValue`, `escapeAlias`) that return branded strings which are handled differently?

### @sgarner
> I'm not sure how useful raw SQL will be in generated migrations, since every database engine has proprietary syntax for DDL stuff.

### @sgarner
> To avoid another review cycle, I committed my suggested changes. There is still one superfluous test which I think could be dropped.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
