# google/jax #21394 — Implement LRU cache eviction for persistent compilation cache

**[View PR on GitHub](https://github.com/google/jax/pull/21394)**

| | |
|---|---|
| **Author** | @ayaka14732 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nouiz
> Can you link to the design doc? Also, would be good to have it documented somewhere? Like in the persistent_compilation_cache.html file?

### @hawkinsp
> I suspect there's a chance you might see stale `mtime` values if you stick the cache on NFS and you're accessing it concurrently from multiple clients (see `lookupcache` in the NFS docs).

### @skye
> This is a first cut at the LRU eviction implementation, so it isn't expected to work well with network file systems yet (notably GCS, which many Cloud TPU users use for their cache storage). We'll iterate from here.

### @superbobry
> Add filelock to build/test-requirements.txt and to the deps in tests/BUILD. Or skip the test for now if filelock is not importable.

### @gnecula
> Thank you for preparing this. Please squash the long chain of commits, or at least most of them.

### @ayaka14732
> Just realised that JAX had a `FileSystemCache` that supports LRU cache eviction introduced in #6869, but was subsequently removed in #10771 to support GCS. This is exactly one of the challenges that I faced in this PR.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
