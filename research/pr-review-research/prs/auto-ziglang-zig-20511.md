# ziglang/zig #20511 — runtime page size detection + rework GeneralPurposeAllocator to reduce active mapping count + Allocator VTable API update

**[View PR on GitHub](https://github.com/ziglang/zig/pull/20511)**

| | |
|---|---|
| **Author** | @archbirdplus |
| **Status** | ✅ merged |
| **Opened** | 2024-07-06 |
| **Repo** | curated review-culture seed |
| **Diff** | +2981 / −2710 across 44 files |
| **Engagement** | 46 conversation · 114 inline review comments |

## Top review comments (ranked by reactions)

### @andrewrk — 8 reactions  
`❤️ 6 · 🎉 2`  ·  [link](https://github.com/ziglang/zig/pull/20511#issuecomment-2638356298)

> # Release Notes
> 
> ## Runtime Page Size
> 
> First, this removes comptime-known `std.mem.page_size`, which is a nonsensical concept since the page size is in fact runtime-known (sorry about that), and replaces it with `std.heap.page_size_min` and `std.heap.page_size_max` for comptime-known bounds of possible page sizes. Uses of `std.mem.page_size` in pointer alignment properties, such as in mmap, are migrated to `std.heap.page_size_min`.
> 
> In places where the page size must be used, `std.heap.pageSize()` provides the answer. It will return a comptime-known value if possible, otherwise querying the operating system at runtime, and memoizing the result (atomically, of course). It also has a `std.options` integration so the application maintainer has the ability to override this behavior.
> 
> ## GeneralPurposeAllocator
> 
> This created a problem for `GeneralPurposeAllocator`, since it relied on a compile-time known page size. Using `page_size_max` instead worked, but the allocator's design relies on being able to ask for page-aligned allocations from the backing allocator. With `page_size_max` this might be greater than the actual runtime page size, something that `std.heap.page_allocator` did not support.
> 
> However, it *used* to support that, so I restored that behavior. `std.heap.page_allocator` thus now supports arbitrary alignments.
> 
> At the same time, another issue cropped up recently where we observe this allocator to have too many active memory mappings. This is solved by increasing effective page size, so using `page_size_max` was an improvement, and I also made it use a minimum of 1 … *[truncated]*

### @andrewrk — 6 reactions  
`👍 5 · 😄 1`  ·  [link](https://github.com/ziglang/zig/pull/20511#issuecomment-2455504360)

> @RossComputerGuy please do not ask other contributors to rebase their code.
> 
> @archbirdplus you do not need to rebase. This is waiting only on me to review and merge. Furthermore, since @alexrp already accepted it, if I find any issues, I will simply address them myself while merging.

### @andrewrk — 6 reactions  
`❤️ 5 · 🚀 1`  ·  [link](https://github.com/ziglang/zig/pull/20511#issuecomment-2638184170)

> final score:
> 
> ```
> Benchmark 1 (3 runs): stage4/bin/zig ast-check ../lib/compiler_rt/udivmodti4_test.zig
>   measurement          mean ± σ            min … max           outliers         delta
>   wall_time          22.8s  ±  184ms    22.6s  … 22.9s           0 ( 0%)        0%
>   peak_rss           58.6MB ± 77.5KB    58.5MB … 58.6MB          0 ( 0%)        0%
>   cpu_cycles         38.1G  ± 84.7M     38.0G  … 38.2G           0 ( 0%)        0%
>   instructions       27.7G  ± 16.6K     27.7G  … 27.7G           0 ( 0%)        0%
>   cache_references   1.08G  ± 4.40M     1.07G  … 1.08G           0 ( 0%)        0%
>   cache_misses       7.54M  ± 1.39M     6.51M  … 9.12M           0 ( 0%)        0%
>   branch_misses       165M  ±  454K      165M  …  166M           0 ( 0%)        0%
> Benchmark 2 (3 runs): /home/andy/src/zig/build-release/stage4/bin/zig ast-check ../lib/compiler_rt/udivmodti4_test.zig
>   measurement          mean ± σ            min … max           outliers         delta
>   wall_time          20.5s  ± 95.8ms    20.4s  … 20.6s           0 ( 0%)        ⚡- 10.1% ±  1.5%
>   peak_rss           54.9MB ±  303KB    54.6MB … 55.1MB          0 ( 0%)        ⚡-  6.2% ±  0.9%
>   cpu_cycles         34.8G  ± 85.2M     34.7G  … 34.9G           0 ( 0%)        ⚡-  8.6% ±  0.5%
>   instructions       25.2G  ± 2.21M     25.2G  … 25.2G           0 ( 0%)        ⚡-  8.8% ±  0.0%
>   cache_references   1.02G  ±  195M      902M  … 1.24G           0 ( 0%)          -  5.8% ± 29.0%
>   cache_misses       4.57M  ±  934K     3.93M  … 5.64M           0 ( 0%)        ⚡- 39.4% ± 35.6%
>   branch_misses       142M  ±  183K … *[truncated]*

### @archbirdplus — 2 reactions  
`👍 2`  ·  [link](https://github.com/ziglang/zig/pull/20511#issuecomment-2357617061)

> Alright. If we care at all about GPA/`mmap` on freestanding+libc (which some people apparently do use), I'll do the following:
> * introduce `has_page_size_bounds`
> * introduce `min_page_alignment`, which falls back to 1 if `min_page_size` would error
> * let GPA fall back to 4K bucket size if there is no `max_page_size`
> 
> That would let us keep our page-aligned pointers and avoid breaking GPA needlessly.
> 
> Limiting the bucket classes for GPA will cause fragmentation for certain large objects, but otherwise has less overhead compared to dynamically allocating the exact number of buckets. I would leave optimizing the freestanding case for a subsequent PR if needed.

### @pfgithub — 2 reactions  
`👍 2`  ·  [link](https://github.com/ziglang/zig/pull/20511#issuecomment-2360184218)

> GPA is backed by backing_allocator, which defaults to page_allocator. A freestanding user could initialize a GPA with a custom backing allocator that doesn't use `std.posix.mmap`.
> 
> To support freestanding std.heap.pageSize, an item field could be added to std.Options: `query_page_size: fn() usize = std.heap.defaultQueryPageSize`, and `std.heap.pageSize()` can call `std.options.query_page_size()` instead of `queryPageSize()`

### @alexrp — 2 reactions  
`👍 2`  ·  [link](https://github.com/ziglang/zig/pull/20511#issuecomment-2384356576)

> Just to make sure I correctly understand the motivation for the latest commits: The issue is that there's no page size defined for `freestanding`/`other`, which means we'll get compile errors in the GPA implementation (and probably other places), and these changes provide a minimum viable fallback for that case, right?
> 
> Assuming my understanding is correct, and assuming that this is the only motivation for these changes, then I would instead suggest just doing what @pfgithub suggested. It's a much smaller change and keeps the `std.heap` API simple.
> 
> Basically, you just add a few fields to `std.Options` looking something like this:
> 
> ```zig
> pub const Options = struct {
>     // ...
> 
>     min_page_size: ?usize = null,
>     max_page_size ?usize = null,
>     query_page_size: fn () usize = heap.defaultQueryPageSize,
> 
>     // ...
> };
> ```
> 
> Now you change the `std.heap.(min,max)_page_size` definitions to prefer `std.options.(min,max)_page_size` if non-null, and otherwise use the usual arch/OS logic, and fall back to a compile error. (Bonus points for making the compile error point to these `std.Options` fields in the `freestanding`/`other` cases so users know what to do in that case.)
> 
> Then you rename `std.heap.queryPageSize()` to `defaultQueryPageSize()` and make it `pub`. Finally, you change the `std.heap.pageSize()` implementation to call `std.options.query_page_size` instead of calling `defaultQueryPageSize()` directly. (Again, bonus points for making the compile error more helpful in the `freestanding`/`other` cases.)
> 
> And that should be it, I think. Now programmers targeting `freesta … *[truncated]*


---
*Collected automatically by `collect.ts` (no token, rate-limit-aware). Reaction counts are a snapshot at collection time.*
