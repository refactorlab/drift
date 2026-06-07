# google/flax #3922 — Support direct quantization for FP8 matmul

**[View PR on GitHub](https://github.com/google/flax/pull/3922)**

| | |
|---|---|
| **Author** | @wenscarl |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @kaixih
> I feel it would be better to write the code like: qx = in_quant(x, ...) # which also includes the amax math qk = in_quant(k, ...) y = dot_general_and_dequant(qx, qk)

### @kaixih
> I think the new design is much clearer of the idea of direct quantization. By the way, do you think we should create a new Fp8DotGeneral op for it and keep the existing fake quant Op untouched?

### @levskaya
> The JAX team really doesn't like us depending on their internal implementations. Could we inline this function logic here to make this free-standing?

### @levskaya
> Sorry we block if trailing spaces are left in the file, there's some after the line `class Fp8Test(parameterized.TestCase):`

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
