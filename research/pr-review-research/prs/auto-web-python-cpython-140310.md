# python/cpython #140310 — gh-139109: A new tracing JIT compiler frontend for CPython

**[View PR on GitHub](https://github.com/python/cpython/pull/140310)**

| | |
|---|---|
| **Author** | @Fidget-Spinner |
| **Status** | Merged (November 13, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @markshannon
> I thought the plan was to generate these exits, otherwise they get out of sync with the source instruction.

(Concerned that manually written exit code could diverge from the original instruction definitions.)

### @markshannon
> You seem to be using `code_curr_size` in various places for checking things other than just the uop count...Can you add comments and/or names for the constants for all comparisons involving `code_curr_size`?

### @markshannon
> I think this is the only use of `is_for_iter_test`, in which case replace it with `is_control_flow` and simplify this test.

### @markshannon
> This is a big step forward for the JIT. @Fidget-Spinner thanks again for doing this.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
