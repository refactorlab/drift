# containerd/containerd #10177 — Multipart layer fetch

**[View PR on GitHub](https://github.com/containerd/containerd/pull/10177)**

| | |
|---|---|
| **Author** | @azr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @swagatbora90
> I wonder if you were able to get any memory usage data from your tests? Previous effort to use ECR containerd resolver...showed that it can take up disproportionate amount of memory specially when we increase the number of parallel chunks.

### @swagatbora90
> I do observe that increasing parallelism does not yield better latency and may lead to higher memory usage...A lower parallelism count(3 or 4) may be preferable than setting parallelism to upwards of 10.

### @dmcgowan
> I don't think we should make this interface change...This configuration could just be directly given as resolver options...we can avoid changing the interface here.

### @dmcgowan
> This is still racy, multiple goroutines may hit this condition and cause a panic. There is no guarantee in one goroutines selects default and closes before another.

### @fuweid
> Not sure if there is competive condition in http2 stdlib on window updating. Will check this part later. it's not blocker.

### @dmcgowan
> We should just get this in, there are still maybe a few interface tweaks we can make before final release that won't affect the functionality.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
