# launchbadge/sqlx #3126 — Make Encode return a result

**[View PR on GitHub](https://github.com/launchbadge/sqlx/pull/3126)**

| | |
|---|---|
| **Author** | @FSMaxB |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @abonander
> In general, we need to be careful not to leave argument buffers in an invalid state on error, in case someone decides to retry.

### @abonander
> Looks good with one final nit.

### @FSMaxB
> Getting the macros to work again is really tricky as it turns out!

### @abonander
> _(Approved and merged after FSMaxB added buffer rollback implementations for MySQL, SQLite, and PostgreSQL argument buffers — see the buffer-invalid-state concern above.)_

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
