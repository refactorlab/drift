# google/jax #28810 — added solve_sylvester and accompanying tests

**[View PR on GitHub](https://github.com/google/jax/pull/28810)**

| | |
|---|---|
| **Author** | @Dekermanjian |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jakevdp
> Thanks for the contribution! In order to land this in JAX it will have to be substantially modified – please start by addressing the comments below, and then we can iterate from there.

### @jakevdp
> Also, to ensure this appears in docs, we'll need to add this new API to the list here: [jax/docs/jax.scipy.rst]

### @jakevdp
> Hmm, a scan with a length equal to the size of the matrix is going to be very slow, especially on accelerators where each scan iteration requires a kernel launch.

### @jakevdp
> That would be a great solution I think. We'd have to make sure to provide enough documentation to let the user make an informed choice of the setting.

### @jakevdp
> We do expect different results on different backends. Some of this will be just standard differences in floating point rounding, while some would stem from the default matrix multiplication precision.

### @jakevdp
> One thing to try would be to make sure the GPU tests are run with `@jax.default_matmul_precision("float32")`, because the default on most hardware is much less precise.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
