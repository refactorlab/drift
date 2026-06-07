# kubernetes-sigs/cluster-api #10897 — 📖 Proposal: Improving status in CAPI resources

**[View PR on GitHub](https://github.com/kubernetes-sigs/cluster-api/pull/10897)**

| | |
|---|---|
| **Author** | @fabriziopandini |
| **Status** | Merged (September 16, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @enxebre
> I might have missed but didn't see anything related to meaning of absence of condition? Do we want to state that our core conditions must always be set either true/false/unknown meaning absence indicate a controller operational issue?

### @vincepri
> First off, @fabriziopandini I gotta say this is FANTASTIC and AMAZING work, and thank you so much for starting this. Seriously, it shows care for our users, and the proposal is a great read.

### @fabriziopandini
> Controllers should apply their conditions to a resource the first time they visit the resource, even if the status is Unknown.

### @neolit123
> +1 i can take some AI / PR changes when / if needed.

### @sbueringer
> Great work, thx!! /lgtm

### @chrischdi
> /lgtm 🎉 Thanks!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
