# envoyproxy/envoy #35545 — access log: new 20x faster json formatter implementation

**[View PR on GitHub](https://github.com/envoyproxy/envoy/pull/35545)**

| | |
|---|---|
| **Author** | @wbpcode |
| **Status** | ✅ merged |
| **Opened** | 2024-08-01 |
| **Repo** | curated review-culture seed |
| **Diff** | +598 / −45 across 12 files |
| **Engagement** | 51 conversation · 134 inline review comments |

## Top review comments (ranked by reactions)

### @jmarantz — 2 reactions  
`👍 2`  ·  [link](https://github.com/envoyproxy/envoy/pull/35545#issuecomment-2289505414)

> /wait
> 
> I think a separate PR should be cut to sort out the exception issue with the sanitizer.

### @jmarantz — 2 reactions  
`👍 2`  ·  [link](https://github.com/envoyproxy/envoy/pull/35545#issuecomment-2359947699)

> I think I get what @zuercher is after with option a; a modest enrichment of the abstraction we put between the serializer and the buffer/string and move the sanitization responsibility in there. Is that right? I misinterpreted before when I was leaning toward option b.

### @phlax — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/35545#issuecomment-2324971786)

> @wbpcode needs main merg
> 
> @jmarantz bump
> 
> /wait

### @jmarantz — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/35545#issuecomment-2325173830)

> per discussion this has been broken up into a bunch of smaller PRs which are shuffling through.
> 
> /wait-any

### @jmarantz — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/35545#issuecomment-2362009416)

> Nice. Per discussion I think I'm in favor of option (a) with Zuercher's ideas mixed in.
> 
> /wait

### @wbpcode — 1 reactions  
`👍 1`  ·  [link](https://github.com/envoyproxy/envoy/pull/35545#issuecomment-2437550748)

> It's more complex because the serialization of the keys is done when we loading the configuration, and we can never know if the value will be null or not at that time.
> 
> I will create a bug first to record this problem.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
