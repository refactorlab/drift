# ml-explore/mlx #1325 — Custom Metal Kernels from Python

**[View PR on GitHub](https://github.com/ml-explore/mlx/pull/1325)**

| | |
|---|---|
| **Author** | @barronalex |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @angeloskath
> Although I see why this would be so much nicer and I am not sure we should change it I have to point out that it deviates from the rest of the C++ API which takes vectors of arrays.

### @awni
> I guess maybe a better question is what do you do if you want to use the same kernel with outputs with different shapes? Do you make a new MetalKernel in that case?

### @awni
> it feels a bit more intuitive from a usage standpoint based on the way one typically builds and runs a kernel...Would it be potentially more scalable if the source is quite long?

### @angeloskath
> If I had to guess of a principled way of printing the kernel then I would make verbose to be of type std::optional<std::ostream>

### @awni
> it might be better to expose this as a function in the C++ API as it will simplify binding code. O/w we have to bind this class

### @awni
> Note we may need to rearrange the internals a bit in fast.h to make it easy to bind to MLX C but that is mostly an implementation detail.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
