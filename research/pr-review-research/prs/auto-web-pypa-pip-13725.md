# pypa/pip #13725 — Remove `__pycache__` when package is removed

**[View PR on GitHub](https://github.com/pypa/pip/pull/13725)**

| | |
|---|---|
| **Author** | @vfazio |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @pfmoore
> Hard-coding the optimisation levels like this seems fragile. While it's unlikely the valid values will change, can we not get them from the import system somehow, so we know they are correct?

### @pfmoore
> We should at least include a comment linking back to where these are stated as being the valid values...By the way, for comparison, `uv` seems to remove the whole `__pycache__` directory.

### @notatallshaw
> I haven't found any user reported issues to do with `__pycache__` being deleted...I'm currently leaning toward taking that approach, to me it seems simpler and uv shows it is battle tested.

### @notatallshaw
> Don't merge these into `folders`. That set means 'package roots to walk'...A separate set avoids touching the existing logic.

### @vfazio
> Since `pip` is utilised by a lot of people, I wanted to take a conservative approach here. But if the maintainers feel it's appropriate to nuke `__pycache__` wholesale, I can change the code.

### @notatallshaw
> Yeah, it's edge case enough and could do with a review of the logic that let's make that it's own issue/PR.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
