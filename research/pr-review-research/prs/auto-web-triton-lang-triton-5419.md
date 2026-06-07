# triton-lang/triton #5419 — [Backend] Implement layout conversion within warps with shuffle idx

**[View PR on GitHub](https://github.com/triton-lang/triton/pull/5419)**

| | |
|---|---|
| **Author** | @Mogball |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @lezcano
> I actually think that there are cases where generating more warp shuffles is better than trying to permute registers to generate 1, because the register permutation can have a significant runtime cost.

### @Jokeren
> I implemented something similar to this approach initially and found a certain 'search' process is required. The code was not clean and also cannot handle the 8-bit scenario, so I gave it up.

### @lezcano
> Find a basis of the intersection of I = S[lane] ∩ T[lane]. In our example it's {(0, 2)}. Consider C = {x ^ y | (x, y) ∈ zip(S[lane]\I, T[lane]\I)}.

### @peterbell10
> FYI based on this table I think a shuffle may cost the same as 4 moves, assuming mov and fma have similar throughput.

### @lezcano
> I think we can do better. I'll leave it up to you to decide whether you want to re-work this PR, or whether you want to reimplement the generic algo.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
