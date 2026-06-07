# numpy/numpy #29642 — ENH: Add extended sorting APIs

**[View PR on GitHub](https://github.com/numpy/numpy/pull/29642)**

| | |
|---|---|
| **Author** | @charris |
| **Status** | ✅ merged |
| **Opened** | 2025-08-30 |
| **Repo** | curated review-culture seed |
| **Diff** | +315 / −165 across 8 files |
| **Engagement** | 54 conversation · 42 inline review comments |

## Top review comments (ranked by reactions)

### @mhvk — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29642#issuecomment-3239512981)

> I think I'd still suggest that the new C-API does not have sort kind at all, and that the old functions just translate. Alternatively, for now, make the new functions private and have the public `SortEx` not have the kind argument, i.e., both old and new call into the private ones.

### @charris — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29642#issuecomment-3241988237)

> > I am curious now if we can't avoid the new function
> 
> Yes, we could. But you didn't want to extend  SORTKIND :) And to be fair, that would have been a kludge.
> 
> I rather like the new functions and the flags interface, I think things worked out well. The only real difference is heapsort not being public, and I've thought it unneeded since introsort went in. From the beginning it was the slowest sort, taking about 2x longer than quicksort, and quicksort has gotten faster. 
> 
> The flag interface is nicely extensible in the future,  we have been abusing SORTKIND for many years as new sorting functions have come along: introsort, radix sort,  timsort, SIMD quicksort, etc.  We don't want to make users choose among those options, let the experts do it.
> 
> All we have do to get rid of `nanfirst` is comment out a line 
> ```
> //           "$nanfirst", &PyArray_OptionalBoolConverter, &nanfirst,
> ```
> 
> The parser then raises an error:
> 
> ```
> In [1]: np.ones(10).sort(nanfirst=1)
> ---------------------------------------------------------------------------
> TypeError                                 Traceback (most recent call last)
> Cell In[1], line 1
> ----> 1 np.ones(10).sort(nanfirst=1)
> 
> TypeError: sort() got an unexpected keyword argument 'nanfirst'
> ```

### @mhvk — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29642#issuecomment-3242722704)

> I'm confused: I thought the numbering *is* backwards compatible in the way I suggested. Specifically, if we have the following flags,
> ```
>         NPY_SORT_DEFAULT = 0,
>         NPY_SORT_STABLE = 2,
>         NPY_SORT_DESCENDING = 4,
>         NPY_SORT_NANFIRST = 8,
>         NPY_SORT_LOWMEM = 1,
> ```
> then one would have a good match with the kinds:
> ```
>         NPY_QUICKSORT = 0,  -> no flags, fine
>         NPY_HEAPSORT = 1, -> would equal NPY_SORT_LOWMEM, which is reasonable (but would have no effect)
>         NPY_MERGESORT = 2, -> NPY_SORT_STABLE, obvious
>         NPY_STABLESORT = 2, -> same
> ```
> Of course,  `NPY_SORT_LOWMEM | NPY_SORT_STABLE = 3` does not currently exist, so that can default to ignoring `LOWMEM` (which is a request, not a requirement; in my suggested follow-up scheme, one would have `NPY_SORT_REQUIREMENT_MASK = 0xFFFFFFFD` -- keeping bits reserved as requirements until we decide otherwise).
> 
> p.s. Of course, for now it may be easier to just have a flag `_NPY_SORT_RESERVED = 1` -- the low memory one just came up because heapsort does not need a work-space (nor does `quicksort`, of course, but this allows us to replace that with something that does need some memory if needed).

### @charris — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29642#issuecomment-3243451537)

> Curiously, NPY_SORTKIND isn't documented anywhere except except for a short listing  in the PyArray_Sort documentation.  Documenting NPY_SORTKIND is all the documentation needed for this PR. The release note might contain a bit more on the dropping of heapsort case somebody notices a change and wants to know why.

### @charris — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/29642#issuecomment-3248993248)

> >  is make sure that the C-side raises an error when the new flags are used
> 
> You get a  TypeError: "no current sort function meets the requirements"

### @charris — 1 reactions  
`😕 1`  ·  [link](https://github.com/numpy/numpy/pull/29642#issuecomment-3251227489)

> > I think just use PyArray_BoolConverter
> 
> Ah, it's already written, is it. Which raises the opposite question, why isn't it used  for `stable`? Lets try that.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
