# numpy/numpy #26081 — TYP: Make array _ShapeType bound and covariant

**[View PR on GitHub](https://github.com/numpy/numpy/pull/26081)**

| | |
|---|---|
| **Author** | @Jacob-Stevens-Haas |
| **Status** | ✅ merged |
| **Opened** | 2024-03-19 |
| **Repo** | curated review-culture seed |
| **Diff** | +97 / −50 across 10 files |
| **Engagement** | 37 conversation · 91 inline review comments |

## Top review comments (ranked by reactions)

### @jorenham — 5 reactions  
`🎉 5`  ·  [link](https://github.com/numpy/numpy/pull/26081#issuecomment-2272520358)

> Thanks a lot @Jacob-Stevens-Haas! Everyone can now go ahead and start typing the shapes of arrays 🎉.
> 
> I'm looking forward to your PR for the shaped `Array` type alias -- assuming that this one didn't scare you off, that is 😜.

### @rgommers — 3 reactions  
`👍 3`  ·  [link](https://github.com/numpy/numpy/pull/26081#issuecomment-2273076349)

> Great to see this land (and just in time for 2.1.0 too), thanks a lot @Jacob-Stevens-Haas, @jorenham & all reviewers!

### @rgommers — 2 reactions  
`👍 2`  ·  [link](https://github.com/numpy/numpy/pull/26081#issuecomment-2246283338)

> > Thanks man. I'm gonna email the list to try to get someone with approval authority to give this attention and make a decision.
> 
> Given that @BvB93 currently has low availability, and @jorenham is doing a ton of great work on static typing (hard to keep up with!) and is actively reviewing here, I'd be happy to rely on @jorenham as the main reviewer here. If the two of you are both happy with the state of this PR (or two PRs, if you split off the alias), I'd be happy to hit the merge button if needed.
> 
> I'll reply on the mailing list as well.
> 
> And thank you for sticking with this PR! I'm very aware that static typing improvements & handling shapes better is impactful and we have a gap between user demand and what we've able to do over the last couple of years. Great to see this much activity recently.

### @Jacob-Stevens-Haas — 2 reactions  
`👍 2`  ·  [link](https://github.com/numpy/numpy/pull/26081#issuecomment-2246363194)

> Great, thanks @rgommers!  @jorenham I'll remove the alias, review the doc changes, fix the CI, and re-request review.

### @jorenham — 2 reactions  
`👍 2`  ·  [link](https://github.com/numpy/numpy/pull/26081#issuecomment-2272674978)

> > I'm curious whether you think it's worth working on the PEP for `TypeVarTuple` variance/bounds ...
> 
> Please do! Perhaps you could also allow `ParamSpec` to be co/contra-variant while you're at it 🤔; it's a very similar case.
> 
> > ... before the alias. 
> 
> Well, besides the covariance and bounds issues, there are other reasons why I think that a plain tuple `TypeVar` is a better fit in this case. 
> A big one is that converting from a `ShapeT: tuple[int, ...]` to `*ShapesT: int` is a one-way street. 
> 
> So this is not a problem:
> 
> ```python
> type ArrayTup[ShapeT: tuple[int, ...], SCT: generic] = ndarray[ShapeT, dtype[SCT]]
> type ArrayVar[*Shape: int, SCT: generic] = ArrayTup[tuple[*Shape], SCT]
> ```
> 
> But the other way around is impossible:
> 
> ```python
> type ArrayVar[*Shape: int, SCT: generic] = ndarray[tuple[*Shape], dtype[SCT]]
> type ArrayTup[ShapeT: tuple[int, ...], SCT: generic] = ArrayVar[???, SCT]
> ```
> 
> ---
> 
> > I started to look at the implementation of `TypeVarTuple` in CPython, and it could be an achievable goal (there's a `BoundsVarianceMixin` in the `typing` module that `TypeVar` uses, maybe that's compatible with `TypeVarTuple`?)
> 
> Don't underestimate the amount of bureaucracy and discussion that's involved in attempting to change things like this:
> 
> I once made an attempt at a similar PEP that allowed specifying co- and contra- variant type params as `+T` and `-T` (like in e.g. Scala), which got rejected (because of PEP 695 and its magic `infer_variance`, which turns out it horrible for debugging, and not always right). But even so, it already was a lot of work, and that was *befo … *[truncated]*

### @Jacob-Stevens-Haas — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/numpy/numpy/pull/26081#issuecomment-2015818123)

> Alright @BvB93 , I made all the requested changes and CI is green - ready for another review. (a) Added type alias, (b) bound the TypeVar, (c) to demonstrate the use, `np.shape` is now typed to return the shape `TypeVar`, (d) described this in the docs and in expanded change notes, including some of the interplay between `TypeVar` and `TypeVarTuple`.  Hope I've been clear enough without going into too much detail.
> 
> Big thanks to @jorenham for being equally interested in this and helping me think through some of the details!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
