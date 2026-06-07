# goharbor/harbor #21347 — feat: Single Active Replication

**[View PR on GitHub](https://github.com/goharbor/harbor/pull/21347)**

| | |
|---|---|
| **Author** | @bupd |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @wy65701436
> What happens if the execution gets stuck in the 'running' status?

### @wy65701436
> How do we determine the relationship between the replication policy and the execution instance — by ID?

### @wy65701436
> During the replication job (at least in Harbor-to-Harbor replication), Harbor skips artifacts that have already been successfully replicated. So, we should consider how much additional benefit this feature will bring.

### @bupd
> It makes no sense to run replication in parallel for same replication policy

### @Vad1mo
> Demonstrated real-world impact: without the feature, parallel replications of the same 1GB image failed after 4+ hours with 13GB bandwidth usage, while the feature enabled completion in 22 minutes with stable 1.42GB usage.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
