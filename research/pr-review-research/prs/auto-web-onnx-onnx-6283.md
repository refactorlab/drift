# onnx/onnx #6283 — Add FLOAT4E2M1 support to relevant operators

**[View PR on GitHub](https://github.com/onnx/onnx/pull/6283)**

| | |
|---|---|
| **Author** | @yuanyao-nv |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @justinchuby
> Do you have plans to also push jax-ml/ml_dtypes#116 forward? If this included in ml_dyptes it would make the interop experience much better (and code run faster).

### @xadupre
> I usually look for strings such as `FLOAT8E4M3FN` and float8e4m3fn to see all the places it is used and I insert a new line to handle the new type.

### @justinchuby
> Is `float32x2` conventional naming? Should it just be `float32`?

### @justinchuby
> lintrunner errors will need to be ignore in line. For example `# noqa: PLR2004`

### @liqunfu
> A quick fix is to insert mantissa = mantissa.astype(np.float32) at onnx\numpy_helper.py before val = np.where(.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
