# launchbadge/sqlx #3188 — feat(cube): support postgres cube

**[View PR on GitHub](https://github.com/launchbadge/sqlx/pull/3188)**

| | |
|---|---|
| **Author** | @jayy-lmao |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @abonander
> This should be a FromStr impl. It's fine to have both, but it's surprising to have a TryFrom<&str> impl and not a FromStr impl.

### @abonander
> one last thing, since #3126 was merged, you'll need to rebase and fix the compilation errors.

### @abonander
> Note that I only today realized that main has been broken for the past few weeks and I'm still working on fixing Clippy warnings

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
