# ultralytics/ultralytics #10165 — new TensorRT INT8 export feature

**[View PR on GitHub](https://github.com/ultralytics/ultralytics/pull/10165)**

| | |
|---|---|
| **Author** | @Burhan-Q |
| **Status** | Merged (May 8, 2024) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @nazmi
> Export failed when dynamic flag is not set as ONNX intermediate does not get exported with dynamic. *(demonstrated that INT8 exports require `dynamic=True` and provided a patch fixing the calibration cache return statement)*

### @glenn-jocher
> I'd love to run this full matrix daily, but our current hardware availability is just not there for support yet...I think for now let's cut this back to the bare minimum, i.e. just 1 export.

### @glenn-jocher
> When performing INT8 calibration, setting the dynamic flag is essential to ensure that TensorRT can handle various input sizes effectively.

### @ambitious-octopus
> Except for a couple of extra back ticks, docs and examples looks good!

### @Burhan-Q
> I'll have to try your suggestion to see if that helps, but I had intended that if int8=True that it would also enforce dynamic=True.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
