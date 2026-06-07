# python/cpython #118450 — gh-117139: Convert the evaluation stack to stack refs

**[View PR on GitHub](https://github.com/python/cpython/pull/118450)**

| | |
|---|---|
| **Author** | @Fidget-Spinner |
| **Status** | ✅ merged |
| **Opened** | 2024-04-30 |
| **Repo importance** | ★73,094 · 34,706 forks · score 216,918 |
| **Diff** | +5215 / −3745 across 35 files |
| **Engagement** | 65 conversation · 275 inline review comments |

## Top review comments (ranked by reactions)

### @gvanrossum — 2 reactions  
`👍 2`  ·  [link](https://github.com/python/cpython/pull/118450#issuecomment-2087341245)

> Could we hold off on this until 3.14? It's only a week until feature freeze for 3.13 (at which point main becomes 3.14), and this looks like a lot of churn in a time where we all would like stability to merge things that are actually needed in 3.13.

### @gvanrossum — 1 reactions  
`👍 1`  ·  [link](https://github.com/python/cpython/pull/118450#issuecomment-2150505697)

> > Only tags all pointers 0b11 and NULL and immortal stuff as deferred for now.
> 
> Hey @Fidget-Spinner, could you update the PR description to be less criptic? I have no idea what you meant with this sentence. This PR is large enough that I think at least the PR description (and perhaps the commit message) should have a careful description of what this PR is doing. (The issue feels more like a discussion than a description of a specific design.)

### @markshannon — 1 reactions  
`👍 1`  ·  [link](https://github.com/python/cpython/pull/118450#issuecomment-2155134060)

> I see that you removed `PyObject_Vectorcall_StackRef` and the other call variants. Thanks for doing that.
> Could you do the same for `_PyEval_UnpackIterableStackRef`, `_PyDict_FromStackRefItems`, `_PyBuildSlice_ConsumeStackRefs`, and `_PyUnicode_JoinStackRef`.
> Could you also convert `_PyList_FromStackSteal` and `_PyTuple_FromStackSteal` back to taking `PyObject **`?
> That way the changes aren't leaking into the `Object` folder which should only be concerned with heap references.

### @markshannon — 1 reactions  
`👍 1`  ·  [link](https://github.com/python/cpython/pull/118450#issuecomment-2166229364)

> > Yeah but the code generator still emits a cast because it thinks it's trying to cast from PyObject, which the C compiler breaks and doesn't like.
> 
> Then fix the code generator 🙂 
> 
> I think you only need to add `.bits` after `stack_pointer[0]` and the cast is valid.

### @markshannon — 1 reactions  
`👍 1`  ·  [link](https://github.com/python/cpython/pull/118450#issuecomment-2167791994)

> Ok. I think we'll need some sort of debugging counter, but we can add it later when it makes more sense.

### @Fidget-Spinner — 1 reactions  
`🎉 1`  ·  [link](https://github.com/python/cpython/pull/118450#issuecomment-2192055221)

> I'm going to merge this in an hour. We can keep iterating on it if needed after.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
