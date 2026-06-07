# hyperium/hyper #3637 — feat(http1): add support for receiving trailer fields

**[View PR on GitHub](https://github.com/hyperium/hyper/pull/3637)**

| | |
|---|---|
| **Author** | @hjr3 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dswij
> I'm not too sure about this one. I see two possible options: 1. Pass it along but mark it as unexpected 2. Err it

### @seanmonstar
> Yea, limits are needed, both on number of field pairs, and bytes itself, or else we expose servers to OOM attacks.

### @dswij
> Can we write some tests covering this as well?

### @seanmonstar
> The one thing I think that could help is to add some docs about the support, including what is and isn't enforced.

### @dswij
> LGTM, thanks for the PR! Anything you want to add? @seanmonstar

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
