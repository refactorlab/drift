# ibis-project/ibis #11595 — feat(singlestoredb): add SingleStoreDB backend

**[View PR on GitHub](https://github.com/ibis-project/ibis/pull/11595)**

| | |
|---|---|
| **Author** | @kesmit13 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @gforsyth
> we don't have any _public_ methods or functions that have a `Yields` block in the docstring, and apparently `quartodoc` doesn't handle them

### @deepyaman
> I'm going to be working somewhere that I believe uses SingleStore heavily, so I was thinking about contributing a backend down the line

### @gforsyth
> I tried to push up a commit to your PR enabling CI on singlestore but it's being rejected

### @deepyaman
> I think it should be possible to minimize dependencies changed compared to `main`

### @kesmit13
> I believe I found the issue with the last failures. It had to do with using a constant for the `WITH` statement that varies depending on the sqlglot version

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
