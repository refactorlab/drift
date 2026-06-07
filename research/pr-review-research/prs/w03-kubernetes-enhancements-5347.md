# kubernetes/enhancements #5347 — KEP-5328: Node Declared Features

**[View PR on GitHub](https://github.com/kubernetes/enhancements/pull/5347)**

| | |
|---|---|
| **Author** | @pravk03 |
| **Status** | ✅ merged (2025-10-09) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> Process review sets *falsifiable* gates: no alpha unless a real feature consumes it, explicit N/A for skipped sections, sane bounds on identifiers and list size. Criteria, not vibes.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@johnbelamaric:**
> I think unless at least one feature uses this, there is no point in doing alpha. We need that as a criterion.

**@liggitt:**
> We have some long feature gate names... 63 might be a little tight... We should also put an upper bound on the number of items in the list for sanity.

**@tallclair:**
> I think some PRR sections are missing. I would put an explicit N/A with a justification when a section isn't applicable.

**@tallclair:**
> IPPR with static CPU policy will exercise the admission controller flow, but we should also have a feature that uses the scheduling flow.

**@liggitt:**
> just ensure alpha features which rely on this mechanism to schedule express a dependency on this feature being enabled


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
