# google/jax #22843 — feat(lib): add real-valued implementation of `jax.scipy.special.fresnel`

**[View PR on GitHub](https://github.com/google/jax/pull/22843)**

| | |
|---|---|
| **Author** | @jeertmans |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @jakevdp
> Also, please add the new function to the documentation listing here: https://github.com/google/jax/blob/main/docs/jax.scipy.rst#jaxscipyspecial

### @jakevdp
> Once you make the last changes, please squash all changes into a single commit (see https://jax.readthedocs.io/en/latest/contributing.html#single-change-commits-and-pull-requests).

### @jakevdp
> Thanks for sticking with this PR through the many rounds of review – it will be a great addition to the JAX package!

### @jeertmans
> Even if the implementation does not support complex, it achieves an accuracy that is extremely close to that of SciPy, and I think real-valued Fresnel integrals are quite useful, especially in radio propagation research tools.

### @jeertmans
> I am of course biased as it this is my PR, but I was hoping it could be listed in the changelog, so other people might be aware that the function is now available.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
