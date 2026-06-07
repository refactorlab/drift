# yewstack/yew #4099 — fix: pair unkeyed children front-to-front during reconciliation

**[View PR on GitHub](https://github.com/yewstack/yew/pull/4099)**

| | |
|---|---|
| **Author** | @Madoshakalaka |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @WorldSEnder
> I don't see the `unkeyed` tests as a public guarantee...keys are the only public guarantee about node identity...This tests a performance modification...It is NOT a semantic guarantee.

### @Madoshakalaka
> For benchmarks that do hit `apply_unkeyed`...old and new lists have identical length...both...produce identical DOM operations...The only added work is three `Vec::reverse` calls...this is maaybe 0.03% of reconciliation time.

### @WorldSEnder
> Down to less than 100 bytes delta for most examples...The additional bytes come from a call to `reverse`, but I don't see a way to avoid it and the perf wins trump the code size delta.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
