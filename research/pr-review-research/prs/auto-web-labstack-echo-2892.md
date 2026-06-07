# labstack/echo #2892 — Add new function "StatusCode in httperror.go"

**[View PR on GitHub](https://github.com/labstack/echo/pull/2892)**

| | |
|---|---|
| **Author** | @suwakei |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aldas
> This is a good idea. I have to research a bit this... It is easy to add new things but hard to remove them.

### @aldas
> This would be `true` but these are different errors from different domains... I am little bit afraid of this change.

### @aldas
> maybe we could create function in Echo that checks/extracts status code from error so you can have one-liners like `errors.Is` allows.

### @aldas
> LGTM but could you rename that method to `StatusCode` and move it just below `HTTPStatusCoder` interface in httperror.go file.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
