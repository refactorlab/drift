# ziglang/zig #23441 — std.os.uefi.tables: ziggify boot and runtime services

**[View PR on GitHub](https://github.com/ziglang/zig/pull/23441)**

| | |
|---|---|
| **Author** | @dotcarmen |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @truemedian
> A few minor nitpicks, but since we're overhauling boot services it's time we remove `[*]MemoryDescriptor` and `[]MemoryDescriptor` from std.os.uefi, they are never valid because the size of the zig struct is almost never the size of the descriptor the firmware returns.

### @truemedian
> The standard describes an event registration as a `VOID*`, and the standard provides absolutely no methods to operate on the registration value other than passing around the `VOID*`, so I say it makes no sense to change this from a `*opaque{}`.

### @dotcarmen
> afaict this was a bug 😬 `exit_data.len` for number of u16s but the spec says it's the number of _bytes_

### @linusg
> Not a thorough review, LGTM at a high level

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
