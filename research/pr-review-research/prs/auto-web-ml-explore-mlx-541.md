# ml-explore/mlx #541 — Custom VJP and checkpointing

**[View PR on GitHub](https://github.com/ml-explore/mlx/pull/541)**

| | |
|---|---|
| **Author** | @angeloskath |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @awni
> I think it makes more sense in `transforms.h`?

### @awni
> I'm wondering about the decision to have `checkpoint` return the arrays rather than a wrapped function?

### @awni
> Would be great to add some benchmarks as well so we understand and have a record of what we are gaining in terms of memory and losing in terms of graph time with this change.

### @awni
> Did you consider trying to count the aggregate array size of the branch rather than the depth?

### @jagrit06
> it might be nice to profile the time spent there in some common use cases just to be sure

### @awni
> Should we make `fn` `Optional` and use `__call__` if it is not set? It seems like that will be the most common case right?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
