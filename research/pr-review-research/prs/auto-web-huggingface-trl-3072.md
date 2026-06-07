# huggingface/trl #3072 — 👁️ [GRPO] Add VLM training capabilities to the trainer

**[View PR on GitHub](https://github.com/huggingface/trl/pull/3072)**

| | |
|---|---|
| **Author** | @CompN3rd |
| **Status** | Merged (July 23, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nph4rd
> The processor class is mutating the input...vLLM complains because it's receiving the modified prompts_text.

### @nph4rd
> The DPO trainer already supports VLMs but expects the column to be called 'images', as a list of PIL images...I think this should be 'images' too, for consistency.

### @MohamedAliRashad
> Qwen (unlike other models) doesn't give a fixed number of tokens for images of different shapes...you may consider removing it and send the pil images as it is.

### @ghubnerr
> This removes the control of where the user wants to insert the <start_of_image> tag...With the AutoProcessor, one can actually return tensors using the apply_chat_template method, which lets you control the image placement better.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
