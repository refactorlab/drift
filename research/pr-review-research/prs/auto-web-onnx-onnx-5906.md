# onnx/onnx #5906 — Support register custom OpSchema by python

**[View PR on GitHub](https://github.com/onnx/onnx/pull/5906)**

| | |
|---|---|
| **Author** | @OYCN |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @xadupre
> Why `reg_schema` and not `register_schema` which seems easier to understand? Should we check that `has_schema` returns True as well? Should we add a method to unregister a schema?

### @justinchuby
> Could you follow https://github.com/onnx/onnx/blob/main/CONTRIBUTING.md#coding-style to fix lint errors reported in https://github.com/onnx/onnx/actions/runs/7783887025/job/21232428145?pr=5906?

### @justinchuby
> I think it would be beneficial to include this which will allow us to do further validation on models. If anything comes up we can always revert.

### @gramalingam
> can you please take a look at the merge conflicts? We can try to merge this PR in this week, ahead of the next release cutoff.

### @gramalingam
> Merge conflicts to be resolved, LGTM otherwise.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
