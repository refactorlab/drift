# webpack/webpack #18772 — feat: add new optimization.entryIife config

**[View PR on GitHub](https://github.com/webpack/webpack/pull/18772)**

| | |
|---|---|
| **Author** | @fi3ework |
| **Status** | Merged (September 25, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @alexander-akait
> Also if we can optimize iife better in future, make sense to rename option `avoidIife` or `optimizeIife` and in future we will improve it better

### @alexander-akait
> We need a test here, I think it is unnecessary, because we already renamed them before

### @fi3ework
> It's necessary. The initial value of `renamedInlinedModule` is `false`. If `avoidEntryIife` is enabled...the inlined module will still be wrapped in an IIFE for those reasons.

### @alexander-akait
> I still think we can get this into a plugin, because we can do more optimization in future

### @alexander-akait
> Just try const renderedModule = this.renderModule(...) And the output the same

### @alexander-akait
> I'll merge it now because the logic works completely, but I still think we should have thought about new hooks

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
