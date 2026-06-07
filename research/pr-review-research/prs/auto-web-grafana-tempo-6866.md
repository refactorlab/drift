# grafana/tempo #6866 — [Feature] Support Math in TraceQL Metrics

**[View PR on GitHub](https://github.com/grafana/tempo/pull/6866)**

| | |
|---|---|
| **Author** | @ruslan-mikhailov |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ruslan-mikhailov
> I would also split such structs into spanProcessor and seriesProcessor, but left as is to not overblow the PR.

### @mdisibio
> Agree, let's think about that later. We've implemented some things as single and split structs, and neither is a clear winner to me yet.

### @ruslan-mikhailov
> This violates IEEE-754. I think, we should comply with it. In that case when a query has no spans within bucket's time range, all operations for this bucket will also result in empty bucket (NaN). wdyt?

### @mdisibio
> I think this is the safest way to start, honoring NaNs, since it will guarantee correct results.

### @mdisibio
> This PR is a huge upgrade to TraceQL, and I am very excited for it. Nice work 👍

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
