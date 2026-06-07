# NVIDIA/Megatron-LM #3029 — Move tensor offload/onload out of RL code

**[View PR on GitHub](https://github.com/NVIDIA/Megatron-LM/pull/3029)**

| | |
|---|---|
| **Author** | @tdene |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mathemakitten
> You mean `initialize_all_tensors` now right?

### @kvareddy
> I guess the condition here should also include self.unified_memory_level == 0

*(Author @tdene responded explaining that prior reviewers had decided UVM should be treated as a memory pool rather than offload, making it incompatible with explicit offload mode.)*

### @kvareddy
> When we resume under recomputation, how do we guarantee initialized values for all tensors?

*(Author @tdene explained the mechanism: context.reset() runs after deallocate operations, and torch_memory_saver preserves memory pointers while avoiding data backup in recompute mode.)*

### @mathemakitten
> minor nits but LGTM

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
