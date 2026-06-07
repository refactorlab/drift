# microsoft/LightGBM #6569 — [c++] Fix `dump_model()` information for root node

**[View PR on GitHub](https://github.com/microsoft/LightGBM/pull/6569)**

| | |
|---|---|
| **Author** | @neNasko1 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jameslamb
> I'm not sure if this will correctly handle these cases: custom `init_score` provided (via `Dataset`); `boost_from_average=False` passed

### @jameslamb
> I am going to try right now to figure out why that was, and if it has implications for this PR.

### @jameslamb
> Just some small suggestions on the new Dask test, and then I think we can merge this.

### @neNasko1
> I think those cases are handled as the results are consistent with what leaf values report

### @jameslamb
> I've also triggered valgrind checks on this branch, to ensure no new memory-management issues have been introduced

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
