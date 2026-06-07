# pytest-dev/pytest #12168 — Initialize cache directory in isolation

**[View PR on GitHub](https://github.com/pytest-dev/pytest/pull/12168)**

| | |
|---|---|
| **Author** | @tamird |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nicoddemus
> TBH I'm starting to see this change as -0: we are changing how the supporting files are being created for little reason (as the original reason for the issue is no longer valid).

### @nicoddemus
> An interruption between `mkdir` and writing the files? This seems highly unlikely to happen, those lines are next to each other -- the current code will solve this indeed, but I fear we will be introducing subtle issues and breaking test suites for minimal/marginal gains, hence -0.

### @RonnyPfannschmidt
> at first glance the proposed mechanism is broken in most linux deployments simply by degrading to copytree on anything that has TMP on tmpfs

### @RonnyPfannschmidt
> given how temporarydirectory actually is used in our case, a followup at a later point might want to replace it with a simpler mechanism

### @tamird
> Turns out the behavior I was seeing which prompted me to send this PR was in fact caused by `mkdir` not properly initializing the cache directory. Plugins (such as `pytest-insta`) use this function.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
