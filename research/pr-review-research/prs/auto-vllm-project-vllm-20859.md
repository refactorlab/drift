# vllm-project/vllm #20859 — [Feature] limit thinking tokens (hard limit)

**[View PR on GitHub](https://github.com/vllm-project/vllm/pull/20859)**

| | |
|---|---|
| **Author** | @llsj14 |
| **Status** | ✅ merged |
| **Opened** | 2025-07-12 |
| **Repo importance** | ★81,996 · 17,677 forks · score 157,703 |
| **Diff** | +702 / −12 across 13 files |
| **Engagement** | 88 conversation · 153 inline review comments |

## Top review comments (ranked by reactions)

### @Flecart — 5 reactions  
`👍 5`  ·  [link](https://github.com/vllm-project/vllm/pull/20859#issuecomment-3476934994)

> Just wanna say thank you for your work @llsj14, this feature is much needed :).

### @AetherPrior — 4 reactions  
`👍 4`  ·  [link](https://github.com/vllm-project/vllm/pull/20859#issuecomment-3608273666)

> Hi all, 
> Do we know when this PR could be merged? This is a super useful feature and the CI check has been pending for a month.

### @llsj14 — 4 reactions  
`👍 2 · 🎉 2`  ·  [link](https://github.com/vllm-project/vllm/pull/20859#issuecomment-4122571655)

> @njhill @chaunceyjiang @aarnphm @hmellor @NickLucche
> Thanks so much for your thoughtful and thorough reviews,
> and thank you for your support @rishitdholakia13

### @rishitdholakia13 — 2 reactions  
`👍 1 · 👀 1`  ·  [link](https://github.com/vllm-project/vllm/pull/20859#issuecomment-3470166266)

> Nice work on the PR ! There was a one question, of a case that needs to be handled. 
> Say a request errors out (due to some network or serving issue) while it was thinking mid-way. Now if the request is retried midway how do we ensure that the thinking is done for the remaining budget and that (the retried request would have the initial input prompt + the partial thinking output). So this way we would need to start the counting of thinking budget right from the right output token for the retried request.

### @dchichkov — 2 reactions  
`🚀 2`  ·  [link](https://github.com/vllm-project/vllm/pull/20859#issuecomment-3633978148)

> It is 1181 commits behind main, I've tried pulling it and applying as a patch, there are conflicts in every file.

### @CennyMo — 2 reactions  
`👍 2`  ·  [link](https://github.com/vllm-project/vllm/pull/20859#issuecomment-3707588276)

> It's a useful feature , could we know when can it be merged?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
