# envoyproxy/envoy #34942 — Enhance ext_proc filter to support MXN streaming

**[View PR on GitHub](https://github.com/envoyproxy/envoy/pull/34942)**

| | |
|---|---|
| **Author** | @yanjunxiang-google |
| **Status** | ✅ merged |
| **Opened** | 2024-06-26 |
| **Repo** | curated review-culture seed |
| **Diff** | +1001 / −81 across 9 files |
| **Engagement** | 29 conversation · 188 inline review comments |

## Top review comments (ranked by reactions)

### @yanjunxiang-google — 1 reactions  
`😕 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/34942#issuecomment-2221851292)

> /assign @gbrail @htuch @jmarantz @tyxia @yanavlasov

### @KBaichoo — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/34942#issuecomment-2230944145)

> /assign @tyxia 
> 
> As codeowner for first pass.

### @tyxia — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/34942#issuecomment-2250769220)

> > /assign @tyxia
> > 
> > As codeowner for first pass.
> 
> The design is under internal review and discussion.
> 
> My opinion here is that we should remove the ext_proc internal buffering here, which is essentially ask in https://github.com/envoyproxy/envoy/issues/32090.  But it is also good to hear other reviewers' opinions. (i.e., not a gating factor if other reviewers approve it)
> 
> Adding wait here to avoid daily ping on maintainer on-caller.
> 
> /wait

### @yanavlasov — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/34942#issuecomment-2451904955)

> Will wait for other approvals and then submit.
> 
> /wait-any

### @jmarantz — 0 reactions  
`—`  ·  [link](https://github.com/envoyproxy/envoy/pull/34942#issuecomment-2250778684)

> I agree; I think internal buffering or MxN complicates the model and how to reason about it.

### @yanjunxiang-google — 0 reactions  
`—`  ·  [link](https://github.com/envoyproxy/envoy/pull/34942#issuecomment-2250991985)

> IMHO,, I am not sure if no internal buffer, how to support the case if the side stream server ask Envoy to send the original data as it is for certain sequence of data during the streaming.  However, it is okay for me to put this on wait.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
