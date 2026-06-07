# google/flax #4948 — Add compute_flops and compute_vjp_flops options to `nnx.tabulate`

**[View PR on GitHub](https://github.com/google/flax/pull/4948)**

| | |
|---|---|
| **Author** | @samanklesaria |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @vfdev-5
> I compared linen vs nnx tabulate on an example running on CPU, vjp flops do not exactly match. Can you check if it is due to our code.

### @samanklesaria
> The way linen calculates vjp flops is the following... These two are pretty close, but aren't doing exactly the same thing. The nnx flop calculation will include the `merge` of the graphdef and state after the `jax.vjp` boundary.

### @vfdev-5
> linen vjp flops number is larger than nnx vjp flops... expected vjp flops can be computed as... and it gives what nnx shows, so, ok to me.

### @samanklesaria
> When I tried to support shared graph structure... calling `nnx_vjp(j, ...)` _does_ result in `f` being re-traced. This is annoying because it results in duplicate rows being added to the tabulation table.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
