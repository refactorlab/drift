# jestjs/jest #15619 — perf: migrate `resolve` and `resolve.exports` to `unrs-resolver`

**[View PR on GitHub](https://github.com/jestjs/jest/pull/15619)**

| | |
|---|---|
| **Author** | @JounQin |
| **Status** | Merged (by cpojer on Jun 3, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @SimenB
> That seems fine to me. But `paths` is also a core `require` feature, surprised the resolver doesn't support it?

### @SimenB
> Mind updating the docs as well?

### @SimenB
> do we still need the `fileWalkers` file if `unrs-resolver` does fs caching?

### @cpojer
> I assume this should have a noticeably positive perf impact on Jest. Would you be able to share the performance before and after?

### @cpojer
> Ok, I do believe they are flaky (not good), and I'm wondering if this PR is exacerbating the flakiness on CI. Let's move forward with this PR and see how it goes.

### @cpojer
> it seems like maybe your PR breaks on node 18 and 20 on all platforms. Would you be able to try running Jest on the older node versions?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
