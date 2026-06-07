# tokio-rs/axum #3288 — Add macro to compile time check if a path is valid

**[View PR on GitHub](https://github.com/tokio-rs/axum/pull/3288)**

| | |
|---|---|
| **Author** | @tcanabrava |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jplatte
> This seems like a decent fit for `axum-extra`. I don't think it's going to be commonly-used enough to warrant being part of the `axum` API surface, at least initially.

### @jplatte
> Also, let's just not have this at all in Rust <1.80. I think having it exist but do nothing is more problematic than people getting compiler errors.

### @jplatte
> One final note, if you could add a changelog entry to `axum-extra/CHANGELOG.md` that would be nice.

### @jplatte
> No need to do anything about the many commits. I usually squash-merge.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
