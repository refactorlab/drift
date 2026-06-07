# tensorflow/tensorflow #84975 — build(aarch64): Update to oneDNN-3.7 + ACL-24.12

**[View PR on GitHub](https://github.com/tensorflow/tensorflow/pull/84975)**

| | |
|---|---|
| **Author** | @Sqvid |
| **Status** | ✅ merged |
| **Opened** | 2025-01-15 |
| **Repo importance** | ★195,540 · 75,352 forks · score 501,948 |
| **Diff** | +441 / −2337 across 36 files |
| **Engagement** | 36 conversation · 15 inline review comments |

## Top review comments (ranked by reactions)

### @Sqvid — 1 reactions  
`👍 1`  ·  [link](https://github.com/tensorflow/tensorflow/pull/84975#issuecomment-2595667541)

> @keerthanakadiri Thanks for the reminder. Yes I have got in touch with my company's CLA Point of Contact, and will hopefully be registered shortly.

### @Sqvid — 1 reactions  
`👍 1`  ·  [link](https://github.com/tensorflow/tensorflow/pull/84975#issuecomment-2604382350)

> @keerthanakadiri The CLA is now signed. Thank you for your patience.

### @Sqvid — 1 reactions  
`👍 1`  ·  [link](https://github.com/tensorflow/tensorflow/pull/84975#issuecomment-2706567206)

> @keerthanakadiri @penpornk During some end-to-end testing of tensorflow against the latest versions it seems there is some unexpected behaviour on some BF16 models. I'd advise **against** merging this just now. I will update the PR once we know more. Thank you.
> 
> I am also happy to convert this into a draft for now if that helps

### @penpornk — 1 reactions  
`👍 1`  ·  [link](https://github.com/tensorflow/tensorflow/pull/84975#issuecomment-2706570326)

> @Sqvid Converting to draft sounds good. Thank you very much!

### @Sqvid — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/84975#issuecomment-2593501719)

> @snadampal Almost all the patches could be removed because they have been upstreamed. One exception amongst the removed patches is [this change to enable blocked sbgemm formats in oneDNN](https://github.com/oneapi-src/oneDNN/pull/2068) and the [corresponding changes in ACL](https://review.mlplatform.org/c/ml/ComputeLibrary/+/13341). Could you let me know if these are still needed and whether they can be rebased? The old patchfiles are not compatible with the current source. Thanks.

### @keerthanakadiri — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/84975#issuecomment-2594436210)

> Hi @Sqvid, Can you please sign CLA , thank you !!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
