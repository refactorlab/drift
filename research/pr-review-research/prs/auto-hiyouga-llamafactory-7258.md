# hiyouga/LlamaFactory #7258 — [model] Support InternVL2.5-3 Series

**[View PR on GitHub](https://github.com/hiyouga/LlamaFactory/pull/7258)**

| | |
|---|---|
| **Author** | @Kuangdd01 |
| **Status** | ✅ merged |
| **Opened** | 2025-03-11 |
| **Repo importance** | ★71,922 · 8,790 forks · score 112,075 |
| **Diff** | +247 / −2 across 8 files |
| **Engagement** | 45 conversation · 9 inline review comments |

## Top review comments (ranked by reactions)

### @o0t1ng0o — 8 reactions  
`👍 3 · 👀 5`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7258#issuecomment-2817765520)

> > fine-tuning InternVL3-1B-hf transformers 4.52.0.dev0
> > 
> > ValueError: Processor was not found, please check and update your processor config.
> 
> I also meet the same question about inference on InternVL3-8B when using the latest llama-factory. I think the issue has not been addressed.
> @hiyouga 
> Error:
> ValueError: Processor was not found, please check and update your processor config.

### @haonan3 — 3 reactions  
`👍 3`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7258#issuecomment-2820603442)

> I think the **latest** version means git clone the transformers and build from the source code. The transformers-4.51.3 doesn't work. And the build-from-source version can work well with OpenGVLab/InternVL3-8B-hf and OpenGVLab/InternVL2_5-8B-MPO-hf (but kingsley01/InternVL2_5-1B-MPO-hf not ❌). @NotACracker

### @murray-z — 2 reactions  
`👀 2`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7258#issuecomment-2814838498)

> fine-tuning InternVL3-1B-hf
> transformers                  4.52.0.dev0
> 
> ValueError: Processor was not found, please check and update your processor config.

### @Kuangdd01 — 2 reactions  
`👍 2`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7258#issuecomment-2820605447)

> > > Hey guys, now we should update the transformers to the latest version and use the official `OpenGVLab` model cards with `-hf` suffix. For those sizes that are not converted now, please refer to this file `/transformers/src/transformers/models/internvl/convert_internvl_weights_to_hf.py` to convert original checkpoints to the HF version. Thanks to @yonigozlan!
> > 
> > the latest version of transformers refer to 4.51.3 or git+https://github.com/Kuangdd01/transformers.git@hf-internvl? I tried 4.51.3, but still didn't work. @haonan3 's solution is work for me.
> 
> :) We should use the latest code of transformers instead of the latest release.
> ```
> pip install git+https://github.com/huggingface/transformers.git@main
> ```

### @Kuangdd01 — 1 reactions  
`👍 1`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7258#issuecomment-2758292829)

> > I know, we need to use yonigozlan/InternVL2_5-1B-MPO-hf instead of the original OpenGVLab/InternVL2_5-1B-MPO! ————————————edit Good job! But I followed this and found something wrong with the tokenizer. <img alt="image" width="1090" src="https://private-user-images.githubusercontent.com/75027733/427584178-10558318-c2f9-465c-a472-70c96702e46e.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NDMwODYxNjksIm5iZiI6MTc0MzA4NTg2OSwicGF0aCI6Ii83NTAyNzczMy80Mjc1ODQxNzgtMTA1NTgzMTgtYzJmOS00NjVjLWE0NzItNzBjOTY3MDJlNDZlLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTAzMjclMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwMzI3VDE0MzEwOVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTE4NjE3NWY1NjIxMWRmM2RhYjE5NjFlZjk3MDZlMjRjMGEzYThkZjYzZmE4NGQzNTRhZmI4ZDE1M2JhNWRmNjYmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.eY9srq6Gg31lYUtCAGKLQ5oUreBVsgKJc25uxr2Kh7U"> I use yaml as this: <img alt="image" width="483" src="https://private-user-images.githubusercontent.com/75027733/427584793-76b2b529-6c41-4070-a4fe-9cd48f3e4fcf.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NDMwODYxNjksIm5iZiI6MTc0MzA4NTg2OSwicGF0aCI6Ii83NTAyNzczMy80Mjc1ODQ3OTMtNzZiMmI1MjktNmM0MS00MDcwLWE0ZmUtOWNkNDhmM2U0ZmNmLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTAzMjclMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdW … *[truncated]*

### @Kuangdd01 — 1 reactions  
`👍 1`  ·  [link](https://github.com/hiyouga/LlamaFactory/pull/7258#issuecomment-2808271849)

> Yes! Wait for a moment. I am going to reproduce it.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
