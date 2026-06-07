# ziglang/zig #20511 — runtime page size detection + rework GeneralPurposeAllocator to reduce active mapping count + Allocator VTable API update

**[View PR on GitHub](https://github.com/ziglang/zig/pull/20511)**

| | |
|---|---|
| **Author** | @archbirdplus |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @notcancername
> These `else` prongs in `heap.zig` worry me, it seems too easy to add an architecture and have an incorrect page size set as default. I think a compile error would be more appropriate.

### @notcancername
> Yes, `page_size` should match all current CPU architectures, so that when a new architecture is added, the implementer gets a compile error when code tries to access `page_size`.

### @notcancername
> Also, I think it would be good if `pageSize` was marked `inline` to propagate the comptime-ness of the result.

### @archbirdplus
> I would like to ban the use of this function in comptime-dependent cases, demanding that the user prove that pageSize will be comptime (in which case they should use page_size instead). But sniffing for comptime is a bug, not a feature.

### @archbirdplus
> Since inlining has no semantic difference, I'll inline it anyways.

### @rootbeer
> I suspect this is from using a too-recent wasmtime, and downgrading to v10.0.2 (which is the version CI runs) will fix it.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
