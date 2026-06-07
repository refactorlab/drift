# ml-explore/mlx #735 — Fast Inference SDPA op

**[View PR on GitHub](https://github.com/ml-explore/mlx/pull/735)**

| | |
|---|---|
| **Author** | @bpkeene |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @awni
> I do think this op makes sense to put in the `mlx::core::fast` namespace / `mlx.core.fast` subpackage.

### @angeloskath
> the way `mlx::core::fast` is set up you provide an mlx function that will be called when gradients are needed so this can be used in more general situations.

### @awni
> I also suggest removing `fast_inference` from the name, I think it will be self-evident if it's in `mx.fast`.

### @awni
> Before I review the API further, I think it makes sense to change to the fast package / namespace and inherit from the `Custom` primitive.

### @jagrit06
> I'd want to do a deeper dive and another pass over this kernel at some later date - but for now, since it works and looks to be fast, I won't block merging it in!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
