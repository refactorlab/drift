# cupy/cupy #9654 — Cython Compilation Warnings of implicit noexcept

**[View PR on GitHub](https://github.com/cupy/cupy/pull/9654)**

| | |
|---|---|
| **Author** | @ManuCorrea |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @seberg
> One really needs to be careful with what the code does and only use noexcept if it's very clear it really cannot fail!

### @leofang
> It is nerve-wrecking that we have `noexcept` added to so many places. Are we sure these are guaranteed to not raise?

### @matusvalo
> The ideal approach would be to remove `legacy_implicit_noexcept` argument and make all function without `except` clause as `noexcept`.

### @seberg
> I would be completely fine just keeping the warnings for functions where we may want to refactor it to e.g. introduce a return value that can indicate an error.

### @leofang
> We could declare this as `cdef int get_reduced_dims(...) except? -1:` so that we don't generate any Python wrapper.

### @seberg
> Since we don't have _incorrect_ `noexcept` now with CI, the main regression would be speed for `noexcept *` uses in hot paths.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
