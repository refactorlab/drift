# surrealdb/surrealdb #6079 — Invert expression value relation and move ast types out of value.

**[View PR on GitHub](https://github.com/surrealdb/surrealdb/pull/6079)**

| | |
|---|---|
| **Author** | @DelSkayn |
| **Status** | Merged (August 8, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

Most of this PR's review threads load only via JavaScript and surfaced as
collapsed/resolved on the web view. The two inline review comments from @kearfy
that were retrievable verbatim:

### @kearfy
> TODO: Figure out if it is possible if multiple actions can have the same method, and if so should they all be run?

### @kearfy
> condition already checked above. either method_action is some or api fallback is some. unreachable!()

Additional reviewers (approvals, no quotable text retrievable): @rushmorem,
@ssttuu (resolved comments on `native.rs` and `plan.rs`), @kearfy.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
