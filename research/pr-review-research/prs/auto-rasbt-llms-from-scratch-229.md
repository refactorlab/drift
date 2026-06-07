# rasbt/LLMs-from-scratch #229 — fixed num_workers

**[View PR on GitHub](https://github.com/rasbt/LLMs-from-scratch/pull/229)**

| | |
|---|---|
| **Author** | @d-kleine |
| **Status** | ✅ merged |
| **Opened** | 2024-06-19 |
| **Repo importance** | ★96,688 · 14,787 forks · score 160,796 |
| **Diff** | +20 / −20 across 15 files |
| **Engagement** | 15 conversation · 0 inline review comments |

## Top review comments (ranked by reactions)

### @rasbt — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/229#issuecomment-2178816451)

> Oh thanks, this wasn't supposed to be hardcoded, otherwise it would defeat the purpose of the function argument!

### @d-kleine — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/229#issuecomment-2178859377)

> and here for GPT-2 XL:
> (edit: updated):
> ![grafik](https://github.com/rasbt/LLMs-from-scratch/assets/53251018/8d297c37-dd45-4e9c-8e83-2dc574bd032f)

### @d-kleine — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/229#issuecomment-2178950193)

> Please check ch05/03_bonus_pretraining_on_gutenberg/pretraining_simple.py. It's not technically relevant, but shouldn't the dropout be the same for the small debugging model as for the standard model (`"drop_rate": 0.1`)?
> 
> > (...) so I am not using it during finetuning.
> 
> Ah, I see, thanks! I think it would be good to add this info in the text or at least to the code as a code comment where you do `"drop_rate": 0.0`, adding a comment like
> ```
> BASE_CONFIG = {
>     ...
>     "drop_rate": 0.0, # deactivated as dropout in LLMs is not recommended anymore
>     ...
> ```

### @rasbt — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/229#issuecomment-2179533190)

> > About the PR, is everything fine so far about the changes?
> 
> Yes, this looks awesome, many thanks!

### @rasbt — 1 reactions  
`👍 1`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/229#issuecomment-2180750311)

> Interesting. Yeah, I think that's the same what I originally observed on Linux + GPU (and also macOS on CPU). I hypothesize because the data is pretokenized, loading is quick no matter what. Thanks for looking into it!

### @d-kleine — 0 reactions  
`—`  ·  [link](https://github.com/rasbt/LLMs-from-scratch/pull/229#issuecomment-2178802094)

> Please double check that everything is fine 🙂


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
