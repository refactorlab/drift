# tensorflow/tensorflow #93951 — build(aarch64): Update to oneDNN-3.7 + ACL-24.12 (fix)

**[View PR on GitHub](https://github.com/tensorflow/tensorflow/pull/93951)**

| | |
|---|---|
| **Author** | @Sqvid |
| **Status** | ✅ merged |
| **Opened** | 2025-05-22 |
| **Repo importance** | ★195,540 · 75,352 forks · score 501,948 |
| **Diff** | +1887 / −1199 across 25 files |
| **Engagement** | 23 conversation · 7 inline review comments |

## Top review comments (ranked by reactions)

### @penpornk — 1 reactions  
`👍 1`  ·  [link](https://github.com/tensorflow/tensorflow/pull/93951#issuecomment-3020338836)

> Sorry for the delay! We checked with our PM and they suggested that we add the AUTHORS file in a separate commit. I'll make a commit adding the file soon so you can just add the Arm entry in the file in this PR.

### @penpornk — 1 reactions  
`❤️ 1`  ·  [link](https://github.com/tensorflow/tensorflow/pull/93951#issuecomment-3201033639)

> @cfRod @Sqvid Sorry for the delay! You don't need to handle the merge conflicts as I had already imported the changes and resolved conflicts internally. The CL isn't merged yet because of some other minor issues that I needed to get some extra checks, e.g., acl_stateless_gemm_workspace.patch containing MIT license text.

### @Sqvid — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/93951#issuecomment-2901762951)

> This patch was previously accepted here
> https://github.com/tensorflow/tensorflow/pull/84975 but failed unit tests.
> The unit test failures have been fixed by the following backported patches:
> 
> The backported patchfiles are:
> 1. third_party/xla/third_party/compute_library/acl_gemm_scheduling_heuristic.patch
> 2. third_party/xla/third_party/compute_library/acl_stateless_gemm_workspace.patch
> 3. third_party/xla/third_party/mkl_dnn/onednn_acl_lock_fixed_format_matmul.patch
> 
> They were upstreamed in these locations respectively:
> 1. https://review.mlplatform.org/c/ml/ComputeLibrary/+/13200
> 2. https://review.mlplatform.org/c/ml/ComputeLibrary/+/13534
> 3. https://github.com/uxlfoundation/oneDNN/pull/3220

### @Sqvid — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/93951#issuecomment-2901788865)

> @penpornk Could you please have a look? I have run it against `test:linux_arm64_wheel_test`. Please let me know if this is wide enough coverage. Thank you.

### @Sqvid — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/93951#issuecomment-2901907353)

> The tests that were previously failing are fixed:
> ```
> INFO: Build completed successfully, 1032 total actions
> //tensorflow/python/kernel_tests/nn_ops:conv_ops_test_cpu        (cached) PASSED in 8.3s
>   Stats over 4 runs: max = 8.3s, min = 7.3s, avg = 7.6s, dev = 0.4s
> //tensorflow/tools/proto_splitter/cc:util_test                           PASSED in 0.7s
> 
> Executed 1 out of 2 tests: 2 tests pass.
> ```
> 
> When I ran the full `linux_arm64_wheel_test` config I found the following failing tests:
> ```
> //tensorflow/python/kernel_tests/distributions:special_math_test_cpu  FAILED
> //tensorflow/python/kernel_tests/math_ops:topk_op_test_cpu  FAILED
> //tensorflow/compiler/tests:sort_ops_test_cpu  FAILED
> //tensorflow/compiler/tests:sort_ops_test_cpu_mlir_bridge_test  FAILED
> //tensorflow/python/distribute/failure_handling:failure_handler_test (8/9 cached) FLAKY
> ``` 
> Though these seemed to fail on the base commit on `master` as well. Please advise if this is indeed expected. Thanks.

### @Sqvid — 0 reactions  
`—`  ·  [link](https://github.com/tensorflow/tensorflow/pull/93951#issuecomment-2943334990)

> Hi, could I request a look at this PR please. Thank you.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
