# ibis-project/ibis #8239 — feat(risingwave): add streaming DDLs

**[View PR on GitHub](https://github.com/ibis-project/ibis/pull/8239)**

| | |
|---|---|
| **Author** | @KeXiangWang |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jcrist
> We're unfortunately in the midst of a large internals refactor moving all backends to use `sqlglot` instead of `sqlalchemy`...we don't really want to merge additional large PRs as this would complicate getting the refactor in.

### @gforsyth
> This would be a new API for Ibis -- should this be a standalone method? One possible alternative is to have a keyword argument to `create_view` that creates a materialized view instead.

### @chloeh13q
> I wonder how generalizable this is across different streaming backends...users coming from another backend, it may cause some confusion.

### @cpcloud
> I think we should keep this API separate from `create_view` for now, it's likely that materialized views will require some additional kwargs that don't apply to views.

### @gforsyth
> We've just merged in #8655 which moves us away from using the word `schema` in any hierarchical sense...standardizing on 'database' as a collection of tables.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
