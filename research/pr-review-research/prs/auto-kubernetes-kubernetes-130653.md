# kubernetes/kubernetes #130653 — kubelet and scheduler for extended resource backed by DRA

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/130653)**

| | |
|---|---|
| **Author** | @yliaog |
| **Status** | ✅ merged |
| **Opened** | 2025-03-07 |
| **Repo** | curated review-culture seed |
| **Diff** | +6770 / −2039 across 106 files |
| **Engagement** | 82 conversation · 542 inline review comments |

## Top review comments (ranked by reactions)

### @yliaog — 1 reactions  
`😄 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130653#issuecomment-3128495222)

> > > @macsko please let me know if there is any further comment, question. I think the deadline for this PR is ~8hr away, I hope to address it before it's too late for your time zone.
> > 
> > Luckily we have one more day than that: Changes Due 02:00 UTC, 30th July which is 7pm Pacific on July 29th.
> 
> What a releif! I somehow thought it is today 7PM PST. Thanks @johnbelamaric

### @pohly — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130653#issuecomment-3133265523)

> @johnbelamaric, @klueska: who is going to do the final LGTM? I don't know where we stand in terms of open questions or pending reviews.

### @yliaog — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130653#issuecomment-2878490461)

> /assign @pohly @johnbelamaric @klueska 
> 
> the implementation for https://github.com/kubernetes/enhancements/pull/5136 is ready for review

### @guptaNswati — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130653#issuecomment-2957277223)

> What will be the `k8s.io/kubelet/pkg/apis/podresources/v1.ListPodResourcesResponse.container.GetDevices()[0].GetResourceName()` with these changes? Right now it returns the extended resourcename used in podspec like `nvidia.com/gou`

### @yliaog — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130653#issuecomment-3054450968)

> @pohly could you please take a look at the dynamicresources scheduler plugin? Thanks.

### @pohly — 0 reactions  
`—`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130653#issuecomment-3058036359)

> @yliaog: there are quite a few test failures that point to genuine problems with the code. Can you start looking into those?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
