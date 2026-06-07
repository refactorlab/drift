# vllm-project/vllm #12388 — [V1][Core] Support for Structured Outputs

**[View PR on GitHub](https://github.com/vllm-project/vllm/pull/12388)**

| | |
|---|---|
| **Author** | @aarnphm |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @russellb
> Lazily import xgrammar because it initializes cuda as a side effect

### @njhill
> Not for this PR but I wonder if we could avoid sorting every time somehow

### @russellb
> The runner could reply with its batch ordering, so things could be aligned as long as the same batch keeps running?

### @mmoskal
> I love seeing structured decoding being intergrated deeply inside of vLLM! I would love to see llguidance being supported though...significantly faster...has much broader JSON Schema support.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
