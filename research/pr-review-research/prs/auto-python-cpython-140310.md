# python/cpython #140310 — gh-139109: A new tracing JIT compiler frontend for CPython

**[View PR on GitHub](https://github.com/python/cpython/pull/140310)**

| | |
|---|---|
| **Author** | @Fidget-Spinner |
| **Status** | ✅ merged |
| **Opened** | 2025-10-18 |
| **Repo importance** | ★73,094 · 34,706 forks · score 216,918 |
| **Diff** | +2407 / −1063 across 41 files |
| **Engagement** | 30 conversation · 248 inline review comments |

## Top review comments (ranked by reactions)

### @efimov-mikhail — 10 reactions  
`❤️ 4 · 🚀 6`  ·  [link](https://github.com/python/cpython/pull/140310#issuecomment-3529077251)

> > This is a big step forward for the JIT. @Fidget-Spinner thanks again for doing this.
> 
> Congratulations, @Fidget-Spinner !

### @Fidget-Spinner — 2 reactions  
`🎉 2`  ·  [link](https://github.com/python/cpython/pull/140310#issuecomment-3439752968)

> @markshannon I implemented what I think you mean. It's a 10x smaller code change now :)

### @Eclips4 — 1 reactions  
`👍 1`  ·  [link](https://github.com/python/cpython/pull/140310#issuecomment-3450541435)

> Don’t want to slow down this amazing feature, but before merging it, could we run refleak tests? I recall there were refleaks related to the JIT, or perhaps the approach used to measure them wasn’t accurate in the JIT case...
> We can probably address those later, since this isn’t critical.

### @Fidget-Spinner — 0 reactions  
`—`  ·  [link](https://github.com/python/cpython/pull/140310#issuecomment-3419041902)

> Closing because this is triggering some UB in CI and wasting resources. Will reopen once I fix it.

### @Fidget-Spinner — 0 reactions  
`—`  ·  [link](https://github.com/python/cpython/pull/140310#issuecomment-3429568428)

> @markshannon I suspect the greatest slowdown is due to the code being rather branchy. Our side exits are very costly right now still. I am planning to fix this thru https://github.com/python/cpython/issues/140434.
> 
> Other sources of slowdown: we even trace through CALL_ALLOC_AND_ENTER_INIT (simple object initialization and creation) right now. The optimizer can't deal with that, so it stops optimizing there. I have another branch that adds this to the uop optimizer.
> 
> Finally, note that I found that the current design slows down the base computed goto interpreter by a lot!!! (Roughly 6% pyperformance it seems). I suspect it's because we trace when we PGO, so we have no choice but to do a normal call to another interpreter when do computed goto rather than the dispatch table idea.
> 
> Alternatively, just mandate tail calling for JIT builds.

### @Fidget-Spinner — 0 reactions  
`—`  ·  [link](https://github.com/python/cpython/pull/140310#issuecomment-3434530936)

> So I benched the patched side exits on my system and I see no speedups https://github.com/python/cpython/issues/140434.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
