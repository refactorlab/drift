# kysely-org/kysely #871 — add modifyEnd to insert, update and delete query builders

**[View PR on GitHub](https://github.com/kysely-org/kysely/pull/871)**

| | |
|---|---|
| **Author** | @thelinuxlich |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @igalklebanov
> The reviewer suggested simplifying the implementation rather than copying patterns from the `select` query builder, noting that `select` required specific approaches due to "structured and unstructured modifiers, and as of late `of`."

### @igalklebanov
> Requested that `modifyEnd` be added to `MergeQueryBuilder` as well, noting this was "tricky" due to the split into multiple builders but proposing that "anywhere `.top(...)` exists can also have a `modifyEnd` there."

### @igalklebanov
> Approved the simplified approach after the author refactored to "add a single cloneWithEndModifier" method reused across derived query nodes rather than duplicating logic.

> Note: This PR's inline review threads were largely collapsed as "resolved" on the public HTML page; the quoted fragments above are the substantive portions that rendered. Reviewer of record: @igalklebanov.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
