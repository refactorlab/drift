# sgl-project/sglang #4848 — Support server based rollout in Verlengine

**[View PR on GitHub](https://github.com/sgl-project/sglang/pull/4848)**

| | |
|---|---|
| **Author** | @yitianlian |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @yangky11
> I'm trying out this PR but got the error below: [AuthenticationError: digest sent was rejected]

### @yitianlian
> You can take a closer look at the `update_weights_from_tensor` method in both the `VerlEngine` and the `HttpServerEngineAdapter`. When using `named_tensors`, the correct flow is to first call the method in VerlEngine, which internally handles preprocessing...

### @yitianlian
> Most naive implementation, can optimize a lot if it is bottleneck

### @zhaochenyang20
> Great work Chengxing, I will review all the design docs, dev logs and codes carefully.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
