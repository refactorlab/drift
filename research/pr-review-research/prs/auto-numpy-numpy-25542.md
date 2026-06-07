# numpy/numpy #25542 — NEP: add NEP 56 on array API standard support in main namespace

**[View PR on GitHub](https://github.com/numpy/numpy/pull/25542)**

| | |
|---|---|
| **Author** | @rgommers |
| **Status** | ✅ merged |
| **Opened** | 2024-01-05 |
| **Repo** | curated review-culture seed |
| **Diff** | +662 / −0 across 1 files |
| **Engagement** | 12 conversation · 111 inline review comments |

## Top review comments (ranked by reactions)

### @ngoldbaum — 3 reactions  
`👍 3`  ·  [link](https://github.com/numpy/numpy/pull/25542#issuecomment-1893963519)

> Hi all, I realize that discussion is still ongoing, but since we're running short on time for the NumPy 2.0 RC, I wanted to unblock merging some of the remaining PRs for array API support that did not get any significant discussion so far.
> 
> Specifically, I'm planning on merging #25233 (adding `device` keyword arguments in array creation routines and `device` and `to_device` attributes to ndarray) and #25169 (adding a `correction` keyword argument to `np.var` and `np.std`) tomorrow. Please let me know if there are any comments relating to those changes for this NEP that haven't been lodged yet and I will hold off.

### @asmeurer — 2 reactions  
`👍 2`  ·  [link](https://github.com/numpy/numpy/pull/25542#issuecomment-1909052936)

> And just to be clear, the standard doesn't require all arrays from a given library to have the same type. This is even discussed explicitly https://data-apis.org/array-api/latest/design_topics/static_typing.html
> 
> > Also note that this standard does not require that input and output array types are the same (they’re expected to be defined in the same library though).

### @rgommers — 2 reactions  
`👍 2`  ·  [link](https://github.com/numpy/numpy/pull/25542#issuecomment-1968866837)

> I think it's time (or well overdue) to merge this PR with Draft status, so we have a rendered version. Discussion seems to have settled down and all comments are addressed. In case someone wants to return to a comment that they think wasn't addressed well enough yet or if we have a hiccup with one of the recent PRs implementing support for this NEP, we can always open a follow-up PR.

### @charris — 2 reactions  
`👍 2`  ·  [link](https://github.com/numpy/numpy/pull/25542#issuecomment-1969100277)

> Thanks Ralf and thanks to all who reviewed and offered comments.

### @rgommers — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/25542#issuecomment-1892758673)

> I reworked for textual comments so far (thanks everyone!) and resolved those. All the ones that look like they might benefit from discussion I'll do in a next update and will leave them unresolved.

### @rgommers — 1 reactions  
`👍 1`  ·  [link](https://github.com/numpy/numpy/pull/25542#issuecomment-1911876985)

> > I don't actually see what the issue with scalars is. They duck type as arrays, at least for all the purposes of the standard
> 
> Good points. In principle yes, you are right - since it's not required that the returned 0-D array is of the same type as the input array and there's no `isinstance` check, duck typing should fulfill all the requirements here.
> 
> > From a _numpy_ user perspective, the main annoyance I have with scalars is that they share most but not all methods with arrays
> 
> Here's one such paper cut:
> ```python
> >>> x_0d.mT
> ...
> ValueError: matrix transpose with ndim < 2 is undefined
> 
> >>> np.float32(3.5).mT
> ...
> AttributeError: 'numpy.float32' object has no attribute 'mT'
> ```
> 
> The standard doesn't require exceptions of a particular type, so this is technically still fully compliant. It's just annoyances. 
> 
> For this PR, I plan to rework the text to not state that scalars are non-compliant and an explanatory note saying that while there are minor differences, they duck type well enough to be considered the same as 0-D arrays from the perspective of the standard.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
