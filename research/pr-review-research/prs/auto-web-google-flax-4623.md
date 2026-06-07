# google/flax #4623 — Implemented spectral norm in NNX

**[View PR on GitHub](https://github.com/google/flax/pull/4623)**

| | |
|---|---|
| **Author** | @mattbahr |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @h-0-0
> I'm getting an UnexpectedTracerError... I think it may have to do with changing the state variable inside the spectral_normalize function which is out of scope.

### @mattbahr
> Could you send your code you used to get the UnexpectedTracerError?... my implementation was based in part on the weight norm implementation in #4568.

### @h-0-0
> By the way if you run the above code but swap SpectralNorm for WeightNorm from #4568 you get the same error.

### @vfdev-5
> Please also add entries to update the docs: [normalization.rst documentation reference]

### @vfdev-5
> Can you please split this PR into two: one for Instance norm and another one for spectral norm. I think we can make instance norm merged quickly.

### @vfdev-5
> Should we check for the type of layer_instance? It should be a subclass of nnx.Module to have parameters and be callable.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
