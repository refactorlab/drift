# tensorflow/tensorflow #62883 — [oneDNN] Add oneDNN version of SparseMatrixMatMul

**[View PR on GitHub](https://github.com/tensorflow/tensorflow/pull/62883)**

| | |
|---|---|
| **Author** | @matthew-olson-intel |
| **Status** | ✅ merged |
| **Opened** | 2024-02-01 |
| **Repo importance** | ★195,540 · 75,352 forks · score 501,948 |
| **Diff** | +969 / −90 across 18 files |
| **Engagement** | 17 conversation · 30 inline review comments |

## Top review comments (ranked by reactions)

### @matthew-olson-intel — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/62883#issuecomment-1936231426)

> > Could you please help make more changes? There are some more errors.
> 
> Sure. Sorry, didn't see those errors in my local tests, and I didn't see which target in the CI threw those errors.

### @matthew-olson-intel — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/62883#issuecomment-1942545906)

> I think I've made all of the appropriate changes; @cantonios @penpornk does this look OK to you?

### @matthew-olson-intel — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/62883#issuecomment-1944542258)

> @cantonios Made that change, and I think the current "Presubmit" test failure is unrelated to this PR.

### @matthew-olson-intel — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/62883#issuecomment-1944858230)

> @cantonios I can see that some internal checks failed, but can't see what they are.

### @cantonios — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/62883#issuecomment-1944865465)

> > @cantonios I can see that some internal checks failed, but can't see what they are.
> 
> ```
> ERROR: tensorflow/core/kernels/mkl/BUILD:104:22: in cc_library rule //tensorflow/core/kernels/mkl:mkl_sparse_matrix_matmul_op: Visibility error:
> target '//tensorflow/core/kernels/sparse:mat_mul_op.h' is not visible from
> target '//tensorflow/core/kernels/mkl:mkl_sparse_matrix_matmul_op'
> ```

### @matthew-olson-intel — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/62883#issuecomment-1944983646)

> > > @cantonios I can see that some internal checks failed, but can't see what they are.
> > 
> > ```
> > ERROR: tensorflow/core/kernels/mkl/BUILD:104:22: in cc_library rule //tensorflow/core/kernels/mkl:mkl_sparse_matrix_matmul_op: Visibility error:
> > target '//tensorflow/core/kernels/sparse:mat_mul_op.h' is not visible from
> > target '//tensorflow/core/kernels/mkl:mkl_sparse_matrix_matmul_op'
> > ```
> 
> Is it possible to get a commandline reproducer for this error? Can't reproduce locally, so fixing it might be trial-and-error that spams this PR with commits and spams you with emails!


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
