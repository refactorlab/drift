# numba/numba #9662 — Type system implementation #1: Added initial implementation for a new type system using redundancies

**[View PR on GitHub](https://github.com/numba/numba/pull/9662)**

| | |
|---|---|
| **Author** | @kc611 |
| **Status** | Merged (Aug 1, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stuartarchibald
> I think it will be important to be consistent in the use of Python types solely in the `cpython` implementation part of Numba, and a preference for NumPy types in the `numpy` part of Numba.

### @stuartarchibald
> There are some modules which have been split where I think this could have been avoided for now through use of NumPy scalar constructors.

### @sklam
> The CI failures seems to be mostly network issues. One other problem is [test failure] which is due to LLVM15 and needs a merge main.

### @sklam
> [@kc611](https://github.com/kc611), is it expected that some tests fail to import with `NUMBA_USE_LEGACY_TYPE_SYSTEM=0`? For example, `test_typeinfer.py` [...] `AttributeError: module 'numba.core.types' has no attribute 'int8'.`

### @sklam
> [@kc611](https://github.com/kc611), this line will teach the `_typeof.cpp` how to associate the C-level typemap, which will also need to learn about the split types.

### @sklam
> Discussed with [@stuartarchibald](https://github.com/stuartarchibald) and [@kc611](https://github.com/kc611), the comments [...] will be addressed in a follow up PR as this PR is already very big.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
