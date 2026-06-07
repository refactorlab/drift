# apache/tvm #18871 — Batched GPU dispatch and object caching for WebGPU runtime

**[View PR on GitHub](https://github.com/apache/tvm/pull/18871)**

| | |
|---|---|
| **Author** | @mitiskuma |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @tqchen
> Given GPU is async, i think it is relatively ok and desirable to keep runtime simple and not containing too smart of a caching in this case.

### @tqchen
> Do we know if we only do lazy but not caching would have similar impact?

### @mitiskuma
> We recover some of the loss (~60-70%) by pooling uniform buffers per dispatch index and reusing them across flushes. But createBindGroup() per dispatch is still expensive.

### @tqchen
> I think starting with a uniform pool + lazy seems to be a good first step as that strictly improves over what we had.

### @mitiskuma
> Qwen3 0.6B | base: 50t/s vs improved: 150t/s | Qwen3 4B | base: 34t/s vs improved: 69t/s

### @tqchen
> pls fix lint, we can aim to land it, would be good to cross check e2e perf and correctness of this PR

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
