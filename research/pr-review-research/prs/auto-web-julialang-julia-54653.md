# JuliaLang/julia #54653 — Create `Base.Fix` as general `Fix1`/`Fix2` for partially-applied functions

**[View PR on GitHub](https://github.com/JuliaLang/julia/pull/54653)**

| | |
|---|---|
| **Author** | @MilesCranmer |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @aplavin
> Are `Fix1` and `Fix2` also getting propagation of kwargs and additional args in this PR? Like `Fix1(f, 1)(2, 3; x=4) === f(1, 2, 3; x=4)`.

### @aplavin
> that approach is more flexible in allowing to fix any arguments, eg 1, 2, and 4 – not just consecutive args.

### @mikmoore
> I hate to be the bikeshedder, but part of my post was protesting this name. The indicated proposal means that `Base.Fix(f, 1, args...) == Base.Fix2(f, only(args))`...I strongly dislike the switch.

### @mikmoore
> I would go ahead and just make that TypeVar a la `Base.Fix{POSITION}(f, args...)`. If one passes a non-`Val` for your `n`, it's already unstable.

### @uniment
> My point is that, although this PR ostensibly doesn't decide a contentious issue, it actually does by foreclosing superior options...this PR steers the language down a worse path.

### @MilesCranmer
> triage...decided that doing `Base.Fix1 -> Base.Fix{1}` and `Base.Fix2 -> Base.Fix{2}` was the smallest acceptable change...while being as similar as possible to existing API.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
