# microsoft/onnxruntime #26834 — [MLAS] Add an NHWC implementation of convolution to avoid transposes

**[View PR on GitHub](https://github.com/microsoft/onnxruntime/pull/26834)**

| | |
|---|---|
| **Author** | @orlmon01 |
| **Status** | Merged (May 14, 2026) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Rohanjames1997
> I imagine that avoiding transposes also improves performance. Do you have any performance results to share?

### @orlmon01
> Feedback appreciated as this PR makes quite a lot of changes to the codebase well outside of the normal KleidiAI scope.

### @orlmon01
> Even with the limited range of convolutions it's implemented for there should still be a performance increase in most cases.

### @orlmon01 (scoping)
Noted the implementation was deliberately scoped with "compiler guards so it is only used with KleidiAI (for now, can be removed if needed)," and shared benchmark data on a MobileNet model: inference latency decreasing from 6.66ms to 5.64ms average, with throughput increasing from 150 to 177 inferences per second.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
