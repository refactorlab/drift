# kubernetes/enhancements #5104 — KEP-5075: DRA: Consumable Capacity

**[View PR on GitHub](https://github.com/kubernetes/enhancements/pull/5104)**

| | |
|---|---|
| **Author** | @sunya-ch |
| **Status** | ✅ merged (2025-06-18) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> The best design review generalizes the abstraction (`johnbelamaric`: repurpose this as 'per-device allocatable resources') and stress-tests the failure/recovery path (`aojea`: what happens on scheduler failover?).

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@johnbelamaric:**
> I think if we repurpose this to just 'per-device allocatable resources', we will not only meet these use cases, but we can meet some of the ones for modeling standard resources in DRA.

**@aojea:**
> what happens if the scheduler restarts or fails over another scheduler instance, is it able to recover the right state?

**@BenTheElder:**
> Please fill out at least the alpha required sections. PRR freeze is Thursday 12th June 2025

**@pohly:**
> Remaining open questions are all things that we can still decide later during the API review of the implementation.


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
