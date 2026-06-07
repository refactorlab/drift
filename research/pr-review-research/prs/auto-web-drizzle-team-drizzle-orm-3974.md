# drizzle-team/drizzle-orm #3974 — RQB v2

**[View PR on GitHub](https://github.com/drizzle-team/drizzle-orm/pull/3974)**

| | |
|---|---|
| **Author** | @Sukairo-02 |
| **Status** | Merged (into the `1.0.0-beta.1` branch, March 13, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

This was a large feature PR (RQB v2 / relational query builder rewrite). The conversation thread was dominated by celebration reactions and procedural release announcements rather than line-by-line review prose. The most substantive verbatim statements are below.

### @AndriiSherman
> Tonight, we are adding the final commits to the RQBv2 PR and merging it into the "1.0.0-beta.1" version under the "beta" npm tag.

### @AndriiSherman
> seems like we are super close to merging this one

### @Sukairo-02
> Yes, already does.

(In response to a question about whether nested `orderBy` is supported.)

### @AndriiSherman
> yes

(Confirming `where` clause support in the new builder.)

Note: Breaking changes called out in the thread included database instances gaining two additional generic arguments, RQB v1 access moving from `db.query` to `db._query`, and several relation exports relocating to `drizzle-orm/_relations`.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
