# tokio-rs/tracing #3069 — v0.1.x: clean up warnings

**[View PR on GitHub](https://github.com/tokio-rs/tracing/pull/3069)**

| | |
|---|---|
| **Author** | @djc |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @djc
> There is no `alloc` features defined in this crate right now.

### @djc
> There doesn't appear to be defined feature for `futures_preview`.

### @djc
> There's no feature defined for `tower-util`.

### @kaffarell
> LGTM, fixes all the clippy/fmt errors I got (except the comment obviously).

### @davidbarsky
> LGTM; would be good to have these on master as well.

### @kaffarell
> IMO either we try to release 0.2.x soonish, or we reverse the roles and have 0.1.x -> master and master -> 0.2.x.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
