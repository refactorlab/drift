# vercel/turborepo #11130 — feat: Add experimentalObservability with an OTel backend

**[View PR on GitHub](https://github.com/vercel/turborepo/pull/11130)**

| | |
|---|---|
| **Author** | @bkonkle |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @anthonyshew
> In `tracker.rs:246`, there's a check looking for `--summarize`. So now this feature will only work with that flag. This is my fault, so happy to fix this myself.

### @anthonyshew
> Separately, I'm also noticing that the feature flag is cosmetic. `turborepo-config` and `turborepo-lib` unconditionally compile the full OTel dep tree. We can get rid of it entirely.

### @anthonyshew
> The failure in `windows (partition 7/10)` is a known issue, caused by recent changes to our integration test suite. Merging past, as #12039 is meant to fix it.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
