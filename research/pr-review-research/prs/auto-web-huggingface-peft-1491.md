# huggingface/peft #1491 — Integrate X-LoRA

**[View PR on GitHub](https://github.com/huggingface/peft/pull/1491)**

| | |
|---|---|
| **Author** | @EricLBuehler |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @BenjaminBossan
> I really want to avoid this, as this looks like a mixing of concerns. Surely, we can figure out a better way. Could you explain why this was needed?

### @BenjaminBossan
> I'm not so happy with this addition to the LoraLayers. It makes reading and understanding them more complex and requires all LoRA layers to be updated

### @BenjaminBossan
> Let's start adding unit tests. Let's start simple and add a new file tests/test_xlora.py with a functional test based on the example you posted earlier.

### @BenjaminBossan
> I think I found a way to allow us to remove all these changes to lora/model.py...This is the more elegant solution, because it should not be necessary for LoraModel to know about XLoRA.

### @BenjaminBossan
> X-LoRA only really works with transformers language models, right? Can we document this more clearly? Also, do you think it would be possible to make this work with other types of models?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
