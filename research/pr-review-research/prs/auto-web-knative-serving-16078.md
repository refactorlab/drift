# knative/serving #16078 — add default conditions to PA to avoid potential race conditions (2nd attempt)

**[View PR on GitHub](https://github.com/knative/serving/pull/16078)**

| | |
|---|---|
| **Author** | @nader-ziada |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dprotaso
> Can you clarify what is happening here? Generally we're not looking at the Reason string but Status.

### @dprotaso
> Can you comment why we added this? It's not clear why we want to gate setting the Active condition on Ready all of a sudden

### @dprotaso
> Can you explain why we need the extra clauses? I would think we could simply have `cond == nil || cond.IsUnknown()`

### @dprotaso
> This looks identical to `allUnknownConditions` can we clean up the extra function and simplify the diff?

### @dprotaso
> Can you comment on why we want to add an additional check here? Probably worth updating the comment as well

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
