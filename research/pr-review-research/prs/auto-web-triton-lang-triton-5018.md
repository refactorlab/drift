# triton-lang/triton #5018 — [AMD] Add a block ping-poing scheduling pass

**[View PR on GitHub](https://github.com/triton-lang/triton/pull/5018)**

| | |
|---|---|
| **Author** | @jungpark-mlir |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @antiagainst
> First batch of comments on the op and its lowering

### @antiagainst
> Thanks for adding docs and comments; looks nice now! Just some final comments, mostly around tests.

### @karthik-man
> Thanks for this work! I am seeing a 10% speedup with this on a compute-bound fbgemm fp8 shape...Do you plan to support selection of this pass without an env var?

### @karthik-man
> Some noob questions: What is the difference between the gpu::BarrierOp...and the ROCDL::SBarrierOp...?

### @sjw36
> A few things to cleanup.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
