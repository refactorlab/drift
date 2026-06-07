# python/mypy #17476 — Add basic support for PEP 702 (@deprecated)

**[View PR on GitHub](https://github.com/python/mypy/pull/17476)**

| | |
|---|---|
| **Author** | @tyralla |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @JelleZijlstra
> I would want it to either print the actual deprecated signature (like pyanalyze) or say something like 'Deprecated call to logging.getLevelName', indicating that the function isn't fully deprecated, just this way of calling it is deprecated.

### @ilevkivskyi
> I think I fixed the bug in #17883. Please undo your `CrossRef` change. Also please add a test like this: [test case provided]

### @ilevkivskyi
> Mypy always reprocesses targets with errors. So the existing test case is not testing what I want.

### @tyralla
> I now had time for some debugging but did not come to a helpful conclusion... I suspect those familiar with Mypy's server functionalities will find it much easier to solve this puzzle.

### @ilevkivskyi
> As you see it failed as expected, so yes, you need to add `deprecated` to the snapshot.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
