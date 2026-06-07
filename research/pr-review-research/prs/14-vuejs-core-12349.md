# vuejs/core #12349 — perf(reactivity): ports `alien-signals` 0.4.4

**[View PR on GitHub](https://github.com/vuejs/core/pull/12349)**

| | |
|---|---|
| **Author** | @johnsoncodehk |
| **Status** | ✅ merged |
| **Opened** | 2024-11-09 |
| **Diff** | +866 / −777 across 16 files |
| **Engagement** | 46 conversation comments · 0 inline review comments |

## Why this PR is notable

Porting the `alien-signals` reactivity algorithm into Vue. The top comment is an **independent, reproducible benchmark** from a third party (`transitive-bullshit`) confirming the perf win across frameworks, with hardware and date stated.

## 🧠 The lesson for reviewers

> The most credible review of a performance PR is an **independent benchmark from outside the project** — method and machine disclosed.

## How the author framed it (PR description excerpt)

> `alien-signals`(https://github.com/stackblitz/alien-signals) is a research-oriented signal library rewritten based on Vue 3.4's reactivity system. It sets several constraints to ensure the high-performance implementation of a reactivity system. (Currently, it is the fastest implementation among all signal libraries)
> 
> This PR ports the https://github.com/stackblitz/alien-signals/blob/master/src/system.ts code to https://github.com/vuejs/core/blob/main/packages/reactivity/src/effect.ts to leverage all the optimizations discovered by `alien-signals`.
> 
> ### Benefits
> 
> - Lower memory usage: Memory usage is reduced by ~13% (2.3MB -> 2.0MB) when creating a large number of ref, computed, and effect instances.
> - Higher performance: Various performance tests now generally yield better results, especially in scenarios where a large number of computeds are read after changing a ref. Vue 3.5 had significant performance drawbacks in this case (a characteristic of pull-model reactivity systems, it can be reproduced in https://github.com/transitive-bullshit/js-reactivity-benchmark), and the current implementation resolves this issue, achieving over 30x performance improvement (proportional to scale).
> - Better code abstraction: The previous scheduling logic had coupling with external implementations (such as Dep cleanup, debug events, recurse effect handling). The current implementation eliminates these couplings.
> 
> ### Benchmark Results
> 
> #### computed
> 
> ```
>      name                                                                    hz     min     max    mean     p75     p99    p995    p999     rme  samples
>    · create computed                                               6,111,709.97  0.00 …​ *[truncated]*

## Highest-signal comments (ranked by reactions)

### @transitive-bullshit — 71 reactions  
`❤️ 14 · 🎉 39 · 🚀 18`  ·  [link](https://github.com/vuejs/core/pull/12349#issuecomment-2493036282)

> Pretty impressive from [my testing](https://github.com/transitive-bullshit/js-reactivity-benchmark) thanks to @johnsoncodehk et al 🔥 
> 
> <p align='center'>
>   <img src="https://github.com/user-attachments/assets/d762a2e7-99dd-41b3-b907-82c4578ec878" alt="Average benchmark results across frameworks">
>   (<em>lower times are better</em>)
> </p>
> 
> These results were last updated _November 22 2024_ on an M3 Macbook Pro using Node.js v22.10.0.


### @johnsoncodehk — 24 reactions  
`👍 5 · ❤️ 2 · 🎉 1 · 🚀 16`  ·  [link](https://github.com/vuejs/core/pull/12349#issuecomment-2505978920)

> PR is now based on alien-signals 0.4.4, due to the implementation of some new fast paths (e.g. https://github.com/stackblitz/alien-signals/pull/7), which gets more performance improvements compared to 0.3.2.
> 
> Benchmark result (baseline is https://github.com/vuejs/core/pull/12349/commits/f15e9d72c0ebffc2ba3015e1086ba7cebb1f3682):
> 
> ```
>  ✓ packages/reactivity/__benchmarks__/computed.bench.ts (13) 11622ms
>    ✓ computed (13) 11620ms
>      name                                                                    hz     min     max    mean     p75     p99    p995    p999     rme  samples
>    · create computed                                               1,691,995.02  0.0005  0.0723  0.0006  0.0006  0.0007  0.0007  0.0017  ±0.11%   845998  [1.00x] ⇓
>      create computed                                               1,693,497.15  0.0005  0.0472  0.0006  0.0006  0.0007  0.0007  0.0015  ±0.08%   846749  (baseline)
>    · write ref, don't read computed (without effect)               1,441,569.95  0.0006  0.0691  0.0007  0.0007  0.0008  0.0008  0.0010  ±0.08%   720785  [1.01x] ⇑
>      write ref, don't read computed (without effect)               1,432,267.74  0.0006  2.7299  0.0007  0.0007  0.0008  0.0008  0.0013  ±1.11%   716134  (baseline)
>    · write ref, don't read computed (with effect)                    428,069.29  0.0022  0.0495  0.0023  0.0023  0.0025  0.0026  0.0047  ±0.08%   214035  [1.07x] ⇑
>      write ref, don't read computed (with effect)                    399,988.18  0.0023  0.1397  0.0025  0.0025  0.0026  0.0028  0.0110  ±0.14%   199997  (baseline)
>    · write ref, read computed (without effect)                       677,705.75  0.0013  0.3494  0.0015  0.0015  0.0016  0.0016 …​ *[truncated]*


### @yyx990803 — 15 reactions  
`👍 5 · ❤️ 5 · 🚀 5`  ·  [link](https://github.com/vuejs/core/pull/12349#issuecomment-2475063553)

> Removed namespace usage in https://github.com/vuejs/core/pull/12349/commits/571ba051d6e279212627766f90a856146f14211e
> 
> Previously namespace was used because it somehow showed better perf in benchmarks, but turns out it's because Vitest benchmark currently has overhead for every access of cross-module import binding due to the way modules are evaluated.
> 
> For real-world performance, we should be benching against the bundled reactivity module, where module-root level exports are scope-hoisted into local consts. This should result in better perf than namespace access. It also is more minifier friendly and can reduce bundle size increase.
> 
> Comparing the benchmark using bundled `reactivity.esm-browser.prod.js`, before and after 571ba051d6e279212627766f90a856146f14211e:
> 
> ```
> · create computed                                               21,076,617.75  0.0000  0.2428  0.0000  0.0000  0.0001  0.0001  0.0002  ±0.16%  10538309  [1.01x] ⇑
>      create computed                                               20,871,461.37  0.0000  0.0939  0.0000  0.0000  0.0001  0.0001  0.0002  ±0.14%  10435731  (baseline)
>    · write ref, don't read computed (without effect)               21,270,929.83  0.0000  0.2626  0.0000  0.0000  0.0001  0.0001  0.0002  ±0.22%  10635465  [1.00x] ⇓
>      write ref, don't read computed (without effect)               21,352,721.02  0.0000  0.3770  0.0000  0.0000  0.0001  0.0001  0.0001  ±0.28%  10676361  (baseline)
>    · write ref, don't read computed (with effect)                  10,561,843.24  0.0000  0.4995  0.0001  0.0001  0.0001  0.0001  0.0002  ±0.29%   5280922  [1.03x] ⇑
>      write ref, don't read computed (with effect)                  10,295,067.44  0.0000  0.7 …​ *[truncated]*


### @johnsoncodehk — 9 reactions  
`❤️ 9`  ·  [link](https://github.com/vuejs/core/pull/12349#issuecomment-2473731782)

> A GC regression that computed not used in effect/template cannot be released is fixed in [`4114a12` (#12349)](https://github.com/vuejs/core/pull/12349/commits/4114a12f0233f07d81b8867dba424744654803e5) (Thanks for @JoviDeCroock bringing it up!)


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
