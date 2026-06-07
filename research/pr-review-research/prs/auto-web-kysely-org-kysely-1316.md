# kysely-org/kysely #1316 — Support json_agg(column_ref)

**[View PR on GitHub](https://github.com/kysely-org/kysely/pull/1316)**

| | |
|---|---|
| **Author** | @SimonSimCity |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @igalklebanov
> How would you name such a helper without making stuff confusing (due to the existence of `jsonArrayFrom`)?

### @igalklebanov
> Can it be replicated with other dialects? people might get disappointed with other dialects not having something similar.

### @igalklebanov
> Regardless, this shouldn't be part of this PR

### @igalklebanov
> This could really use a unit test

### @igalklebanov
> Most times there's also a sql output check between execution and query, but I see this suite doesn't do these so it's fine.

### @igalklebanov
> since this PR introduces new functionality, we wanna keep it out of any documentation so it's parked in the next major release branch

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
