# grafana/k6 #4089 — Revamp the end-of-test summary

**[View PR on GitHub](https://github.com/grafana/k6/pull/4089)**

| | |
|---|---|
| **Author** | @joanlopez |
| **Status** | Merged (March 11, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mstoykov
> Please do move `lib/summary.go` under internal package - maybe `internal/lib` just to get it out of the way - although having a `summary` package is probably a good idea.

### @mstoykov
> I have done one more pass, and given the time restraint (and the size of a bunch of the code) and that it is mostly internal - I am okay with merging this as is.

### @mstoykov
> Do not forget to squash this 😅

### @olegbespalov
> Thinking loudly: it seems like the summary mode could also take responsibility of displaying no summary, which makes the UX more straightforward, but it's probably not a big deal

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
