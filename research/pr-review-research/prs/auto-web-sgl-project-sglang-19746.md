# sgl-project/sglang #19746 — [P/D disagg] - support decode side radix cache

**[View PR on GitHub](https://github.com/sgl-project/sglang/pull/19746)**

| | |
|---|---|
| **Author** | @ishandhanani |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @llc-kc
> Have you tested low-concurrency scenarios (e.g., 30 concurrent requests)? Tests under low concurrency can fairly reflect the performance improvements brought by Delta KV Cache transmission.

### @ovidiusm
> This looks like a rebase issue, it reverted a fix for the hang when TP P>D. I will fix it in #23967

### @dongyibo
> For multiple decode workers, such as when decode is run with DP, it's best if the same DP rank is used for the entire conversation; otherwise, the cached KV cache cannot be utilized?

### @ShangmingCai
> I think it is good to merge.

### @ByronHsu
> LGTM. Excited to try this feature for long context PD!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
