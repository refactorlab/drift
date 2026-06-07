# knative/serving #15503 — Ensure ContainerHealthy condition is set back to True

**[View PR on GitHub](https://github.com/knative/serving/pull/15503)**

| | |
|---|---|
| **Author** | @SaschaSchwarze0 |
| **Status** | Merged (Jan 20, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @skonto
> should we relax the condition? Resetting this should happen when we have at least one pod up (deployment.Status.AvailableReplicas>0) no?

### @evankanderson
> The real world laughs at this... all we have here are heuristics. My gut would be relax the check to closer to what Stavros is suggesting: container ready can become true if there is at least one ready container.

### @SaschaSchwarze0
> Would we agree on the following? (1) If there is no Pod, we do not change the current status. (2) If any Pod is ready, we set it to True.

### @skonto
> we just need a signal for the blocking condition not holding any more. Serving should handle traffic as usual depending on the number of pods that are ready.

### @dprotaso
> let's go with option 2... since that's how we would know about image pull failures [regarding Pending pods]

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
