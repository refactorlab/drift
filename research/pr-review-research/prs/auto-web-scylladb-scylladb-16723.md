# scylladb/scylladb #16723 — tablets: alter keyspace

**[View PR on GitHub](https://github.com/scylladb/scylladb/pull/16723)**

| | |
|---|---|
| **Author** | @ptrsmrn |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tgrabiec
> waiting for topology request completion doesn't work, because this function doesn't handle global requests

### @gleb-cloudius
> if it is needed it should be moved outside of the loop

### @ptrsmrn
> there's surely a redundant effort done in evaluating this snippet in every loop iteration...either has to be fixed or the cancellation code has to be removed altogether

### @xemul
> once the latter is merged, test cases checking how ALTER works from this PR would stop passing

### @mykaul
> We'll take the change RF to 6.0. Reject ALTER is not needed at this point

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
