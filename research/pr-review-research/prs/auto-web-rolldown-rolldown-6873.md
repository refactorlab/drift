# rolldown/rolldown #6873 — feat: support vite-style tsconfig resolution

**[View PR on GitHub](https://github.com/rolldown/rolldown/pull/6873)**

| | |
|---|---|
| **Author** | @shulaoda |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Copilot
> The `find_tsconfig` operation is called on every file transformation in Auto mode. While there's caching of the merged options, the tsconfig lookup itself might be repeated. Verify that oxc_resolver's `find_tsconfig` has its own internal caching, otherwise consider adding a path-to-tsconfig-path cache to avoid redundant filesystem lookups.

### @sapphi-red
> (Approved the changes with a co-authored commit addressing the cache implementation in the build-context preparation logic, aligning the fix with the raised performance consideration.)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
