# hiyouga/LlamaFactory #4224 — Implement efficient packing without cross-contamination attention

**[View PR on GitHub](https://github.com/hiyouga/LlamaFactory/pull/4224)**

| | |
|---|---|
| **Author** | @chuan298 |
| **Status** | ✅ merged |
| **Opened** | 2024-06-11 |
| **Repo importance** | ★71,922 · 8,790 forks · score 112,075 |
| **Diff** | +358 / −39 across 13 files |
| **Engagement** | 23 conversation · 13 inline review comments |

## Top review comments (ranked by reactions)

### @bao-xiaoyi — 4 reactions  
`👍 4`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/4224#issuecomment-2350789759)

> ![image](https://github.com/user-attachments/assets/308ba255-f486-402b-97fa-d8e4a168d994)
> 感觉[functionary](https://github.com/MeetKai/functionary)那边这句话挺值得深思的

### @chuan298 — 2 reactions  
`👍 2`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/4224#issuecomment-2201803705)

> Hi @hiyouga 
> It was my mistake for not testing thoroughly. I just changed efficient_packing to ModelArguments to minimize changes in the code (the old code required passing data_args in every load_model function, which I found quite unreasonable and led to errors in other parts), and I have now thoroughly retested everything.

### @chuan298 — 1 reactions  
`👍 1`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/4224#issuecomment-2180302066)

> > 是否应该考虑使用 varlen_flash_atten 实现?
> 
> Hi @AlongWY , The models in transformers have used flash_attn_varlen_func by default when passing attention_mask. I just made a slight change to the attention_mask when packing sequences and returned indices, cu_seqlens, and max_seqlen_in_batch corresponding to the modified attention_mask.

### @hiyouga — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/4224#issuecomment-2203567797)

> hi @chuan298 
> Thank you for your efforts in integrating efficient packing into llama factory. We will merge this PR in the coming days.

### @bao-xiaoyi — 1 reactions  
`👍 1`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/4224#issuecomment-2350873381)

> https://research.ibm.com/blog/hugging-face-training-flash-attention
> 现在的实现过程应该是有些问题的，大佬们可以参考下这个

### @Leo-T-Zang — 0 reactions  
`—`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/4224#issuecomment-2237510987)

> Thanks for doing this! One quick question: does position id re-initialized for packed examples?


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
