# cupy/cupy #9825 — Add int64 index support to `cupyx.scipy.sparse`

**[View PR on GitHub](https://github.com/cupy/cupy/pull/9825)**

| | |
|---|---|
| **Author** | @eriknw |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @seberg
> We may want re-consider the exact kernel setup (when is casting done), but I think that also can wait.

### @seberg
> Hmmm, claude is asking where the `step == 1` fast path went, and it isn't clear to me immediately either. (Maybe removed when cumsum was broken?)

### @seberg
> the nicest thing might be to just add `cusparse` to the `scipyx.__getattr__` (which we already have). Then we can just write `cupyx.cusparse.MatDescriptor` which is lazy

### @seberg
> isn't this just the same as `prod(new_shape) == 0` (and that is already checked earlier)? the `cnt.sum()` seems unnecessary

### @seberg
> if we add an `_is_int64` property (or `__init__` time attribute) to all of the classes, than also all of these types of checks get nicer

### @seberg
> Hmmm, this feels a bit too bad, but I don't have a good idea... unless you are curious if ends up nice and short, I doubt it's worth it.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
