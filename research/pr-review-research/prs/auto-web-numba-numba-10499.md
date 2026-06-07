# numba/numba #10499 — Fix swapped shapes in slice assignment error message - Fixes #10402

**[View PR on GitHub](https://github.com/numba/numba/pull/10499)**

| | |
|---|---|
| **Author** | @Meenakshi-1802 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @esc
> [@Meenakshi-1802](https://github.com/Meenakshi-1802) thank you for this, can you add a test perhaps?

### @esc
> The following test cases are failing, please fix: FAIL: test_1d_slicing_set_list_npm... FAIL: test_setitem_broadcast_error...

### @esc
> Can you please undo the whitespace changes introduced in [commit] and please fix the remaining test case failures instead, thank you.

### @esc
> This refactor is too invasive. Please just flip the shapes in the expected `msg.`

### @esc
> The revert of the whitespace fixes is fine, but you seem to have gone in the other direction and now removed whitespace where it existed.

### @esc
> Looks perfect, thank you for your perseverance! 🎉

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
