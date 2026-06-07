# derailed/k9s #3503 — fix(logs): enhance log streaming with retry mechanism and error handling

**[View PR on GitHub](https://github.com/derailed/k9s/pull/3503)**

| | |
|---|---|
| **Author** | @uozalp |
| **Status** | Merged (September 17, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @derailed
> I think this needs a bit more thought/TLC

### @derailed
> We need to be careful here with allocs. This allocated a 100 buffer channel. Why is this necessary?

### @uozalp
> Prevents the `"WRN Dropping log line due to slow consumer"` warnings I see on high-volume logging pods

### @derailed
> Thanks Umut! I think we need to benchmark this and figure out a sweet spot. Less is more when it comes to buffered channels.

### @uozalp
> (Provided detailed benchmark results showing 40-buffer optimal performance with 0% drop rate across multiple test runs.)

### @derailed
> Very cool! Well done Sir. Thank you Umut!!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
