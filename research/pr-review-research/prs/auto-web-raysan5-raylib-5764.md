# raysan5/raylib #5764 — [build.zig] Refactor

**[View PR on GitHub](https://github.com/raysan5/raylib/pull/5764)**

| | |
|---|---|
| **Author** | @HaxSam |
| **Status** | Merged |
| **Source** | GitHub conversation page (fetched via web, no API token) |

## Top review comments (most substantive, verbatim)

### @Not-Nik
> Big patch, and I didn't have time to go over it thoroughly, but I feel there is a lot of redundant code...Maybe we can have an array of link requirements that is set in the big switch and then applied afterwards.

### @Not-Nik
> Code readability is already acceptable overall though, so a (hesitant, because first sentence) r+.

### @CrackedPixel
> the build fails. i removed `.lazy = true` to get around it...zig 0.16.0...error: no module named 'zemscripten' available within module 'root.@build'

### @CrackedPixel
> it did not like to build the `opengl_interop` example, i removed the examples to get around it. if possible, this specific example should be skipped on mac

### @raysan5
> I prefer more redundant code if it is more simple and every platform is kind-of self-contained...I prefer to discretize directly per platform, even if there is duplicate code.

---
*Collected via parallel web fetch of the public GitHub PR page (no token, no API rate-limit budget used).*
