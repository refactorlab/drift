# kubernetes-sigs/cluster-api #12329 — 📖 Propagating taints from Cluster API to Nodes

**[View PR on GitHub](https://github.com/kubernetes-sigs/cluster-api/pull/12329)**

| | |
|---|---|
| **Author** | @nrb |
| **Status** | Merged (November 5, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @chrischdi
> We are not yet at that point but we should explicitly consider cluster-api taints to not be added via this mechanism / have validation for it...So we may want to block the whole `node.cluster.x-k8s.io/` prefix from being set

### @neolit123
> if a set of taints are propagated to the node by a CAPI controller, but then a third party controller changes one of the taints...would that be the accurate state of the world?

### @sbueringer
> As we are continuously writing the always taints it would be accurate. We should probably block some more taints (probably entire domains like we do for labels and annotations)

### @fabriziopandini
> If we introduce a sort of list of taint that the users should not set, I would also block them also in the webhooks (might be with 'ratcheting' to prevent objects to become invalid)

### @JoelSpeed
> I don't think this needs to be in the same call, but it does need to be before the `uninitialized` taint is removed

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
