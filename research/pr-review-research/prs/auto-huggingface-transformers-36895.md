# huggingface/transformers #36895 — Add RF-DETR

**[View PR on GitHub](https://github.com/huggingface/transformers/pull/36895)**

| | |
|---|---|
| **Author** | @sbucaille |
| **Status** | ✅ merged |
| **Opened** | 2025-03-21 |
| **Repo** | curated review-culture seed |
| **Diff** | +5356 / −26 across 21 files |
| **Engagement** | 43 conversation · 350 inline review comments |

## Top review comments (ranked by reactions)

### @sbucaille — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/huggingface/transformers/pull/36895#issuecomment-2748897474)

> You are right, but it is not the only example. I'll stick to my original plan until I have something running with actual results and I'll take care of refactoring this part later, I'll ping you when it's ready.

### @Cyrilvallez — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/huggingface/transformers/pull/36895#issuecomment-2835509078)

> Hey @sbucaille @konstantinos-p! It will be solved by https://github.com/huggingface/transformers/pull/37829 🤗 I will merge asap! Sorry for the wait on this!
> 
> EDIT: Just merged the PR!

### @vasqu — 2 reactions  
`❤️ 2`  ·  [link](https://github.com/huggingface/transformers/pull/36895#issuecomment-4136265758)

> Checking now! Sorry for the delays, a lot of model sprints lately @sbucaille @yonigozlan

### @sbucaille — 2 reactions  
`👍 1 · 😄 1`  ·  [link](https://github.com/huggingface/transformers/pull/36895#issuecomment-4159756035)

> @vasqu I've answered most of your comments.
> Regarding the conversion mappings, I'm having hard time finding the correct mappings. On one hand `RfDetrModelTest::test_reverse_loading_mapping` pass but my checkpoints in integration tests end up with many unexpected and missing values. And if I change it so that they don't appear anymore, then `RfDetrModelTest::test_reverse_loading_mapping` do not pass.
> I'll try later with some sleep
> 
> Also, certain tests seem to not pass when I use a cuda device, specifically all the disk or cpu offloading where it tries to access `hf_device_map` which do not exist in `RfDetrModel` 🤔

### @sbucaille — 2 reactions  
`👍 1 · ❤️ 1`  ·  [link](https://github.com/huggingface/transformers/pull/36895#issuecomment-4211372424)

> Alright I addressed the remaining comments, I still need to take care of the conversion mapping but I'm falling short in time these days to put some focus on that I'll try this weekend !

### @qubvel — 1 reactions  
`👍 1`  ·  [link](https://github.com/huggingface/transformers/pull/36895#issuecomment-2750799652)

> Hey, let's use RfDert name + modular, it's ok! RfDetr is a correct naming format while RTDetr is an exception made before modular was introduced


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
