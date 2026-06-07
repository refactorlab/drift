# numpy/numpy #29737 — ENH, API: New sorting slots for DType API

**[View PR on GitHub](https://github.com/numpy/numpy/pull/29737)**

| | |
|---|---|
| **Author** | @MaanasArora |
| **Status** | ✅ merged |
| **Opened** | 2025-09-10 |
| **Repo** | curated review-culture seed |
| **Diff** | +579 / −81 across 6 files |
| **Engagement** | 54 conversation · 188 inline review comments |

## Top review comments (ranked by reactions)

### @seberg — 2 reactions  
`👍 2`  ·  [link](https://github.com/numpy/numpy/pull/29737#issuecomment-3297455099)

> Right, so basically we have 4 typical implementations.  With NaNs, it would be 8, although we wouldn't need all.  I am now leaning towards not worrying about NaNs, though.  I just doubt that sorting NaNs to the front is niche enough to make it hard. 
> 
> > I can see the wish for performance but it seems to me calling a function with flags that internally just has a switch right up front
> 
> I think optimization is actually a reason to expose the `get_*` style API.  The overhead is tiny, but:
> * It makes it much easier to reason about how to build an optimized version for structured dtypes.  This could have a _huge_ effect on
> * If we add sort-hints (or other metadata to the context), it might allow future further optimized versions to select the best algorithm once.  E.g. a "this is a very small sort" hint.
> 
> Not sure this matters, but I think optimization is a reason *for* the `get_` style API.  The reason for allowing to just pass 4 functions here is that it is less verbose to implement (i.e. user, including NumPy convenience).
> 
> UFuncs actually support *both* styles.  The closest design to what ufuncs actually be having _both_!
> But, I am happy to just do either one, we can always add a `NPY_DT_sort_getter` slot and one should only define one of them.  We could also add some `void *reserved = NULL` at the end of the struct, but since `NPY_DT_sort_getter` and `NPY_DT_sort_functions` would be mutually exclusive, I actually don't think I care about that.
> 
> (Implementation wise, `NPY_DT_sort_getter` could be set to a default that looks up what's in `NPY_DT_sort_functions`.)
> 
> ---
> 
> There … *[truncated]*

### @charris — 2 reactions  
`👍 2`  ·  [link](https://github.com/numpy/numpy/pull/29737#issuecomment-3298836636)

> I am quite happy to leave the design choice to @seberg here. My first instinct would be to go with the simplest implementation, but agree that a getter approach offers more flexibility for future changes. That said, the future is hard to predict, so we shouldn't spend too much time on it. I think the most important thing in the short term is to make alternative selections easy, SIMD for instance. I think Sebastian is thinking of run time dispatch as a possibility.

### @ngoldbaum — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29737#issuecomment-3286606670)

> Sure, whichever you think would work best. Just wanted to make sure it's on your radar.

### @charris — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29737#issuecomment-3286805492)

> Note that sortkind has the property that `sortkind & 0x7 >> 1` yields an index ranging from 0 to 3 that can be used to pick the sorting functions if they are in an array. That trick is not currently used, but things were deliberately designed so that it would work.

### @mhvk — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29737#issuecomment-3288817858)

> > we have 4 ways of doing sorts
> 
> Except that @charris also introduced an option to sort nans first or last... It is currently commented out, but it would make it eight options... Which is partially why I like passing on flags...  :smiley_cat: 
> 
> Note that I'd be absolutely fine with going with a mechanism mirroring the ufuncs -- in the end, sorting could in principle easily be done with a `gufunc` if that would have a `flags` option. 
> 
> p.s. Sorry to come to this discussion late!

### @MaanasArora — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29737#issuecomment-3330031899)

> Ah yes, we don't have the registration functions yet, so can't really do stringdtype properly. Can we scope this PR to just the internal slots and implementation then if possible, and do registration after? Doing the general registration mechanism here might be too much?
> 
> Edit: we don't exactly need many docs for this PR then either, I suppose, except for `SortParameters`...


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
