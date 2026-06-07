# bevyengine/bevy #18670 — Remote entity reservation v9

**[View PR on GitHub](https://github.com/bevyengine/bevy/pull/18670)**

| | |
|---|---|
| **Author** | @ElliottjPierce |
| **Status** | ✅ merged · 🎉7 |
| **Source** | GitHub conversation page (fetched via web, bypassing the API rate limit) |

## 🧠 Why the review here is valuable

> For a perf PR: demand the benchmark baseline be merged *first*, name the exact operation to bench, and read the honest trade-off (despawn got slower, but worth it). And catch the missed rename while you're there.

## Valuable review comments (verbatim excerpts)

*Quoted as rendered on the PR conversation page; emphasis on the substantive review prose, not celebration.*

**@alice-i-cecile:**
> I prefer the second more realistic and robust option. Do merge the benchmarks in a separate pr first though to give us a baseline!

**@cart:**
> Yeah I think benching world.entities_allocator().alloc() (and remote_alloc) under different conditions is the correct way to benchmark what we care about here.

**@cart:**
> Also we should really rename world.entities_allocator() to world.entity_allocator(). We missed that when we renamed EntitiesAllocator to EntityAllocator.

**@cart:**
> The 'free' op (and therefore despawn) has definitely taken the biggest hit. But not to a worrying degree relative to what we gain.


---
*Collected via web fetch of the public GitHub PR page (no API token, no rate-limit budget used).*
