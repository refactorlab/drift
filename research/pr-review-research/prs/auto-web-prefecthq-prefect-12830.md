# PrefectHQ/prefect #12830 — Automations SDK Methods

**[View PR on GitHub](https://github.com/PrefectHQ/prefect/pull/12830)**

| | |
|---|---|
| **Author** | @WillRaphaelson |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cicdw
> I also think that `enable` `disable` should return some indication of whether the requested action was taken (e.g `bool`) instead of `Optional[Automation]`

### @serinamarie
> If we could catch the `PrefectHTTPStatusError` here when reading a nonexistent id and maybe add a test for it, that might be nicer for the user than this error

### @serinamarie
> Some small nits but LGTM!

### @chrisguidry
Left comments on typing issues, suggesting improvements to type annotations and method signatures throughout the implementation, and suggested removing type parameterization to simplify the codebase.

### @cicdw
Requested the `find()` method be made more robust to handle edge cases better and improve reliability.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
