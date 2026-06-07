# prometheus/prometheus #16355 — feat(notifier): independent alertmanager sendloops

**[View PR on GitHub](https://github.com/prometheus/prometheus/pull/16355)**

| | |
|---|---|
| **Author** | @siavashs |
| **Status** | ✅ merged |
| **Opened** | 2025-03-31 |
| **Repo** | curated review-culture seed |
| **Diff** | +1174 / −435 across 11 files |
| **Engagement** | 33 conversation · 156 inline review comments |

## Top review comments (ranked by reactions)

### @siavashs — 3 reactions  
`🎉 3`  ·  [link](https://github.com/prometheus/prometheus/pull/16355#issuecomment-3743724023)

> All green again, let's merge this thing 😄

### @krajorama — 1 reactions  
`👍 1`  ·  [link](https://github.com/prometheus/prometheus/pull/16355#issuecomment-2771561821)

> > > Hi, awesome start! I've done my first pass on the code and gave a couple of comments.
> > > In general I'm not against the refactoring part, but I'm not sure about other reviewers, so I'm looking for some feedback on that. I'd also prefer to have the refactoring done in a separate PR up front, to get it out of the way and make this PR smaller. Let's see what other say on that first.
> > 
> > Hi, thanks for your feedback.
> > 
> > The refactoring commit is kept separate, so we can easily do another PR for that one first. I can submit that later today.
> 
> Hi, we discussed this with @grobinson-grafana  and yes we'd like to have the refactoring in a separate PR for easy review and merge. Thanks in advance!

### @krajorama — 1 reactions  
`👍 1`  ·  [link](https://github.com/prometheus/prometheus/pull/16355#issuecomment-2820244225)

> hi @siavashs , will you have time to rebase this PR and continue? thanks

### @siavashs — 1 reactions  
`👍 1`  ·  [link](https://github.com/prometheus/prometheus/pull/16355#issuecomment-2854041709)

> > LGTM. I'm not maintainer of alertmanager, so looking for approve from @grobinson-grafana . Also since this has multithreading, it would be nice to test under load. Is that something you could do @siavashs @MichaHoffmann ? (I'll ask around at Grafana).
> 
> Thanks for the review. We're planning to patch a portion of our Prometheus instances fleet and test the performance under production load.

### @machine424 — 1 reactions  
`👍 1`  ·  [link](https://github.com/prometheus/prometheus/pull/16355#issuecomment-3556388172)

> > @krajorama @machine424 Anything else needed here?
> 
> We spoke about this on slack, I'll need to take a final look.

### @siavashs — 1 reactions  
`👀 1`  ·  [link](https://github.com/prometheus/prometheus/pull/16355#issuecomment-3566723568)

> Not sure why random unrelated tests are failing on Windows!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
