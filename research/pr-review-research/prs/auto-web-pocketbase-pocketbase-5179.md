# pocketbase/pocketbase #5179 — Fix days calculation bug for the old logs

**[View PR on GitHub](https://github.com/pocketbase/pocketbase/pull/5179)**

| | |
|---|---|
| **Author** | @nehmeroumani |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ganigeorgiev
> this change actually introduced a side-effect and due to the way how the checks inside the condition are performed it will now keep the logs for 2x the specified period.

> **Note:** This is a small log-retention bug fix. The conversation page exposed only the maintainer's technical concern above verbatim; the rest of the page was emoji reactions and references to related commits, with no extended design discussion.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
