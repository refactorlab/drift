# pola-rs/polars #19894 — feat: Add `index_of()` function to `Series` and `Expr`

**[View PR on GitHub](https://github.com/pola-rs/polars/pull/19894)**

| | |
|---|---|
| **Author** | @itamarst |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @coastalwhite
> My guess is that you are treating a categorical as a string when it goes into the row encoding. If you want to compare the row encoding of a series with the row encoding of another series they need to have been encoded with the exact same dtype (i.e. so the same RevMap as well) otherwise the output is undefined.

### @ritchie46
> I believe we only need docs entries on the python side (so that they end up in the ref guide), then it is good to go.

### @rodrigogiraoserrao
> Do we really need the tiny user-guide page? It's pretty much the same as the docstrings, so I feel like it's enough to have the docstrings.

### @ritchie46
> Alright, thanks @itamarst, looks good!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
