# ollama/ollama #16031 — runner: Remove CGO engines, use llama-server exclusively for GGML models

**[View PR on GitHub](https://github.com/ollama/ollama/pull/16031)**

| | |
|---|---|
| **Author** | @dhiltgen |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @sharki13
> v24: 780 [tokens/sec], v30: 242 - regardless of OLLAMA_LLM_LIBRARY flag

### @sammyvoncheese
> Reports Gemma4 31b model offloading layers to CPU when context exceeds 133k tokens on RTX 5090, whereas contexts under that threshold remain fully GPU-resident.

### @rick-github
> embedding models get reloaded for every request

### @maurizioaiello
> Radeon 8060S initially dropped during GPU discovery; resolution required removing OLLAMA_LLM_LIBRARY environment variable setting.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
