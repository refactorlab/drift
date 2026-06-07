# uber-go/zap #1519 — Update lazy logger not to materialize unless it's being written to

**[View PR on GitHub](https://github.com/uber-go/zap/pull/1519)**

| | |
|---|---|
| **Author** | @rabbbit |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @prashantv
> this seems reasonable, though I am wondering whether we can do a more thorough check here... we pass `nil` since we don't want the underlying core to add itself to the `CheckedEntry`...

### @rabbbit
> So this I wondered about and this is where my knowledge of zap ended... the zapcore documentation says... which make it sound like by calling CheckedEntry, we'll have two cores having the same message...

### @prashantv
> `Check` may decide not to log for reasons other than level, e.g., take a look at the sampler... reasoning about whether this will work correctly with sampling is non-trivial, so I think it may be better to stick to the level check only.

### @rabbbit
> I guess I'd want to avoid that one alloc if possible too.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
