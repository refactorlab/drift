# open-policy-agent/opa #7446 — feat: new event-based decisions log buffer implementation

**[View PR on GitHub](https://github.com/open-policy-agent/opa/pull/7446)**

| | |
|---|---|
| **Author** | @sspaink |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @srenatus
> This looks great, especially the numbers. I've gone through the code and commented a bit, adding a few questions for my understanding.

### @johanfylling
> Do we have some sort of comparative analysis on drop behavior between the two buffer types? E.g. is one buffer more prone to dropping events than the other while under the same pressure?

### @johanfylling
> Some recent measurements (500 concurrent requesting clients):

(Followed by detailed performance metrics showing the new event buffer achieved significantly lower latencies and more predictable peak behavior.)

### @anderseknert
> 142 comments (143 once I post this, I suppose) on a PR must be a new record for OPA! Had it been me I'd probably have closed my laptop for good.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
