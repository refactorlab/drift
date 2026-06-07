# prometheus/prometheus #15687 — Float histograms: implement methods for Add/Sub operations using Kahan summation

**[View PR on GitHub](https://github.com/prometheus/prometheus/pull/15687)**

| | |
|---|---|
| **Author** | @crush-on-anechka |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @beorn7
> It's a bit sad that we need to duplicate so much logic, but I guess it cannot be prevented most of the time.

### @beorn7
> Kahan summation is currently only used in certain aggregations... we will only need Kahan summation for histograms for: `sum` aggregation, `avg` aggregation, `sum_over_time` function, `avg_over_time` function

### @beorn7
> When reconciling zero buckets, we might be merging buckets into the zero bucket... we should _also_ use Kahan summation in this case

### @beorn7
> Rounding can only reduce accuracy rather than increasing it... we have to accept that accuracy depends on operation order

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
