# kubernetes/enhancements #5136 — Add KEP for DRA: Extended Resource

**[View PR on GitHub](https://github.com/kubernetes/enhancements/pull/5136)**

| | |
|---|---|
| **Author** | @yliaog |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @SergeyKanzhelev
> This sounds complicated. Can the object be always around, and simply ignored if scheduled on a Device Plugin node for now?

### @aojea
> providing much flexibility to a mechanism that should be only solving the migration from device plugins to dra drivers, can make the scope creeping

### @towca
> Could we add a mention of the Cluster Autoscaler requirements somewhere in the KEP? I'm just worried about future changes not taking them into account.

### @SergeyKanzhelev
> we discussed this idea with the sig scheduling folks, that would mean some other controller needs to create the claim

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
