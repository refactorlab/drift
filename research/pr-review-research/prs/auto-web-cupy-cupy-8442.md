# cupy/cupy #8442 — Support system allocated memory

**[View PR on GitHub](https://github.com/cupy/cupy/pull/8442)**

| | |
|---|---|
| **Author** | @rongou |
| **Status** | Merged (Oct 29, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kmaehashi
> Q: Are there any lightweight perf regression tests that we can run to confirm we don't add overhead due to this change when UMP is not in use

### @emcastillo
> I will run the performance tests tomorrow to check if we have regressions! lets wait until its done for merging 😇

### @jakirkham
> From upstream NumPy (numpy/numpy#27630), in the future these section could be dropped

### @leofang
> CuPy does not include NumPy as a build-time dependency at all and it's a big move for such a niche use case. Furthermore, this PR is ready for a quick final pass/merge, and I would hate to further delay the progress here

### @emcastillo
> we are being pinged a lot about this, so it would be great if we can merge it in the current state and work on optimizations in a follow up PR

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
