# gfx-rs/wgpu #5701 — feat: implement F16 support in shaders

**[View PR on GitHub](https://github.com/gfx-rs/wgpu/pull/5701)**

| | |
|---|---|
| **Author** | @FL33TW00D |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @teoxoy
> One thing I'm concerned is that the polyfills we have in some of the backends might not support `f16`. It would be worth adding more tests covering the built-in functions and operations that support `f16`.

### @teoxoy
> Validate out `f16` inside push constants

### @ErichDonGubler
> Can you please post the Git history for `half-2`...the commit hash...is not accessible from the `starkat99` or `FL33TWOOD` repos

### @teoxoy
> Execution tests would be great as well, they live in `tests/tests/shader`

### @cwfitzgerald
> All comments should be addressed

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
