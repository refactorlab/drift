# python/cpython #124640 — GH-91048: Add utils for capturing async call stack for asyncio programs and enable profiling

**[View PR on GitHub](https://github.com/python/cpython/pull/124640)**

| | |
|---|---|
| **Author** | @1st1 |
| **Status** | Merged (January 22, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mpage
> Thanks for doing this! Do you know how much overhead the awaiter tracking adds?

### @picnixz
> Didn't we remove typing imports recently from asyncio to speed-up import time?

(Noting this change would revert that optimization.)

### @kumaraditya303
> The C implementation is thread safe so new code should ideally be thread safe as well

(Flagged thread-safety considerations and mentioned future free-threading compatibility concerns.)

### @ambv
> First off, I don't think the crusade to remove typing imports from the standard library makes sense.

### @pablogsal
> I ran some async benchmarks from pyperformance and a small echo tcp server and the Perf impact is below the noise.

### @markshannon
Requested clarification on the design approach, questioning whether the implementation strategy was optimal for tracking awaited relationships between tasks.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
