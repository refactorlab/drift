# kubernetes/kubernetes #116429 — Add SidecarContainers feature

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/116429)**

| | |
|---|---|
| **Author** | @gjkim42 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jpbetz
> Here's some API review related feedback, I'll do a pass on the implementation shortly

### @matthyx
> I need to finish the docs PR and make it clear there before we release...

### @olitomlinson
> would the sidecar init container start **before** other non-sidecar init containers? or would it start in parallel?

### @matthyx
> It depends on which order you put them inside `initContainers`... there is only one **ordered** list of init containers

### @zhouhaibing089
> I wonder why this is or-ed with `status.State.Terminated != nil`? If all containers have been stopped...this will report that there are regular container started

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
