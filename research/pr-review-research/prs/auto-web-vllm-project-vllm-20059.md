# vllm-project/vllm #20059 — [Core] Allow full cudagraph with separate attention routines and orthogonal to compilation, add support for FA2 and FlashInfer

**[View PR on GitHub](https://github.com/vllm-project/vllm/pull/20059)**

| | |
|---|---|
| **Author** | @fhl2000 |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @ProExpertProg
> I think we should try to consolidate CUDAGraph logic into a single class. CUDAGraph logic is complex on `main` already, and this PR increases complexity significantly.

### @ProExpertProg
> There are benefits to compilation without splitting the graph (e.g. attention+quant fusion). We should add a new flag that maintains that ability.

### @ProExpertProg
> This is a large PR, so it might help to split it. e.g. FlashInfer cg support can be added in a follow-up.

### @MengqingCao
> the check here is specified to be done after platform-specific check... this make it impossible to enable piecewise graph in vllm-ascend.

### @fhl2000
> The final check is to guarantee that the platform-specific updates don't violate the cudagraph_mode compatibility.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
