# kubernetes/kubernetes #125488 — DRA for 1.31

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/125488)**

| | |
|---|---|
| **Author** | @pohly |
| **Status** | ✅ merged |
| **Opened** | 2024-06-13 |
| **Repo** | curated review-culture seed |
| **Diff** | +24749 / −37722 across 486 files |
| **Engagement** | 25 conversation · 731 inline review comments |

## Top review comments (ranked by reactions)

### @klueska — 1 reactions  
`🎉 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/125488#issuecomment-2243475129)

> Gladly. Thanks everyone! One step closer...
> 
> /approve
> /lgtm
> /unhold

### @pohly — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/125488#issuecomment-2198489031)

> > Before you push a new change, It would be great if you could either rebut or ACK+resolve comments that are addressed. 
> 
> I'll definitely ACK changes that I have made or will make (I'm currently waiting for further comments before pushing the next update).
> 
> I was less sure about resolving myself. So you don't want to double-check how I resolved the comment?

### @pohly — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/125488#issuecomment-2222736670)

> /test pull-kubernetes-integration pull-kubernetes-verify pull-kubernetes-verify-lint pull-kubernetes-unit pull-kubernetes-node-e2e-containerd-1-7-dra  pull-kubernetes-kind-dra 
> 
> I am feeling lucky... :grin: 
> 
> However, I already some tests locally. There is one known, odd (random?) failure:
> 
>         $ go test ./pkg/api/testing
>         --- FAIL: TestDefaulting (1.76s)
>             --- FAIL: TestDefaulting/resource.k8s.io/v1alpha3,_Kind=ResourceClaimList (0.01s)
>                 defaulting_test.go:238: expected resource.k8s.io/v1alpha3, Kind=ResourceClaimList to trigger defaulting due to fuzzing
>         FAIL
>         FAIL        k8s.io/kubernetes/pkg/api/testing       17.294s
>         FAIL
>         $ go test -run=TestDefaulting/resource.k8s.io/v1alpha3,_Kind=ResourceClaimList ./pkg/api/testing
>         ok          k8s.io/kubernetes/pkg/api/testing       0.062s

### @pohly — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/125488#issuecomment-2223017900)

> /test pull-kubernetes-integration pull-kubernetes-verify pull-kubernetes-verify-lint pull-kubernetes-unit  pull-kubernetes-kind-dra
> 
> The E2E node jobs (pull-kubernetes-node-e2e-containerd-1-7-dra) are hard-coded to enable v1alpha2, so they are not usable here. We either need two versions of them or update them after merging.

### @pohly — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/125488#issuecomment-2225160230)

> I addressed review feedback and linter hints. I gave up my stance that wrapping of errors (`%v` vs `%w`) should be considered on a case-by-cases basis and instead now always wrap.
> 
> Here's the diff before I rebase because of a conflict: https://github.com/kubernetes/kubernetes/compare/9a7aad84208bb330935ce376b37f2e47cb8e2565..18417425dc31639b92c9d35343bb18b29c6a7f53

### @pohly — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/125488#issuecomment-2225563038)

> /test pull-kubernetes-node-e2e-crio-cgrpv1-dra
> 
> Job updated, might work again.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
