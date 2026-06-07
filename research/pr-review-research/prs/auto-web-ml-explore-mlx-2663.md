# ml-explore/mlx #2663 — Add Masked Scatter

**[View PR on GitHub](https://github.com/ml-explore/mlx/pull/2663)**

| | |
|---|---|
| **Author** | @CC-Yeh |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @awni
> You can't call other ops inside the `eval_gpu` (or `eval_cpu`) because that's just building a graph but you want to actually run the graph in the eval.

### @awni
> Basically all of the error checking here (and any that you do in `eval_cpu`) should be done in the operation and not in the primitive.

### @awni
> What about doing this with `a[mask] = x` instead of making it a function?

### @angeloskath
> Boolean indices in numpy do not really broadcast and omitted dimensions are taken whole...we should implement the API at least.

### @angeloskath
> The `MaskedScatter` primitive is batched. The 0-th dim is the batch. The `masked_scatter` op is not batched. So in the primitive we can't use the op but we have to use the primitive.

### @awni
> I think we only want to store `mask_flat` as a temporary if there was a copy done.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
