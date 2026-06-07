# foundry-rs/foundry #11547 — feat(`forge`): backtraces

**[View PR on GitHub](https://github.com/foundry-rs/foundry/pull/11547)**

| | |
|---|---|
| **Author** | @yash-atreya |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @DaniPopes
> This does enable steps tracing on -vvv which is 2-3x slower even when no tests fail. I think this is probably fine, however we might want to look into re-executing failing tests since this level of tracing is only needed when they fail.

### @DaniPopes
> Edit: we can further optimize this by not requesting stack snapshots since we don't need them. I think we just want jump steps.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used). Note: this PR's review discussion was light; the captured comments above are the substantive reviewer concerns (performance trade-offs of step tracing).*
