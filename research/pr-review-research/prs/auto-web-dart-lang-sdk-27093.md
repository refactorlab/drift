# dart-lang/sdk #27093 — Updated directory_linux.cc to conform with the deprecation of readdir_r

**[View PR on GitHub](https://github.com/dart-lang/sdk/pull/27093)**

| | |
|---|---|
| **Author** | @starfys |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @floitschG
> This should now fit on one line.

### @mkustermann
> `result != NULL` implies `errno == 0` according to the man page. Only if `result == NULL` one needs to distinguish between error (in which case `errno != 0`) and end of stream (in which case `errno == 0`).

### @mkustermann
> If `readdir` returns `NULL` it might be end-of-stream **or** error. Why not implement the same error handling as above?

### @mkustermann
> I think having only one `readdir()` makes it easier to read

### @zanderso
> Some summary of the discussion in the pull request should probably go in a comment on one of the readdir calls.

### @zanderso
> Is readdir thread safe going as far back as glibc 2.11?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
