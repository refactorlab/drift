# pytorch/pytorch #170486 — [flex_attention] support low precision K/V inputs in compiled GPU mode

**[View PR on GitHub](https://github.com/pytorch/pytorch/pull/170486)**

| | |
|---|---|
| **Author** | @howardzhang-cv |
| **Status** | ✅ merged (reverted, then re-merged) |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> For numerical/precision changes, demand quantitative correctness checks (SQNR), make sure the failure path errors comprehensibly, and document the intended usage pattern so people don't misuse it.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@drisspg:**
> Looks good, can we also add some sanity numeric checks to the test_flex_attention which use SQNR and test against this.

**@drisspg:**
> what happens when someone tries to call bwds, is the error comprehensible?

**@drisspg:**
> people would/should actually use this is to write a score mod that does something like: def score_mod(score, b, h, q, kv): return score * kv_dequant_scale


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
