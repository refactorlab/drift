# temporalio/temporal #8223 — Degraded workflow visibility

**[View PR on GitHub](https://github.com/temporalio/temporal/pull/8223)**

| | |
|---|---|
| **Author** | @spkane31 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @bergundy
> Something that you should be considering as well is replication. There's some exceptions in replication of workflow tasks beyond a certain attempt.

### @bergundy
> I think this method is idempotent and only a single task would be created but worth validating that assumption or ensuring that it works this way.

### @bergundy
> Counts don't matter, please fix this, it's only the unique set values that matter.

### @bergundy
> I don't think your code covers the case where the last failure changes from timeout to failure and back.

### @bergundy
> This would be a critical error, not a warning.

### @spkane31
> From my reading of the code: the method itself is not idempotent but the elasticsearch processor does deduplication so only a single visibility update is actually processed.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
