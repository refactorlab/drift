# kubernetes/kubernetes #102884 — In-place Pod Vertical Scaling feature

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/102884)**

| | |
|---|---|
| **Author** | @vinaykul |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sftim
> For the changelog entry, we might prefer to describe the changes in terms of API fields...The API doesn't have fields named `PodSpec` or `Resources` or `ResizePolicy`; those are instead `spec`, `resources` and `resizePolicy`.

### @gjkim42
> Left review comments flagging validation issues with the ResizePolicy field implementation (referenced in issue #116854), indicating concerns about proper constraint enforcement in the design.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
