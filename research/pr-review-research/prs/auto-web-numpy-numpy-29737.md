# numpy/numpy #29737 — ENH, API: New sorting slots for DType API

**[View PR on GitHub](https://github.com/numpy/numpy/pull/29737)**

| | |
|---|---|
| **Author** | @MaanasArora |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mhvk
> I'd suggest we ensure that the (arg)sort loops have the standard array method loop signature... This is obviously needed if we move to (arg)sort being `gufunc`s, but I think it is good regardless, just not to expand special cases.

### @mhvk
> isn't it better to define the API as just having only one `sort` and one `argsort` function that take `flags`? Much easier to extend in the future.

### @seberg
> I think optimization is actually a reason to expose the `get_*` style API...it makes it much easier to reason about how to build an optimized version for structured dtypes.

### @charris
> The type specific sorts gain speed by having `<` built in...even for the generic loops, that might be the way to go, instead of looking for -1 returned by the compare functions, look for +1.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
