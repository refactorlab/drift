# ziglang/zig #20271 — ZON by MasonRemaley

**[View PR on GitHub](https://github.com/ziglang/zig/pull/20271)**

| | |
|---|---|
| **Author** | @MasonRemaley |
| **Status** | Merged (February 3, 2025) |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @mlugg
> Regarding `&` in ZON... You're correct that ZON definitely shouldn't include this. Our main use of ZON today (`build.zig.zon`) already creates variable-length structures without this syntax. To avoid a divergence between ZON you can `@import` and `build.zig.zon`, I would consider this a merge blocker, but that's Andrew's call of course.

### @mlugg
> Implementation-wise, the ZIR instruction corresponding to `@import` should be modified to provide a result type if one is present (you can use `.none` to represent the case where there isn't one). Then, the ZON analysis logic should traverse into this result type as needed.

### @mlugg
> By the way, in case you're unfamiliar with the `AstGen` code, you'll just want `try rl.ri.resultType(gz, node) orelse .none` in the corresponding case in `AstGen.builtinCall`.

### @mlugg
> Since the operand **must** be a string literal, it's just a waste of bytes and time to use `expr` to actually create a `str` instruction. So, you shouldn't use `Zir.Inst.Bin` as the payload here -- instead, create a new payload type.

### @mlugg
> You probably just need to clear your cache directory -- ZIR is cached based on `zig version`, so if you haven't created a commit with your changes, the compiler will use the old cached ZIR!

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
