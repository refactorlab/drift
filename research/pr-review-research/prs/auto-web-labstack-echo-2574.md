# labstack/echo #2574 — binder: allow binding to a nil map

**[View PR on GitHub](https://github.com/labstack/echo/pull/2574)**

| | |
|---|---|
| **Author** | @georgmu |
| **Status** | Merged (Feb 13, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aldas
> I think this PR is overall OK but that check could be moved. If you have time please change that and if not, I can do it myself this weekend and merge it.

### @algorithmcardboard
> I am running into this issue as well. Thank you @georgmu for the fix. @aldas any idea when this will make it to the release?

### @aldas
> I really can not say at the moment, but you can use `dest := map[string]int{}` syntax to create your maps instead of `var dest map[string]int`

### @aldas
> thanks for the fix and @algorithmcardboard for pinging me. I forgot this PR again.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
