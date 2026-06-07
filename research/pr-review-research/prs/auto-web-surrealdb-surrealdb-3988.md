# surrealdb/surrealdb #3988 — Consolidate authentication methods

**[View PR on GitHub](https://github.com/surrealdb/surrealdb/pull/3988)**

| | |
|---|---|
| **Author** | @geraname |
| **Status** | Merged (May 22, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @phughk
> It's not backwards compatible and it's not feature gated, so as soon as this merges, then we have changed the product.

### @geraname
> This change is intended to be a breaking change for 2.0, hence why this PR is against `main` instead of `1.x`.

### @phughk
> Perhaps in the future I would try branching it out into separate PRs and feed the smaller PRs in one-by-one. Makes it easier to review and reason about.

### @geraname
> This PR does away with the concept of scopes and tokens (which are heavily interdependent), which requires implementing an alternative to keep existing functionality.

**Note:** Additional inline threads on `core/src/dbs/session.rs`, `core/src/err/mod.rs`, and `core/src/fnc/...` from @tobiemh were marked resolved and their text did not load on the web view.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
