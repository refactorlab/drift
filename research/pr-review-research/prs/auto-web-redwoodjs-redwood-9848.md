# redwoodjs/redwood #9848 — Detect/resolve ambiguous script names

**[View PR on GitHub](https://github.com/redwoodjs/redwood/pull/9848)**

| | |
|---|---|
| **Author** | @codersmith |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Tobbe
> Looks like there are no existing tests for this code. Would be great if you could add some for sure!

### @Tobbe
> I'd lean on mocking instead of using the test project, if possible. We've started using `memfs` in some unit tests lately, and it's pretty nice to work with

### @Tobbe
> I wouldn't mock ../lib/exec because then you're not testing the change you made to that file. I think a better option here is to just spy on it, so that you can still verify input parameters.

### @Tobbe
> I found https://github.com/streamich/fs-monkey/blob/master/docs/api/patchRequire.md to help with the `require` problem 🙂 Take a look in the tests I pushed

### @Tobbe
> @codersmith I added a few tests. I'm not super happy with them. But mostly because the way `patchRequire` seems to work. I wish there was a way to reset and/or restore.

### @Josh-Walker-GM
> Looks great. Tested locally too and it works nicely.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
