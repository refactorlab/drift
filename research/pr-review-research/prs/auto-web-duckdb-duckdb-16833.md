# duckdb/duckdb #16833 — Unittester failures summary

**[View PR on GitHub](https://github.com/duckdb/duckdb/pull/16833)**

| | |
|---|---|
| **Author** | @ZuleykhaPavlichenkova-TomTom |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Tmonster
> I think if you summarize everything, it's a bit too long of a message...it's much nicer to look at the files, then run the tests locally to find out exactly what has failed. If you want to have a summary with also the failures, then I suggest having two flags `--summarize-failures` and `--summarize-failures-verbose`

### @Mytherin
> showing the error again is helpful as well...For smaller errors this looks great to me...The HTTPFS example is a bit excessive because there are many errors

### @Mytherin
> Can we report those as well?

### @Mytherin
> Thanks for the PR! LGTM - the CI failure is unrelated. Can we start enabling these flags on the various CI runs as well?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
