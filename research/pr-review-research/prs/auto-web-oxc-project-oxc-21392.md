# oxc-project/oxc #21392 — feat(linter/release): automate oxlint rule version updates

**[View PR on GitHub](https://github.com/oxc-project/oxc/pull/21392)**

| | |
|---|---|
| **Author** | @penkzhou |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @camchenry
> Let's make this a JavaScript script that we run with node. No Rust source code parsing, so it will be simpler and faster.

### @camchenry
> We don't need a separate `check` tool - we only ever call this after we just rewrote the version, so this is redundant.

### @camchenry
> the tests were helpful while developing this, but I don't think we'll need them long-term...keeps things simpler too.

### @camc314
> if you want to take another look too since it's release related

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
