# prometheus/prometheus #14495 — [FEATURE] PromQL: Add experimental info function MVP

**[View PR on GitHub](https://github.com/prometheus/prometheus/pull/14495)**

| | |
|---|---|
| **Author** | @aknuds1 |
| **Status** | ✅ merged |
| **Opened** | 2024-07-22 |
| **Repo** | curated review-culture seed |
| **Diff** | +993 / −21 across 16 files |
| **Engagement** | 24 conversation · 151 inline review comments |

## Top review comments (ranked by reactions)

### @beorn7 — 2 reactions  
`👍 2`  ·  [link](https://github.com/prometheus/prometheus/pull/14495#issuecomment-2394342576)

> Just quickly: The plan _is_ to make `info` work on all info metrics, and to automatically use the actual identifying metrics. The PR here is an MVP to test the functionality and usefulness before investing the significant effort to fully implement the `info` function.

### @beorn7 — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/prometheus/prometheus/pull/14495#issuecomment-2305139214)

> Played with it, and it seems to do what it should. (I haven't looked at the code.)
> 
> Beyond the important restrictions already mentioned above (only works for `target_info`, not for info metrics in general, however we will define what an info metric is in the future; and only considers `job` and `instance` as identifying labels, however we will define what the identifying labels are in the future), we should also mention that a final version should probably accept any PromQL expression returning a vector as the 2nd argument (with the result being used as the superset to pick info metrics from – but which labels to copy can only be restricted if it is a simple label matcher, similar to what the `absent` function is already doing with guessing labels).

### @Nexucis — 1 reactions  
`👍 1`  ·  [link](https://github.com/prometheus/prometheus/pull/14495#issuecomment-2306583420)

> Minus the comments I put, on the frontend side it looks ok to me.
> 
> I am not validating the syntax of the `info` syntax. This is beyond my knowledge to understand if it doesn't break the PromQL syntax.
> 
> I am just validating the frontend code

### @MichaHoffmann — 1 reactions  
`👍 1`  ·  [link](https://github.com/prometheus/prometheus/pull/14495#issuecomment-2370813417)

> So this might not work, but intiutively - I would probably evaluate the info function in "populateSeries" by checking if the VectorSelector is under an info function, extract arguments and then just change Series of the VectorSelector. This feels like a nice place to evaluate the info function since at the end - it just changes labels of vector selector thats something we can do when "populating" its series in the first place i think; benefit is that remaining engine is none-the-wiser since we just changed Series and also we dont need to pass the querier around. Ill give it a try if that is a sane suggestion in the afternoon!
> 
> Edit: nah we cannot do that since first argument of info is an arbitrary expression.

### @beorn7 — 1 reactions  
`👍 1`  ·  [link](https://github.com/prometheus/prometheus/pull/14495#issuecomment-2399498595)

> WRT how to tell what the identifying labels are: One of the basic ideas is that this information is already present in the TSDB. Ideally, the targets exposing info metrics will already mark what the identifying metrics are (which is something OpenMetrics already allows).
> 
> BTW, the discussion here repeats aspects that already got their treatment when the design doc was presented. I recommend to have a look at https://github.com/prometheus/proposals/blob/main/proposals/2024-04-10-native-support-for-info-metrics-metadata.md .

### @jan--f — 0 reactions  
`—`  ·  [link](https://github.com/prometheus/prometheus/pull/14495#issuecomment-2298824147)

> @aknuds1 Iiuc the info function implements what is discussed in https://github.com/prometheus/prometheus/issues/13586 for other operators?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
