# JuliaLang/julia #53219 — Refactor CodeInfo/CodeInstance separation and interfaces

**[View PR on GitHub](https://github.com/JuliaLang/julia/pull/53219)**

| | |
|---|---|
| **Author** | @Keno |
| **Status** | ✅ merged |
| **Opened** | 2024-02-06 |
| **Repo importance** | ★48,772 · 5,785 forks · score 76,892 |
| **Diff** | +673 / −668 across 37 files |
| **Engagement** | 17 conversation · 102 inline review comments |

## Top review comments (ranked by reactions)

### @Keno — 1 reactions  
`👍 1`  ·  [link](https://github.com/JuliaLang/julia/pull/53219#issuecomment-1932828221)

> We're still before the feature freeze, so I think it makes sense to merge these kinds of internals-breaking changes. Otherwise, we'll merge it right after the feature freeze and we'll need to maintain both versions through the full RC period.

### @Keno — 1 reactions  
`😄 1`  ·  [link](https://github.com/JuliaLang/julia/pull/53219#issuecomment-1937343168)

> jinx, I also just rebased this locally ;). Let's see if we ended up in the same place ;).

### @Keno — 1 reactions  
`🚀 1`  ·  [link](https://github.com/JuliaLang/julia/pull/53219#issuecomment-1949648862)

> CI all green. I'm planning to merge this tomorrow. There's 2-3 follow up items still to be done, but I think they can be done in parallel on top of this.

### @vchuravy — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/53219#issuecomment-1930833384)

> This will conflict with #52233 which I am hoping to merge in the next few days. I went through this PR and I didn't see anything to bad, only my unease about uncached CodeInstances :)

### @aviatesk — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/53219#issuecomment-1932487833)

> Planning to conduct a thorough review around tomorrow. On a broader note, maybe relevant to Valentin's PR as well, it might be worth discussing whether this change should be incorporated into v1.11. While I agree that external uses of the `CodeInfo` fields is usualy wrong, considering its anticipated widespread use within the community, giving some leeway for ecosystem updates could be preferred?

### @Keno — 0 reactions  
`—`  ·  [link](https://github.com/JuliaLang/julia/pull/53219#issuecomment-1937343659)

> > jinx, I also just rebased this locally ;). Let's see if we ended up in the same place ;).
> 
> No diff modulo whitespace, so I'll just switch to this.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
