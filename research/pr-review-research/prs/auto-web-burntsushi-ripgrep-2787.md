# BurntSushi/ripgrep #2787 — Set up ripgrep for compilation on non-unix, non-windows platforms

**[View PR on GitHub](https://github.com/BurntSushi/ripgrep/pull/2787)**

| | |
|---|---|
| **Author** | @holzschu |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @blyxxyz
> The WASI spec seems to ban absolute paths and the stdlib doesn't implement `canonicalize`. I don't know how black-and-white this is (especially in the long term) but right now this might as well be stubbed out with `None`.

### @BurntSushi
> I'm not a huge fan of giving wrong answers like this. And it seems like WASI can't really support hyperlinks anyway, due to the ban on absolute paths. So I think this change should probably be reverted.

### @BurntSushi
> My main objection was to silently using a potentially incorrect value. I'm open to doing that in the future to get hyperlinks working in WASI after we've considered the possible alternatives.

### @BurntSushi
> Did running tests via `wasmtime` fail? If so this is fine, but if they worked, then we should just include them here.

### @BurntSushi
> To be consistent with other log messages, could you please use 'hyperlinks' instead of 'Hyperlinks'?

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
