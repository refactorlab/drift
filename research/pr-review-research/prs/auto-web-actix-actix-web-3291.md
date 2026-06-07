# actix/actix-web #3291 — Add `unicode` feature to switch between `regex` and `regex-lite` crates as a trade-off between full unicode support and binary size

**[View PR on GitHub](https://github.com/actix/actix-web/pull/3291)**

| | |
|---|---|
| **Author** | @yujincheng08 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @robjtede
> So the benefit of `regex` over `regex-lite` is it's unicode support so I think what I'd prefer is a feature flag called `unicode` (bikeshedding tbd), enabled by default, where disabling it falls back to `regex-lite`.

### @yujincheng08
> I think there's also performance gain when using `regex` over `regex-lite`. The principal difference between the `regex` and `regex-lite` crates is that the latter prioritizes smaller binary sizes and shorter Rust compile times over performance and functionality.

### @robjtede
> Another good reason to have this be an on-by-default feature since this will be sort of 'infectious' as a transitive dep. Thankfully, most third party libs use default-features = false already.

### @robjtede
> I've made some changes to isolate the conditional Regex logic (for actix-router at least) in a separate module which also allows us to keep using `regex::RegexSet` for better perf.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
