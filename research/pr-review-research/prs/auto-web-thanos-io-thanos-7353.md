# thanos-io/thanos #7353 — Receiver: cache matchers for series calls

**[View PR on GitHub](https://github.com/thanos-io/thanos/pull/7353)**

| | |
|---|---|
| **Author** | @pedro-stanaka |
| **Status** | Merged (January 3, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @GiedriusS
> I suggest using `singleflight` here to reduce allocations even more

### @GiedriusS
> Maybe we can just use `pkg/cache/inmemory.go`? It's another LRU implementation that already exists in the tree.

### @yeya24
> Should we move this code out of `storepb` package? `storepb` sounds more related to the proto itself but this matcher cache can be more generic

### @alanprot
> Is it possible to make this interface receive the Prometheus types, instead thanos ones, so we can reuse the same implementation on cortex?

### @yeya24
> Same here. Can we take prometheus matcher as input key?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
