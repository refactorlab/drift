# kubernetes/kubernetes #130160 — Implement DRA Device Binding Conditions (KEP-5007)

**[View PR on GitHub](https://github.com/kubernetes/kubernetes/pull/130160)**

| | |
|---|---|
| **Author** | @KobayashiD27 |
| **Status** | ✅ merged |
| **Opened** | 2025-02-14 |
| **Repo** | curated review-culture seed |
| **Diff** | +5103 / −635 across 80 files |
| **Engagement** | 98 conversation · 487 inline review comments |

## Top review comments (ranked by reactions)

### @liggitt — 2 reactions  
`👍 2`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130160#issuecomment-3132304068)

> > @KobayashiD27 Since we have all approvals, please squash the commits.
> 
> (you don't have to squash to a single commit, distinct commits for API changes, implementation changes, generated changes are fine, but squashing in fixup commits where they make sense is good)

### @dom4ha — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130160#issuecomment-2904754606)

> > I fully agree that the “fail then reschedule” pattern is problematic and should not be encouraged. I’ll revise the KEP to make that clear, and to better separate the concerns of the mechanism itself from the specific device models it might support.
> 
> I think we should focus on updating the KEP first, especially reformulating the purpose and defining which problem it solves. Doing things in the right order should help us to review the implementation and ask the right questions.
> 
> > At the same time, I recognize that the architectural questions around proxy drivers and planning phases are important and worth exploring.
> 
> How important is solving the problem of attachable devices? Even if it's not a priority now, I think it's very important to explore in the context of changes we plan to make in scheduling.

### @pohly — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130160#issuecomment-3036681345)

> /assign @mortent
> 
> For a first pass. You are probably not familiar with the scheduler plugin, though.
> 
> @KobayashiD27: at some point I had implemented integration tests for this feature. Did you copy those into your branch? If not, then please do.

### @KobayashiD27 — 1 reactions  
`👍 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130160#issuecomment-3101629159)

> @macsko 
> https://github.com/kubernetes/kubernetes/pull/130160#discussion_r2218801964
> From this disscusion, I have removed "scheduler_perf" test in this PR.

### @pohly — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130160#issuecomment-3131404363)

> > > I believe there is only one unresolved review comment:
> > https://github.com/kubernetes/kubernetes/pull/130160#discussion_r2235878667
> 
> Looks like it got resolved via a unit test.
> 
> I believe all of my feedback got addressed, I'm fine with merging this.

### @macsko — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/kubernetes/kubernetes/pull/130160#issuecomment-3131523500)

> Thanks for your extensive work!
> 
> /approve
> For scheduler changes


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
