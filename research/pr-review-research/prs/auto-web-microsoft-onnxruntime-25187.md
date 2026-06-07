# microsoft/onnxruntime #25187 — KleidiAI SGEMM/IGEMM/Quantized MatMul - Modular MLAS API Changes for KleidiAI

**[View PR on GitHub](https://github.com/microsoft/onnxruntime/pull/25187)**

| | |
|---|---|
| **Author** | @damdoo01-arm |
| **Status** | Merged (July 25, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

> Note: most reviewer feedback on this PR lived in code-review threads that the web page summarized rather than rendered as verbatim prose. The substantive review topics are recorded below; only the author/approver remarks were captured verbatim.

### @edgchen1 (review thread — Dynamic Quantize MatMul)
Flagged that in the DynamicQuantizeMatMul KleidiAI-specific prepacking logic, the case where the B zero-point input is provided but is not constant must be handled.

### @edgchen1 (review thread — QGEMM implementation)
Raised concerns about proper handling of quantization parameters in the QGEMM call implementations across the different code paths.

### @edgchen1 (review thread — SGEMM architecture)
Questioned the dispatch-logic structure and whether the SME2 availability checks were positioned optimally within the kernel-selection framework.

### @edgchen1 (review thread — API design)
Raised questions about whether the new MLAS interface overrides for `MlasGemmBatch` and `MlasGemmPackB` align with long-term extensibility goals.

### @damdoo01-arm (author response, verbatim)
> We will include all feedback in subsequent PR

### @hariharans29 (approver)
Approved the changes after final pipeline verification, enabling merge into main.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
