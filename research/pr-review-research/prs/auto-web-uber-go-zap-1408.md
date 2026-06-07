# uber-go/zap #1408 — zapslog: fix all with slogtest, support inline group, ignore empty group.

**[View PR on GitHub](https://github.com/uber-go/zap/pull/1408)**

| | |
|---|---|
| **Author** | @arukiidou |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @abhinav
> Once a Handler is constructed, consider all its fields immutable. Only new handlers (like the ones returned by WithAttrs) can have different values for those fields—that's the only time we can mutate them.

### @abhinav
> I made a few minor fixups and changed the `holdGroup` to a slice because the string can't handle cases like `WithGroup("foo").WithGroup("bar").Info("msg")`.

### @abhinav
> Logger name is already tested in WithName. It doesn't need to be duplicated in every test.

### @abhinav
> We could probably do this more efficiently with an immutable tree of references, but deferring that for now.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
