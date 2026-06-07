# kubernetes-sigs/controller-runtime #3121 — 📖 Add a design for supporting warm replicas

**[View PR on GitHub](https://github.com/kubernetes-sigs/controller-runtime/pull/3121)**

| | |
|---|---|
| **Author** | @godwinpang |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @alvaroaleman
> This will break conversion webhooks. I don't know if there is a good way to figure out if the binary contains a conversion webhook, but if in doubt we have to retain the current behavior

### @sbueringer
> Does this actually break the metric? Sounds like the metric will just show the reality. It might break alerts that assume the queue length should be pretty low, but that's an issue of the alerts.

### @JoelSpeed
> Has the impact to API servers been assessed for this proposal? [The] slow to start sources are likely informers... this EP is basically going to double the API server load?

### @alvaroaleman
> we would need to integrate the warmup with a healthcheck, such that the healthcheck only passes once warmup has completed

### @zach593
> The pre-filled queue can conflict with the priority queue feature. When the priority queue is enabled, a controller that has just restarted will initially be filled with low-priority items.

### @sbueringer
> Lets update this doc to reflect the current state of affairs so we can merge it

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
