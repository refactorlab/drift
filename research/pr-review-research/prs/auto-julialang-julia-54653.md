# JuliaLang/julia #54653 — Create `Base.Fix` as general `Fix1`/`Fix2` for partially-applied functions

**[View PR on GitHub](https://github.com/JuliaLang/julia/pull/54653)**

| | |
|---|---|
| **Author** | @MilesCranmer |
| **Status** | ✅ merged |
| **Opened** | 2024-06-02 |
| **Repo importance** | ★48,772 · 5,785 forks · score 76,892 |
| **Diff** | +167 / −23 across 6 files |
| **Engagement** | 135 conversation · 58 inline review comments |

## Top review comments (ranked by reactions)

> ⚠️ Only the first 100 conversation comments were fetched (API page cap).

### @DilumAluthge — 7 reactions  
`👍 7`  ·  [link](https://github.com/JuliaLang/julia/pull/54653#issuecomment-2145662027)

> Hi @admsev, please do not use the JuliaLang/julia repo as a testing ground for developing your AI tool.

### @nsajko — 3 reactions  
`👍 3`  ·  [link](https://github.com/JuliaLang/julia/pull/54653#issuecomment-2146273447)

> Another package (apart from FixArgs.jl and AccessorsExtra.jl), treading the same ground is my [CallableExpressions.jl](https://juliahub.com/ui/Packages/General/CallableExpressions).
> 
> This PR, too, really seems like it should be a package first for a few years before it can be considered for merging into `Base`.

### @aplavin — 3 reactions  
`👍 3`  ·  [link](https://github.com/JuliaLang/julia/pull/54653#issuecomment-2147312651)

> It would be nice if all new functions/structs proposals to Base went through a phase of being implemented in a package. Then:
> - Everyone can easily try these `Fix` structs in their code
> - You and others can evaluate how useful the specific implementation is
> - Rough edges that are only apparent in actual use can be smoothed before committing Base to the interface
> 
> Of course it shouldn't be required for such packages to be "popular" – but to have at least some usage in the wild is useful before Base. As I understand, currently there's no package implementing this exact approach...

### @MilesCranmer — 3 reactions  
`❤️ 3`  ·  [link](https://github.com/JuliaLang/julia/pull/54653#issuecomment-2154652842)

> > However, the raised issues are not related to the general concept, but to the specific implementation. It's far less clear without battle-testing which design is more suitable for general usage.
> 
> While this could apply earlier when we were discussing ideas for multiple args, I have since compromised and stripped out all the creativity and new ideas. So I suggest we do not need to consider "longterm testing in a package" with the current PR. Now it's the same exact thing as `Fix1`/`Fix2`, to the point one can write:
> 
> ```julia
> const Fix1{F,T} = Fix{1,F,T}
> ```
> 
> And as we know those are quite battle-tested and popular for shorthand anonymous functions: 
> https://github.com/search?q=/Base.Fix%5B12%5D/+language:julia&type=code
> 
> In other words, I'm not taking any creative design choices here (which I would have liked to do... but I'm trying to be a realist here). It's the same design as current Julia; just one parameter is freed from its vestigial form of hard-coding.
> 
> This also means this PR doesn't pose any barrier to future design choices like the ideas in your package or @nsajko's packages – so you don't need to worry about not being able to consider such choices in the future. This PR doesn't rule those out from a future integration. This PR is literally just `Fix1`/`Fix2`, freed from a constraint.
> 
> I'm basically just punting any design choices to later because I know that _that_ design discussion will take a long time... but I think many people can make effective use of `Fix{n}` alone already, so I don't want to let perfect stand in the way of good. See https://github.com/J … *[truncated]*

### @MilesCranmer — 2 reactions  
`👍 2`  ·  [link](https://github.com/JuliaLang/julia/pull/54653#issuecomment-2145941452)

> Another question:
> 
> Should we rewrite `Base.Fix1` and `Base.Fix2` using `Base.Fix{N}`?
> 
> For example:
> 
> ```julia
> const Fix1{F,T} = Fix{1,F,Tuple{T},@NamedTuple{}}
> const Fix2{F,T} = Fix{2,F,Tuple{T},@NamedTuple{}}
> ```
> 
> I _think_ this would not be a breaking change. But I could very well be wrong.
> 
> ---
> 
> Edit: this is nice, it even means that `Fix{1}(+, 1.0)` would get picked up by any method specialisation written `::Fix1{typeof(f),Float64}`!
> 
> Edit 2: Actually nevermind, it complicates the interface as you may expect people to call `f.x` to get the contents of `Fix1`. No reason to change `Fix1`/`Fix2` internals (although we totally could).

### @MilesCranmer — 2 reactions  
`👎 2`  ·  [link](https://github.com/JuliaLang/julia/pull/54653#issuecomment-2146276952)

> > This PR, too, really seems like it should be a package first for a few years before it can be considered for merging into `Base`.
> 
> It has been a package (multiple packages, actually) for 4 years


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
