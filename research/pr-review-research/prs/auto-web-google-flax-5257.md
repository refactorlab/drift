# google/flax #5257 — Add intermediate value captures (extends #4925)

**[View PR on GitHub](https://github.com/google/flax/pull/5257)**

| | |
|---|---|
| **Author** | @samanklesaria |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @cgarciae
> My main comment is that we should not introduce new APIs, instead we should make `sow` and `perturb` work `with capture_intermediates`

### @samanklesaria
> Note that this approach works with `vmap` when using a jax branch in which `Box` supports vmap

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
