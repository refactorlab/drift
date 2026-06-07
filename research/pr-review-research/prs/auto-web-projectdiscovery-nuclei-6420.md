# projectdiscovery/nuclei #6420 — cache, goroutine and unbounded workers management

**[View PR on GitHub](https://github.com/projectdiscovery/nuclei/pull/6420)**

| | |
|---|---|
| **Author** | @knakul853 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dwisiswant0
> minor: lint error...SA1019: dslRepo.ErrParsingArg.Error is deprecated: Use errkit.ErrorX instead.

### @coderabbitai
> Index is added to InFlight before the HostErrorsCache check; on skip the entry is never cleaned, impacting resume/memory.

### @coderabbitai
> Copy the value before enqueue so workers don't observe reused/mutated structs.

### @coderabbitai
> Without eviction, the first 4096 unique entries persist forever; after that, no new items are cached.

### @coderabbitai
> sync.Pool can retain very large buffers after spikes. Consider a small helper that resets and only pools buffers under a cap.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
