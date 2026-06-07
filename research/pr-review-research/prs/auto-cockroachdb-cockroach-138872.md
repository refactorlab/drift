# cockroachdb/cockroach #138872 — ccl/changefeedccl: add compression options for webhook sink

**[View PR on GitHub](https://github.com/cockroachdb/cockroach/pull/138872)**

| | |
|---|---|
| **Author** | @massimo-ua |
| **Status** | ✅ merged |
| **Opened** | 2025-01-11 |
| **Repo** | curated review-culture seed |
| **Diff** | +782 / −108 across 8 files |
| **Engagement** | 34 conversation · 126 inline review comments |

## Top review comments (ranked by reactions)

### @cockroach-teamcity — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/138872#issuecomment-2585295182)

> [![CLA assistant check](https://cla.crdb.dev/pull/badge/signed)](https://cla.crdb.dev/cockroachdb/cockroach?pullRequest=138872) <br/>All committers have signed the CLA.

### @cockroach-teamcity — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/138872#issuecomment-2585295212)

> This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/cockroachdb/cockroach/138872)

### @massimo-ua — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/138872#issuecomment-2593349264)

> @asg0451 Thanks for the review. I'll work through the comments and update you once I'm done.

### @massimo-ua — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/138872#issuecomment-2601047978)

> I see that in the webhook sink https://github.com/cockroachdb/cockroach/blob/758fe6af0492e04f677196745f28a546b3a657cc/pkg/ccl/changefeedccl/sink_webhook_v2.go#L181, every time makePayloadForBytes is called, it creates an HTTP request object. The request configuration is static, except for the body and ContentLength. We could easily create a request template once, then clone its static configuration and just update the dynamic parts each time. WDYT?

### @asg0451 — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/138872#issuecomment-2605382094)

> > I see that in the webhook sink
> > 
> > https://github.com/cockroachdb/cockroach/blob/758fe6af0492e04f677196745f28a546b3a657cc/pkg/ccl/changefeedccl/sink_webhook_v2.go#L181
> > 
> > , every time makePayloadForBytes is called, it creates an HTTP request object. The request configuration is static, except for the body and ContentLength. We could easily create a request template once, then clone its static configuration and just update the dynamic parts each time. WDYT?
> 
> That's a good idea, but let's leave it out of here just to keep the scope down.

### @massimo-ua — 0 reactions  
`—`  ·  [link](https://github.com/cockroachdb/cockroach/pull/138872#issuecomment-2610049732)

> @asg0451 Please review recent changes
> Updated encoder/decoders pool implementation


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
