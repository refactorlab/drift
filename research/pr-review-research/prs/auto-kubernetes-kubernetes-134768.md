# kubernetes/kubernetes #134768 — [PodLevelResourceManagers] Pod Level Resource Managers - Alpha

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/134768)**

| | |
|---|---|
| **Author** | @KevinTMtz |
| **Status** | ✅ merged |
| **Opened** | 2025-10-22 |
| **Repo** | curated review-culture seed |
| **Diff** | +8976 / −688 across 55 files |
| **Engagement** | 49 conversation · 403 inline review comments |

## Top review comments (ranked by reactions)

### @ffromani — 2 reactions  
`👍 2`  ·  [link](https://github.com/kubernetes/kubernetes/pull/134768#issuecomment-4029395088)

> @tallclair @KevinTMtz (cc @esotsal ) I didn't look at this PR recently, but I clearly remember it was in pretty good shape last time I checked and I'm confident it's close or ready to merge.
> 
> My concern is: how do we handle the interactions with https://github.com/kubernetes/kubernetes/pull/129719 ?
> 
> The main reason I bring this up is that 129719 has a higher prio than this PR in the 1.36 cycle, so if we merge this PR we can disrupt (albeit, hopefully, not much) 129719 and slow it down even further.
> 
> I for myself I'm somehow leaning towards merging this PR as it's readier than 129719, but I think it's better to address this point openly in the best interest of the SIG and the project.

### @ffromani — 2 reactions  
`👍 2`  ·  [link](https://github.com/kubernetes/kubernetes/pull/134768#issuecomment-4033270274)

> > @tallclair @KevinTMtz (cc @esotsal ) I didn't look at this PR recently, but I clearly remember it was in pretty good shape last time I checked and I'm confident it's close or ready to merge.
> > 
> > My concern is: how do we handle the interactions with #129719 ?
> > 
> > The main reason I bring this up is that 129719 has a higher prio than this PR in the 1.36 cycle, so if we merge this PR we can disrupt (albeit, hopefully, not much) 129719 and slow it down even further.
> > 
> > I for myself I'm somehow leaning towards merging this PR as it's readier than 129719, but I think it's better to address this point openly in the best interest of the SIG and the project.
> 
> Talked about this topic in sig-node weekly 20260310. Feedback is to not block work so if this PR is in readier state than https://github.com/kubernetes/kubernetes/pull/129719 we will go forward with this one first.
> I'll do another review shortly and we will move forward.

### @ffromani — 2 reactions  
`👍 2`  ·  [link](https://github.com/kubernetes/kubernetes/pull/134768#issuecomment-4039403469)

> the device manager failure is a known issue which we need to investigate. I'll take a stab once the review here is completed. It's not a merge blocker.

### @ffromani — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/134768#issuecomment-4056017077)

> /lgtm
> 
> super hard to spot the inter-diff changes, but I haven't found anything unexpected.
> @ndixita feel free to unhold when happy

### @ffromani — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/134768#issuecomment-3467167231)

> PTAL to conflicts and rebases; I will look at memory manager and e2e tests afterwards, completing my review.

### @ffromani — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/134768#issuecomment-3509998801)

> @drewhagen This is an important enhancement, and the process so far has been very productive. We've identified that the implementation needs some structural changes, requiring careful thought and refactoring to be fully robust and maintainable.
> I am positive we can converge on a great solution, but that iteration and follow-up work won't fit within a short extension.
> Therefore, my recommendation is to give this enhancement the time it deserves and retarget it for 1.36. This ensures we ship a high-quality feature.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
