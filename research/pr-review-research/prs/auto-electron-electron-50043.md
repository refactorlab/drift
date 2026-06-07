# electron/electron #50043 — feat: capture JS stack trace on renderer OOM

**[View PR on GitHub](https://github.com/electron/electron/pull/50043)**

| | |
|---|---|
| **Author** | @alexkozy |
| **Status** | ✅ merged |
| **Opened** | 2026-03-03 |
| **Repo importance** | ★121,543 · 17,236 forks · score 195,486 |
| **Diff** | +442 / −6 across 10 files |
| **Engagement** | 22 conversation · 32 inline review comments |

## Top review comments (ranked by reactions)

### @nikwen — 1 reactions  
`👍 1`  ·  [link](https://github.com/electron/electron/pull/50043#issuecomment-4004920617)

> You will also need to sign your commits. Otherwise, we can't merge them.

### @nikwen — 1 reactions  
`👍 1`  ·  [link](https://github.com/electron/electron/pull/50043#issuecomment-4006469124)

> Thanks for the changes and for signing your commits!
> 
> Looks like there is still a small linter error:
> 
> ```patch
> --- a/shell/renderer/oom_stack_trace.cc
> +++ b/shell/renderer/oom_stack_trace.cc
> @@ -95,10 +95,9 @@
>  
>    v8::HeapStatistics stats;
>    isolate->GetHeapStatistics(&stats);
> -  std::string heap_info =
> -      absl::StrFormat("Heap: used=%.1fMB limit=%.1fMB",
> -                      stats.used_heap_size() / 1048576.0,
> -                      stats.heap_size_limit() / 1048576.0);
> +  std::string heap_info = absl::StrFormat("Heap: used=%.1fMB limit=%.1fMB",
> +                                          stats.used_heap_size() / 1048576.0,
> +                                          stats.heap_size_limit() / 1048576.0);
>    fprintf(stderr, "\n<--- Near heap limit --->\n%s\n", heap_info.c_str());
>    fflush(stderr);
> ```

### @deepak1556 — 1 reactions  
`👀 1`  ·  [link](https://github.com/electron/electron/pull/50043#issuecomment-4195197819)

> I know that @ckerr is currently performing a raw_ptr cleanup of the codebase, my gut feeling is that we are going to hit a dangling ptr check for `raw_ptr<v8::Isolate>` in the `OOMState` for the main thread given we are not releasing till the thread is torn down. You can build with the following flags to confirm, 
> 
> ```
> enable_dangling_raw_ptr_checks = true
> enable_dangling_raw_ptr_feature_flag = true
> enable_backup_ref_ptr_support = true
> enable_backup_ref_ptr_feature_flag = true
> ```

### @alexkozy — 1 reactions  
`👍 1`  ·  [link](https://github.com/electron/electron/pull/50043#issuecomment-4196041551)

> Applied the fix for dangling pointer using DisposeObserver, yet to confirm locally after the full rebuild.

### @alexkozy — 0 reactions  
`—`  ·  [link](https://github.com/electron/electron/pull/50043#issuecomment-4038312521)

> @deepak1556 this change will help us a lot on our side to investigate ooms. I would really appreciate review.

### @deepak1556 — 0 reactions  
`—`  ·  [link](https://github.com/electron/electron/pull/50043#issuecomment-4044994010)

> Apologies for the delay, taking a look now.


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
