# crossplane/crossplane #6557 — Design document: Day Two Operations

**[View PR on GitHub](https://github.com/crossplane/crossplane/pull/6557)**

| | |
|---|---|
| **Author** | @negz |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @dee0sap
> As I can provide a solution equivalent to what is solved by this proposal with the above combination of tools why would I want to invest in two ways of managing day two operations?

### @bobh66
> One area of possible concern would be if the Operation pipeline requests changes to an XR (assuming v2 only) which is being reconciled by an external Flux/ArgoCD/etc and triggers a loop.

### @turkenh
> I believe it will be a big limitation. We should better at least have an idea on how we can add support for that without requiring breaking changes once we get there.

### @haarchri
> in v2, all the resources like KubernetesCluster XRs are namespaced...app teams to write low-level config that used to be abstracted away.

### @turkenh
> Would this resource be a cluster scoped one or namespaced one?...supporting namespaced operations as well as cluster scoped ones could make sense.

### @bassam
> The tombstone approach seems promising, agree we should support/standardize on this across compositions and operations.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
