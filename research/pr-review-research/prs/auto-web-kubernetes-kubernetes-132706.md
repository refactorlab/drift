# kubernetes/kubernetes #132706 — DRA API: graduation to GA

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/132706)**

| | |
|---|---|
| **Author** | @pohly |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nojnhuh
> the error that occurs here is [the server could not find the requested resource] where it should probably stay something like it was before, [Forbidden: admin access to devices requires the resource.k8s.io/admin-access: true label on the containing namespace]

### @nojnhuh
> CI is red since #133147 merged. Copying {allocator,pools}_incubating.go to experimental should get things in better shape.

### @pacoxu
> /test pull-kubernetes-conformance-kind-ga-only-parallel /test pull-kubernetes-node-e2e-containerd /test pull-kubernetes-e2e-gce

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
