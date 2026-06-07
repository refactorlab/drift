# JuliaLang/julia #53219 — Refactor CodeInfo/CodeInstance separation and interfaces

**[View PR on GitHub](https://github.com/JuliaLang/julia/pull/53219)**

| | |
|---|---|
| **Author** | @Keno |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @vtjnash
> Might be much safer not to change this API, and just ignore the extra argument. I want to be able to use it in the future to improve compression ratios anyways

### @vtjnash
> The pair of conditions though `(ci.inferred !== nothing || ci.invoke != C_NULL)` seems to be not something that has a well-defined meaning in a multithread program (e.g. it introduces a data-race here).

### @vtjnash
> If this codeinst is not in a cache, that means it is not legal to call this method, as this method pushes the object into the global debuginfo / JIT structs and later returns those, which can result in GC use-after free bugs

### @vchuravy
> This will conflict with #52233 which I am hoping to merge in the next few days. I went through this PR and I didn't see anything to bad, only my unease about uncached CodeInstances :)

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
