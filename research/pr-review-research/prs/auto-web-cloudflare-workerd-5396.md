# cloudflare/workerd #5396 — Reworking Headers impl

**[View PR on GitHub](https://github.com/cloudflare/workerd/pull/5396)**

| | |
|---|---|
| **Author** | @jasnell |
| **Status** | Merged (December 1, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kentonv
> There's an opportunity for big gains here by taking advantage of the tables that are already available in `HttpOverCapnpFactory`.

### @jasnell
> Internal tests are failing because the refactor changes the ordering of the headers in places... will need to see if we can preserve the order.

### @danlapid
> Whenever this is done I want as many reviewers as we can get on this, incl Harris, Kenton, Mike, Yagiz, etc.

### @jasnell
> The emphasis for review should be on correctness and ensuring that the revised implementation does not introduce new bugs.

### @kentonv
> The force-push seems to contain a combination of changes specific to this PR, and also a rebase on master, which breaks incremental reviews.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
