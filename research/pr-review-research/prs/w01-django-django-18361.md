# django/django #18361 — Added generic support for Aggregate.order_by

**[View PR on GitHub](https://github.com/django/django/pull/18361)**

| | |
|---|---|
| **Author** | @camuthig |
| **Status** | ✅ merged (2025-03-03) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> One reviewer (`charettes`) is a whole-system safety net — teaching the `F()`-reference vs `Value` distinction, guarding the test suite's speed, and catching Oracle/NULL semantics across four databases. The value is the context the author *can't* have.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@charettes:**
> delimiter should not be wrapped in a Value as that prevents references to columns and normally string arguments are considered to be F-ield references.

**@charettes:**
> Try reuse the existing models defined in aggregation/models.py instead. We can't add new tables/models for each new feature otherwise the suite slowly gets slower.

**@charettes:**
> Django uses a NCLOB column to persist JSONField and Oracle doesn't allow to GROUP BY a NCLOB field.

**@charettes:**
> It seems that SQLite, Postgres, MySQL, and Oracle all return NULL which should translate to None?


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
