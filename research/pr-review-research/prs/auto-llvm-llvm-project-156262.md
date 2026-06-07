# llvm/llvm-project #156262 — [VPlan] Make canonical IV part of the region

**[View PR on GitHub](https://github.com/llvm/llvm-project/pull/156262)**

| | |
|---|---|
| **Author** | @fhahn |
| **Status** | ✅ merged |
| **Opened** | 2025-08-31 |
| **Repo** | curated review-culture seed |
| **Diff** | +786 / −540 across 59 files |
| **Engagement** | 12 conversation · 599 inline review comments |

## Top review comments (ranked by reactions)

### @llvm-ci — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/156262#issuecomment-4276857629)

> LLVM Buildbot has detected a new failure on builder `openmp-offload-amdgpu-clang-flang` running on `rocm-worker-hw-01` while building `llvm` at step 3 "annotate".
> 
> Full details are available at: https://lab.llvm.org/buildbot/#/builders/67/builds/2717
> 
> <details>
> <summary>Here is the relevant piece of the build log for the reference</summary>
> 
> ```
> Step 3 (annotate) failure: 'python ../llvm.src/offload/ci/openmp-offload-amdgpu-clang-flang.py ...' (failure)
> ...
> PASS: libomp :: ompt/tasks/serialized.c (248 of 548)
> PASS: libomp :: ompt/teams/serial_teams.c (249 of 548)
> PASS: libomp :: ompt/worksharing/for/guided_serialized.c (250 of 548)
> PASS: libomp :: ompt/synchronization/nest_lock.c (251 of 548)
> PASS: libomp :: ompt/parallel/nested.c (252 of 548)
> PASS: libomp :: ompt/synchronization/test_lock.c (253 of 548)
> PASS: libomp :: ompt/misc/interoperability.cpp (254 of 548)
> PASS: libomp :: ompt/worksharing/for/runtime.c (255 of 548)
> PASS: libomp :: ompt/worksharing/for/dynamic.c (256 of 548)
> PASS: libomp :: ompt/worksharing/for/auto_serialized.c (257 of 548)
> FAIL: libarcher :: races/taskwait-depend.c (258 of 548)
> ******************** TEST 'libarcher :: races/taskwait-depend.c' FAILED ********************
> Exit Code: 1
> 
> Command Output (stdout):
> --
> # RUN: at line 14
> /home/botworker/builds/openmp-offload-amdgpu-clang-flang/build/llvm.build/./bin/clang -fopenmp  -gdwarf-4 -O1 -fsanitize=thread  -I /home/botworker/builds/openmp-offload-amdgpu-clang-flang/llvm.src/openmp/tools/archer/tests -I /home/botworker/builds/openmp-offload-amdgpu-clang-flang/build/llvm.build/runtimes/runtimes-bins/ope … *[truncated]*

### @bgra8 — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/156262#issuecomment-4372987453)

> @fhahn we (at google) have bisected a compiler assertion failure to this revision.
> 
> To reproduce build `clang` with assertions enabled at this revision and compile the following `reduced.ll` (compilation command at the end):
> 
> ```ll
> target datalayout = "e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128"
> target triple = "x86_64-unknown-linux-gnu"
> 
> define ptr @barney(i64 %arg, ptr %arg1, ptr %arg2, ptr %arg3) #0 {
> bb:
>   br label %bb4
> 
> bb4:                                              ; preds = %bb5, %bb
>   %phi = phi i64 [ 0, %bb ], [ %add, %bb5 ]
>   %icmp = icmp slt i64 %phi, %arg
>   br i1 %icmp, label %bb5, label %bb17
> 
> bb5:                                              ; preds = %bb4
>   %add = add i64 %phi, 1
>   %getelementptr = getelementptr [8 x i8], ptr %arg1, i64 %add
>   %load = load double, ptr %getelementptr, align 8
>   %getelementptr6 = getelementptr [16 x i8], ptr %arg3, i64 %add
>   %load7 = load double, ptr %getelementptr6, align 8
>   %getelementptr8 = getelementptr [16 x i8], ptr %arg3, i64 %phi
>   %load9 = load double, ptr %getelementptr8, align 8
>   %getelementptr10 = getelementptr [16 x i8], ptr %arg2, i64 %phi
>   %fsub = fsub double %load7, %load9
>   %fdiv = fdiv double 0.000000e+00, %load
>   %fmul = fmul double %fsub, %fdiv
>   call void @spam(ptr %getelementptr10, double %fmul)
>   %getelementptr11 = getelementptr i8, ptr %getelementptr6, i64 8
>   %load12 = load double, ptr %getelementptr11, align 8
>   %getelementptr13 = getelementptr i8, ptr %getelementptr8, i64 8
>   %load14 = load double, ptr %getelementptr13, align 8
>   %fsub15 = fsub double %load1 … *[truncated]*

### @fhahn — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/156262#issuecomment-4374886392)

> Thanks for the heads up, will take a look

### @bgra8 — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/156262#issuecomment-4389216207)

> @fhahn any idea what's going on here? Should we revert and investigate offline?

### @fhahn — 0 reactions  
`—`  ·  [link](https://github.com/llvm/llvm-project/pull/156262#issuecomment-4390182917)

> Should already be fixed by https://github.com/llvm/llvm-project/commit/eb899dca28677ac2e72b0a85f04e9c9d04df7bbe


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
