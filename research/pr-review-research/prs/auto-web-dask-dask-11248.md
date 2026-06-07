# dask/dask #11248 — Add a Task class to replace tuples for task specification

**[View PR on GitHub](https://github.com/dask/dask/pull/11248)**

| | |
|---|---|
| **Author** | @fjetter |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @phofl
> This change is only hooked into distributed? I.e. if we get an old style graph then the sync scheduler will still execute the old style graph? Wouldn't we want to do client side [conversion] to reduce the upload size?

### @hendrikmakait
> For me, calling this class `TaskRef` would make more sense since it does reference a `Task` via its key.

### @hendrikmakait
> The `Alias` class feels slightly off. It's the only `BaseTask` class that does not return the key with which it's also registered...A more explicit variant would be something like `Alias(old, new)`

### @phofl
> Can you add a brief comment for this as well? Took me a while to come to that conclusion

### @hendrikmakait
> Are `Tasks` never inlineable? Is this because we inline elsewhere?

### @fjetter
> Right now, the Task signature is `key, func, args, kwargs` but it is also possible to make it `key, func, /, *args, **kwargs` which would make it more natural to write a task...I chose to not go down this path because it makes internals a little more complex

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
