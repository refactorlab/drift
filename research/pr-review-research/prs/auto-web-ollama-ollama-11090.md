# ollama/ollama #11090 — New Memory Management

**[View PR on GitHub](https://github.com/ollama/ollama/pull/11090)**

| | |
|---|---|
| **Author** | @jessegross |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mcelrath
> Wait, isn't ollama using llama.cpp as your runner? I mean, #10740 is kind of an egregious estimation fail, but the real work is in llama.cpp...

### @jessegross
> The other major component of memory usage is the compute graph. For newer models that have image processing capabilities and/or require longer context length, this has been an increasingly significant factor.

### @dhiltgen
> Scheduler changes look good to me. A few minor nit/suggestions but optional.

### @digitalextremist
> gpt-oss:20b now fits in 16gb with enough context to do real work, versus before where it was splitting hard, early.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
