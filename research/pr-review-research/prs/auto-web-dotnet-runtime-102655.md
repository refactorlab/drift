# dotnet/runtime #102655 — NonBacktracking Regex optimizations

**[View PR on GitHub](https://github.com/dotnet/runtime/pull/102655)**

| | |
|---|---|
| **Author** | @ieviev |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stephentoub
> In our previous conversations, you mentioned you thought inner vectorization would be possible, where we could vectorize within a match rather than just finding the next starting place. I don't see that in this PR. Is that possible?

### @stephentoub
> I'm a bit concerned though that when running this on our own perf test suite, I'm seeing regressions in various places...Some of the more concerning ones were `\p{Sm}` and `.{2,4}(Tom`, which regressed throughput by ~50%

### @ieviev
> An optimized DFA will give you a very consistent worst case throughput of somewhere around 500mb/s on any pattern...AVX on benchmarks is a bit of a gamble

### @danmoseley
> IIRC essentially all the tests for the non backtracking are also run against the other engines...Is that what you're looking to do?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
