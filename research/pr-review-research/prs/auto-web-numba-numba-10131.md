# numba/numba #10131 — Added initial typed set implementation based on typed dict implementation

**[View PR on GitHub](https://github.com/numba/numba/pull/10131)**

| | |
|---|---|
| **Author** | @kc611 |
| **Status** | Merged (Mar 26, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @seibert
> Requested changes on multiple file sections including setobject.h, containers.py, and test_setimpl.py, indicating substantive concerns about implementation details across the C and Python layers.

### @swap357
> I was able to trace the `discard()` issues with iterator to C code

### @swap357
> Note: `set: types.Set` here maps to the reflected set. typed set (`types.SetType`) isn't mapped, so `isinstance(typed_set, set)` would return `False` in JIT

### @swap357
> Tested this thoroughly, no critical bugs remain, no memory leaks. performance - constant time per operation across scaling. Good to merge.

### @swap357
> Posted detailed review comments on test_setimpl.py and setobject.c following local testing and C-code tracing of the discard implementation.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
