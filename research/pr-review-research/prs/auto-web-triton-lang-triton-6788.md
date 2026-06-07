# triton-lang/triton #6788 — Use variadic argument pre-compiled cuda launcher

**[View PR on GitHub](https://github.com/triton-lang/triton/pull/6788)**

| | |
|---|---|
| **Author** | @vwbaker |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @peterbell10
> I don't think there's any inherent issue with using C++ and pybind11 for convenience wrappers of the CPython API. I do think that pybind11's function bindings have quite significant overhead though.

### @ThomasRaoux
> 5 us second overhead isn't negligible and I'm not sure the comparison to first call is comparable as in general the cache can be pre-generated offline and re-used.

### @ptillet
> seems pretty scary to have the driver depend on LLVM!

### @bertmaher
> Most of our production machines don't have a compiler toolchain installed, so we have to call a remote compilation service just to compile these launch functions.

### @peterbell10
> Awesome, would be great to see some benchmark results.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
