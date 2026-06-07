# kubernetes/enhancements #4565 — KEP-4563: EvictionRequest API

**[View PR on GitHub](https://github.com/kubernetes/enhancements/pull/4565)**

| | |
|---|---|
| **Author** | @atiratree |
| **Status** | ✅ merged |
| **Opened** | 2024-03-28 |
| **Repo** | curated review-culture seed |
| **Diff** | +2963 / −0 across 4 files |
| **Engagement** | 48 conversation · 597 inline review comments |

## Top review comments (ranked by reactions)

### @haircommander — 3 reactions  
`🎉 3`  ·  [link](https://github.com/kubernetes/enhancements/pull/4565#issuecomment-3862295612)

> I think the current state is a good direction. It's cut a lot of the non-MVP features while being extensible and covering the majority of use cases we've heard. I can imagine there will be some more iteration as we get to implementation, but it's safe enough to try and good enough for now! LGTM from node perspective

### @dchen1107 — 2 reactions  
`🎉 1 · 🚀 1`  ·  [link](https://github.com/kubernetes/enhancements/pull/4565#issuecomment-3892913081)

> /lgtm
> /approve 
> 
> There are minor things, you can send me the follow up PR later.

### @txomon — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/enhancements/pull/4565#issuecomment-3370636139)

> @soltysh I'm not sure about other cases, but in both my professional and personal k8s environments, the number of deployments with a single replica is higher than the rest of the deployments. The reason for this is that there are a lot of additional functionalities that one installs in their cluster but that their usage is many times one off, cert manager as an example come to my mind.
> 
> Having 2 replicas for all these services generates a lot of waste. Although I do agree that having 2 replicas might work in general cases where you have huge clusters and spare capacity, in cases where this capacity is provisioned on demand, or just edge k8s clusters are provisioned, the waste created by duplicating resource usage unnecessarily is significant.

### @wojtek-t — 1 reactions  
`🎉 1`  ·  [link](https://github.com/kubernetes/enhancements/pull/4565#issuecomment-3871863722)

> The current version LGTM. I will hold on approving the PRR with SIG approval to ensure that it will not significantly evolve in the meantime :)

### @wojtek-t — 1 reactions  
`🎉 1`  ·  [link](https://github.com/kubernetes/enhancements/pull/4565#issuecomment-3889205346)

> I think that applying @dchen1107 comments will not affect the PRR, so I'm ready to approve the PRR now.
> 
> /approve PRR

### @intUnderflow — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/kubernetes/enhancements/pull/4565#issuecomment-3893888325)

> Thank you to everyone who wrote, reviewed, gave feedback on or otherwise contributed to this KEP! I deeply appreciate all of your efforts and look forward to taking this forward together ❤️


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
