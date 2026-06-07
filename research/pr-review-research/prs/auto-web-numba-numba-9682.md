# numba/numba #9682 — Python 3.13 support

**[View PR on GitHub](https://github.com/numba/numba/pull/9682)**

| | |
|---|---|
| **Author** | @sklam |
| **Status** | Merged (Nov 7, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @stuartarchibald
> As we've discussed this extensively out of bounds, the code has effectively been through a 'are these the right decisions and concepts' review, the review herein has been largely focussed on implementation details.

### @stuartarchibald
> I don't think this should be considered a merge blocking issue as it's not clear it's the PR that's causing it, it could well be some ecosystem issue.

### @stuartarchibald
> this is approved conditional on the buildfarm not reporting any new issues (see comments for known windows `pycc`+`distutils` issue)

### @stuartarchibald
> I manually `diff`'d this against the same file in a clone of `python/pythoncapi-compat` at SHA `0041177c`...the only difference was the line which expresses the `Latest version:`

### @sklam
> Build farm passed with just odd failures with random pycc tests on windows. Will merge now and patch later.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
