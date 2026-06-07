# diesel-rs/diesel #5049 — Add support for PostgreSQL's RETURNING old.column

**[View PR on GitHub](https://github.com/diesel-rs/diesel/pull/5049)**

| | |
|---|---|
| **Author** | @Ten0 |
| **Status** | Merged (May 28, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @weiznich
> Overall I like the implementation. This looks reasonable to add. I still have some smaller questions and minor requests to improve certain details.

### @weiznich
> It's fine to not have them, but I would like to have a comment with the reason then. Otherwise I fear someone will wonder about that in a few month/years.

### @weiznich
> Given that some of this happens in a different file, it also might be useful to move everything into one location?

### @Ten0
> I opted to not have them: for returning from a delete just listing the field names gives old values, so writing `old.` seems less idiomatic.

### @weiznich
> For transparency: I just squashed all the commits and used the PR description as commit message.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
