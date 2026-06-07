# rust-lang/rust #124032 — Replace sort implementations

**[View PR on GitHub](https://github.com/rust-lang/rust/pull/124032)**

| | |
|---|---|
| **Author** | @Voultapher |
| **Status** | ✅ merged |
| **Opened** | 2024-04-16 |
| **Diff** | +2,628 / −1,692 across 20 files |
| **Engagement** | 108 conversation comments · 35 inline review comments |

## Why this PR is notable

Replacing the standard library's sort algorithms (the `driftsort`/`ipnsort` work). Reviewers don't take the perf claim on faith — `Voultapher` posts microbenchmarks across multiple machines *on request*, and `Kobzol` connects the change to an adjacent `optimize-for-size` stakeholder.

## 🧠 The lesson for reviewers

> Algorithmic changes are reviewed with **reproducible benchmarks across hardware**, and good reviewers ask 'who else does this touch?' before approving.

## How the author framed it (PR description excerpt)

> This PR replaces the sort implementations with tailor-made ones that strike a balance of run-time, compile-time and binary-size, yielding run-time and compile-time improvements. Regressing binary-size for `slice::sort` while improving it for `slice::sort_unstable`. All while upholding the existing soft and hard safety guarantees, and even extending the soft guarantees, detecting strict weak ordering violations with a high chance and reporting it to users via a panic.
> 
> * `slice::sort` -> driftsort [design document](https://github.com/Voultapher/sort-research-rs/blob/main/writeup/driftsort_introduction/text.md), includes detailed benchmarks and analysis.
> 
> * `slice::sort_unstable` -> ipnsort [design document](https://github.com/Voultapher/sort-research-rs/blob/main/writeup/ipnsort_introduction/text.md), includes detailed benchmarks and analysis.
> 
> #### Why should we change the sort implementations?
> 
> In the [2023 Rust survey](https://blog.rust-lang.org/2024/02/19/2023-Rust-Annual-Survey-2023-results.html#challenges), one of the questions was: "In your opinion, how should work on the following aspects of Rust be prioritized?". The second place was "Runtime performance" and the third one "Compile Times". This PR aims to improve both.
> 
> #### Why is this one big PR and not multiple?
> 
> * The current documentation gives performance recommendations for `slice::sort` and `slice::sort_unstable`. If for example only one of them were to be changed, this advice would be misleading for some Rust versions. By replacing them atomically, the advice remains largely unchanged, and users don't have to change their code.
> * driftsort and ipnsort share a substantial part of their implementations.
> * T …​ *[truncated]*

## Highest-signal comments (ranked by reactions)
> ⚠️ Only the first 100 conversation comments were fetched (API page limit); a later comment could out-rank these.


### @compiler-errors — 8 reactions  
`👍 3 · ❤️ 5`  ·  [link](https://github.com/rust-lang/rust/pull/124032#issuecomment-2171693208)

> > Genuine question, what is the risk and fallout from using the feature in this way right now?
> 
> It's literally just incomplete. We've already reworked the implementation completely before, and we are likely to reimplement it again in a dramatic way (#120639), after which we still need to build certainty that it's sound and correct -- *especially* its intersection with `specialization`.
> 
> > If const_trait is not ready for use in the stdlib, how come it is used in PartialEq and Add, with user facing, albeit unstable const APIs?
> 
> Precisely because they're unstable const APIs. "not ready for prime-time use" is not a binary -- it's going to be based off of the best judgement of the people who are working on this feature, such as @fee1-dead and myself. And it's pretty clear that that judgement is that we should not be adding this additional usage here.
> 
> Sorry! We're working very hard on const traits, and hopefully soon this will change :)


### @Voultapher — 5 reactions  
`❤️ 3 · 🚀 2`  ·  [link](https://github.com/rust-lang/rust/pull/124032#issuecomment-2065185281)

> @Kobzol here are the microbenchmark results you asked for on my Zen 3 machine:
> 
> ```
>  name                                          baseline ns/iter      branch ns/iter        diff ns/iter   diff %  speedup 
>  slice::sort_by_cached_key_lexicographic       1,285,959 (62 MB/s)   1,106,405 (72 MB/s)       -179,554  -13.96%   x 1.16 
>  slice::sort_by_key_lexicographic              7,918,161 (10 MB/s)   8,450,892 (9 MB/s)         532,731    6.73%   x 0.94 
>  slice::sort_large_ascending                   3,580 (22346 MB/s)    3,367 (23760 MB/s)            -213   -5.95%   x 1.06 
>  slice::sort_large_big                         716,164 (1787 MB/s)   1,439,015 (889 MB/s)       722,851  100.93%   x 0.50 
>  slice::sort_large_descending                  4,754 (16827 MB/s)    6,628 (12070 MB/s)           1,874   39.42%   x 0.72 
>  slice::sort_large_expensive                   13,105,320 (6 MB/s)   12,933,701 (6 MB/s)       -171,619   -1.31%   x 1.01 
>  slice::sort_large_mostly_ascending            144,789 (552 MB/s)    128,831 (620 MB/s)         -15,958  -11.02%   x 1.12 
>  slice::sort_large_mostly_descending           150,506 (531 MB/s)    140,820 (568 MB/s)          -9,686   -6.44%   x 1.07 
>  slice::sort_large_random                      257,440 (310 MB/s)    88,850 (900 MB/s)         -168,590  -65.49%   x 2.90 
>  slice::sort_large_strings                     1,031,233 (155 MB/s)  641,908 (249 MB/s)        -389,325  -37.75%   x 1.61 
>  slice::sort_medium_random                     923 (866 MB/s)        481 (1663 MB/s)               -442  -47.89%   x 1.92 
>  slice::sort_small_ascending                   22 (3636 MB/s)        20 (4000 MB/s)                  -2   -9.09%   x 1.10 
>  slice::sort_smal …​ *[truncated]*


### @Kobzol — 5 reactions  
`👍 5`  ·  [link](https://github.com/rust-lang/rust/pull/124032#issuecomment-2115563261)

> CC @diondokter - this might be an interesting use-case for "optimize-for-size" stdlib feature.


### @RalfJung — 3 reactions  
`👍 3`  ·  [link](https://github.com/rust-lang/rust/pull/124032#issuecomment-2171656472)

> We got a pretty clear statement that const_trait is not ready for prime time, and IMO we should honor that. The language just is not ready yet for what you want to do, and you will have to be more patient. But let's not pressure the team into anything.


---
*Data pulled live from the GitHub REST API. Reaction counts are a snapshot at fetch time.*
