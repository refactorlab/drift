# launchbadge/sqlx #3334 — Fix: nextest cleanup race condition

**[View PR on GitHub](https://github.com/launchbadge/sqlx/pull/3334)**

| | |
|---|---|
| **Author** | @bonega |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @abonander
> instead of generating an arbitrary database name, we could generate one based on the path of the test function that's running...make it always clean up the test database afterward unless an environment variable is set

### @abonander
> we could instead hash the path. A SHA-256 hash is incredibly unlikely to collide and can be encoded in 64 hex characters, so in Base64 (with dash and underscore) would be more like... 40?

### @abonander
> Reminder to check this trait implementation for proper quoting of the database name. It doesn't look like it does it.

### @abonander
> Even with `URL_SAFE` the database name still needs to be quoted because it may contain dashes.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
