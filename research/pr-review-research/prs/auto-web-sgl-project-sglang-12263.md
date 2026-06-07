# sgl-project/sglang #12263 — feat: support EPD disaggregation

**[View PR on GitHub](https://github.com/sgl-project/sglang/pull/12263)**

| | |
|---|---|
| **Author** | @gty111 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ShangmingCai
> So we assume PD Disaggregation is enabled by default in this version? I thought we discussed that it is basically an implementation of Encoder DP, which I think should also work when Encoder is disaggregated while Prefill and Decode are not.

### @ZhengWG
> Have you tested with larger model sizes? I noticed that the embedding data is transmitted via TCP, which could be time-consuming if the embedding data is relatively large.

### @QiuMike
> I see your benchmark, 1p1d uses 2 cards, but 1p1d6E uses 8 cards, but the TTFT only decreased 50ms. Am I right? And how about the QPS improvement at a certain SLO?

### @Copilot AI
> A key problem is the `EmbeddingData` class definition, which isn't shared between the new encoder server and the tokenizer manager, which will cause runtime failures.

### @yhyang201
> This PR contains a relatively large amount of code, so we also ran the Nightly Test... the remaining CI failures are most likely due to CI instability or factors unrelated to this PR.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
