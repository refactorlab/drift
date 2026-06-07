# launchbadge/sqlx #3723 — Add SqlStr

**[View PR on GitHub](https://github.com/launchbadge/sqlx/pull/3723)**

| | |
|---|---|
| **Author** | @joeydewaal |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @abonander
> At minimum I would still delete the `Execute` trait though...Lay some of the groundwork for the execution model refactor I've been meaning to do (run the connection on a background task for parallelism and cancellation safety)

### @abonander
> (Also, I don't assume you intended to do this, but you erased my authorship in these commits.)

### @joeydewaal
> This wasn't my first time trying to make this PR work...I eventually just copied over the `sql_str.rs` file but didn't think about authorship. I'll rebase when I work on this some more.

### @joeydewaal
> If I'd have to guess I'd say that the lifetimes would've probably been used before #1551 but were not touched because of backwards compatibility...should these be removed?

### @abonander
> Yeah, deleting the lifetimes on `Arguments` was an idea, though `AnyArguments` also uses it when encoding `&str`...It saves a copy when later encoding into the database-specific format.

### @abonander
> On second thought, I'd rather just merge this. I think `QueryBuilder` already draws enough attention to itself.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
