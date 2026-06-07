# typeorm/typeorm #11332 — feat: add new undefined and null behavior flags

**[View PR on GitHub](https://github.com/typeorm/typeorm/pull/11332)**

| | |
|---|---|
| **Author** | @naorpeled |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sgarner
> There are good reasons why the designers of SQL decided that `NULL = NULL` was false and required the use of the `IS NULL` operator to match null values... Automatically converting JS `null` into SQL `IS NULL` is a dangerous foot-gun because `null` values in JS can arise from the results of other operations, user input, and other sources where the developer didn't expect it.

### @sgarner
> If nulls were transformed automatically, this could execute: `SELECT * FROM secret WHERE project_id IS NULL`. Oh no, that's not what we wanted! We just leaked all the secrets that aren't assigned to any project.

### @coderabbitai
> Broaden JSDoc scope beyond 'find operations'... This option applies to all where-capable operations (find, query builders, repository/manager update/delete/soft-delete).

### @coderabbitai
> When parameterValue === null, the earlier null-behavior block already throws/continues; only 'sql-null' falls through. The 'throw' here is dead code.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
