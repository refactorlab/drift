# prometheus/prometheus #17671 — tsdb(wal): st-per-sample initial code and benchmarks

**[View PR on GitHub](https://github.com/prometheus/prometheus/pull/17671)**

| | |
|---|---|
| **Author** | @ywwg |
| **Status** | ✅ merged |
| **Opened** | 2025-12-10 |
| **Repo** | curated review-culture seed |
| **Diff** | +3402 / −2680 across 20 files |
| **Engagement** | 92 conversation · 92 inline review comments |

## Top review comments (ranked by reactions)

### @krajorama — 1 reactions  
`👍 1`  ·  [link](https://github.com/prometheus/prometheus/pull/17671#issuecomment-3754350976)

> > oh maybe that's because refs are stored as diff from prev ref instead of first ref. In the benchmark, refs increment by one. What do refs look like in practice? enumerated? or random?
> 
> In practice when there's an empty TSDB and you do the first scrape, the series ref is assigned incrementally as series are read from the scrape.  The order of series won't change between scrapes, but some series may disappear and new ones may appear due to dynamic labels. So you'll get some randomness over time. I think it makes sense to use previous ref, cause a lot of time the numbers will be incremental.

### @bwplotka — 1 reactions  
`👍 1`  ·  [link](https://github.com/prometheus/prometheus/pull/17671#issuecomment-3883003142)

> Yea, can you rebase and add only your commits in this PR?
> 
> <img width="779" height="381" alt="image" src="https://github.com/user-attachments/assets/fb84ac72-4376-41b9-bbb4-2b4356e67ce2" />

### @ywwg — 0 reactions  
`—`  ·  [link](https://github.com/prometheus/prometheus/pull/17671#issuecomment-3711314623)

> oh nevermind, the dashboard defaults to showing a valid prombench, in this case 17716.

### @ywwg — 0 reactions  
`—`  ·  [link](https://github.com/prometheus/prometheus/pull/17671#issuecomment-3716176306)

> Changes to the serialization of samples:
> * store timestamps as a delta to the previous sample, not the first sample.  Most samples will be the same distance apart so the deltas will be easily compressible.
> * record start timestamps with a leading byte and then an optional int64: The leading byte can be 0 (no ST), 1 (same as prev timestamp), 2 (same as previous ST), or 3 (delta to last ST).
> 
> As long as my assumptions about what these slices of SampleRefs usually look like, this should be an improvement across the board:
> 
> "v0" here is a naive encoding of ST with every record similar to how T is recorded, as a delta with the first sample.
> 
> ```
> goos: linux
> goarch: amd64
> pkg: github.com/prometheus/prometheus/tsdb/record
> cpu: Intel(R) Core(TM) Ultra 7 155U
>                                                 │ encode-v0.txt │            encode-v1.txt            │
>                                                 │    sec/op     │    sec/op     vs base               │
> Encode_Samples/compr=none/data=real1000-2         10.930µ ± 11%   8.396µ ±  9%  -23.18% (p=0.002 n=6)
> Encode_Samples/compr=none/data=real1000-dst-2     10.500µ ±  2%   8.249µ ±  5%  -21.44% (p=0.002 n=6)
> Encode_Samples/compr=none/data=real1000-cst-2      9.845µ ±  2%   8.150µ ±  7%  -17.22% (p=0.002 n=6)
> Encode_Samples/compr=none/data=worst1000-2         11.14µ ±  6%   11.88µ ±  8%   +6.55% (p=0.026 n=6)
> Encode_Samples/compr=none/data=worst1000-st-2      13.39µ ±  8%   17.88µ ±  7%  +33.53% (p=0.002 n=6)
> Encode_Samples/compr=snappy/data=real1000-2       22.558µ ±  3%   8.683µ ±  7%  -61.51% (p=0.002 n=6)
> Encode_Samples/comp … *[truncated]*

### @ywwg — 0 reactions  
`—`  ·  [link](https://github.com/prometheus/prometheus/pull/17671#issuecomment-3716214346)

> some of these numbers are a little suspicious (98%?) so I will keep checking

### @ywwg — 0 reactions  
`—`  ·  [link](https://github.com/prometheus/prometheus/pull/17671#issuecomment-3719814903)

> In very promising news, I had to make some tests bigger because the new written WAL size is so much smaller


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
