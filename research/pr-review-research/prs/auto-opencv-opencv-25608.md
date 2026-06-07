# opencv/opencv #25608 — Animated WebP and AVIF Support

**[View PR on GitHub](https://github.com/opencv/opencv/pull/25608)**

| | |
|---|---|
| **Author** | @sturkmen72 |
| **Status** | ✅ merged |
| **Opened** | 2024-05-19 |
| **Repo importance** | ★87,790 · 56,575 forks · score 319,089 |
| **Diff** | +1002 / −119 across 15 files |
| **Engagement** | 16 conversation · 75 inline review comments |

## Top review comments (ranked by reactions)

### @mshabunin — 2 reactions  
`👀 2`  ·  [link](https://github.com/opencv/opencv/pull/25608#issuecomment-2407482586)

> We needs some way to limit memory usage, something similar to `OPENCV_IO_MAX_IMAGE_PIXELS` [environment variable](https://docs.opencv.org/4.x/d6/dea/tutorial_env_reference.html#autotoc_md990), but for animation. Otherwise it would be possible to exhaust memory by reading large animation, because with current interface it would be stored in the memory at once.
> 
> I've been able to consume >20 GB by reading 19 MiB webp video containing 5000 solid color frames (FHD).

### @asmorkalov — 2 reactions  
`👍 2`  ·  [link](https://github.com/opencv/opencv/pull/25608#issuecomment-2538496461)

> @sturkmen72 Thanks a lot for the great job! I'll contribute to you branch with review fixes by myself and then merge.

### @sturkmen72 — 2 reactions  
`👍 2`  ·  [link](https://github.com/opencv/opencv/pull/25608#issuecomment-2538528850)

> @asmorkalov thank you for your review. i believe after merging this PR we can correct some issues. frankly timestamp is for now one variable (it is not incremental) and maybe need some discussion to be more revelant for all animated formats. it is not working with avif files well when converting a webp to avif. and i will do needed changes for gif animations

### @sturkmen72 — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/25608#issuecomment-2404961695)

> @asmorkalov imho https://github.com/opencv/opencv/pull/26211 should be merged before this patch. i should change (remove) imencode part in this PR

### @mshabunin — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/25608#issuecomment-2413366408)

> I believe limiting just the number of frames is not enough (1)  and is not convenient for end-users (2).
> 
> 1. Single frame can be rather big - 16k*16k pixels and even small number of such frames can consume all memory
> 2. As a user I don't want to calculate how much memory some animation might take - 10 very large frames or 1000 smaller ones - I just want to load it and be safe in case of malicious input.
> 
> So I propose to use both frame count in the interface and an environment variable limiting total memory consumption.

### @asmorkalov — 1 reactions  
`👍 1`  ·  [link](https://github.com/opencv/opencv/pull/25608#issuecomment-2553187794)

> @vrabaud I want to merge the PR. Could you take a look on it?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
