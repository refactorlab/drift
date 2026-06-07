# dmlc/xgboost #11808 — Make block_size of BuildHistKernel adaptive

**[View PR on GitHub](https://github.com/dmlc/xgboost/pull/11808)**

| | |
|---|---|
| **Author** | @razdoburdin |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Vika-F
> Previously block_size was always 256 rows, which is quite large. And now it is 1 row in case no more rows fit into L1. Won't this change affect the performance in the case when there are no enough space for rows in L1?

### @trivialfis
> Consider using `sizeof(GradientPair)` and `sizeof(GradientPairPrecise)` instead of `sizeof(float) * 2`

### @trivialfis
> Could you please elaborate on what it means to be the maximum number of elements in a (histogram) column? I thought that's the number of histogram bins?

### @trivialfis
> Is the `cache_sizes[idx]` valid if we break here?

### @trivialfis
> Could you please elaborate on how the current code detects the case and performs fallback? Is it guaranteed that under VM, `if (type == kCpuidTypeNull) break` is true?

### @trivialfis
> what happens to CPUs with efficient/performance cores, or what happens with CPUs that have different dies (for example, amd 3d cache)?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
