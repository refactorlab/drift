# onnx/onnx #7030 — Add FLOAT8E8M0 data type

**[View PR on GitHub](https://github.com/onnx/onnx/pull/7030)**

| | |
|---|---|
| **Author** | @yuanyao-nv |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @justinchuby
> Out of curiosity: what are the benefits of each rounding mode? Was it different because of the lack of spec, or due to platform characteristics/ performance considerations?

### @justinchuby
> Given the difference in native behavior, a given backend is unlikely to implement all rounding modes, I assume. Wondering if this has an implication to model portability

### @yuanyao-nv
> CUDA has done extensive experiments to show that roundup gives the best accuracy and has standardized it in the CUDA spec, so essentially roundup should be the only mode that matters for MX applications.

### @justinchuby
> The reference evaluator is likely going to be implemented by ml_dtypes (proposed). Is there a way to simulate the rounding mode in an efficient manner?

### @justinchuby
> Could you update https://github.com/onnx/ir-py/blob/main/src/onnx_ir/_enums.py and the tensor representations...as well, after consensus is reached?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
