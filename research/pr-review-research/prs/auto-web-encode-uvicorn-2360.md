# encode/uvicorn #2360 — fix: upgrade is not websocket and dependencies are installed, should not warning

**[View PR on GitHub](https://github.com/encode/uvicorn/pull/2360)**

| | |
|---|---|
| **Author** | @vvanglro |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Kludex
> The `_should_upgrade` is called multiple times in the httptools one.

### @Kludex
> Can you create a table of expected behavior you see? Also, while checking this... I've noticed that this is printed multiple times with httptools.

### @vvanglro
> The biggest difference between h11 and httptools is that h11 strictly determines that upgrade is equal to websocket, whereas httptools does not, which leads to warnings when upgrade is not a websocket.

### @vvanglro
> When a user installs a websocket dependency and receives a request with an incorrect value in the upgrade field, multiple warnings are generated, which is incorrect because I already have the dependency installed, this PR is to fix that.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
