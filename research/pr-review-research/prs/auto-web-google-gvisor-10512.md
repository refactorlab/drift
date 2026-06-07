# google/gvisor #10512 — Add vllm benchmark

**[View PR on GitHub](https://github.com/google/gvisor/pull/10512)**

| | |
|---|---|
| **Author** | @derpsteb |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @EtiennePerot
> All the benchmarks are structured to have everything bundled in the image, so there's no need for internet connectivity at runtime...opt-125m seems tiny, it's definitely at the scale where this isn't a concern and you can just bundle it in the image.

### @EtiennePerot
> I think it would also be valuable to benchmark a larger model too...larger models have much lower overhead relative to unsandboxed performance, presumably because a larger fraction of time is spent waiting for the GPU.

### @EtiennePerot
> If you care about model loading performance, consider it...how the model files are available to the model server has an impact on model loading performance.

### @EtiennePerot
> You probably don't need to care that much about metricsviz, it's not going to be useful or reliable for a large benchmark like this. You can still plumb it though.

### @EtiennePerot
> The newly-added image is too large for [BuildKite presubmits]...Can you add the image name (`gpu/vllm`) to [`NON_TEST_IMAGES`]?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
