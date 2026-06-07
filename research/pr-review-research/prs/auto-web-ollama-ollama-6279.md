# ollama/ollama #6279 — feat: Introduce K/V Context Quantisation (vRAM improvements)

**[View PR on GitHub](https://github.com/ollama/ollama/pull/6279)**

| | |
|---|---|
| **Author** | @sammcj |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Nepherpitou
> V cache quantization requires flash_attn

### @Atelepov
> Enable FlashAttention via environment variable OLLAMA_FLASH_ATTENTION

### @sammcj
> I believe I've fixed sussed out the estimation for the scheduler

### @jmorganca
> Excited to begin enabling flash attention and kv cache quantization by default

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
