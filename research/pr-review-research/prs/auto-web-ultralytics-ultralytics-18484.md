# ultralytics/ultralytics #18484 — NMS Export for Detect, Segment, Pose and OBB YOLO models

**[View PR on GitHub](https://github.com/ultralytics/ultralytics/pull/18484)**

| | |
|---|---|
| **Author** | @Y-T-G |
| **Status** | Merged (January 24, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Y-T-G
> This is heuristics because if the user passes a different `max_det` during prediction, then the above check wouldn't work and it will apply NMS again.

### @Laughing-q
> I guess this PR is still WIP right? I tried... but encountered this error: RuntimeError: Error in execution...

### @Y-T-G
> Can't get it to work correctly with OBB, so I removed it. The output is correct when running `NMSModel` manually, but doesn't after export inference.

### @Drise13
> We should make sure this is documented because from a YOLO perspective, this is 'non-standard' format as far as I know.

### @glenn-jocher
> We've identified a known issue with TFLite int8 models in certain environments and are investigating.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
